import "server-only";
import type { PengunjungListRow, PengunjungSummaryRow } from "./pengunjung.dal";
import type { JenisLayanan, PengunjungItem, PengunjungSummary } from "./pengunjung.types";

export function num(v: number | bigint | string | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** NORM → 8 digit ber-nol di depan (konvensi rekam medis). */
function normPad(v: number | string | null | undefined): string {
  const s = String(v ?? "").trim();
  return s ? s.padStart(8, "0") : "—";
}

export function mapPengunjung(row: PengunjungListRow, jenis: JenisLayanan): PengunjungItem {
  const nopenRi = row.nopenRi?.trim() || null;
  const tindakLanjut = jenis === 2 ? (nopenRi ? "ranap" : "rajal") : null;
  return {
    nopen: String(row.nopen ?? "").trim(),
    norm: normPad(row.norm),
    nama: row.nama?.trim() || "(tanpa nama)",
    jk: Number(row.jns) === 1 ? "L" : "P",
    umur: num(row.umurThn),
    baru: Number(row.baru) === 1,
    tglReg: row.tglReg?.trim() || "—",
    tglMasuk: row.masuk?.trim() || null,
    tglKeluar: row.keluar?.trim() || null,
    unit: row.unit?.trim() || "—",
    caraBayar: row.caraBayar?.trim() || "—",
    dokter: row.dokter?.trim() || "—",
    nopenRi,
    tindakLanjut,
  };
}

export function readSummary(row: PengunjungSummaryRow, jenis: JenisLayanan): PengunjungSummary {
  const total = num(row.total);
  const baru = num(row.baru);
  const igdRajal = jenis === 2 ? num(row.rajal) : null;
  return {
    total,
    baru,
    lama: total - baru,
    lk: num(row.lk),
    pr: num(row.pr),
    igdRajal,
    igdRanap: igdRajal === null ? null : total - igdRajal,
  };
}
