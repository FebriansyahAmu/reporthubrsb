import "server-only";
import { buildReportWorkbook, stampWita, type ExcelColumn } from "@/server/lib/excel";
import type { PengunjungExport } from "./pengunjung.service";
import type { PengunjungItem } from "./pengunjung.types";

const idNum = new Intl.NumberFormat("id-ID");

const JENIS_LABEL: Record<number, string> = {
  1: "Rawat Jalan",
  2: "Gawat Darurat (IGD)",
  3: "Rawat Inap",
};
const BAYAR_LABEL: Record<number, string> = { 0: "Semua", 1: "Umum", 2: "BPJS" };

function columns(jenis: number): ExcelColumn<PengunjungItem>[] {
  const cols: ExcelColumn<PengunjungItem>[] = [
    { header: "No", width: 5, value: (_r, i) => i + 1, align: "center", bold: true },
    { header: "NORM", width: 11, value: (r) => r.norm, align: "center", text: true },
    { header: "Nama Pasien", width: 26, value: (r) => r.nama },
    { header: "JK", width: 5, value: (r) => r.jk, align: "center" },
    { header: "Umur (Th)", width: 9, value: (r) => r.umur, numFmt: "#,##0", align: "right" },
    { header: "Status", width: 9, value: (r) => (r.baru ? "Baru" : "Lama"), align: "center" },
    { header: "NOPEN", width: 13, value: (r) => r.nopen, align: "center", text: true },
    { header: "Tgl Registrasi", width: 17, value: (r) => r.tglReg, align: "center" },
    { header: "Unit Pelayanan", width: 24, value: (r) => r.unit },
    { header: "Cara Bayar", width: 18, value: (r) => r.caraBayar, align: "center" },
    { header: "Dokter", width: 26, value: (r) => r.dokter },
  ];
  if (jenis === 2) {
    cols.push({
      header: "Tindak Lanjut",
      width: 16,
      value: (r) => (r.tindakLanjut === "ranap" ? "→ Rawat Inap" : "Rawat Jalan"),
      align: "center",
    });
  }
  return cols;
}

export type PengunjungExcelMeta = { generatedAt: Date; by?: string; ruanganNama?: string };

/** Susun workbook Excel "Laporan Pengunjung Per Pasien". */
export async function buildPengunjungExcel(
  exp: PengunjungExport,
  meta: PengunjungExcelMeta,
): Promise<Buffer> {
  const { filter, summary, data } = exp;

  const filterLine = [
    `Periode: ${filter.from} s/d ${filter.to}`,
    `Jenis layanan: ${JENIS_LABEL[filter.jenis]}`,
    `Ruangan: ${meta.ruanganNama || "Semua"}`,
    `Cara bayar: ${BAYAR_LABEL[filter.caraBayar]}`,
    ...(filter.jenis === 2 && filter.tindak !== "all"
      ? [`Tindak lanjut: ${filter.tindak === "rajal" ? "Rawat Jalan" : "Lanjut Rawat Inap"}`]
      : []),
  ].join("   ·   ");

  const statParts = [
    `Total kunjungan: ${idNum.format(summary.total)}`,
    `Baru: ${idNum.format(summary.baru)}`,
    `Lama: ${idNum.format(summary.lama)}`,
    `L/P: ${idNum.format(summary.lk)} / ${idNum.format(summary.pr)}`,
  ];
  if (filter.jenis === 2 && summary.igdRajal !== null) {
    statParts.push(
      `IGD Rawat Jalan: ${idNum.format(summary.igdRajal)}`,
      `Lanjut Rawat Inap: ${idNum.format(summary.igdRanap ?? 0)}`,
    );
  }

  const infoLine = `Dibuat: ${stampWita(meta.generatedAt)}${meta.by ? ` oleh ${meta.by}` : ""}   ·   Sumber: SIMGOS (read-only)`;

  return buildReportWorkbook<PengunjungItem>({
    sheetName: "Pengunjung Per Pasien",
    title: "LAPORAN PENGUNJUNG PER PASIEN",
    subtitle: "RSUD Pratama Bolaang Mongondow Timur",
    metaLines: [filterLine, statParts.join("   ·   "), infoLine],
    columns: columns(filter.jenis),
    rows: data,
    generatedAt: meta.generatedAt,
    emptyText: "Tidak ada kunjungan untuk periode & filter ini.",
  });
}
