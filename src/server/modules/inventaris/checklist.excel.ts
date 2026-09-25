import "server-only";
import { buildReportWorkbook, stampWita, type ExcelColumn } from "@/server/lib/excel";
import { FREKUENSI_LABEL, type Frekuensi } from "./checklist.schema";
import type { RiwayatOverview, RunDetail } from "./checklist.service";

type ExportMeta = { generatedAt: Date; by: string };

const RS = "UPTD RSUD Bolaang Mongondow Timur";

function frekLabel(f: Frekuensi): string {
  return FREKUENSI_LABEL[f];
}

/** Ekspor detail checklist satu periode → daftar barang + status periksa. */
export async function buildChecklistPeriodeExcel(detail: RunDetail, meta: ExportMeta): Promise<Buffer> {
  const columns: ExcelColumn<RunDetail["rows"][number]>[] = [
    { header: "No", width: 5, align: "center", value: (_r, i) => i + 1 },
    { header: "Kode Barang", width: 16, text: true, value: (r) => r.kodeBarang },
    { header: "Nama Barang", width: 34, value: (r) => r.nama },
    { header: "Merk / Tipe", width: 18, value: (r) => r.merk ?? "" },
    { header: "Diperiksa", width: 11, align: "center", value: (r) => (r.checked ? "Ya" : "Belum") },
    { header: "Kondisi", width: 16, value: (r) => r.kondisi?.nama ?? "" },
    { header: "Catatan", width: 30, value: (r) => r.catatan ?? "" },
    { header: "Diperiksa Oleh", width: 20, value: (r) => r.checkedBy ?? "" },
    { header: "Waktu Periksa", width: 20, value: (r) => (r.checkedAt ? stampWita(new Date(r.checkedAt)) : "") },
  ];

  const statusTxt = detail.selesai
    ? `Selesai${detail.selesaiBy ? ` · oleh ${detail.selesaiBy}` : ""}${detail.selesaiAt ? ` (${stampWita(new Date(detail.selesaiAt))})` : ""}`
    : "Berjalan";

  return buildReportWorkbook({
    sheetName: `Checklist ${frekLabel(detail.frekuensi)}`,
    title: `Checklist Pemeliharaan ${frekLabel(detail.frekuensi)} — ${detail.ruangan.nama}`,
    subtitle: RS,
    metaLines: [
      `Periode: ${detail.periodeLabel}`,
      `Ruangan: ${detail.ruangan.kodePrefix} · ${detail.ruangan.nama}`,
      `Status: ${statusTxt} · Diperiksa ${detail.done} dari ${detail.total} barang`,
      `Diekspor: ${stampWita(meta.generatedAt)} · oleh ${meta.by}`,
    ],
    columns,
    rows: detail.rows,
    generatedAt: meta.generatedAt,
    emptyText: "Ruangan ini belum memiliki unit barang.",
  });
}

/** Ekspor ringkasan riwayat pelaksanaan checklist satu ruangan/frekuensi. */
export async function buildRiwayatExcel(ov: RiwayatOverview, meta: ExportMeta): Promise<Buffer> {
  const columns: ExcelColumn<RiwayatOverview["runs"][number]>[] = [
    { header: "No", width: 5, align: "center", value: (_r, i) => i + 1 },
    { header: "Periode", width: 34, value: (r) => r.periodeLabel },
    { header: "Status", width: 12, align: "center", value: (r) => (r.selesai ? "Selesai" : "Berjalan") },
    { header: "Diperiksa", width: 12, align: "center", value: (r) => `${r.done} / ${r.total}` },
    { header: "Diselesaikan Oleh", width: 22, value: (r) => r.selesaiBy ?? "" },
    { header: "Waktu Selesai", width: 20, value: (r) => (r.selesaiAt ? stampWita(new Date(r.selesaiAt)) : "") },
    { header: "Dibuat", width: 20, value: (r) => stampWita(new Date(r.createdAt)) },
  ];

  const selesaiCount = ov.runs.filter((r) => r.selesai).length;

  return buildReportWorkbook({
    sheetName: `Riwayat ${frekLabel(ov.frekuensi)}`,
    title: `Riwayat Checklist Pemeliharaan ${frekLabel(ov.frekuensi)} — ${ov.ruangan.nama}`,
    subtitle: RS,
    metaLines: [
      `Ruangan: ${ov.ruangan.kodePrefix} · ${ov.ruangan.nama}`,
      `Total periode tercatat: ${ov.runs.length} · Selesai: ${selesaiCount}`,
      `Diekspor: ${stampWita(meta.generatedAt)} · oleh ${meta.by}`,
    ],
    columns,
    rows: ov.runs,
    generatedAt: meta.generatedAt,
    emptyText: "Belum ada riwayat pelaksanaan checklist.",
  });
}
