/**
 * Tafsir kata kunci pencarian pasien Form RM (PRD §6.1) — murni & ringan,
 * dipakai validasi server dan petunjuk di klien.
 */

/** Panjang minimum kata kunci. */
export const MIN_CARI = 3;

/** Angka → No.RM / NIK / NOPEN (dicocokkan persis); selain itu → penggalan nama. */
export type KunciCariPasien = { angka: string } | { nama: string };

/** Null bila tak layak dicari (terlalu pendek, campuran angka-huruf, atau karakter asing). */
export function tafsirCari(q: string): KunciCariPasien | null {
  const t = q.trim().replace(/\s+/g, " ");
  if (t.length < MIN_CARI) return null;
  if (/^\d+$/.test(t)) return t.length <= 25 ? { angka: t } : null;
  return /^[\p{L} .,'`-]+$/u.test(t) ? { nama: t } : null;
}
