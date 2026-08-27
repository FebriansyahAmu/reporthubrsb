import "server-only";
import { buildReportWorkbook, stampWita, type ExcelColumn } from "@/server/lib/excel";
import type { PenyakitItem, PenyakitResult } from "./penyakit.types";

const idNum = new Intl.NumberFormat("id-ID");

const JENIS_LABEL: Record<number, string> = {
  1: "Rawat Jalan",
  2: "Gawat Darurat",
  3: "Rawat Inap",
};
const BAYAR_LABEL: Record<number, string> = { 0: "Semua", 1: "Umum", 2: "BPJS" };

const COLUMNS: ExcelColumn<PenyakitItem>[] = [
  { header: "#", width: 6, value: (r) => r.rank, align: "center", bold: true },
  { header: "Kode ICD-10", width: 13, value: (r) => r.kode, align: "center", text: true },
  { header: "Diagnosa", width: 44, value: (r) => r.nama },
  { header: "Kasus", width: 11, value: (r) => r.kasus, numFmt: "#,##0", align: "right" },
  { header: "Pasien", width: 11, value: (r) => r.pasien, numFmt: "#,##0", align: "right" },
  { header: "Laki-laki", width: 11, value: (r) => r.lk, numFmt: "#,##0", align: "right" },
  { header: "Perempuan", width: 11, value: (r) => r.pr, numFmt: "#,##0", align: "right" },
];

export type PenyakitExcelMeta = { generatedAt: Date; by?: string };

/** Susun workbook Excel "10 Penyakit Terbanyak" dari hasil laporan (data + ringkasan). */
export async function buildPenyakitExcel(
  result: PenyakitResult,
  meta: PenyakitExcelMeta,
): Promise<Buffer> {
  const s = result.summary;
  const metricLabel = result.metric === "pasien" ? "Pasien" : "Kasus";

  const filterLine = [
    `Periode: ${result.periode.from} s/d ${result.periode.to}`,
    `Jenis layanan: ${JENIS_LABEL[result.jenis] ?? "-"}`,
    `Cara bayar: ${BAYAR_LABEL[result.caraBayar]}`,
    `Cakupan: ${result.utama ? "Diagnosa utama" : "Semua diagnosa"}`,
    `Urut: ${metricLabel}`,
  ].join("   ·   ");

  const statLine = [
    `Total jenis diagnosis: ${idNum.format(s.jenisDiag)}`,
    `Total kasus: ${idNum.format(s.totalKasus)}`,
    `Total pasien: ${idNum.format(s.totalPasien)}`,
    `Kontribusi 10 besar (kasus): ${Math.round(s.kasusShare * 100)}%`,
  ].join("   ·   ");

  const infoLine = `Dibuat: ${stampWita(meta.generatedAt)}${meta.by ? ` oleh ${meta.by}` : ""}   ·   Sumber: SIMGOS (read-only)`;

  return buildReportWorkbook<PenyakitItem>({
    sheetName: "10 Penyakit Terbanyak",
    title: "10 PENYAKIT TERBANYAK",
    subtitle: "RSUD Pratama Bolaang Mongondow Timur · Laporan Diagnosa ICD-10 Terbanyak",
    metaLines: [filterLine, statLine, infoLine],
    columns: COLUMNS,
    rows: result.data,
    generatedAt: meta.generatedAt,
    emptyText: "Tidak ada diagnosa untuk periode & filter ini.",
    rankMedal: true,
  });
}
