import "server-only";
import ExcelJS from "exceljs";
import { KOLOM_RL35 } from "./rl35.constants";
import { barisFormulir, barisPerRuangan, JUDUL_RL35, LABEL_JENIS_RUANGAN, labelPeta, metaRl35, subjudulRl35 } from "./rl35.dokumen";
import type { NilaiRl35, Rl35Result } from "./rl35.types";

/**
 * Workbook Excel RL 3.5 — sheet "RL 3.5" (urutan formulir SIRS 6: jenis
 * kegiatan, TOTAL, baris 66 & 77) dan "Per Ruangan" (rincian + status
 * pemetaan). Header bertingkat Dalam / Luar Kab/Kota / Total Kunjungan → L / P.
 * Gaya visual sama dengan RL 3.2 (teal, zebra, border).
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

export type Rl35ExcelMeta = { generatedAt: Date; by: string };

type Sel = string | number;
type Baris = { depan: Sel[]; angka: (number | string)[]; gaya: "biasa" | "rincian" | "total" | "rata" };

const borderAll = (argb: string) => ({
  top: { style: "thin" as const, color: { argb } },
  bottom: { style: "thin" as const, color: { argb } },
  left: { style: "thin" as const, color: { argb } },
  right: { style: "thin" as const, color: { argb } },
});

const angka = (n: NilaiRl35) => KOLOM_RL35.map((k) => n[k.ambil]);

function tulisSheet(
  wb: ExcelJS.Workbook,
  r: Rl35Result,
  meta: Rl35ExcelMeta,
  opts: { nama: string; depan: { header: string; lebar: number; teks?: boolean }[]; baris: Baris[] },
): void {
  const nDepan = opts.depan.length;
  const LAST = nDepan + KOLOM_RL35.length;
  const ws = wb.addWorksheet(opts.nama, {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  opts.depan.forEach((k, i) => (ws.getColumn(i + 1).width = k.lebar));
  for (let c = nDepan + 1; c <= LAST; c++) ws.getColumn(c).width = 9;

  const mergeAcross = (row: number) => ws.mergeCells(row, 1, row, LAST);
  let row = 1;
  mergeAcross(row);
  ws.getCell(row, 1).value = JUDUL_RL35;
  ws.getCell(row, 1).font = { name: "Calibri", size: 14, bold: true, color: { argb: TEAL } };
  ws.getRow(row).height = 22;
  row++;
  mergeAcross(row);
  ws.getCell(row, 1).value = subjudulRl35(r);
  ws.getCell(row, 1).font = { name: "Calibri", size: 10, color: { argb: SUBTLE } };
  row++;
  for (const [i, line] of metaRl35(r, { oleh: meta.by, waktu: meta.generatedAt }).entries()) {
    mergeAcross(row);
    const c = ws.getCell(row, 1);
    c.value = line;
    const peringatan = line.startsWith("PERHATIAN");
    c.font = { name: "Calibri", size: 9.5, italic: i === 0, bold: peringatan, color: { argb: peringatan ? WARN : MUTED } };
    c.alignment = { wrapText: true, vertical: "top" };
    ws.getRow(row).height = line.length > 150 ? 26 : 14;
    row++;
  }
  row++;

  const h1 = row;
  const h2 = row + 1;
  const dataStart = row + 2;
  ws.views = [{ state: "frozen", xSplit: nDepan, ySplit: h2 }];

  const header = (r1: number, c1: number, r2: number, c2: number, label: string, gelap = false) => {
    if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
    const cell = ws.getCell(r1, c1);
    cell.value = label;
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: gelap ? TEAL_DK : TEAL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = borderAll(TEAL);
  };
  opts.depan.forEach((k, i) => header(h1, i + 1, h2, i + 1, k.header));
  let c = nDepan + 1;
  for (const grup of [...new Set(KOLOM_RL35.map((k) => k.grup))]) {
    const anggota = KOLOM_RL35.filter((k) => k.grup === grup);
    header(h1, c, h1, c + anggota.length - 1, grup);
    anggota.forEach((k, i) => header(h2, c + i, h2, c + i, k.sub, true));
    c += anggota.length;
  }
  ws.getRow(h1).height = 28;
  ws.getRow(h2).height = 16;

  opts.baris.forEach((b, ri) => {
    const er = ws.getRow(dataStart + ri);
    const zebra = b.gaya === "biasa" && ri % 2 === 1;
    const tebal = b.gaya === "total" || b.gaya === "rata";
    const isi = (cell: ExcelJS.Cell, v: Sel, o: { teks?: boolean; kiri?: boolean } = {}) => {
      cell.value = v;
      if (o.teks) cell.numFmt = "@";
      else if (typeof v === "number") cell.numFmt = Number.isInteger(v) ? "#,##0" : "#,##0.0";
      const redup = v === 0 || v === "" || b.gaya === "rincian";
      cell.font = { name: "Calibri", size: 9, bold: tebal, italic: b.gaya === "rincian", color: { argb: redup && !tebal ? SUBTLE : INK } };
      cell.alignment = { vertical: "middle", horizontal: o.kiri ? "left" : typeof v === "number" ? "right" : "center" };
      cell.border = borderAll(BORDER);
      if (b.gaya === "total") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } };
      else if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    };
    b.depan.forEach((v, i) => isi(er.getCell(i + 1), v, { teks: opts.depan[i].teks, kiri: i > 0 }));
    b.angka.forEach((v, i) => isi(er.getCell(nDepan + 1 + i), v));
  });
}

export async function buildRl35Excel(r: Rl35Result, meta: Rl35ExcelMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditTrail RS BOLTIM";
  wb.created = meta.generatedAt;

  const kosong = KOLOM_RL35.map(() => "");
  tulisSheet(wb, r, meta, {
    nama: "RL 3.5",
    depan: [
      { header: "No", lebar: 6, teks: true },
      { header: "Jenis Kegiatan", lebar: 36 },
    ],
    baris: barisFormulir(r).map((b): Baris => {
      if (b.jenis === "kegiatan") return { depan: [b.kode, b.label], angka: angka(b.nilai), gaya: "biasa" };
      if (b.jenis === "total") return { depan: ["99", b.label], angka: angka(b.nilai), gaya: "total" };
      // Baris 66 & 77: satu angka di kolom Jumlah.
      return { depan: [b.kode, b.label], angka: [...kosong.slice(1), b.nilai ?? "-"], gaya: "rata" };
    }),
  });

  const ruangan = barisPerRuangan(r);
  let no = 0;
  tulisSheet(wb, r, meta, {
    nama: "Per Ruangan",
    depan: [
      { header: "No", lebar: 5 },
      { header: "ID Ruangan", lebar: 12, teks: true },
      { header: "Ruangan", lebar: 28 },
      { header: "Layanan", lebar: 13 },
      { header: "Jenis Kegiatan RL 3.5", lebar: 36 },
    ],
    baris: [
      ...ruangan.map((b): Baris =>
        b.jenis === "ruangan"
          ? {
              depan: [++no, b.r.id, b.r.aktif ? b.r.nama : `${b.r.nama} (nonaktif)`, LABEL_JENIS_RUANGAN[b.r.jenisKunjungan] ?? "", labelPeta(b.r)],
              angka: angka(b.nilai),
              gaya: "biasa",
            }
          : { depan: ["", "", "", "", `↳ ${b.label}`], angka: angka(b.nilai), gaya: "rincian" },
      ),
      // = total laporan: hanya ruangan yang dilaporkan yang dijumlahkan.
      { depan: ["", "", "TOTAL (ruangan dilaporkan)", "", ""], angka: angka(r.total), gaya: "total" },
    ],
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
