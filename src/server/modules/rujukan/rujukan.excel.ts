import "server-only";
import ExcelJS from "exceljs";
import type { RujukanKeluarExportItem } from "./rujukan.types";

export type RujukanExportMeta = {
  from?: string;
  to?: string;
  jenisLabel?: string;
  search?: string;
  total: number;
  generatedAt: Date;
  by?: string;
};

type Col = { header: string; key: keyof RujukanKeluarExportItem; width: number };

const COLUMNS: Col[] = [
  { header: "Tgl Rujukan", key: "tglRujukan", width: 13 },
  { header: "Tgl Rencana Kunjungan", key: "tglRencanaKunjungan", width: 15 },
  { header: "Berlaku s/d", key: "tglBerlakuKunjungan", width: 13 },
  { header: "No. Rujukan", key: "noRujukan", width: 22 },
  { header: "No. SEP", key: "noSep", width: 22 },
  { header: "No. Kartu BPJS", key: "noKartu", width: 17 },
  { header: "Nama Pasien", key: "pasienNama", width: 26 },
  { header: "NIK", key: "pasienNik", width: 18 },
  { header: "Jenis Pelayanan", key: "jenisLabel", width: 15 },
  { header: "Diagnosa (ICD)", key: "diagRujukan", width: 12 },
  { header: "Kode Faskes", key: "tujuanKode", width: 12 },
  { header: "Faskes Tujuan", key: "tujuanNama", width: 32 },
  { header: "Kode Poli", key: "poliKode", width: 10 },
  { header: "Poli Tujuan", key: "poliNama", width: 22 },
  { header: "Catatan", key: "catatan", width: 40 },
  { header: "Status", key: "statusLabel", width: 10 },
];

const TEAL = "FF0F766E";
const ZEBRA = "FFF6F8FA";
const BORDER = "FFD7DEE5";
const p2 = (n: number) => String(n).padStart(2, "0");

function stampWita(d: Date): string {
  // Tampilkan jam dinding RS (WITA, UTC+8) apa adanya.
  const w = new Date(d.getTime() + 8 * 3600 * 1000);
  return `${w.getUTCFullYear()}-${p2(w.getUTCMonth() + 1)}-${p2(w.getUTCDate())} ${p2(w.getUTCHours())}:${p2(w.getUTCMinutes())} WITA`;
}

function filterSummary(m: RujukanExportMeta): string {
  const parts: string[] = [];
  if (m.from || m.to) parts.push(`Periode: ${m.from || "awal"} s/d ${m.to || "terkini"}`);
  if (m.jenisLabel) parts.push(`Jenis: ${m.jenisLabel}`);
  if (m.search) parts.push(`Cari: "${m.search}"`);
  return parts.length ? parts.join("   ·   ") : "Semua data (tanpa filter)";
}

/** Susun workbook Excel rapi untuk daftar rujukan keluar. */
export async function buildRujukanExcel(
  rows: RujukanKeluarExportItem[],
  meta: RujukanExportMeta,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ReportHub RSB";
  wb.created = meta.generatedAt;

  const ws = wb.addWorksheet("Rujukan Keluar", {
    views: [{ state: "frozen", ySplit: 5, xSplit: 0 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const lastCol = COLUMNS.length; // 1-indexed
  ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));

  // Baris 1: judul
  ws.mergeCells(1, 1, 1, lastCol);
  const title = ws.getCell(1, 1);
  title.value = "LAPORAN RUJUKAN KELUAR";
  title.font = { name: "Calibri", size: 15, bold: true, color: { argb: TEAL } };
  title.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 24;

  // Baris 2: RS / sumber
  ws.mergeCells(2, 1, 2, lastCol);
  const sub = ws.getCell(2, 1);
  sub.value = "RSUD Pratama Bolaang Mongondow Timur · Sumber: BPJS VClaim";
  sub.font = { name: "Calibri", size: 10, color: { argb: "FF64748B" } };

  // Baris 3: filter
  ws.mergeCells(3, 1, 3, lastCol);
  const flt = ws.getCell(3, 1);
  flt.value = filterSummary(meta);
  flt.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF475569" } };

  // Baris 4: dibuat + total
  ws.mergeCells(4, 1, 4, lastCol);
  const info = ws.getCell(4, 1);
  info.value = `Dibuat: ${stampWita(meta.generatedAt)}${meta.by ? ` oleh ${meta.by}` : ""}   ·   Total: ${meta.total} baris`;
  info.font = { name: "Calibri", size: 10, color: { argb: "FF475569" } };

  // Baris 5: header
  const headerRowIdx = 5;
  const headerRow = ws.getRow(headerRowIdx);
  COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: TEAL } },
      bottom: { style: "thin", color: { argb: TEAL } },
      left: { style: "thin", color: { argb: TEAL } },
      right: { style: "thin", color: { argb: TEAL } },
    };
  });
  headerRow.height = 26;

  // Data
  const textCols = new Set<keyof RujukanKeluarExportItem>(["noSep", "noRujukan", "noKartu", "pasienNik"]);
  const centerCols = new Set<keyof RujukanKeluarExportItem>([
    "tglRujukan", "tglRencanaKunjungan", "tglBerlakuKunjungan",
    "jenisLabel", "diagRujukan", "tujuanKode", "poliKode", "statusLabel",
  ]);
  rows.forEach((r, ri) => {
    const row = ws.getRow(headerRowIdx + 1 + ri);
    COLUMNS.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = r[c.key] ?? "";
      if (textCols.has(c.key)) cell.numFmt = "@"; // paksa teks (cegah notasi ilmiah NIK/SEP)
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF1E293B" } };
      cell.alignment = {
        vertical: "top",
        horizontal: centerCols.has(c.key) ? "center" : "left",
        wrapText: c.key === "catatan",
      };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
      if (ri % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      }
      // Tandai jenis pelayanan dgn warna lembut.
      if (c.key === "jenisLabel") {
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: r.jenisLabel === "Rawat Inap" ? TEAL : "FF9A3412" } };
      }
    });
  });

  // Auto-filter pada header + data
  ws.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: headerRowIdx + rows.length, column: lastCol },
  };

  // Jika kosong, tulis catatan
  if (rows.length === 0) {
    ws.mergeCells(headerRowIdx + 1, 1, headerRowIdx + 1, lastCol);
    const empty = ws.getCell(headerRowIdx + 1, 1);
    empty.value = "Tidak ada data rujukan untuk filter ini.";
    empty.font = { italic: true, color: { argb: "FF94A3B8" } };
    empty.alignment = { horizontal: "center" };
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
