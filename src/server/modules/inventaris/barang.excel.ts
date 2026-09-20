import "server-only";
import ExcelJS from "exceljs";
import { buildReportWorkbook, stampWita, type ExcelColumn } from "@/server/lib/excel";
import { STATUS_ASET_LABEL, type StatusAset } from "./barang.schema";
import type { BarangListItem, FormRefs, ImportRowInput } from "./barang.service";

/* ------------------------------------------------------------------- export */

const dateId = (ymd: string | null): string => {
  if (!ymd) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const bln = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${Number(m[3])} ${bln[Number(m[2]) - 1]} ${m[1]}`;
};

/** Susun Excel daftar barang (kaya & rapi, angka harga tetap NUMBER agar bisa dijumlah). */
export async function buildBarangExcel(
  rows: BarangListItem[],
  opts: { generatedAt: Date; by: string; metaLines: string[] },
): Promise<Buffer> {
  const columns: ExcelColumn<BarangListItem>[] = [
    { header: "No", width: 5, value: (_r, i) => i + 1, align: "center" },
    { header: "Kode Barang", width: 16, value: (r) => r.kodeBarang, text: true, bold: true },
    { header: "Register", width: 10, value: (r) => r.register ?? "", align: "center" },
    { header: "Nama Barang", width: 32, value: (r) => r.nama },
    { header: "Merk/Tipe", width: 18, value: (r) => r.merk ?? "" },
    { header: "No. Seri", width: 16, value: (r) => r.nomorSeri ?? "", text: true },
    { header: "Kategori", width: 18, value: (r) => r.kategori?.nama ?? "" },
    { header: "Ruangan", width: 24, value: (r) => r.ruangan.nama },
    { header: "Kondisi", width: 14, value: (r) => r.kondisi?.nama ?? "" },
    { header: "Status", width: 12, value: (r) => STATUS_ASET_LABEL[r.statusAset] },
    { header: "Sumber Anggaran", width: 16, value: (r) => r.sumberAnggaran?.singkatan ?? "" },
    { header: "Satuan", width: 10, value: (r) => r.satuan?.nama ?? "" },
    { header: "Tahun", width: 8, value: (r) => r.tahunPerolehan ?? "", align: "center" },
    { header: "Tgl Perolehan", width: 14, value: (r) => dateId(r.tglPerolehan) },
    { header: "Harga (Rp)", width: 16, value: (r) => r.harga ?? "", numFmt: '"Rp"#,##0', align: "right" },
    { header: "Keterangan", width: 28, value: (r) => r.keterangan ?? "" },
  ];

  const totalNilai = rows.reduce((a, r) => a + (r.harga ?? 0), 0);

  return buildReportWorkbook<BarangListItem>({
    sheetName: "Master Barang",
    title: "Daftar Master Barang — Inventaris RSUD Boltim",
    subtitle: "Modul Inventarisasi Barang · AuditTrail RS BOLTIM",
    metaLines: [
      ...opts.metaLines,
      `Total unit: ${rows.length} · Total nilai aset: Rp${totalNilai.toLocaleString("id-ID")}`,
      `Dibuat: ${stampWita(opts.generatedAt)} · Oleh: ${opts.by}`,
    ],
    columns,
    rows,
    generatedAt: opts.generatedAt,
    emptyText: "Tidak ada barang untuk filter ini.",
  });
}

/* ------------------------------------------------------------------- import */

const IMPORT_HEADERS: { key: keyof ImportRowInput; label: string; contoh: string }[] = [
  { key: "kodeBarang", label: "Kode Barang", contoh: "(kosongkan = otomatis)" },
  { key: "nama", label: "Nama Barang", contoh: "Tempat Tidur Pasien Elektrik" },
  { key: "merk", label: "Merk/Tipe", contoh: "Paramount PA-2000" },
  { key: "nomorSeri", label: "No. Seri", contoh: "SN-2023-0012" },
  { key: "register", label: "Register", contoh: "1" },
  { key: "kategori", label: "Kategori", contoh: "Alat Kesehatan" },
  { key: "sumberAnggaran", label: "Sumber Anggaran", contoh: "DAK" },
  { key: "satuan", label: "Satuan", contoh: "Unit" },
  { key: "kondisi", label: "Kondisi", contoh: "Baik" },
  { key: "ruangan", label: "Ruangan", contoh: "ICU" },
  { key: "tahunPerolehan", label: "Tahun Perolehan", contoh: "2023" },
  { key: "tglPerolehan", label: "Tgl Perolehan", contoh: "2023-05-17" },
  { key: "harga", label: "Harga (Rp)", contoh: "25000000" },
  { key: "status", label: "Status", contoh: "Aktif" },
  { key: "keterangan", label: "Keterangan", contoh: "" },
];

/** Alias header (dinormalkan: huruf kecil, hanya alfanumerik) → field. */
const HEADER_ALIAS: Record<string, keyof ImportRowInput> = {
  kodebarang: "kodeBarang", kode: "kodeBarang",
  namabarang: "nama", nama: "nama", barang: "nama",
  merk: "merk", merek: "merk", merktipe: "merk", tipe: "merk",
  noseri: "nomorSeri", nomorseri: "nomorSeri", serialnumber: "nomorSeri", sn: "nomorSeri",
  register: "register", noregister: "register", noreg: "register",
  kategori: "kategori", kelompok: "kategori",
  sumberanggaran: "sumberAnggaran", sumber: "sumberAnggaran", anggaran: "sumberAnggaran",
  satuan: "satuan",
  kondisi: "kondisi",
  ruangan: "ruangan", lokasi: "ruangan", lokasiruangan: "ruangan",
  tahunperolehan: "tahunPerolehan", tahun: "tahunPerolehan",
  tglperolehan: "tglPerolehan", tanggalperolehan: "tglPerolehan", tanggal: "tglPerolehan",
  harga: "harga", nilai: "harga", hargarp: "harga",
  status: "status", statusaset: "status",
  keterangan: "keterangan", catatan: "keterangan", ket: "keterangan",
};

const normHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Ubah nilai sel exceljs menjadi teks bersih (Date → YYYY-MM-DD). */
function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`;
  }
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join("").trim();
    if (o.text != null) return String(o.text).trim();
    if (o.result != null) return String(o.result).trim();
    return "";
  }
  return String(v).trim();
}

/** Parse file .xlsx yang diunggah → daftar baris mentah + peta kolom terbaca. */
export async function parseImportWorkbook(
  buf: Buffer,
): Promise<{ rows: ImportRowInput[]; kolomTerbaca: string[]; error?: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    return { rows: [], kolomTerbaca: [], error: "File tidak dapat dibaca. Pastikan format .xlsx." };
  }
  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) {
    return { rows: [], kolomTerbaca: [], error: "Sheet pertama kosong atau tanpa data." };
  }

  // Petakan kolom dari baris header (baris 1).
  const headerRow = ws.getRow(1);
  const colMap = new Map<number, keyof ImportRowInput>();
  const kolomTerbaca: string[] = [];
  headerRow.eachCell((cell, col) => {
    const field = HEADER_ALIAS[normHeader(cellText(cell.value))];
    if (field && !kolomTerbaca.includes(field)) {
      colMap.set(col, field);
      kolomTerbaca.push(field);
    }
  });
  if (!kolomTerbaca.includes("nama") || !kolomTerbaca.includes("ruangan")) {
    return {
      rows: [],
      kolomTerbaca,
      error: 'Kolom wajib "Nama Barang" dan "Ruangan" tidak ditemukan di baris pertama.',
    };
  }

  const rows: ImportRowInput[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const item: ImportRowInput = {};
    let any = false;
    colMap.forEach((field, col) => {
      const text = cellText(row.getCell(col).value);
      if (text) any = true;
      item[field] = text;
    });
    if (any) rows.push(item);
  }
  return { rows, kolomTerbaca };
}

/* ------------------------------------------------------------ template import */

const HEAD_FILL = "FF0F766E";
const REF_FILL = "FF1E5A94";

/** Bangun template .xlsx untuk diisi (2 sheet: Data Barang + Referensi valid). */
export async function buildImportTemplate(refs: FormRefs): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditTrail RS BOLTIM";

  // --- Sheet 1: Data Barang ---
  const ws = wb.addWorksheet("Data Barang", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = IMPORT_HEADERS.map((h) => ({ header: h.label, key: h.key, width: Math.max(14, h.label.length + 4) }));
  const head = ws.getRow(1);
  head.height = 24;
  head.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  // Baris contoh (abu, italic) — hapus sebelum mengisi data asli.
  const contoh = ws.addRow(IMPORT_HEADERS.map((h) => h.contoh));
  contoh.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF94A3B8" } };
  });

  // --- Sheet 2: Referensi ---
  const rs = wb.addWorksheet("Referensi");
  rs.columns = [
    { header: "Ruangan (prefix)", width: 16 },
    { header: "Ruangan (nama)", width: 30 },
    { header: "Kategori", width: 24 },
    { header: "Kondisi", width: 18 },
    { header: "Sumber Anggaran", width: 22 },
    { header: "Satuan", width: 14 },
    { header: "Status", width: 14 },
  ];
  rs.getRow(1).eachCell((cell) => {
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REF_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  const statusList = (["AKTIF", "PERBAIKAN", "DIPINJAM", "DIHAPUS"] as StatusAset[]).map((s) => STATUS_ASET_LABEL[s]);
  const maxLen = Math.max(
    refs.ruangan.length,
    refs.kategori.length,
    refs.kondisi.length,
    refs.sumberAnggaran.length,
    refs.satuan.length,
    statusList.length,
  );
  for (let i = 0; i < maxLen; i++) {
    rs.addRow([
      refs.ruangan[i]?.kodePrefix ?? "",
      refs.ruangan[i]?.nama ?? "",
      refs.kategori[i]?.nama ?? "",
      refs.kondisi[i]?.nama ?? "",
      refs.sumberAnggaran[i] ? `${refs.sumberAnggaran[i].singkatan} — ${refs.sumberAnggaran[i].nama}` : "",
      refs.satuan[i]?.nama ?? "",
      statusList[i] ?? "",
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
