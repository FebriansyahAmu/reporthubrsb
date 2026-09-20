import "server-only";
import { buildReportPdf, type PdfTableSpec } from "@/server/lib/pdf";
import { stampWita } from "@/server/lib/excel";
import { MENULAR_DEFINISI, MENULAR_MODE_LABEL } from "@/server/lib/icd-menular";
import { RL41_AGE_GROUPS } from "@/server/modules/rl41/rl41.constants";
import type { Rl51Result } from "./rl51.types";

const idNum = new Intl.NumberFormat("id-ID");
const nz = (n: number) => (n === 0 ? "-" : idNum.format(n));

export type Rl51PdfMeta = { generatedAt: Date; by?: string };

/**
 * PDF ringkas RL 5.1 (rapi & jelas): tabel per diagnosa (ICD-10) — kunjungan &
 * kasus baru — + tabel distribusi 25 kelompok umur KASUS BARU. Matriks penuh
 * tetap di Excel.
 */
export async function buildRl51Pdf(result: Rl51Result, meta: Rl51PdfMeta): Promise<Buffer> {
  const s = result.summary;

  const mainTable: PdfTableSpec = {
    caption: "Rekap per Diagnosa (ICD-10)",
    columns: [
      { header: "No", width: 26, align: "center", maxLines: 1 },
      { header: "Kode", width: 56, align: "left", maxLines: 1 },
      { header: "Diagnosa", width: 470, align: "left", maxLines: 2 },
      { header: "L", width: 46, align: "right", maxLines: 1 },
      { header: "P", width: 46, align: "right", maxLines: 1 },
      { header: "Baru", width: 58, align: "right", maxLines: 1 },
      { header: "Kunjungan", width: 68, align: "right", maxLines: 1 },
    ],
    rows: result.data.map((r) => [
      String(r.rank),
      r.kode,
      r.diagnosa,
      idNum.format(r.lk),
      idNum.format(r.pr),
      nz(r.baru),
      idNum.format(r.total),
    ]),
    totals: [
      "",
      "",
      "TOTAL",
      idNum.format(s.totalLk),
      idNum.format(s.totalPr),
      idNum.format(s.totalBaru),
      idNum.format(s.totalKunjungan),
    ],
  };

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
    caption: "Distribusi Kelompok Umur — Kasus Baru",
    columns: [
      { header: "Kelompok Umur", width: 220, align: "left", maxLines: 1 },
      { header: "Laki-laki", width: 90, align: "right", maxLines: 1 },
      { header: "Perempuan", width: 90, align: "right", maxLines: 1 },
      { header: "Total", width: 100, align: "right", maxLines: 1 },
    ],
    rows: ageTot.map((a) => [a.label, nz(a.lk), nz(a.pr), nz(a.lk + a.pr)]),
    totals: ["TOTAL", "", "", idNum.format(s.totalBaru)],
  };

  const metaLines = [
    `Periode: ${result.periode.from} s/d ${result.periode.to}   ·   Bulan: ${result.bulan} ${result.tahun}   ·   Kelompok penyakit: ${MENULAR_MODE_LABEL[result.menular]}`,
    `Total kunjungan: ${idNum.format(s.totalKunjungan)}   ·   Kasus baru: ${idNum.format(s.totalBaru)}   ·   Jenis diagnosa (ICD-10): ${idNum.format(s.jenisDiag)}   ·   L: ${idNum.format(s.totalLk)}   ·   P: ${idNum.format(s.totalPr)}`,
    `Kolom kelompok umur = kasus baru. Dibuat: ${stampWita(meta.generatedAt)}${meta.by ? ` oleh ${meta.by}` : ""}`,
  ];
  if (result.menular !== "all") metaLines.push(MENULAR_DEFINISI);

  return buildReportPdf({
    title: "RL 5.1 — DATA MORBIDITAS PASIEN RAWAT JALAN",
    subtitle: result.instansi
      ? `${result.instansi.nama} · Kode RS ${result.instansi.kodeRs} · ${result.instansi.kota}`
      : "RSUD Bolaang Mongondow Timur",
    metaLines,
    tables: [mainTable, ageTable],
    footerNote: "Sumber: SIMGOS (read-only) · RL 5.1 (di-port dari SP LaporanRL51Revisi) · AuditTrail RS BOLTIM",
    generatedAt: meta.generatedAt,
    orientation: "landscape",
  });
}
