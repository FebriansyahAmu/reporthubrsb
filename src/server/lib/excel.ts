import "server-only";
import ExcelJS from "exceljs";

/**
 * Pembangun workbook Excel generik untuk laporan "ter-styling rapi" — dipakai
 * beberapa modul laporan agar tampilannya konsisten (judul, ringkasan filter,
 * header teal, zebra, border, freeze, auto-filter). Angka disimpan sebagai NUMBER
 * + numFmt (bukan string) sehingga tetap bisa dijumlah/urut di Excel.
 */

const TEAL = "FF0F766E";
const ZEBRA = "FFF6F8FA";
const BORDER = "FFD7DEE5";
const INK = "FF1E293B";
const MUTED = "FF475569";
const SUBTLE = "FF64748B";
/** Medali peringkat 1–3 (emas, perak, perunggu) — lembut. */
const MEDAL = ["FFFDE68A", "FFE6EAF0", "FFFCD9B6"];

const p2 = (n: number) => String(n).padStart(2, "0");

/** Jam dinding RS (WITA, UTC+8) apa adanya. */
export function stampWita(d: Date): string {
  const w = new Date(d.getTime() + 8 * 3600 * 1000);
  return `${w.getUTCFullYear()}-${p2(w.getUTCMonth() + 1)}-${p2(w.getUTCDate())} ${p2(w.getUTCHours())}:${p2(w.getUTCMinutes())} WITA`;
}

export type ExcelColumn<T> = {
  header: string;
  width: number;
  value: (row: T, index: number) => string | number | null | undefined;
  align?: "left" | "center" | "right";
  /** Format angka Excel, mis. "#,##0" atau '"Rp"#,##0'. */
  numFmt?: string;
  /** Paksa teks (mis. kode/NIK agar tak jadi notasi ilmiah). */
  text?: boolean;
  bold?: boolean;
};

export type BuildReportOptions<T> = {
  sheetName: string;
  title: string;
  /** Baris kecil di bawah judul (mis. nama RS / sumber data). */
  subtitle?: string;
  /** Baris info (ringkasan filter, statistik, dibuat oleh, dll). */
  metaLines: string[];
  columns: ExcelColumn<T>[];
  rows: T[];
  generatedAt: Date;
  emptyText?: string;
  /** Beri warna medali pada sel peringkat baris 1–3 (kolom pertama). */
  rankMedal?: boolean;
};

/** Susun workbook Excel rapi dari definisi kolom + baris. */
export async function buildReportWorkbook<T>(opts: BuildReportOptions<T>): Promise<Buffer> {
  const { columns, rows } = opts;
  const lastCol = columns.length; // 1-indexed
  const wb = new ExcelJS.Workbook();
  wb.creator = "ReportHub RSB";
  wb.created = opts.generatedAt;

  // Tata letak baris atas.
  let r = 1;
  const titleRowIdx = r++;
  const subtitleRowIdx = opts.subtitle ? r++ : 0;
  const metaStart = r;
  r += opts.metaLines.length;
  const headerRowIdx = r++;
  const dataStart = r;

  const ws = wb.addWorksheet(opts.sheetName, {
    views: [{ state: "frozen", ySplit: headerRowIdx, xSplit: 0 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = columns.map((c) => ({ width: c.width }));

  const mergeAcross = (row: number) => ws.mergeCells(row, 1, row, lastCol);

  // Judul
  mergeAcross(titleRowIdx);
  const title = ws.getCell(titleRowIdx, 1);
  title.value = opts.title;
  title.font = { name: "Calibri", size: 15, bold: true, color: { argb: TEAL } };
  title.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(titleRowIdx).height = 24;

  // Subjudul
  if (subtitleRowIdx) {
    mergeAcross(subtitleRowIdx);
    const sub = ws.getCell(subtitleRowIdx, 1);
    sub.value = opts.subtitle ?? "";
    sub.font = { name: "Calibri", size: 10, color: { argb: SUBTLE } };
  }

  // Baris meta
  opts.metaLines.forEach((line, i) => {
    const idx = metaStart + i;
    mergeAcross(idx);
    const cell = ws.getCell(idx, 1);
    cell.value = line;
    cell.font = { name: "Calibri", size: 10, italic: i === 0, color: { argb: MUTED } };
  });

  // Header
  const headerRow = ws.getRow(headerRowIdx);
  columns.forEach((c, i) => {
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
  rows.forEach((row, ri) => {
    const excelRow = ws.getRow(dataStart + ri);
    columns.forEach((c, ci) => {
      const cell = excelRow.getCell(ci + 1);
      const v = c.value(row, ri);
      cell.value = v ?? "";
      if (c.text) cell.numFmt = "@";
      else if (typeof v === "number" && c.numFmt) cell.numFmt = c.numFmt;
      cell.font = { name: "Calibri", size: 10, bold: !!c.bold, color: { argb: INK } };
      cell.alignment = {
        vertical: "middle",
        horizontal: c.align ?? (typeof v === "number" ? "right" : "left"),
        wrapText: false,
      };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
      if (ri % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      // Medali peringkat pada kolom pertama.
      if (opts.rankMedal && ci === 0 && ri < 3) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MEDAL[ri] } };
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: INK } };
      }
    });
  });

  ws.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: headerRowIdx + Math.max(rows.length, 0), column: lastCol },
  };

  if (rows.length === 0) {
    mergeAcross(dataStart);
    const empty = ws.getCell(dataStart, 1);
    empty.value = opts.emptyText ?? "Tidak ada data untuk filter ini.";
    empty.font = { italic: true, color: { argb: "FF94A3B8" } };
    empty.alignment = { horizontal: "center" };
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
