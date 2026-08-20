import "server-only";
import type { PenyakitGrandRow, TopPenyakitRow } from "./penyakit.dal";
import type { PenyakitItem } from "./penyakit.types";

/** Angka aman: BIGINT dari driver bisa berupa bigint/string → number. */
export function num(v: number | bigint | string | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Rapikan deskripsi ICD: buang prefiks kode & tag "(IM)"/versi bila ada. */
function cleanNama(row: TopPenyakitRow): string {
  const raw = row.nama?.trim();
  if (raw) return raw;
  const dx = row.dxText?.trim();
  if (dx) return dx.charAt(0).toUpperCase() + dx.slice(1);
  return row.kode;
}

export function mapPenyakit(row: TopPenyakitRow, rank: number): PenyakitItem {
  return {
    rank,
    kode: row.kode?.trim() || "—",
    nama: cleanNama(row),
    kasus: num(row.kasus),
    pasien: num(row.pasien),
    lk: num(row.lk),
    pr: num(row.pr),
  };
}

export function readGrandTotal(row: PenyakitGrandRow): {
  jenisDiag: number;
  totalKasus: number;
  totalPasien: number;
} {
  return {
    jenisDiag: num(row.jenisDiag),
    totalKasus: num(row.totalKasus),
    totalPasien: num(row.totalPasien),
  };
}
