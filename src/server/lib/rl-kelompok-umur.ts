import { z } from "zod";

/**
 * Opsi kolom kelompok umur pada ekspor Excel laporan RL (4.1, 5.1):
 *  - `semua`  → 25 kelompok umur (format resmi SIRS), termasuk yang bernilai 0;
 *  - `terisi` → hanya kelompok yang L+P-nya > 0 di seluruh laporan.
 *
 * Kelompok disembunyikan utuh (kolom L dan P sekaligus), sehingga pasangan L/P
 * tetap utuh. Urutan kelompok tidak berubah.
 */
export const UMUR_MODES = ["semua", "terisi"] as const;
export type UmurMode = (typeof UMUR_MODES)[number];

/** Parameter `umur` pada rute ekspor; nilai lain → 422. Bawaan `semua`. */
export const rlEksporOpsiSchema = z.object({
  umur: z.enum(UMUR_MODES).default("semua"),
});

type BarisUmur = { umur: ReadonlyArray<{ lk: number; pr: number }> };

/** Indeks kelompok (0..24) yang punya data (L+P > 0) di salah satu baris. */
export function kelompokUmurTerisi(rows: ReadonlyArray<BarisUmur>, jumlahKelompok = 25): number[] {
  const terisi: number[] = [];
  for (let i = 0; i < jumlahKelompok; i++) {
    if (rows.some((r) => (r.umur[i]?.lk ?? 0) + (r.umur[i]?.pr ?? 0) > 0)) terisi.push(i);
  }
  return terisi;
}

/** Indeks kelompok (0..24) yang ditampilkan untuk mode tertentu. */
export function kelompokUmurTampil(
  rows: ReadonlyArray<BarisUmur>,
  mode: UmurMode,
  jumlahKelompok = 25,
): number[] {
  if (mode === "terisi") return kelompokUmurTerisi(rows, jumlahKelompok);
  return Array.from({ length: jumlahKelompok }, (_, i) => i);
}

/** Catatan untuk baris meta Excel bila sebagian kelompok disembunyikan. */
export function catatanKelompokUmur(tampil: number, jumlahKelompok = 25): string {
  if (tampil >= jumlahKelompok) return "";
  if (tampil === 0) return "Semua kelompok umur bernilai 0 sehingga kolom umur tidak ditampilkan";
  return `Kelompok umur yang bernilai 0 disembunyikan (${tampil} dari ${jumlahKelompok} kelompok ditampilkan)`;
}
