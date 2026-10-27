import { hitungUmur } from "@/lib/format";
import { JENIS_KUNJUNGAN, type JenisKunjungan, type LegEpisode } from "@/features/form-rm/registry";
import type { LegEpisodeRow, LegSasaranRow } from "./form-rm.dal";
import type { EpisodeSasaran } from "./form-rm.types";

/**
 * Fungsi MURNI daftar pasien Form RM (tanpa I/O, diuji unit): normalisasi leg
 * SIMGOS, pengelompokan per episode (NOPEN), dan paginasi.
 */

const adalahJenis = (n: number): n is JenisKunjungan => (JENIS_KUNJUNGAN as readonly number[]).includes(n);

const keJenisKelamin = (v: unknown) => {
  const jk = Number(v);
  return jk === 1 ? "Laki-Laki" : jk === 2 ? "Perempuan" : "—";
};

/** "YYYY-MM-DD" → Date lokal tengah malam; null bila tak valid. */
function tanggal(s: string | null): Date | null {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null;
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Kelompokkan leg (urut MASUK menurun) per NOPEN → satu episode per pendaftaran,
 * diwakili leg pertama (terbaru). Urutan episode mengikuti leg terbarunya.
 */
export function kelompokkanEpisode(rows: readonly LegSasaranRow[], acuanUmur: Date): EpisodeSasaran[] {
  const peta = new Map<string, EpisodeSasaran>();
  for (const r of rows) {
    const jenis = Number(r.JENIS_KUNJUNGAN);
    if (!adalahJenis(jenis)) continue;
    const nopen = String(r.NOPEN);
    const ada = peta.get(nopen);
    if (ada) {
      if (r.KELUAR == null) ada.dirawat = true;
      continue;
    }
    peta.set(nopen, {
      nopen,
      norm: String(r.NORM),
      nama: r.NAMA?.trim() || "—",
      jenisKelamin: keJenisKelamin(r.JENIS_KELAMIN),
      umur: hitungUmur(tanggal(r.TANGGAL_LAHIR), acuanUmur),
      ruang: r.RUANG?.trim() || "—",
      ruanganId: String(r.RUANGAN_ID),
      jenis,
      masuk: r.MASUK,
      keluar: r.KELUAR,
      dirawat: r.KELUAR == null,
    });
  }
  return [...peta.values()];
}

/** Baris (NOPEN, JENIS_KUNJUNGAN) → jenis kunjungan per episode. */
export function petaJenisEpisode(
  rows: readonly { NOPEN: string; JENIS_KUNJUNGAN: number | string }[],
): Map<string, Set<JenisKunjungan>> {
  const peta = new Map<string, Set<JenisKunjungan>>();
  for (const r of rows) {
    const j = Number(r.JENIS_KUNJUNGAN);
    if (!adalahJenis(j)) continue;
    const s = peta.get(String(r.NOPEN)) ?? new Set<JenisKunjungan>();
    s.add(j);
    peta.set(String(r.NOPEN), s);
  }
  return peta;
}

/** Baris leg episode SIMGOS → leg (jenis & ruangan) satu episode; jenis tak dikenal dibuang. */
export const legDariBaris = (rows: readonly LegEpisodeRow[]): LegEpisode[] =>
  rows.map((r) => ({ jenis: Number(r.JENIS_KUNJUNGAN), ruanganId: String(r.RUANGAN_ID) })).filter((l) => adalahJenis(l.jenis));

/** Jenis kunjungan dari leg satu episode. */
export const jenisDariLeg = (legs: readonly LegEpisode[]): Set<JenisKunjungan> =>
  new Set(legs.map((l) => l.jenis).filter(adalahJenis));

/** Halaman dari daftar penuh (halaman di luar jangkauan dijepit ke halaman terakhir). */
export function halamanDari<T>(semua: readonly T[], halaman: number, ukuran: number) {
  const total = semua.length;
  const totalPages = Math.max(1, Math.ceil(total / ukuran));
  const page = Math.min(Math.max(1, halaman), totalPages);
  return {
    data: semua.slice((page - 1) * ukuran, page * ukuran),
    meta: { page, pageSize: ukuran, total, totalPages },
  };
}
