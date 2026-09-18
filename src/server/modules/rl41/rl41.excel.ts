import "server-only";
import ExcelJS from "exceljs";
import { stampWita } from "@/server/lib/excel";
import { RL41_AGE_GROUPS } from "./rl41.constants";
import type { Rl41Result } from "./rl41.types";

/**
 * Workbook Excel RL 4.1 — matriks lebar (per ICD-10 × 25 kelompok umur × L/P +
 * jenis kelamin + kematian). Header dua baris bertingkat (grup umur menaungi
 * kolom L/P). Dibuat bespoke (bukan buildReportWorkbook) karena butuh header
 * ber-merge; gaya visual dijaga konsisten (teal, zebra, border).
 */

const TEAL = "FF0F766E";
const TEAL_DK = "FF0B5A54";
const ZEBRA = "FFF6F8FA";
const BORDER = "FFD7DEE5";
const INK = "FF1E293B";
const MUTED = "FF475569";
const SUBTLE = "FF64748B";
const TOTAL_BG = "FFE8EEF0";

const idNum = new Intl.NumberFormat("id-ID");

// Tata letak kolom (1-indexed).
const AGE_START = 4;
const AGE_END = AGE_START + 25 * 2 - 1; // 53
const COL_L = 54;
const COL_P = 55;
const COL_TOT = 56;
const COL_ML = 57;
const COL_MP = 58;
const COL_MT = 59;
const LAST = COL_MT;

export type Rl41ExcelMeta = { generatedAt: Date; by?: string };

function borderAll(argb: string) {
  return {
    top: { style: "thin" as const, color: { argb } },
    bottom: { style: "thin" as const, color: { argb } },
    left: { style: "thin" as const, color: { argb } },
    right: { style: "thin" as const, color: { argb } },
  };
}

export async function buildRl41Excel(result: Rl41Result, meta: Rl41ExcelMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditTrail RS BOLTIM";
  wb.created = meta.generatedAt;

  const ws = wb.addWorksheet("RL 4.1", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // Lebar kolom
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 42;
  for (let c = AGE_START; c <= AGE_END; c++) ws.getColumn(c).width = 5.5;
  [COL_L, COL_P, COL_TOT, COL_ML, COL_MP, COL_MT].forEach((c) => (ws.getColumn(c).width = 7.5));

  const mergeAcross = (row: number) => ws.mergeCells(row, 1, row, LAST);

  let r = 1;
  // Judul
  mergeAcross(r);
  const title = ws.getCell(r, 1);
  title.value = "RL 4.1 — DATA MORBIDITAS & MORTALITAS PASIEN RAWAT INAP";
  title.font = { name: "Calibri", size: 14, bold: true, color: { argb: TEAL } };
  title.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(r).height = 22;
  r++;

  // Subjudul (instansi)
  mergeAcross(r);
  const sub = ws.getCell(r, 1);
  sub.value = result.instansi
    ? `${result.instansi.nama} · Kode RS ${result.instansi.kodeRs} · ${result.instansi.kota}`
    : "RSUD Bolaang Mongondow Timur";
  sub.font = { name: "Calibri", size: 10, color: { argb: SUBTLE } };
  r++;

  // Baris meta
  const metaLines = [
    `Periode: ${result.periode.from} s/d ${result.periode.to}   ·   Bulan: ${result.bulan} ${result.tahun}`,
    `Total kasus: ${idNum.format(result.summary.totalKasus)}   ·   Jenis diagnosa (ICD-10): ${idNum.format(result.summary.jenisDiag)}   ·   Laki-laki: ${idNum.format(result.summary.totalLk)}   ·   Perempuan: ${idNum.format(result.summary.totalPr)}   ·   Meninggal: ${idNum.format(result.summary.totalMati)}`,
    `Dibuat: ${stampWita(meta.generatedAt)}${meta.by ? ` oleh ${meta.by}` : ""}   ·   Sumber: SIMGOS (read-only) · di-port dari SP LaporanRL41Revisi`,
  ];
  metaLines.forEach((line, i) => {
    mergeAcross(r);
    const cell = ws.getCell(r, 1);
    cell.value = line;
    cell.font = { name: "Calibri", size: 9.5, italic: i === 0, color: { argb: MUTED } };
    r++;
  });
  r++; // spacer

  const h1 = r;
  const h2 = r + 1;
  const dataStart = r + 2;

  // Freeze 3 kolom pertama + baris header.
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: h2 }];

  const styleHeader = (cell: ExcelJS.Cell, dark = false) => {
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: dark ? TEAL_DK : TEAL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = borderAll(TEAL);
  };

  // Kolom identitas — merge vertikal h1:h2
  const vmerge = (col: number, label: string) => {
    ws.mergeCells(h1, col, h2, col);
    const cell = ws.getCell(h1, col);
    cell.value = label;
    styleHeader(cell);
    cell.alignment = { vertical: "middle", horizontal: col === 3 ? "left" : "center", wrapText: true };
  };
  vmerge(1, "No");
  vmerge(2, "Kode ICD-10");
  vmerge(3, "Golongan Penyebab Penyakit (Diagnosa)");

  // Grup umur: h1 (nama grup, merge 2 kolom) + h2 (L / P)
  RL41_AGE_GROUPS.forEach((g, i) => {
    const cL = AGE_START + i * 2;
    ws.mergeCells(h1, cL, h1, cL + 1);
    const gc = ws.getCell(h1, cL);
    gc.value = g.label;
    styleHeader(gc);
    const l = ws.getCell(h2, cL);
    l.value = "L";
    styleHeader(l, true);
    const p = ws.getCell(h2, cL + 1);
    p.value = "P";
    styleHeader(p, true);
  });

  // Jumlah (L, P, Total)
  ws.mergeCells(h1, COL_L, h1, COL_TOT);
  const jc = ws.getCell(h1, COL_L);
  jc.value = "Jumlah";
  styleHeader(jc);
  ([[COL_L, "L"], [COL_P, "P"], [COL_TOT, "Total"]] as const).forEach(([c, lbl]) => {
    const cell = ws.getCell(h2, c);
    cell.value = lbl;
    styleHeader(cell, true);
  });

  // Mati (L, P, Total)
  ws.mergeCells(h1, COL_ML, h1, COL_MT);
  const mc = ws.getCell(h1, COL_ML);
  mc.value = "Mati";
  styleHeader(mc);
  ([[COL_ML, "L"], [COL_MP, "P"], [COL_MT, "Total"]] as const).forEach(([c, lbl]) => {
    const cell = ws.getCell(h2, c);
    cell.value = lbl;
    styleHeader(cell, true);
  });

  ws.getRow(h1).height = 32;
  ws.getRow(h2).height = 15;

  // Baris data
  result.data.forEach((row, ri) => {
    const excelRow = ws.getRow(dataStart + ri);
    const zebra = ri % 2 === 1;
    const put = (
      col: number,
      v: string | number,
      opts?: { align?: "left" | "center" | "right"; bold?: boolean; text?: boolean; dim?: boolean },
    ) => {
      const cell = excelRow.getCell(col);
      cell.value = v ?? "";
      if (opts?.text) cell.numFmt = "@";
      else if (typeof v === "number") cell.numFmt = "#,##0";
      cell.font = {
        name: "Calibri",
        size: 9,
        bold: !!opts?.bold,
        color: { argb: opts?.dim ? SUBTLE : INK },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: opts?.align ?? (typeof v === "number" ? "right" : "left"),
      };
      cell.border = borderAll(BORDER);
      if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    };

    put(1, row.rank, { align: "center", dim: true });
    put(2, row.kode, { align: "center", text: true, bold: true });
    put(3, row.diagnosa);
    row.umur.forEach((u, i) => {
      const cL = AGE_START + i * 2;
      put(cL, u.lk, { align: "center", dim: u.lk === 0 });
      put(cL + 1, u.pr, { align: "center", dim: u.pr === 0 });
    });
    put(COL_L, row.lk, { align: "right" });
    put(COL_P, row.pr, { align: "right" });
    put(COL_TOT, row.total, { align: "right", bold: true });
    put(COL_ML, row.matiLk, { align: "right", dim: row.matiLk === 0 });
    put(COL_MP, row.matiPr, { align: "right", dim: row.matiPr === 0 });
    put(COL_MT, row.mati, { align: "right", bold: true, dim: row.mati === 0 });
  });

  // Baris TOTAL
  if (result.data.length > 0) {
    const ageTot = Array.from({ length: 25 }, () => ({ lk: 0, pr: 0 }));
    let matiLk = 0;
    let matiPr = 0;
    for (const row of result.data) {
      row.umur.forEach((u, i) => {
        ageTot[i].lk += u.lk;
        ageTot[i].pr += u.pr;
      });
      matiLk += row.matiLk;
      matiPr += row.matiPr;
    }
    const totalRowIdx = dataStart + result.data.length;
    const totRow = ws.getRow(totalRowIdx);
    const putTot = (col: number, v: string | number, align: "left" | "center" | "right" = "right") => {
      const cell = totRow.getCell(col);
      cell.value = v ?? "";
      if (typeof v === "number") cell.numFmt = "#,##0";
      cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: INK } };
      cell.alignment = { vertical: "middle", horizontal: align };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } };
      cell.border = borderAll(BORDER);
    };
    ws.mergeCells(totalRowIdx, 1, totalRowIdx, 3);
    putTot(1, "TOTAL", "center");
    ageTot.forEach((u, i) => {
      putTot(AGE_START + i * 2, u.lk, "center");
      putTot(AGE_START + i * 2 + 1, u.pr, "center");
    });
    putTot(COL_L, result.summary.totalLk);
    putTot(COL_P, result.summary.totalPr);
    putTot(COL_TOT, result.summary.totalKasus);
    putTot(COL_ML, matiLk);
    putTot(COL_MP, matiPr);
    putTot(COL_MT, result.summary.totalMati);
  } else {
    mergeAcross(dataStart);
    const empty = ws.getCell(dataStart, 1);
    empty.value = "Tidak ada data untuk periode ini.";
    empty.font = { italic: true, color: { argb: "FF94A3B8" } };
    empty.alignment = { horizontal: "center" };
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
