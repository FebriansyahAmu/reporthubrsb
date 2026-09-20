import "server-only";
import { buildReportPdf, type PdfTableSpec } from "@/server/lib/pdf";
import { stampWita } from "@/server/lib/excel";
import { MENULAR_DEFINISI, MENULAR_MODE_LABEL } from "@/server/lib/icd-menular";
import { RL41_AGE_GROUPS } from "./rl41.constants";
import type { Rl41Result } from "./rl41.types";

const idNum = new Intl.NumberFormat("id-ID");
const nz = (n: number) => (n === 0 ? "-" : idNum.format(n));

export type Rl41PdfMeta = { generatedAt: Date; by?: string };

/**
 * PDF ringkas RL 4.1 (rapi & jelas): tabel per diagnosa (ICD-10) + tabel
 * distribusi 25 kelompok umur agregat. Rincian per-ICD × kelompok umur penuh
 * tetap di Excel; PDF fokus keterbacaan.
 */
export async function buildRl41Pdf(result: Rl41Result, meta: Rl41PdfMeta): Promise<Buffer> {
  const s = result.summary;

  // Tabel utama per diagnosa
  const mainTable: PdfTableSpec = {
    caption: "Rekap per Diagnosa (ICD-10)",
    columns: [
      { header: "No", width: 26, align: "center", maxLines: 1 },
      { header: "Kode", width: 56, align: "left", maxLines: 1 },
      { header: "Diagnosa", width: 484, align: "left", maxLines: 2 },
      { header: "L", width: 48, align: "right", maxLines: 1 },
      { header: "P", width: 48, align: "right", maxLines: 1 },
      { header: "Total", width: 60, align: "right", maxLines: 1 },
      { header: "Mati", width: 48, align: "right", maxLines: 1 },
    ],
    rows: result.data.map((r) => [
      String(r.rank),
      r.kode,
      r.diagnosa,
      idNum.format(r.lk),
      idNum.format(r.pr),
      idNum.format(r.total),
      nz(r.mati),
    ]),
    totals: [
      "",
      "",
      "TOTAL",
      idNum.format(s.totalLk),
      idNum.format(s.totalPr),
      idNum.format(s.totalKasus),
      idNum.format(s.totalMati),
    ],
  };

  // Distribusi kelompok umur (agregat semua diagnosa)
  const ageTot = RL41_AGE_GROUPS.map((g) => {
    let lk = 0;
    let pr = 0;
    for (const row of result.data) {
      lk += row.umur[g.id - 1]?.lk ?? 0;
      pr += row.umur[g.id - 1]?.pr ?? 0;
    }
    return { label: g.label, lk, pr };
  });
  const ageTable: PdfTableSpec = {
    caption: "Distribusi Kelompok Umur (semua diagnosa)",
    columns: [
      { header: "Kelompok Umur", width: 220, align: "left", maxLines: 1 },
      { header: "Laki-laki", width: 90, align: "right", maxLines: 1 },
      { header: "Perempuan", width: 90, align: "right", maxLines: 1 },
      { header: "Total", width: 100, align: "right", maxLines: 1 },
    ],
    rows: ageTot.map((a) => [a.label, nz(a.lk), nz(a.pr), nz(a.lk + a.pr)]),
    totals: [
      "TOTAL",
      idNum.format(s.totalLk),
      idNum.format(s.totalPr),
      idNum.format(s.totalKasus),
    ],
  };

  const metaLines = [
    `Periode: ${result.periode.from} s/d ${result.periode.to}   ·   Bulan: ${result.bulan} ${result.tahun}`,
    `Kelompok penyakit: ${MENULAR_MODE_LABEL[result.menular]}   ·   Total kasus: ${idNum.format(s.totalKasus)}   ·   Jenis diagnosa (ICD-10): ${idNum.format(s.jenisDiag)}   ·   L: ${idNum.format(s.totalLk)}   ·   P: ${idNum.format(s.totalPr)}   ·   Meninggal: ${idNum.format(s.totalMati)}`,
    `Dibuat: ${stampWita(meta.generatedAt)}${meta.by ? ` oleh ${meta.by}` : ""}`,
  ];
  if (result.menular !== "all") metaLines.push(MENULAR_DEFINISI);

  return buildReportPdf({
    title: "RL 4.1 — DATA MORBIDITAS & MORTALITAS PASIEN RAWAT INAP",
    subtitle: result.instansi
      ? `${result.instansi.nama} · Kode RS ${result.instansi.kodeRs} · ${result.instansi.kota}`
      : "RSUD Bolaang Mongondow Timur",
    metaLines,
    tables: [mainTable, ageTable],
    footerNote: "Sumber: SIMGOS (read-only) · RL 4.1 (di-port dari SP LaporanRL41Revisi) · AuditTrail RS BOLTIM",
    generatedAt: meta.generatedAt,
    orientation: "landscape",
  });
}
