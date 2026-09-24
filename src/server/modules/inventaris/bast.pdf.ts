import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { BastInput } from "./bast.schema";
import type { KirData } from "./kir.service";

/**
 * Berita Acara Serah Terima Barang (BAST) — dokumen resmi RSUD Boltim, meniru
 * format template 1:1 (kop + garis ganda, badan surat + terbilang tanggal, dua
 * PIHAK, blok tanda tangan tiga penanda + Direktur, dan lampiran daftar barang).
 * Dibangun dengan pdf-lib (Helvetica; karakter Unicode dipetakan aman WinAnsi).
 */

/* ---------------------------------------------------------------- konstanta */

const KOP = [
  "PEMERINTAH KABUPATEN BOLAANG MONGONDOW TIMUR",
  "UPTD RUMAH SAKIT UMUM DAERAH",
];
const KOP_ALAMAT = "Jl. Amurang – Kotamobagu Desa Sumber Rejo Kec. Modayag - Kode Pos 95781";
const KOP_INSTANSI = "RSUD Bolaang Mongondow Timur";

const PARA1 =
  "PIHAK PERTAMA menyerahkan dokumen dan barang kepada PIHAK KEDUA, dan PIHAK KEDUA menyatakan telah menerima barang dari PIHAK PERTAMA (daftar dokumen ada dalam lampiran).";
const PARA2 =
  "Demikian berita acara serah terima Barang ini dilakukan oleh KEDUA PIHAK, sejak penandatanganan berita acara ini, semua barang tersebut menjadi TANGGUNG JAWAB PIHAK KEDUA dalam hal penyimpanan dan pemeliharaannya untuk dapat dipakai sesuai kebutuhan.";

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const BLACK = rgb(0, 0, 0);
const M = 50; // margin kiri/kanan
const PW = 595.28; // A4 portrait
const PH = 841.89;

/* ---------------------------------------------------------------- terbilang */

const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
function terbilang(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${terbilang(n - 10)} belas`;
  if (n < 100) return `${terbilang(Math.floor(n / 10))} puluh${n % 10 ? ` ${terbilang(n % 10)}` : ""}`;
  if (n < 200) return `seratus${n % 100 ? ` ${terbilang(n % 100)}` : ""}`;
  if (n < 1000) return `${terbilang(Math.floor(n / 100))} ratus${n % 100 ? ` ${terbilang(n % 100)}` : ""}`;
  if (n < 2000) return `seribu${n % 1000 ? ` ${terbilang(n % 1000)}` : ""}`;
  return `${terbilang(Math.floor(n / 1000))} ribu${n % 1000 ? ` ${terbilang(n % 1000)}` : ""}`;
}

/** "Selasa lima belas September dua ribu dua puluh enam" dari YYYY-MM-DD. */
function hariTerbilang(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const hari = HARI[dt.getUTCDay()];
  return `${hari} ${terbilang(d)} ${BULAN[m - 1]} ${terbilang(y)}`;
}

const p2 = (n: number) => String(n).padStart(2, "0");
function todayWitaIso(): string {
  const w = new Date(Date.now() + 8 * 3600 * 1000);
  return `${w.getUTCFullYear()}-${p2(w.getUTCMonth() + 1)}-${p2(w.getUTCDate())}`;
}

/* ---------------------------------------------------------------- WinAnsi */

const UNI: Record<string, string> = { "–": "-", "—": "-", "‑": "-", "’": "'", "“": '"', "”": '"', "×": "x" };
const san = (s: string) => (s ?? "").replace(/[–—‑’“”×]/g, (c) => UNI[c] ?? c).replace(/[^\x20-\xFF]/g, "?");

/* ------------------------------------------------------------------- logo */

let logoCache: Uint8Array | null | undefined;
function loadLogo(): Uint8Array | undefined {
  if (logoCache !== undefined) return logoCache ?? undefined;
  try {
    logoCache = new Uint8Array(readFileSync(join(process.cwd(), "public", "logo", "logoboltim.png")));
  } catch {
    logoCache = null;
  }
  return logoCache ?? undefined;
}

/* --------------------------------------------------------------- builder */

type Pihak = { nama: string; nip: string; jabatan: string };

export async function buildBastPdf(
  data: KirData,
  opts: { generatedAt: Date; by: string; bast?: BastInput },
): Promise<Buffer> {
  const b = opts.bast;
  const tanggal = b?.tanggal || todayWitaIso();
  const romawi = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][Number(tanggal.slice(5, 7))] ?? "";
  const nomor = (b?.nomor || `044/ RSUD.01/     /${romawi}/${tanggal.slice(0, 4)}`).trim();
  const p1: Pihak = {
    nama: b?.pihak1?.nama || "Frenly A Mamuaja, A.Md.Kep",
    nip: b?.pihak1?.nip || "19880803 201201 1 001",
    jabatan: b?.pihak1?.jabatan || "Pembantu Pengurus Barang",
  };
  const p2p: Pihak = { nama: b?.pihak2?.nama || "", nip: b?.pihak2?.nip || "", jabatan: b?.pihak2?.jabatan || "" };
  const dir: Pihak = { nama: b?.direktur?.nama || "", nip: b?.direktur?.nip || "", jabatan: "" };

  const doc = await PDFDocument.create();
  // Times (serif) agar mendekati dokumen resmi sumber 1:1.
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const logo = loadLogo();
  const logoImg = logo ? await doc.embedPng(logo) : null;

  let page!: PDFPage;
  let y = 0;
  const newPage = () => { page = doc.addPage([PW, PH]); y = PH - 40; };

  const at = (s: string, x: number, yy: number, size: number, f: PDFFont = font) => page.drawText(san(s), { x, y: yy, size, font: f, color: BLACK });
  const center = (s: string, cx: number, size: number, f: PDFFont = font) => {
    const w = f.widthOfTextAtSize(san(s), size);
    page.drawText(san(s), { x: cx - w / 2, y, size, font: f, color: BLACK });
  };
  const wrap = (s: string, f: PDFFont, size: number, maxW: number): string[] => {
    const words = san(s).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const cand = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(cand, size) <= maxW) cur = cand;
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  };
  // Paragraf rata kiri dgn pembungkusan; kembalikan tinggi terpakai.
  const para = (s: string, size: number, lh = 14, maxW = PW - 2 * M) => {
    for (const ln of wrap(s, font, size, maxW)) { at(ln, M, y, size, font); y -= lh; }
  };

  /* ---- Kop + garis ganda ---- */
  const drawKop = () => {
    const topY = y;
    let logoBottom = topY;
    if (logoImg) {
      const lh = 52;
      const lw = logoImg.height > 0 ? (logoImg.width * lh) / logoImg.height : lh;
      page.drawImage(logoImg, { x: M, y: topY - lh, width: lw, height: lh });
      logoBottom = topY - lh;
    }
    const cx = PW / 2;
    y = topY - 10; center(KOP[0], cx, 12, bold);
    y = topY - 24; center(KOP[1], cx, 12, bold);
    y = topY - 35; center(KOP_ALAMAT, cx, 8.5, font);
    y = Math.min(topY - 44, logoBottom - 6);
    // garis ganda
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1.4, color: BLACK });
    y -= 3;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.5, color: BLACK });
    y -= 20;
  };

  /* ---- Blok satu PIHAK ---- */
  const drawPihak = (no: string, p: Pihak) => {
    const numX = M + 14, labX = M + 32, colX = M + 118;
    const rows: [string, string][] = [["Nama", p.nama], ["NIP", p.nip], ["Jabatan", p.jabatan]];
    rows.forEach(([lab, val], i) => {
      if (i === 0) at(`${no}.`, numX, y, 10.5, font);
      at(lab, labX, y, 10.5, font);
      at(`: ${val}`, colX, y, 10.5, font);
      y -= 15;
    });
  };

  /* ---- Blok tanda tangan (dipakai di hal.1 & lampiran) ---- */
  const drawSignatures = () => {
    const usableW = PW - 2 * M;
    const lcx = M + usableW * 0.24;
    const rcx = M + usableW * 0.76;
    const ccx = PW / 2;

    y -= 6;
    center("Yang Menyerahkan", lcx, 10, font);
    center("Yang Menerima", rcx, 10, font);
    y -= 13;
    center("PIHAK PERTAMA", lcx, 10, font);
    center("PIHAK KEDUA", rcx, 10, font);
    y -= 52;
    center(p1.nama || "(............................)", lcx, 10, bold);
    center(p2p.nama || "(............................)", rcx, 10, bold);
    y -= 12;
    center(`NIP. ${p1.nip || "............................"}`, lcx, 9, font);
    if (p2p.nip) center(`NIP. ${p2p.nip}`, rcx, 9, font);

    // Blok Direktur (di tengah, di bawah dua kolom)
    y -= 22;
    center("Direktur", ccx, 10, font);
    y -= 13;
    center(KOP_INSTANSI, ccx, 10, font);
    y -= 52;
    center(dir.nama || "(............................)", ccx, 10, bold);
    y -= 12;
    center(`NIP. ${dir.nip || "............................"}`, ccx, 9, font);
    y -= 10;
  };

  /* ========================= HALAMAN 1 (Surat) ========================= */
  newPage();
  drawKop();

  // Judul + garis bawah
  const judul = "BERITA ACARA SERAH TERIMA BARANG";
  center(judul, PW / 2, 11.5, bold);
  {
    const w = bold.widthOfTextAtSize(san(judul), 11.5);
    page.drawLine({ start: { x: PW / 2 - w / 2, y: y - 2 }, end: { x: PW / 2 + w / 2, y: y - 2 }, thickness: 0.7, color: BLACK });
  }
  y -= 14;
  center(`NOMOR : ${nomor}`, PW / 2, 10, bold);
  y -= 24;

  para(`Pada hari ${hariTerbilang(tanggal)} kami yang bertanda tangan di bawah ini :`, 10.5);
  y -= 8;

  drawPihak("1", p1);
  y -= 2;
  at("Selanjutnya Sebagai PIHAK PERTAMA", M + 14, y, 10.5, font);
  y -= 22;
  drawPihak("2", p2p);
  y -= 2;
  at("Selanjutnya Sebagai PIHAK KEDUA", M + 14, y, 10.5, font);
  y -= 24;

  para(PARA1, 10.5);
  y -= 6;
  para(PARA2, 10.5);
  y -= 18;

  drawSignatures();

  /* ===================== HALAMAN 2 (Lampiran) ===================== */
  newPage();
  at("LAMPIRAN : BERITA ACARA SERAH TERIMA BARANG", M, y, 10.5, font);
  y -= 14;
  at(`NOMOR : ${nomor}`, M + 60, y, 10.5, font);
  y -= 24;

  // Tabel barang
  const cols = [
    { h: "NO", w: 32, align: "center" as const },
    { h: "NAMA BARANG", w: 213, align: "left" as const },
    { h: "JUMLAH", w: 70, align: "center" as const },
    { h: "TAHUN PENGADAAN", w: 90, align: "center" as const },
    { h: "KETERANGAN", w: 90, align: "center" as const },
  ];
  const tableW = cols.reduce((a, c) => a + c.w, 0);
  const xs: number[] = [];
  { let acc = M; for (const c of cols) { xs.push(acc); acc += c.w; } }

  const cellText = (s: string, colIdx: number, rowTopY: number, f: PDFFont, size: number) => {
    const c = cols[colIdx];
    const lines = wrap(s, f, size, c.w - 8);
    lines.forEach((ln, li) => {
      const lw = f.widthOfTextAtSize(ln, size);
      let x = xs[colIdx] + 4;
      if (c.align === "center") x = xs[colIdx] + (c.w - lw) / 2;
      at(ln, x, rowTopY - 11 - li * 11, size, f);
    });
    return lines.length;
  };

  const drawTableHeader = () => {
    const hLines = Math.max(...cols.map((c) => wrap(c.h, bold, 8.5, c.w - 8).length));
    const hH = hLines * 11 + 6;
    page.drawRectangle({ x: M, y: y - hH, width: tableW, height: hH, borderColor: BLACK, borderWidth: 0.8 });
    cols.forEach((c, i) => cellText(c.h, i, y, bold, 8.5));
    // garis vertikal
    let vx = M;
    for (const c of cols) { vx += c.w; if (vx < M + tableW - 0.1) page.drawLine({ start: { x: vx, y }, end: { x: vx, y: y - hH }, thickness: 0.8, color: BLACK }); }
    y -= hH;
  };

  drawTableHeader();
  const barang = data.barang;
  const rowsData = barang.length
    ? barang.map((it, i) => [
        String(i + 1),
        (it.nama || "-").toUpperCase(),
        `1${it.satuan ? ` ${it.satuan.toUpperCase()}` : ""}`,
        it.tahunPerolehan != null ? String(it.tahunPerolehan) : "-",
        it.keterangan ?? "",
      ])
    : [["", "(Tidak ada barang pada ruangan ini)", "", "", ""]];

  for (const r of rowsData) {
    const nLines = Math.max(...r.map((cell, i) => wrap(cell, font, 9, cols[i].w - 8).length));
    const rowH = nLines * 11 + 6;
    if (y - rowH < 120) { // sisakan ruang; lanjut halaman baru + header ulang
      newPage();
      drawTableHeader();
    }
    const topY = y;
    page.drawRectangle({ x: M, y: topY - rowH, width: tableW, height: rowH, borderColor: BLACK, borderWidth: 0.6 });
    r.forEach((cell, i) => cellText(cell, i, topY, font, 9));
    let vx = M;
    for (const c of cols) { vx += c.w; if (vx < M + tableW - 0.1) page.drawLine({ start: { x: vx, y: topY }, end: { x: vx, y: topY - rowH }, thickness: 0.6, color: BLACK }); }
    y -= rowH;
  }

  y -= 26;
  // Tanda tangan lampiran (pindah halaman bila mepet)
  if (y < 220) newPage();
  drawSignatures();

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
