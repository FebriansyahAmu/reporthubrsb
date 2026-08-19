import "server-only";
import type { GrandTotalRow, TopObatRow } from "./farmasi.dal";
import type { ObatTerbanyakItem } from "./farmasi.types";

/** Angka aman: DECIMAL/BIGINT dari driver bisa berupa string/bigint → number. */
export function num(v: number | bigint | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Ambil bagian daun dari header kategori "A - B - C" → "C" (fallback ke leaf). */
function leafOf(row: TopObatRow): string {
  if (row.kategoriLeaf) return row.kategoriLeaf;
  if (row.kategori) {
    const parts = row.kategori.split(" - ");
    return parts[parts.length - 1] ?? row.kategori;
  }
  return "—";
}

export function mapObat(row: TopObatRow, rank: number): ObatTerbanyakItem {
  return {
    rank,
    farmasiId: Number(row.farmasiId),
    nama: row.nama?.trim() || "(tanpa nama)",
    kategori: row.kategori?.trim() || "—",
    kategoriLeaf: leafOf(row),
    generik: Number(row.generik) === 1,
    merk: row.merk?.trim() || "",
    qty: num(row.qty),
    nilai: Math.round(num(row.nilai)),
    resep: num(row.resep),
  };
}

export function readGrandTotal(row: GrandTotalRow): {
  jenisObat: number;
  totalQty: number;
  totalNilai: number;
} {
  return {
    jenisObat: num(row.jenisObat),
    totalQty: num(row.totalQty),
    totalNilai: Math.round(num(row.totalNilai)),
  };
}
