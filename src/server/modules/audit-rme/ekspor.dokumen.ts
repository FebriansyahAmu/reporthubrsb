import "server-only";
import ExcelJS from "exceljs";
import { formatNumber } from "@/lib/format";
import {
  buildReportPdf,
  loadInstansiLogo,
  type PdfCellStyle,
  type PdfColumnDef,
  type PdfSignatureBlock,
  type PdfTableSpec,
} from "@/server/lib/pdf";

/**
 * Model dokumen ekspor Audit Trail RME (Fase 2 · K5). SATU definisi laporan
 * dirender ke **Excel** (angka tetap angka, banyak lembar, bisa diolah) dan
 * **PDF** (siap cetak & tanda tangan). Builder `ekspor.*.ts` hanya menyusun
 * model ini dari service yang sama dengan layar → angka ekspor = angka layar.
 */

/* ------------------------------------------------------------------ model */

/** Nada sel (status/pita) — selaras token warna aplikasi; selalu disertai teks/angka. */
export type Nada = "hijau" | "hijauLembut" | "kuningLembut" | "merahLembut" | "merah" | "biruLembut" | "abu";

export type Nilai = string | number | null;
export type Sel = Nilai | { v: Nilai; nada?: Nada | null; tebal?: boolean; coret?: boolean };

/**
 * Format kolom. `persen`/`persen1` = 0–100 (bulat / 1 desimal); `waktu` =
 * `YYYY-MM-DDTHH:mm:ss` & `tanggal` = `YYYY-MM-DD` (jam dinding WITA); `kode` =
 * teks apa adanya (nomor panjang tak jadi notasi ilmiah).
 */
export type Format = "teks" | "angka" | "desimal" | "persen" | "persen1" | "waktu" | "tanggal" | "kode";
const FORMAT_ANGKA: readonly Format[] = ["angka", "desimal", "persen", "persen1"];

export type Kolom = {
  judul: string;
  /** Lebar Excel (karakter). */
  lebar: number;
  /** Lebar PDF (pt). Kosong = kolom hanya di Excel. */
  pdf?: number;
  fmt?: Format;
  rata?: "kiri" | "tengah" | "kanan";
  /** Bungkus teks panjang (Excel). */
  bungkus?: boolean;
};

export type Tabel = {
  judul?: string;
  kolom: Kolom[];
  baris: Sel[][];
  total?: Sel[];
  catatan?: string;
  /** false = hanya di Excel (rincian panjang yang tak berguna dicetak). */
  pdf?: boolean;
};

/** Satu lembar Excel = satu bagian PDF. */
export type Lembar = { nama: string; judul: string; tabel: Tabel[] };

export type Dokumen = {
  judul: string;
  /** Keterangan di bawah judul: filter, sumber data, catatan metode. */
  meta: string[];
  lembar: Lembar[];
  ttd?: PdfSignatureBlock;
  orientasi?: "landscape" | "portrait";
  /** Nama berkas tanpa ekstensi & stempel tanggal. */
  berkas: string;
  /** Jumlah baris utama (dicatat di meta-audit). */
  jumlah: number;
  /** Ringkasan cakupan untuk riwayat ekspor — TANPA identitas pasien. */
  ringkasan: string;
};

/** Identitas ekspor yang dicetak di dokumen & dicatat di meta-audit. */
export type Stempel = { kode: string; oleh: string; waktu: string };

export const INSTANSI = "UPTD RSUD Bolaang Mongondow Timur";
/** Tempat tanda tangan dokumen resmi (sama dengan KIR inventaris). */
export const TEMPAT_TTD = "Sumber Rejo";

/* ------------------------------------------------------------ helper sel */

const nilaiOf = (s: Sel): Nilai => (s != null && typeof s === "object" ? s.v : s);
const gayaOf = (s: Sel) => (s != null && typeof s === "object" ? s : null);

/** Warna per nada: latar + teks (teks digelapkan agar kontras saat dicetak). */
const NADA: Record<Nada, { isi: string; teks: string }> = {
  hijau: { isi: "#2F8A4E", teks: "#FFFFFF" },
  hijauLembut: { isi: "#E3F3E8", teks: "#1F6B3B" },
  kuningLembut: { isi: "#F6ECD6", teks: "#7A4F0C" },
  merahLembut: { isi: "#FBE9E6", teks: "#A3301F" },
  merah: { isi: "#CF4436", teks: "#FFFFFF" },
  biruLembut: { isi: "#E6F1FA", teks: "#1F5A8C" },
  abu: { isi: "#F1F3F5", teks: "#64748B" },
};

/** Pita kepatuhan/kelengkapan (sama dengan heatmap Peta Ruangan). */
export function nadaPersen(p: number | null | undefined): Nada | null {
  if (p == null) return null;
  if (p >= 85) return "hijau";
  if (p >= 70) return "hijauLembut";
  if (p >= 50) return "kuningLembut";
  if (p >= 30) return "merahLembut";
  return "merah";
}
export const PITA_KETERANGAN = "Pita: >= 85% hijau tua · 70–84% hijau muda · 50–69% kuning · 30–49% merah muda · < 30% merah.";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** `YYYY-MM-DD…` → "28 Sep 2026" (tanpa geser zona waktu). */
export function tglTeks(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${iso.slice(0, 4)}`;
}
/** `YYYY-MM-DD…` → "28 September 2026" (tanggal tanda tangan). */
export function tglPanjang(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}
/** `YYYY-MM-DD` → "Senin". */
export const hariTeks = (iso: string) => HARI[new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCDay()];
/** `YYYY-MM-DDTHH:mm…` → "28/09/2026 14:05". */
export function waktuTeks(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`;
}
export const rentangTeks = (from: string, to: string) => `${tglTeks(from)} – ${tglTeks(to)}`;

/** Nilai tanggal ISO (label seperti "Total" di kolom tanggal tetap teks). */
const ISO_TGL = /^\d{4}-\d{2}-\d{2}/;

/** Teks sel untuk PDF sesuai format kolom. */
function teksPdf(v: Nilai, fmt: Format | undefined): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") {
    if (fmt === "persen" || fmt === "persen1") return `${formatNumber(v)}%`;
    return formatNumber(v);
  }
  if (!ISO_TGL.test(v)) return v;
  if (fmt === "waktu") return waktuTeks(v);
  if (fmt === "tanggal") return `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;
  return v;
}

/* ------------------------------------------------------------------ Excel */

const TEAL = "FF0F766E";
const ZEBRA = "FFF6F8FA";
const BORDER = "FFD7DEE5";
const INK = "FF1E293B";
const MUTED = "FF475569";
const TOTAL_BG = "FFE8EDF1";

const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;
const garis = (c: string) => ({
  top: { style: "thin" as const, color: { argb: c } },
  bottom: { style: "thin" as const, color: { argb: c } },
  left: { style: "thin" as const, color: { argb: c } },
  right: { style: "thin" as const, color: { argb: c } },
});

const NUMFMT: Partial<Record<Format, string>> = {
  angka: "#,##0",
  desimal: "#,##0.0",
  persen: "0%",
  persen1: "0.0%",
  waktu: "dd/mm/yyyy hh:mm",
  tanggal: "dd/mm/yyyy",
  kode: "@",
};

function isiSelExcel(cell: ExcelJS.Cell, s: Sel, k: Kolom, opts: { zebra: boolean; total: boolean }) {
  const v = nilaiOf(s);
  const g = gayaOf(s);
  const fmt = k.fmt ?? (typeof v === "number" ? "angka" : "teks");
  if (v == null || v === "") cell.value = "";
  else if ((fmt === "persen" || fmt === "persen1") && typeof v === "number") cell.value = v / 100;
  else if (fmt === "waktu" && typeof v === "string" && ISO_TGL.test(v)) cell.value = new Date(`${v.slice(0, 19)}Z`);
  else if (fmt === "tanggal" && typeof v === "string" && ISO_TGL.test(v)) cell.value = new Date(`${v.slice(0, 10)}T00:00:00Z`);
  else if (fmt === "kode") cell.value = String(v);
  else cell.value = v;
  if (NUMFMT[fmt]) cell.numFmt = NUMFMT[fmt]!;

  const nada = g?.nada ? NADA[g.nada] : null;
  cell.font = {
    name: "Calibri",
    size: 10,
    bold: opts.total || !!g?.tebal,
    strike: !!g?.coret,
    color: { argb: nada ? argb(nada.teks) : INK },
  };
  const rata = k.rata ?? (FORMAT_ANGKA.includes(fmt) ? "kanan" : "kiri");
  cell.alignment = {
    vertical: "middle",
    horizontal: rata === "kanan" ? "right" : rata === "tengah" ? "center" : "left",
    wrapText: !!k.bungkus,
  };
  cell.border = garis(BORDER);
  if (nada) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(nada.isi) } };
  else if (opts.total) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } };
  else if (opts.zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
}

/** Nama lembar Excel: ≤ 31 karakter, tanpa `[]:*?/\`, unik. */
function namaLembar(nama: string, dipakai: Set<string>): string {
  const dasar = nama.replace(/[[\]:*?/\\]/g, "-").slice(0, 31) || "Lembar";
  let hasil = dasar;
  for (let i = 2; dipakai.has(hasil.toLowerCase()); i++) hasil = `${dasar.slice(0, 27)} (${i})`;
  dipakai.add(hasil.toLowerCase());
  return hasil;
}

export async function renderXlsx(dok: Dokumen, st: Stempel): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditTrail RS BOLTIM";
  wb.created = new Date();
  const dipakai = new Set<string>();
  const kepala = [`Dibuat oleh ${st.oleh} · ${st.waktu} · No. ekspor ${st.kode}`, ...dok.meta];

  for (const lb of dok.lembar) {
    const ws = wb.addWorksheet(namaLembar(lb.nama, dipakai), {
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const nKolom = Math.max(1, ...lb.tabel.map((t) => t.kolom.length));
    ws.columns = Array.from({ length: nKolom }, (_, i) => ({ width: Math.max(...lb.tabel.map((t) => t.kolom[i]?.lebar ?? 0), 8) }));

    let r = 1;
    const tulis = (teks: string, font: Partial<ExcelJS.Font>) => {
      const c = ws.getCell(r++, 1);
      c.value = teks;
      c.font = { name: "Calibri", ...font };
    };
    tulis(dok.judul, { size: 14, bold: true, color: { argb: TEAL } });
    tulis(`${INSTANSI} · ${lb.judul}`, { size: 11, bold: true, color: { argb: INK } });
    for (const m of kepala) tulis(m, { size: 9, italic: true, color: { argb: MUTED } });
    r++;

    const satuTabel = lb.tabel.length === 1;
    for (const t of lb.tabel) {
      if (t.judul) tulis(t.judul, { size: 11, bold: true, color: { argb: INK } });
      const hr = ws.getRow(r);
      t.kolom.forEach((k, i) => {
        const c = hr.getCell(i + 1);
        c.value = k.judul;
        c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
        c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        c.border = garis(TEAL);
      });
      hr.height = 30;
      const barisHeader = r++;

      if (t.baris.length === 0) {
        const c = ws.getCell(r++, 1);
        c.value = "Tidak ada data untuk filter ini.";
        c.font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
      }
      t.baris.forEach((baris, bi) => {
        const row = ws.getRow(r++);
        t.kolom.forEach((k, i) => isiSelExcel(row.getCell(i + 1), baris[i] ?? null, k, { zebra: bi % 2 === 1, total: false }));
      });
      if (t.total) {
        const row = ws.getRow(r++);
        t.kolom.forEach((k, i) => isiSelExcel(row.getCell(i + 1), t.total![i] ?? null, k, { zebra: false, total: true }));
      }
      if (satuTabel && t.baris.length > 0) {
        ws.views = [{ state: "frozen", ySplit: barisHeader, xSplit: 0 }];
        ws.autoFilter = { from: { row: barisHeader, column: 1 }, to: { row: barisHeader + t.baris.length, column: t.kolom.length } };
      }
      if (t.catatan) tulis(t.catatan, { size: 9, italic: true, color: { argb: MUTED } });
      r++;
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* -------------------------------------------------------------------- PDF */

const LEBAR_HALAMAN = { landscape: 769, portrait: 523 } as const;

function tabelPdf(t: Tabel, caption: string, lebarMaks: number): PdfTableSpec | null {
  const idx = t.kolom.flatMap((k, i) => (k.pdf ? [i] : []));
  if (idx.length === 0) return null;
  const jumlah = idx.reduce((s, i) => s + t.kolom[i].pdf!, 0);
  const skala = jumlah > lebarMaks ? lebarMaks / jumlah : 1;
  const columns: PdfColumnDef[] = idx.map((i) => {
    const k = t.kolom[i];
    const angka = !!k.fmt && FORMAT_ANGKA.includes(k.fmt);
    return {
      header: k.judul,
      width: Math.floor(k.pdf! * skala),
      align: k.rata === "tengah" ? "center" : k.rata === "kanan" || (!k.rata && angka) ? "right" : "left",
      maxLines: k.bungkus ? 4 : 2,
    };
  });
  const teks = (baris: Sel[]) => idx.map((i) => teksPdf(nilaiOf(baris[i] ?? null), t.kolom[i].fmt));
  const gaya = (baris: Sel[]) =>
    idx.map((i): PdfCellStyle | null => {
      const g = gayaOf(baris[i] ?? null);
      if (!g) return null;
      const n = g.nada ? NADA[g.nada] : null;
      return { fill: n?.isi, color: n?.teks, bold: g.tebal };
    });
  const kosong = t.baris.length === 0;
  return {
    caption,
    columns,
    rows: kosong ? [["Tidak ada data untuk filter ini.", ...idx.slice(1).map(() => "")]] : t.baris.map(teks),
    styles: kosong ? undefined : t.baris.map(gaya),
    totals: t.total ? teks(t.total) : undefined,
    note: t.catatan,
  };
}

export async function renderPdf(dok: Dokumen, st: Stempel): Promise<Buffer> {
  const orientasi = dok.orientasi ?? "landscape";
  const tables = dok.lembar.flatMap((lb) =>
    lb.tabel
      .filter((t) => t.pdf !== false)
      .flatMap((t) => tabelPdf(t, t.judul ? `${lb.judul} · ${t.judul}` : lb.judul, LEBAR_HALAMAN[orientasi]) ?? []),
  );
  const logo = loadInstansiLogo();
  return buildReportPdf({
    title: dok.judul,
    subtitle: `${INSTANSI} · Audit Trail Rekam Medis Elektronik`,
    metaLines: [`Dibuat oleh ${st.oleh} · ${st.waktu} · No. ekspor ${st.kode}`, ...dok.meta],
    tables,
    orientation: orientasi,
    signature: dok.ttd,
    logo: logo ? { bytes: logo, format: "png", height: 42 } : undefined,
    footerNote: `Audit Trail RME · data SIMGOS (read-only) · No. ekspor ${st.kode}`,
    generatedAt: new Date(),
  });
}
