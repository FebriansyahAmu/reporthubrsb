import "server-only";
import ExcelJS from "exceljs";
import { grupMetrik, LABEL_TEMPAT_TIDUR, METRIK_RL32 } from "./rl32.constants";
import { barisPerRuangan, JUDUL_RL32, labelPeta, metaRl32, subjudulRl32 } from "./rl32.dokumen";
import type { NilaiRl32, Rl32Result } from "./rl32.types";

/**
 * Workbook Excel RL 3.2 — sheet "RL 3.2" (37 jenis pelayanan SIRS 6) dan
 * "Per Ruangan" (rincian + status pemetaan). Tiap kolom angka dirinci L / P /
 * Jumlah dengan header bertingkat (grup → kolom → L/P/Jml). Gaya visual sama
 * dengan RL 4.1 (teal, zebra, border).
 */

const TEAL = "FF0F766E";
const TEAL_DK = "FF0B5A54";
const ZEBRA = "FFF6F8FA";
const BORDER = "FFD7DEE5";
const INK = "FF1E293B";
const MUTED = "FF475569";
const SUBTLE = "FF64748B";
const WARN = "FFB45309";
const TOTAL_BG = "FFE8EEF0";

export type Rl32ExcelMeta = { generatedAt: Date; by: string };

type KolomDepan<T> = { header: string; lebar: number; nilai: (row: T, i: number) => string | number; teks?: boolean };

type Matriks<T> = {
  nama: string;
  kolomDepan: KolomDepan<T>[];
  baris: T[];
  nilai: (row: T) => NilaiRl32;
  /** Baris rincian (miring, abu) — tidak ikut dijumlah pembaca. */
  rincian?: (row: T) => boolean;
  total: NilaiRl32;
  labelTotal: string;
};

const borderAll = (argb: string) => ({
  top: { style: "thin" as const, color: { argb } },
  bottom: { style: "thin" as const, color: { argb } },
  left: { style: "thin" as const, color: { argb } },
  right: { style: "thin" as const, color: { argb } },
});

function tulisSheet<T>(wb: ExcelJS.Workbook, r: Rl32Result, m: Matriks<T>, meta: Rl32ExcelMeta): void {
  const nDepan = m.kolomDepan.length;
  const awalAngka = nDepan + 1;
  const kolomTT = awalAngka + METRIK_RL32.length * 3;
  const LAST = kolomTT;

  const ws = wb.addWorksheet(m.nama, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  m.kolomDepan.forEach((k, i) => (ws.getColumn(i + 1).width = k.lebar));
  for (let c = awalAngka; c < kolomTT; c++) ws.getColumn(c).width = 6.5;
  ws.getColumn(kolomTT).width = 10;

  const mergeAcross = (row: number) => ws.mergeCells(row, 1, row, LAST);
  let row = 1;
  mergeAcross(row);
  const judul = ws.getCell(row, 1);
  judul.value = JUDUL_RL32;
  judul.font = { name: "Calibri", size: 14, bold: true, color: { argb: TEAL } };
  ws.getRow(row).height = 22;
  row++;
  mergeAcross(row);
  const sub = ws.getCell(row, 1);
  sub.value = subjudulRl32(r);
  sub.font = { name: "Calibri", size: 10, color: { argb: SUBTLE } };
  row++;
  for (const [i, line] of metaRl32(r, { oleh: meta.by, waktu: meta.generatedAt }).entries()) {
    mergeAcross(row);
    const c = ws.getCell(row, 1);
    c.value = line;
    const peringatan = line.startsWith("PERHATIAN");
    c.font = { name: "Calibri", size: 9.5, italic: i === 0, bold: peringatan, color: { argb: peringatan ? WARN : MUTED } };
    row++;
  }
  row++;

  const h1 = row;
  const h2 = row + 1;
  const h3 = row + 2;
  const dataStart = row + 3;
  ws.views = [{ state: "frozen", xSplit: nDepan, ySplit: h3 }];

  const gayaHeader = (cell: ExcelJS.Cell, gelap = false, kiri = false) => {
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: gelap ? TEAL_DK : TEAL } };
    cell.alignment = { vertical: "middle", horizontal: kiri ? "left" : "center", wrapText: true };
    cell.border = borderAll(TEAL);
  };
  const header = (r1: number, c1: number, r2: number, c2: number, label: string, gelap = false, kiri = false) => {
    if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
    const cell = ws.getCell(r1, c1);
    cell.value = label;
    gayaHeader(cell, gelap, kiri);
  };

  m.kolomDepan.forEach((k, i) => header(h1, i + 1, h3, i + 1, k.header, false, i === nDepan - 1));
  let c = awalAngka;
  for (const g of grupMetrik()) {
    if (g.grup) header(h1, c, h1, c + g.metrik.length * 3 - 1, g.grup);
    for (const mt of g.metrik) {
      if (g.grup) header(h2, c, h2, c + 2, mt.sub);
      else header(h1, c, h2, c + 2, mt.label);
      header(h3, c, h3, c, "L", true);
      header(h3, c + 1, h3, c + 1, "P", true);
      header(h3, c + 2, h3, c + 2, "Jml", true);
      c += 3;
    }
  }
  header(h1, kolomTT, h3, kolomTT, LABEL_TEMPAT_TIDUR);
  ws.getRow(h1).height = 30;
  ws.getRow(h2).height = 30;
  ws.getRow(h3).height = 14;

  const tulisAngka = (excelRow: ExcelJS.Row, n: NilaiRl32, gaya: (cell: ExcelJS.Cell, v: number | string) => void) => {
    let col = awalAngka;
    for (const mt of METRIK_RL32) {
      const a = n[mt.key];
      gaya(excelRow.getCell(col++), a.lk);
      gaya(excelRow.getCell(col++), a.pr);
      gaya(excelRow.getCell(col++), a.total);
    }
    gaya(excelRow.getCell(kolomTT), n.tempatTidur ?? "");
  };

  m.baris.forEach((item, ri) => {
    const er = ws.getRow(dataStart + ri);
    const zebra = ri % 2 === 1;
    const rinci = m.rincian?.(item) ?? false;
    const gaya = (cell: ExcelJS.Cell, v: number | string, opts?: { teks?: boolean; kiri?: boolean }) => {
      cell.value = v;
      if (opts?.teks) cell.numFmt = "@";
      else if (typeof v === "number") cell.numFmt = "#,##0";
      const nol = v === 0 || v === "";
      cell.font = { name: "Calibri", size: 9, italic: rinci, color: { argb: nol || rinci ? SUBTLE : INK } };
      cell.alignment = { vertical: "middle", horizontal: opts?.kiri ? "left" : typeof v === "number" ? "right" : "center" };
      cell.border = borderAll(BORDER);
      if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    };
    m.kolomDepan.forEach((k, i) => gaya(er.getCell(i + 1), k.nilai(item, ri), { teks: k.teks, kiri: i > 0 }));
    tulisAngka(er, m.nilai(item), (cell, v) => gaya(cell, v));
  });

  const totalRow = ws.getRow(dataStart + m.baris.length);
  const gayaTotal = (cell: ExcelJS.Cell, v: number | string) => {
    cell.value = v;
    if (typeof v === "number") cell.numFmt = "#,##0";
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: INK } };
    cell.alignment = { vertical: "middle", horizontal: typeof v === "number" ? "right" : "center" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } };
    cell.border = borderAll(BORDER);
  };
  if (nDepan > 1) ws.mergeCells(totalRow.number, 1, totalRow.number, nDepan);
  gayaTotal(totalRow.getCell(1), m.labelTotal);
  tulisAngka(totalRow, m.total, gayaTotal);
}

export async function buildRl32Excel(r: Rl32Result, meta: Rl32ExcelMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditTrail RS BOLTIM";
  wb.created = meta.generatedAt;

  tulisSheet(
    wb,
    r,
    {
      nama: "RL 3.2",
      kolomDepan: [
        { header: "No", lebar: 5, nilai: (b) => b.kode, teks: true },
        { header: "Jenis Pelayanan", lebar: 34, nilai: (b) => b.deskripsi },
      ],
      baris: r.baris,
      nilai: (b) => b.nilai,
      total: r.total,
      labelTotal: "TOTAL",
    },
    meta,
  );

  // Ruangan (+ rincian per jenis pelayanan bila dipisah menurut DPJP).
  const baris = barisPerRuangan(r);
  const noRuangan = new Map(
    baris.filter((b) => b.jenis === "ruangan").map((b, i) => [b.r.id, i + 1] as const),
  );
  tulisSheet(
    wb,
    r,
    {
      nama: "Per Ruangan",
      kolomDepan: [
        { header: "No", lebar: 5, nilai: (b) => (b.jenis === "ruangan" ? (noRuangan.get(b.r.id) ?? "") : "") },
        { header: "ID Ruangan", lebar: 12, nilai: (b) => (b.jenis === "ruangan" ? b.r.id : ""), teks: true },
        { header: "Jenis Pelayanan RL 3.2", lebar: 34, nilai: (b) => (b.jenis === "ruangan" ? labelPeta(b.r) : `↳ ${b.label}`) },
        {
          header: "Ruangan",
          lebar: 32,
          nilai: (b) => (b.jenis === "bagian" ? `   ${b.r.nama}` : b.r.aktif ? b.r.nama : `${b.r.nama} (nonaktif)`),
        },
      ],
      baris,
      nilai: (b) => b.nilai,
      rincian: (b) => b.jenis === "bagian",
      // = total laporan: hanya ruangan yang dipetakan yang dijumlahkan.
      total: r.total,
      labelTotal: "TOTAL (ruangan dipetakan)",
    },
    meta,
  );

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
