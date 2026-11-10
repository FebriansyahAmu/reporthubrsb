import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { writeAudit } from "@/server/lib/audit";
import { ConflictError, NotFoundError, ServiceUnavailableError, ValidationError } from "@/server/lib/errors";
import { asalPublik } from "@/server/lib/public-origin";
import { qrSvgDataUri } from "@/server/lib/qr";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";
import type { RuanganOption } from "@/server/modules/kunjungan/kunjungan.types";
import { formatKode } from "@/features/form-rm/ttd-siaga/kode-pasang";
import {
  JALUR_TTD_SIAGA,
  type KodePasangDto,
  type OpsiRuanganPerangkat,
  type PerangkatTtdDto,
  type StatusPasang,
} from "@/features/form-rm/ttd-siaga/types";
import { hubTtd } from "./hub";
import { kodePasang } from "./kode-pasang.store";
import { permintaanTtd } from "./permintaan.hub";
import type { BuatPerangkatInput, UbahPerangkatInput } from "./perangkat.schema";
import { lupakanGanda } from "./perangkat.sesi";

/**
 * Registri perangkat TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md §5.1, §5.7,
 * §7.5). Hanya DB `reporthub`; SIMGOS hanya DIBACA untuk nama ruangan.
 * Kolom kredensial tidak pernah keluar dari modul ini (DTO eksplisit).
 */

export type AktorPerangkat = { id: string; nama: string; ip: string | null };

const PILIH = {
  id: true,
  nama: true,
  ruanganId: true,
  tokenHash: true, // hanya untuk menurunkan status; TIDAK masuk DTO
  aktif: true,
  dipasangAt: true,
  terakhirAktifAt: true,
  dicabutAt: true,
  createdAt: true,
} as const;

type BarisPerangkat = {
  id: string;
  nama: string;
  ruanganId: string | null;
  tokenHash: string | null;
  aktif: boolean;
  dipasangAt: Date | null;
  terakhirAktifAt: Date | null;
  dicabutAt: Date | null;
  createdAt: Date;
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function statusDari(r: BarisPerangkat): StatusPasang {
  if (!r.aktif) return "DICABUT";
  return r.tokenHash ? "TERPASANG" : "BELUM";
}

function keDto(r: BarisPerangkat, namaRuangan: ReadonlyMap<string, string>): PerangkatTtdDto {
  return {
    id: r.id,
    nama: r.nama,
    ruanganId: r.ruanganId,
    ruanganNama: r.ruanganId ? (namaRuangan.get(r.ruanganId) ?? null) : null,
    status: statusDari(r),
    terhubung: r.aktif && r.tokenHash !== null && hubTtd.terhubung(r.id),
    dipasangAt: iso(r.dipasangAt),
    terakhirAktifAt: iso(r.terakhirAktifAt),
    dicabutAt: iso(r.dicabutAt),
    kodeSampai: kodePasang.sampaiAktif(r.id),
    dibuatAt: r.createdAt.toISOString(),
  };
}

const isUnik = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
const NAMA_BENTROK = "Nama perangkat sudah dipakai perangkat lain.";

/** Ruangan pelayanan SIMGOS (read-only). Gagal → `null` (pemanggil memutuskan). */
async function ruanganSimgos(): Promise<RuanganOption[] | null> {
  try {
    return await getRuanganKunjunganList();
  } catch (err) {
    console.error("[ttd-siaga] gagal membaca ruangan SIMGOS:", (err as Error)?.message);
    return null;
  }
}

async function petaNamaRuangan(): Promise<Map<string, string>> {
  const rooms = await ruanganSimgos();
  return new Map((rooms ?? []).map((r) => [r.id, r.nama]));
}

let cacheRuangan: { peta: Map<string, string>; sampai: number } | null = null;

/** Nama ruangan untuk label lokasi di pemilih petugas — disimpan 5 menit (SIMGOS dibaca jarang). */
export async function petaNamaRuanganTersimpan(): Promise<Map<string, string>> {
  if (cacheRuangan && cacheRuangan.sampai > Date.now()) return cacheRuangan.peta;
  const rooms = await ruanganSimgos();
  const peta = new Map((rooms ?? []).map((r) => [r.id, r.nama]));
  if (rooms) cacheRuangan = { peta, sampai: Date.now() + 5 * 60_000 };
  return peta;
}

/** Opsi lokasi untuk form pengelola; SIMGOS tak tersedia → daftar kosong. */
export async function opsiRuanganPerangkat(): Promise<OpsiRuanganPerangkat[]> {
  return ((await ruanganSimgos()) ?? []).map((r) => ({ id: r.id, nama: r.nama, kategori: r.kategori }));
}

/**
 * Tulis: ruangan WAJIB ada di daftar SIMGOS. SIMGOS tak terjangkau → 503
 * (gagal tertutup, bukan menyimpan ID yang tak terverifikasi).
 */
async function pastikanRuangan(ruanganId: string | null | undefined): Promise<Map<string, string>> {
  const rooms = await ruanganSimgos();
  if (ruanganId && !rooms) throw new ServiceUnavailableError("Daftar ruangan SIMRS tidak tersedia. Coba lagi.");
  const peta = new Map((rooms ?? []).map((r) => [r.id, r.nama]));
  if (ruanganId && !peta.has(ruanganId)) {
    throw new ValidationError({ formErrors: [], fieldErrors: { ruanganId: ["Ruangan tidak ditemukan"] } });
  }
  return peta;
}

async function cariBaris(id: string): Promise<BarisPerangkat> {
  const row = await getAppDb().formRmPerangkatTtd.findUnique({ where: { id }, select: PILIH });
  if (!row) throw new NotFoundError("Perangkat tidak ditemukan");
  return row;
}

export async function daftarPerangkat(): Promise<PerangkatTtdDto[]> {
  const [rows, peta] = await Promise.all([
    getAppDb().formRmPerangkatTtd.findMany({ select: PILIH, orderBy: [{ aktif: "desc" }, { nama: "asc" }] }),
    petaNamaRuangan(),
  ]);
  return rows.map((r) => keDto(r, peta));
}

export async function buatPerangkat(input: BuatPerangkatInput, aktor: AktorPerangkat): Promise<PerangkatTtdDto> {
  const ruanganId = input.ruanganId ?? null;
  const peta = await pastikanRuangan(ruanganId);
  let row: BarisPerangkat;
  try {
    row = await getAppDb().formRmPerangkatTtd.create({
      data: { nama: input.nama, ruanganId, dibuatOlehId: aktor.id },
      select: PILIH,
    });
  } catch (e) {
    if (isUnik(e)) throw new ConflictError(NAMA_BENTROK);
    throw e;
  }
  await writeAudit({
    actorId: aktor.id,
    actorName: aktor.nama,
    action: "form-rm.ttd-siaga.perangkat-buat",
    targetId: row.id,
    metadata: { nama: row.nama, ruanganId },
    ip: aktor.ip,
  });
  return keDto(row, peta);
}

export async function ubahPerangkat(
  id: string,
  input: UbahPerangkatInput,
  aktor: AktorPerangkat,
): Promise<PerangkatTtdDto> {
  const lama = await cariBaris(id);
  const peta = await pastikanRuangan(input.ruanganId);
  const data: { nama?: string; ruanganId?: string | null } = {};
  if (input.nama !== undefined && input.nama !== lama.nama) data.nama = input.nama;
  if (input.ruanganId !== undefined && input.ruanganId !== lama.ruanganId) data.ruanganId = input.ruanganId;
  if (Object.keys(data).length === 0) return keDto(lama, peta);

  let row: BarisPerangkat;
  try {
    row = await getAppDb().formRmPerangkatTtd.update({ where: { id }, data, select: PILIH });
  } catch (e) {
    if (isUnik(e)) throw new ConflictError(NAMA_BENTROK);
    throw e;
  }
  await writeAudit({
    actorId: aktor.id,
    actorName: aktor.nama,
    action: "form-rm.ttd-siaga.perangkat-ubah",
    targetId: id,
    metadata: {
      ...(data.nama !== undefined ? { nama: [lama.nama, data.nama] } : {}),
      ...(data.ruanganId !== undefined ? { ruanganId: [lama.ruanganId, data.ruanganId] } : {}),
    },
    ip: aktor.ip,
  });
  return keDto(row, peta);
}

/**
 * Cabut: kredensial (aktif & lama) dihapus, kode pasang aktif dibatalkan, dan
 * aliran SSE tablet langsung ditutup dengan event `dicabut`. Idempoten —
 * perangkat yang sudah dicabut dikembalikan apa adanya tanpa audit.
 */
export async function cabutPerangkat(id: string, aktor: AktorPerangkat): Promise<PerangkatTtdDto> {
  const lama = await cariBaris(id);
  kodePasang.batalkan(id);
  const peta = await petaNamaRuangan();
  if (!lama.aktif) return keDto(lama, peta);

  const row = await getAppDb().formRmPerangkatTtd.update({
    where: { id },
    data: { aktif: false, tokenHash: null, tokenHashLama: null, tokenDiputarAt: null, dicabutAt: new Date() },
    select: PILIH,
  });
  permintaanTtd.denganIp(aktor.ip, () => permintaanTtd.inti.batalkanPerangkat(id, "perangkat-dicabut"));
  hubTtd.putuskan(id, "dicabut");
  lupakanGanda(id);
  await writeAudit({
    actorId: aktor.id,
    actorName: aktor.nama,
    action: "form-rm.ttd-siaga.perangkat-cabut",
    targetId: id,
    metadata: { nama: row.nama, terpasang: lama.tokenHash !== null },
    ip: aktor.ip,
  });
  return keDto(row, peta);
}

/**
 * Kode pasang baru (sekali pakai, 10 menit). Kode lama perangkat ini langsung
 * batal; kredensial yang sedang terpasang TETAP berlaku sampai kode baru
 * dipakai (pasang ulang) — mencabut adalah aksi terpisah.
 *
 * URL/QR hanya dibuat dari origin publik terkonfigurasi (`asalPublik`), TIDAK
 * dari header Host (host-header injection → QR menunjuk domain penyerang).
 * Kode mentah hanya ada di respons ini; audit tidak memuatnya.
 */
export async function terbitkanKodePasang(id: string, aktor: AktorPerangkat): Promise<KodePasangDto> {
  await cariBaris(id);
  const { kode, sampai } = kodePasang.terbitkan(id);
  const asal = asalPublik();
  const url = asal ? `${asal}${JALUR_TTD_SIAGA}#kode=${kode}` : null;
  const qr = url ? await qrSvgDataUri(url, 1) : null;
  await writeAudit({
    actorId: aktor.id,
    actorName: aktor.nama,
    action: "form-rm.ttd-siaga.kode-pasang",
    targetId: id,
    metadata: { sampai: new Date(sampai).toISOString() },
    ip: aktor.ip,
  });
  return { kode: formatKode(kode), sampai, url, qr };
}
