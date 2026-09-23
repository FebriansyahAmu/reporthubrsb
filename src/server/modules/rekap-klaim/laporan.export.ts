import "server-only";
import ExcelJS from "exceljs";
import { buildReportPdf, type PdfTableSpec } from "@/server/lib/pdf";
import { stampWita } from "@/server/lib/excel";
import { formatRupiah, formatNumber } from "@/lib/format";
import { BULAN_LABEL, JENIS_KLAIM, JENIS_KLAIM_LABEL } from "./klaim.schema";
import type { LaporanData } from "./laporan.service";

/**
 * Export laporan Rekap Klaim BPJS ke Excel (.xlsx, multi-sheet meniru workbook
 * sumber) dan PDF (dokumen resmi landscape). Angka Excel disimpan sebagai NUMBER
 * + numFmt agar tetap bisa dijumlah/urut. Uang = rupiah penuh.
 */

const TEAL = "FF0F766E";
const ZEBRA = "FFF6F8FA";
const BORDER = "FFD7DEE5";
const INK = "FF1E293B";
const MUTED = "FF475569";
const TOTAL_BG = "FFE8EDF1";
const RP = '"Rp"#,##0';
const NUM = "#,##0";

const periodeLabel = (tahun: number, bulan: number) => `${BULAN_LABEL[bulan - 1]} ${tahun}`;

type ExportMeta = { generatedAt: Date; by: string };

/* ------------------------------------------------------------------- Excel */

type Col = { header: string; width: number; align?: "left" | "center" | "right"; numFmt?: string; bold?: boolean };
type Block = {
  caption?: string;
  columns: Col[];
  rows: (string | number | null)[][];
  totals?: (string | number | null)[];
  /** Baris mulai indeks ini ditandai (bold + latar) sebagai ringkasan. */
  emphasizeFrom?: number;
};

const allBorder = (argb: string) => ({
  top: { style: "thin" as const, color: { argb } },
  bottom: { style: "thin" as const, color: { argb } },
  left: { style: "thin" as const, color: { argb } },
  right: { style: "thin" as const, color: { argb } },
});

function styleCell(
  cell: ExcelJS.Cell,
  value: string | number | null | undefined,
  col: Col,
  zebra: boolean,
  emph: boolean,
) {
  cell.value = value ?? "";
  if (typeof value === "number" && col.numFmt) cell.numFmt = col.numFmt;
  cell.font = { name: "Calibri", size: 9.5, bold: emph || !!col.bold, color: { argb: INK } };
  cell.alignment = { vertical: "middle", horizontal: col.align ?? (typeof value === "number" ? "right" : "left") };
  cell.border = allBorder(BORDER);
  if (emph) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } };
  else if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
}

function writeSheet(wb: ExcelJS.Workbook, name: string, title: string, metaLines: string[], blocks: Block[]) {
  const colCount = Math.max(1, ...blocks.map((b) => b.columns.length));
  const ws = wb.addWorksheet(name, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const widths: number[] = [];
  for (let i = 0; i < colCount; i++) widths[i] = Math.max(...blocks.map((b) => b.columns[i]?.width ?? 0));
  ws.columns = widths.map((w) => ({ width: w }));

  const merge = (row: number) => ws.mergeCells(row, 1, row, colCount);
  let r = 1;

  merge(r);
  const t = ws.getCell(r, 1);
  t.value = title;
  t.font = { name: "Calibri", size: 14, bold: true, color: { argb: TEAL } };
  ws.getRow(r).height = 22;
  r++;

  for (const line of metaLines) {
    merge(r);
    const c = ws.getCell(r, 1);
    c.value = line;
    c.font = { name: "Calibri", size: 9, italic: true, color: { argb: MUTED } };
    r++;
  }
  r++; // jeda

  for (const block of blocks) {
    if (block.caption) {
      merge(r);
      const c = ws.getCell(r, 1);
      c.value = block.caption;
      c.font = { name: "Calibri", size: 11, bold: true, color: { argb: INK } };
      r++;
    }
    const hr = ws.getRow(r);
    block.columns.forEach((col, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = col.header;
      cell.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = allBorder(TEAL);
    });
    hr.height = 24;
    r++;

    block.rows.forEach((row, ri) => {
      const emph = block.emphasizeFrom != null && ri >= block.emphasizeFrom;
      const er = ws.getRow(r);
      block.columns.forEach((col, ci) => styleCell(er.getCell(ci + 1), row[ci], col, !emph && ri % 2 === 1, emph));
      r++;
    });
    if (block.totals) {
      const er = ws.getRow(r);
      block.columns.forEach((col, ci) => styleCell(er.getCell(ci + 1), block.totals![ci], col, false, true));
      r++;
    }
    r++; // jeda antar-blok
  }
  return ws;
}

export async function buildLaporanExcel(data: LaporanData, meta: ExportMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditTrail RS BOLTIM";
  wb.created = meta.generatedAt;
  const stamp = `Dibuat oleh ${meta.by} · ${stampWita(meta.generatedAt)}`;

  // Sheet: Rekap tahunan (matriks INA-CBG's) + ringkasan.
  const th = data.tahunan;
  if (th) {
    const matrixCols: Col[] = [
      { header: "Jenis Klaim", width: 26, bold: true },
      { header: "Rawat Inap (RITL)", width: 20, numFmt: RP },
      { header: "Rawat Jalan (RJTL)", width: 20, numFmt: RP },
      { header: "Total", width: 22, numFmt: RP, bold: true },
    ];
    const matrixRows = JENIS_KLAIM.map((j) => [
      JENIS_KLAIM_LABEL[j], th.inaCbgs[j].ritl, th.inaCbgs[j].rjtl, th.inaCbgs[j].total,
    ]);
    writeSheet(
      wb, `Rekap ${th.tahun}`, `Rekapitulasi Klaim ${th.tahun}`,
      [
        stamp,
        `Total dana klaim: ${formatRupiah(th.totalDana)}`,
        `INA-CBG's: ${formatRupiah(th.inaCbgsTotal.total)}  ·  Rujukan Ambulans: ${formatRupiah(th.rujukan.dana)} (${formatNumber(th.rujukan.kasus)} kasus, ${th.rujukan.entri} entri)`,
        `Total potongan/adjustment: ${formatRupiah(th.totalPotongan)}  ·  Nilai bersih: ${formatRupiah(th.nilaiBersih)}`,
        `Klaim belum cair: ${th.belumCair.count} entri · ${formatRupiah(th.belumCair.nilai)}`,
        `Jumlah entri: ${th.entri}  ·  Total kasus: ${formatNumber(th.totalKasus)}`,
      ],
      [{
        caption: "Rincian INA-CBG's per Jenis Klaim",
        columns: matrixCols,
        rows: matrixRows,
        totals: ["TOTAL INA-CBG's", th.inaCbgsTotal.ritl, th.inaCbgsTotal.rjtl, th.inaCbgsTotal.total],
      }],
    );

    // Sheet: rincian per bulan.
    writeSheet(
      wb, `Bulanan ${th.tahun}`, `Rincian per Bulan Pelayanan ${th.tahun}`,
      [stamp],
      [{
        columns: [
          { header: "Bulan", width: 16, bold: true },
          { header: "Entri", width: 10, numFmt: NUM },
          { header: "Kasus", width: 10, numFmt: NUM },
          { header: "Dana", width: 22, numFmt: RP },
          { header: "Potongan", width: 20, numFmt: RP },
        ],
        rows: th.perBulan.map((b) => [BULAN_LABEL[b.bulan - 1], b.entri, b.kasus, b.dana, b.potongan]),
        totals: [
          "TOTAL",
          th.perBulan.reduce((s, b) => s + b.entri, 0),
          th.perBulan.reduce((s, b) => s + b.kasus, 0),
          th.perBulan.reduce((s, b) => s + b.dana, 0),
          th.perBulan.reduce((s, b) => s + b.potongan, 0),
        ],
      }],
    );
  }

  // Sheet: perbandingan antar tahun.
  const p = data.perbandingan;
  if (p.tahun.length) {
    const cols: Col[] = [
      { header: "Komponen", width: 26, bold: true },
      ...p.tahun.map((y) => ({ header: String(y), width: 18, numFmt: RP, align: "right" as const })),
    ];
    const compRows = p.rows.map((rw) => [rw.label, ...p.tahun.map((y) => rw.perTahun[y])]);
    const summaryRows = [
      ["Total Dana", ...p.tahun.map((y) => p.totalDana[y])],
      ["Potongan", ...p.tahun.map((y) => p.totalPotongan[y])],
      ["Nilai Bersih", ...p.tahun.map((y) => p.nilaiBersih[y])],
    ];
    writeSheet(
      wb, "Perbandingan", "Perbandingan Klaim Antar Tahun",
      [stamp, "Nilai = jumlah dana klaim (rupiah) per komponen tiap tahun pelayanan."],
      [{
        caption: "Dana per Komponen & Ringkasan",
        columns: cols,
        rows: [...compRows, ...summaryRows],
        emphasizeFrom: compRows.length,
      }],
    );
  }

  // Sheet: klaim pending (RI vs RJ).
  const pend = data.pending;
  if (pend.perBulan.length) {
    writeSheet(
      wb, "Pending", `Laporan Klaim Pending${data.tahun ? ` ${data.tahun}` : ""}`,
      [stamp, "Klaim pending dikelompokkan Rawat Inap (RITL) vs Rawat Jalan (RJTL) per bulan pelayanan."],
      [{
        columns: [
          { header: "Periode", width: 18, bold: true },
          { header: "Kasus RI", width: 10, numFmt: NUM },
          { header: "Biaya RI", width: 20, numFmt: RP },
          { header: "Kasus RJ", width: 10, numFmt: NUM },
          { header: "Biaya RJ", width: 20, numFmt: RP },
          { header: "Total Kasus", width: 12, numFmt: NUM },
          { header: "Total Biaya", width: 22, numFmt: RP },
        ],
        rows: pend.perBulan.map((e) => [
          periodeLabel(e.tahun, e.bulan), e.riKasus, e.riBiaya, e.rjKasus, e.rjBiaya, e.kasus, e.biaya,
        ]),
        totals: [
          "TOTAL", pend.totals.riKasus, pend.totals.riBiaya, pend.totals.rjKasus,
          pend.totals.rjBiaya, pend.totals.kasus, pend.totals.biaya,
        ],
      }],
    );
  }

  // Sheet: rujukan ambulans (per bulan + per tahun).
  const ruj = data.rujukan;
  if (ruj.perBulan.length) {
    writeSheet(
      wb, "Rujukan", `Laporan Rujukan Ambulans${data.tahun ? ` ${data.tahun}` : ""}`,
      [stamp, "Klaim rujukan ambulans (terpisah dari INA-CBG's) per bulan & rekap per tahun."],
      [
        {
          caption: "Per Bulan Pelayanan",
          columns: [
            { header: "Periode", width: 18, bold: true },
            { header: "Entri", width: 10, numFmt: NUM },
            { header: "Kasus", width: 10, numFmt: NUM },
            { header: "Biaya", width: 22, numFmt: RP },
          ],
          rows: ruj.perBulan.map((e) => [periodeLabel(e.tahun, e.bulan), e.entri, e.kasus, e.biaya]),
          totals: ["TOTAL", ruj.totals.entri, ruj.totals.kasus, ruj.totals.biaya],
        },
        {
          caption: "Rekap per Tahun",
          columns: [
            { header: "Tahun", width: 18, bold: true },
            { header: "Entri", width: 10, numFmt: NUM },
            { header: "Kasus", width: 10, numFmt: NUM },
            { header: "Biaya", width: 22, numFmt: RP },
          ],
          rows: ruj.perTahun.map((e) => [String(e.tahun), e.entri, e.kasus, e.biaya]),
        },
      ],
    );
  }

  // Pastikan minimal ada satu sheet (data kosong).
  if (wb.worksheets.length === 0) {
    writeSheet(wb, "Rekap", "Rekapitulasi Klaim BPJS", [stamp, "Belum ada data klaim untuk direkap."], [
      { columns: [{ header: "Info", width: 40 }], rows: [["Belum ada data."]] },
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/* --------------------------------------------------------------------- PDF */

export async function buildLaporanPdf(data: LaporanData, meta: ExportMeta): Promise<Buffer> {
  const tables: PdfTableSpec[] = [];
  const th = data.tahunan;

  if (th) {
    tables.push({
      caption: `Rekapitulasi INA-CBG's ${th.tahun}`,
      columns: [
        { header: "Jenis Klaim", width: 180 },
        { header: "Rawat Inap (RITL)", width: 185, align: "right" },
        { header: "Rawat Jalan (RJTL)", width: 185, align: "right" },
        { header: "Total", width: 200, align: "right" },
      ],
      rows: JENIS_KLAIM.map((j) => [
        JENIS_KLAIM_LABEL[j], formatRupiah(th.inaCbgs[j].ritl), formatRupiah(th.inaCbgs[j].rjtl), formatRupiah(th.inaCbgs[j].total),
      ]),
      totals: ["TOTAL INA-CBG's", formatRupiah(th.inaCbgsTotal.ritl), formatRupiah(th.inaCbgsTotal.rjtl), formatRupiah(th.inaCbgsTotal.total)],
    });
    tables.push({
      caption: `Rincian per Bulan ${th.tahun}`,
      columns: [
        { header: "Bulan", width: 150 },
        { header: "Entri", width: 90, align: "right" },
        { header: "Kasus", width: 100, align: "right" },
        { header: "Dana", width: 210, align: "right" },
        { header: "Potongan", width: 200, align: "right" },
      ],
      rows: th.perBulan.map((b) => [BULAN_LABEL[b.bulan - 1], String(b.entri), formatNumber(b.kasus), formatRupiah(b.dana), formatRupiah(b.potongan)]),
      totals: [
        "TOTAL", String(th.entri), formatNumber(th.totalKasus),
        formatRupiah(th.inaCbgsTotal.total + th.rujukan.dana), formatRupiah(th.totalPotongan),
      ],
    });
  }

  const p = data.perbandingan;
  if (p.tahun.length) {
    const yearW = Math.min(120, Math.floor((769 - 190) / Math.max(1, p.tahun.length)));
    const compCols = [
      { header: "Komponen", width: 190 },
      ...p.tahun.map((y) => ({ header: String(y), width: yearW, align: "right" as const })),
    ];
    tables.push({
      caption: "Perbandingan Dana Klaim Antar Tahun",
      columns: compCols,
      rows: p.rows.map((rw) => [rw.label, ...p.tahun.map((y) => formatRupiah(rw.perTahun[y]))]),
      totals: ["Total Dana", ...p.tahun.map((y) => formatRupiah(p.totalDana[y]))],
    });
    tables.push({
      caption: "Potongan & Nilai Bersih per Tahun",
      columns: compCols,
      rows: [
        ["Potongan", ...p.tahun.map((y) => formatRupiah(p.totalPotongan[y]))],
        ["Nilai Bersih", ...p.tahun.map((y) => formatRupiah(p.nilaiBersih[y]))],
      ],
    });
  }

  const pend = data.pending;
  if (pend.perBulan.length) {
    tables.push({
      caption: `Laporan Klaim Pending${data.tahun ? ` ${data.tahun}` : ""} (RI vs RJ)`,
      columns: [
        { header: "Periode", width: 90 },
        { header: "Kasus RI", width: 70, align: "right" },
        { header: "Biaya RI", width: 140, align: "right" },
        { header: "Kasus RJ", width: 70, align: "right" },
        { header: "Biaya RJ", width: 140, align: "right" },
        { header: "Total Kasus", width: 80, align: "right" },
        { header: "Total Biaya", width: 150, align: "right" },
      ],
      rows: pend.perBulan.map((e) => [
        periodeLabel(e.tahun, e.bulan), formatNumber(e.riKasus), formatRupiah(e.riBiaya),
        formatNumber(e.rjKasus), formatRupiah(e.rjBiaya), formatNumber(e.kasus), formatRupiah(e.biaya),
      ]),
      totals: [
        "TOTAL", formatNumber(pend.totals.riKasus), formatRupiah(pend.totals.riBiaya),
        formatNumber(pend.totals.rjKasus), formatRupiah(pend.totals.rjBiaya),
        formatNumber(pend.totals.kasus), formatRupiah(pend.totals.biaya),
      ],
    });
  }

  const ruj = data.rujukan;
  if (ruj.perBulan.length) {
    tables.push({
      caption: `Laporan Rujukan Ambulans${data.tahun ? ` ${data.tahun}` : ""} — per Bulan`,
      columns: [
        { header: "Periode", width: 160 },
        { header: "Entri", width: 100, align: "right" },
        { header: "Kasus", width: 120, align: "right" },
        { header: "Biaya", width: 220, align: "right" },
      ],
      rows: ruj.perBulan.map((e) => [periodeLabel(e.tahun, e.bulan), String(e.entri), formatNumber(e.kasus), formatRupiah(e.biaya)]),
      totals: ["TOTAL", String(ruj.totals.entri), formatNumber(ruj.totals.kasus), formatRupiah(ruj.totals.biaya)],
    });
  }

  if (tables.length === 0) {
    tables.push({
      columns: [{ header: "Info", width: 400 }],
      rows: [["Belum ada data klaim untuk direkap."]],
    });
  }

  const scope = data.tahun ? `Tahun pelayanan ${data.tahun}` : "Semua tahun pelayanan";
  return buildReportPdf({
    title: "Rekapitulasi Dana Klaim BPJS",
    subtitle: "RSUD Boltim — INA-CBG's & Rujukan Ambulans",
    metaLines: [scope, `Dibuat oleh ${meta.by} · ${stampWita(meta.generatedAt)}`],
    tables,
    orientation: "landscape",
    footerNote: "AuditTrail RS BOLTIM · Rekap Klaim BPJS",
    generatedAt: meta.generatedAt,
  });
}
