import "server-only";
import { buildReportWorkbook, stampWita, type ExcelColumn } from "@/server/lib/excel";
import type { ObatTerbanyakItem, ObatTerbanyakResult } from "./farmasi.types";

const idNum = new Intl.NumberFormat("id-ID");
const idRp = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const JENIS_LABEL: Record<number, string> = {
  0: "Semua",
  1: "Rawat Jalan",
  2: "Gawat Darurat",
  3: "Rawat Inap",
};
const BAYAR_LABEL: Record<number, string> = { 0: "Semua", 1: "Umum", 2: "BPJS" };

const COLUMNS: ExcelColumn<ObatTerbanyakItem>[] = [
  { header: "#", width: 6, value: (r) => r.rank, align: "center", bold: true },
  { header: "Nama Obat / Alkes", width: 36, value: (r) => r.nama },
  { header: "Kategori", width: 16, value: (r) => r.kategoriLeaf, align: "center" },
  {
    header: "Generik",
    width: 13,
    value: (r) => (r.generik ? "Generik" : "Non-generik"),
    align: "center",
  },
  { header: "Merk", width: 18, value: (r) => r.merk || "—" },
  { header: "Kuantitas", width: 13, value: (r) => r.qty, numFmt: "#,##0", align: "right" },
  { header: "Nilai (Rp)", width: 17, value: (r) => r.nilai, numFmt: '"Rp"#,##0', align: "right" },
  { header: "Resep", width: 10, value: (r) => r.resep, numFmt: "#,##0", align: "right" },
];

export type ObatExcelMeta = { generatedAt: Date; by?: string; kategoriCount: number };

/** Susun workbook Excel "10 Obat Terbanyak" dari hasil laporan (data + ringkasan). */
export async function buildObatExcel(
  result: ObatTerbanyakResult,
  meta: ObatExcelMeta,
): Promise<Buffer> {
  const s = result.summary;
  const metricLabel = result.metric === "nilai" ? "Nilai" : "Kuantitas";
  const share =
    result.metric === "nilai"
      ? s.totalNilai > 0
        ? s.top10Nilai / s.totalNilai
        : 0
      : s.qtyShare;

  const filterLine = [
    `Periode: ${result.periode.from} s/d ${result.periode.to}`,
    `Jenis layanan: ${JENIS_LABEL[result.jenis]}`,
    `Cara bayar: ${BAYAR_LABEL[result.caraBayar]}`,
    `Kategori: ${meta.kategoriCount > 0 ? `${meta.kategoriCount} dipilih` : "Semua"}`,
    `Urut: ${metricLabel}`,
  ].join("   ·   ");

  const statLine = [
    `Total jenis obat: ${idNum.format(s.jenisObat)}`,
    `Total kuantitas: ${idNum.format(s.totalQty)}`,
    `Total nilai: ${idRp.format(s.totalNilai)}`,
    `Kontribusi 10 besar (${metricLabel.toLowerCase()}): ${Math.round(share * 100)}%`,
  ].join("   ·   ");

  const infoLine = `Dibuat: ${stampWita(meta.generatedAt)}${meta.by ? ` oleh ${meta.by}` : ""}   ·   Sumber: SIMGOS (read-only)`;

  return buildReportWorkbook<ObatTerbanyakItem>({
    sheetName: "10 Obat Terbanyak",
    title: "10 OBAT TERBANYAK",
    subtitle: "RSUD Pratama Bolaang Mongondow Timur · Laporan Pengeluaran Farmasi per Obat",
    metaLines: [filterLine, statLine, infoLine],
    columns: COLUMNS,
    rows: result.data,
    generatedAt: meta.generatedAt,
    emptyText: "Tidak ada pemakaian obat untuk periode & filter ini.",
    rankMedal: true,
  });
}
