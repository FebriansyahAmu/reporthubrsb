import "server-only";
import ExcelJS from "exceljs";
import { stampWita } from "@/server/lib/excel";
import { MENULAR_DEFINISI, MENULAR_MODE_LABEL } from "@/server/lib/icd-menular";
import { RL41_AGE_GROUPS } from "@/server/modules/rl41/rl41.constants";
import type { Rl51Result } from "./rl51.types";

/**
 * Workbook Excel RL 5.1 — matriks lebar (per ICD-10 × 25 kelompok umur × L/P
 * untuk KASUS BARU + blok Kasus Baru + blok Jumlah Kunjungan). Header dua baris
 * bertingkat. Gaya konsisten dengan RL 4.1 (teal, zebra, border).
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

const AGE_START = 4;
const AGE_END = AGE_START + 25 * 2 - 1; // 53
const COL_BL = 54; // baru L
const COL_BP = 55; // baru P
const COL_BT = 56; // baru total
const COL_KL = 57; // kunjungan L
const COL_KP = 58; // kunjungan P
const COL_KT = 59; // kunjungan total
const LAST = COL_KT;

export type Rl51ExcelMeta = { generatedAt: Date; by?: string };

function borderAll(argb: string) {
  return {
    top: { style: "thin" as const, color: { argb } },
    bottom: { style: "thin" as const, color: { argb } },
    left: { style: "thin" as const, color: { argb } },
    right: { style: "thin" as const, color: { argb } },
  };
}

export async function buildRl51Excel(result: Rl51Result, meta: Rl51ExcelMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditTrail RS BOLTIM";
  wb.created = meta.generatedAt;

  const ws = wb.addWorksheet("RL 5.1", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 42;
  for (let c = AGE_START; c <= AGE_END; c++) ws.getColumn(c).width = 5.5;
  [COL_BL, COL_BP, COL_BT, COL_KL, COL_KP, COL_KT].forEach((c) => (ws.getColumn(c).width = 7.5));

  const mergeAcross = (row: number) => ws.mergeCells(row, 1, row, LAST);

  let r = 1;
  mergeAcross(r);
  const title = ws.getCell(r, 1);
  title.value = "RL 5.1 — DATA MORBIDITAS PASIEN RAWAT JALAN";
  title.font = { name: "Calibri", size: 14, bold: true, color: { argb: TEAL } };
  title.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(r).height = 22;
  r++;

  mergeAcross(r);
  const sub = ws.getCell(r, 1);
  sub.value = result.instansi
    ? `${result.instansi.nama} · Kode RS ${result.instansi.kodeRs} · ${result.instansi.kota}`
    : "RSUD Bolaang Mongondow Timur";
  sub.font = { name: "Calibri", size: 10, color: { argb: SUBTLE } };
  r++;

  const metaLines = [
    `Periode: ${result.periode.from} s/d ${result.periode.to}   ·   Bulan: ${result.bulan} ${result.tahun}   ·   Kelompok penyakit: ${MENULAR_MODE_LABEL[result.menular]}`,
    `Total kunjungan: ${idNum.format(result.summary.totalKunjungan)}   ·   Kasus baru: ${idNum.format(result.summary.totalBaru)}   ·   Jenis diagnosa (ICD-10): ${idNum.format(result.summary.jenisDiag)}   ·   L: ${idNum.format(result.summary.totalLk)}   ·   P: ${idNum.format(result.summary.totalPr)}`,
    `Kolom kelompok umur = KASUS BARU. Dibuat: ${stampWita(meta.generatedAt)}${meta.by ? ` oleh ${meta.by}` : ""}   ·   Sumber: SIMGOS (read-only) · di-port dari SP LaporanRL51Revisi${result.menular !== "all" ? `   ·   ${MENULAR_DEFINISI}` : ""}`,
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
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: h2 }];

  const styleHeader = (cell: ExcelJS.Cell, dark = false) => {
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: dark ? TEAL_DK : TEAL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = borderAll(TEAL);
  };

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

  // Grup umur (kasus baru): h1 label grup (merge 2 kolom) + h2 L/P
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

  // Kasus Baru (L, P, Total)
  ws.mergeCells(h1, COL_BL, h1, COL_BT);
  const bc = ws.getCell(h1, COL_BL);
  bc.value = "Kasus Baru";
  styleHeader(bc);
  ([[COL_BL, "L"], [COL_BP, "P"], [COL_BT, "Total"]] as const).forEach(([c, lbl]) => {
    const cell = ws.getCell(h2, c);
    cell.value = lbl;
    styleHeader(cell, true);
  });

  // Jumlah Kunjungan (L, P, Total)
  ws.mergeCells(h1, COL_KL, h1, COL_KT);
  const kc = ws.getCell(h1, COL_KL);
  kc.value = "Jumlah Kunjungan";
  styleHeader(kc);
  ([[COL_KL, "L"], [COL_KP, "P"], [COL_KT, "Total"]] as const).forEach(([c, lbl]) => {
    const cell = ws.getCell(h2, c);
    cell.value = lbl;
    styleHeader(cell, true);
  });

  ws.getRow(h1).height = 32;
  ws.getRow(h2).height = 15;

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
    row.umur.forEach((uu, i) => {
      const cL = AGE_START + i * 2;
      put(cL, uu.lk, { align: "center", dim: uu.lk === 0 });
      put(cL + 1, uu.pr, { align: "center", dim: uu.pr === 0 });
    });
    put(COL_BL, row.baruLk, { align: "right" });
    put(COL_BP, row.baruPr, { align: "right" });
    put(COL_BT, row.baru, { align: "right", bold: true });
    put(COL_KL, row.lk, { align: "right" });
    put(COL_KP, row.pr, { align: "right" });
    put(COL_KT, row.total, { align: "right", bold: true });
  });

  if (result.data.length > 0) {
    const ageTot = Array.from({ length: 25 }, () => ({ lk: 0, pr: 0 }));
    let baruLk = 0;
    let baruPr = 0;
    for (const row of result.data) {
      row.umur.forEach((uu, i) => {
        ageTot[i].lk += uu.lk;
        ageTot[i].pr += uu.pr;
      });
      baruLk += row.baruLk;
      baruPr += row.baruPr;
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
    ageTot.forEach((uu, i) => {
      putTot(AGE_START + i * 2, uu.lk, "center");
      putTot(AGE_START + i * 2 + 1, uu.pr, "center");
    });
    putTot(COL_BL, baruLk);
    putTot(COL_BP, baruPr);
    putTot(COL_BT, result.summary.totalBaru);
    putTot(COL_KL, result.summary.totalLk);
    putTot(COL_KP, result.summary.totalPr);
    putTot(COL_KT, result.summary.totalKunjungan);
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
