import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { STATUS_VERIFIKASI, type StatusVerifikasi } from "./verifikasi.constants";

/**
 * Repository DB aplikasi `reporthub` (READ-WRITE) untuk modul Verifikasi Klaim.
 * Tidak pernah menyentuh SIMGOS. Pencarian massal memakai `IN` pada kolom unik /
 * terindeks (`klaim_verifikasi.nopen`, `bukti_pelayanan.nopen`).
 */

export type StatusTersimpan = { status: StatusVerifikasi; versi: number };

const STATUS_SET = new Set<string>(STATUS_VERIFIKASI);

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
    if (STATUS_SET.has(r.status)) out.set(r.nopen, { status: r.status as StatusVerifikasi, versi: r.versi });
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
