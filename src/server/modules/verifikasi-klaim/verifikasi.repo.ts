import "server-only";
import type { KlaimTindakLanjut } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import {
  labelAksi,
  SASARAN_TINDAK_LANJUT,
  STATUS_TINDAK_LANJUT,
  STATUS_VERIFIKASI,
  type SasaranTindakLanjut,
  type StatusTindakLanjut,
  type StatusVerifikasi,
} from "./verifikasi.constants";
import { labelAturan, PREFIKS_MANUAL } from "./verifikasi.rules";
import type { RiwayatItem, TindakLanjutItem } from "./verifikasi.types";

/**
 * Repository DB aplikasi `reporthub` (READ-WRITE) untuk modul Verifikasi Klaim.
 * Tidak pernah menyentuh SIMGOS. Pencarian massal memakai `IN` pada kolom unik /
 * terindeks (`klaim_verifikasi.nopen`, `klaim_tindak_lanjut.nopen`, `bukti_pelayanan.nopen`).
 * Penulisan (keputusan, tindak lanjut) dilakukan service di dalam transaksi.
 */

export type StatusTersimpan = { status: StatusVerifikasi; versi: number };

const STATUS_SET = new Set<string>(STATUS_VERIFIKASI);
const asStatus = (s: string | null): StatusVerifikasi | null => (s && STATUS_SET.has(s) ? (s as StatusVerifikasi) : null);

/** Status tersimpan per NOPEN. NOPEN tanpa baris = BELUM_DIPERIKSA (lazy). */
export async function findStatusByNopens(nopens: readonly string[]): Promise<Map<string, StatusTersimpan>> {
  if (nopens.length === 0) return new Map();
  const rows = await getAppDb().klaimVerifikasi.findMany({
    where: { nopen: { in: [...nopens] } },
    select: { nopen: true, status: true, versi: true },
  });
  const out = new Map<string, StatusTersimpan>();
  for (const r of rows) {
    // Nilai di luar katalog (data rusak) diabaikan → tampil sebagai belum diperiksa.
    const status = asStatus(r.status);
    if (status) out.set(r.nopen, { status, versi: r.versi });
  }
  return out;
}

/** NOPEN yang Bukti Pelayanan-nya sudah diisi di aplikasi. */
export async function findBuktiNopens(nopens: readonly string[]): Promise<Set<string>> {
  if (nopens.length === 0) return new Set();
  const rows = await getAppDb().buktiPelayanan.findMany({
    where: { nopen: { in: [...nopens] } },
    select: { nopen: true },
  });
  return new Set(rows.map((r) => r.nopen));
}

/* ----------------------------------------------------------------- riwayat */

export async function findRiwayat(nopen: string, take = 100): Promise<RiwayatItem[]> {
  const rows = await getAppDb().klaimVerifikasiRiwayat.findMany({
    where: { nopen },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    aksi: r.aksi,
    label: labelAksi(r.aksi),
    dariStatus: asStatus(r.dariStatus),
    keStatus: asStatus(r.keStatus),
    versi: r.versi,
    catatan: r.catatan,
    data: (r.data as Record<string, unknown> | null) ?? null,
    olehNama: r.olehNama,
    createdAt: r.createdAt.toISOString(),
  }));
}

/* ----------------------------------------------------------- tindak lanjut */

const SASARAN_SET = new Set<string>(SASARAN_TINDAK_LANJUT);
const STATUS_TL_SET = new Set<string>(STATUS_TINDAK_LANJUT);

export function keTindakLanjutItem(r: KlaimTindakLanjut): TindakLanjutItem {
  return {
    id: r.id,
    nopen: r.nopen,
    aturan: r.aturan,
    label: labelAturan(r.aturan),
    pesan: r.pesan,
    sasaranJenis: (SASARAN_SET.has(r.sasaranJenis) ? r.sasaranJenis : "PERAN") as SasaranTindakLanjut,
    sasaranRef: r.sasaranRef,
    sasaranNama: r.sasaranNama,
    status: (STATUS_TL_SET.has(r.status) ? r.status : "OPEN") as StatusTindakLanjut,
    catatan: r.catatan,
    dibuatOlehNama: r.dibuatOlehNama,
    createdAt: r.createdAt.toISOString(),
    selesaiAt: r.selesaiAt?.toISOString() ?? null,
    selesaiCara: r.selesaiCara,
    selesaiOlehNama: r.selesaiOlehNama,
    manual: r.aturan.startsWith(PREFIKS_MANUAL),
  };
}

/** Semua item satu berkas: terbuka dulu, lalu terbaru. */
export async function findTindakLanjut(nopen: string): Promise<TindakLanjutItem[]> {
  const rows = await getAppDb().klaimTindakLanjut.findMany({ where: { nopen }, orderBy: { createdAt: "desc" } });
  return rows.map(keTindakLanjutItem).sort((a, b) => Number(b.status === "OPEN") - Number(a.status === "OPEN"));
}

/** Jumlah item terbuka & total per NOPEN (untuk daftar antrean). */
export async function hitungTindakLanjut(nopens: readonly string[]): Promise<Map<string, { open: number; total: number }>> {
  if (nopens.length === 0) return new Map();
  const rows = await getAppDb().klaimTindakLanjut.groupBy({
    by: ["nopen", "status"],
    where: { nopen: { in: [...nopens] }, status: { not: "BATAL" } },
    _count: { _all: true },
  });
  const out = new Map<string, { open: number; total: number }>();
  for (const r of rows) {
    const x = out.get(r.nopen) ?? { open: 0, total: 0 };
    x.total += r._count._all;
    if (r.status === "OPEN") x.open += r._count._all;
    out.set(r.nopen, x);
  }
  return out;
}

/** Item OTOMATIS (bukan cek manual) yang masih terbuka — kandidat penutupan otomatis. */
export async function findTindakLanjutOtomatisOpen(nopens: readonly string[]) {
  if (nopens.length === 0) return [];
  return getAppDb().klaimTindakLanjut.findMany({
    where: { nopen: { in: [...nopens] }, status: "OPEN", NOT: { aturan: { startsWith: PREFIKS_MANUAL } } },
    select: { id: true, nopen: true, aturan: true },
  });
}

/** NOPEN (dari daftar) yang masih punya item tindak lanjut terbuka. */
export async function findNopenDenganTlOpen(nopens: readonly string[]): Promise<Set<string>> {
  if (nopens.length === 0) return new Set();
  const rows = await getAppDb().klaimTindakLanjut.findMany({
    where: { nopen: { in: [...nopens] }, status: "OPEN" },
    select: { nopen: true },
    distinct: ["nopen"],
  });
  return new Set(rows.map((r) => r.nopen));
}
