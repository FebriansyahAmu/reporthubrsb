import "server-only";
import {
  LineCapStyle,
  PDFDocument,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { loadInstansiLogo, san } from "@/server/lib/pdf";
import { gambarQr } from "@/server/lib/pdf-qr";
import type { BarisLaporan, LaporanResult } from "./bckh.types";

/**
 * PDF Laporan Kinerja Harian — tiruan 1:1 dokumen contoh `6. BCKH NOVEMBER.docx`
 * (PRD §9). Semua koordinat (pt, dari ATAS halaman) diukur dari dokumen Word asli
 * (twip ÷ 20) & render PDF-nya. Isi Times New Roman → Times (metrik setara);
 * judul sampul Calibri/Tahoma/Leelawadee (tak boleh disertakan, lisensi) →
 * Helvetica-Bold yang dipadatkan horizontal (operator Tz) agar lebar sama.
 */

const LEBAR = 612; // Letter, sama dengan dokumen asli
const TINGGI = 792;
const HITAM = rgb(0, 0, 0);
const hex = (h: string) => {
  const n = Number.parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

type Font = { tr: PDFFont; tb: PDFFont; hb: PDFFont };

/** y dari atas → y pdf-lib (dari bawah). */
const Y = (yAtas: number) => TINGGI - yAtas;

const op = (nama: PDFOperatorNames, ...angka: number[]) => PDFOperator.of(nama, angka.map((n) => PDFNumber.of(n)));

/**
 * Tulis teks dengan penskalaan horizontal `tz` (%) dan, bila `tebal` > 0, goresan
 * tepi setebal itu (mode isi+gores — meniru bobot Tahoma Bold). Status teks
 * dipulihkan sesudahnya.
 */
function teks(page: PDFPage, s: string, x: number, baseline: number, font: PDFFont, size: number, tz = 100, tebal = 0) {
  if (!s) return;
  if (tz !== 100) page.pushOperators(op(PDFOperatorNames.SetTextHorizontalScaling, tz));
  if (tebal > 0) {
    page.pushOperators(
      op(PDFOperatorNames.SetTextRenderingMode, 2),
      op(PDFOperatorNames.SetLineWidth, tebal),
      op(PDFOperatorNames.StrokingColorRgb, 0, 0, 0),
    );
  }
  page.drawText(s, { x, y: Y(baseline), font, size, color: HITAM });
  if (tebal > 0) page.pushOperators(op(PDFOperatorNames.SetTextRenderingMode, 0), op(PDFOperatorNames.SetLineWidth, 1));
  if (tz !== 100) page.pushOperators(op(PDFOperatorNames.SetTextHorizontalScaling, 100));
}

const lebarTeks = (s: string, font: PDFFont, size: number, tz = 100) => (font.widthOfTextAtSize(s, size) * tz) / 100;

/** Teks rata tengah pada `tengah`; dipadatkan lagi bila melebihi `maks`. */
function teksTengah(page: PDFPage, mentah: string, tengah: number, baseline: number, font: PDFFont, size: number, tz = 100, maks = Infinity, tebal = 0) {
  const s = san(mentah);
  let z = tz;
  const w0 = lebarTeks(s, font, size, z);
  if (w0 > maks) z = (z * maks) / w0;
  teks(page, s, tengah - lebarTeks(s, font, size, z) / 2, baseline, font, size, z, tebal);
}

/** Garis bawah teks (nama penandatangan). */
function garisBawah(page: PDFPage, x: number, baseline: number, lebar: number) {
  page.drawLine({ start: { x, y: Y(baseline + 1.4) }, end: { x: x + lebar, y: Y(baseline + 1.4) }, thickness: 0.55, color: HITAM });
}

/** Bungkus teks ke lebar `maks` (pecah di spasi; kata terlalu panjang dipotong keras). */
function bungkus(mentah: string, font: PDFFont, size: number, maks: number): string[] {
  const kata = san(mentah).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (kata.length === 0) return [""];
  const muat = (s: string) => font.widthOfTextAtSize(s, size) <= maks;
  const baris: string[] = [];
  let kini = "";
  for (const k of kata) {
    const calon = kini ? `${kini} ${k}` : k;
    if (muat(calon)) {
      kini = calon;
      continue;
    }
    if (kini) baris.push(kini);
    if (muat(k)) {
      kini = k;
      continue;
    }
    let potong = "";
    for (const ch of k) {
      if (muat(potong + ch)) potong += ch;
      else {
        baris.push(potong);
        potong = ch;
      }
    }
    kini = potong;
  }
  if (kini) baris.push(kini);
  return baris;
}

/* ================================================================ sampul */

const SAMPUL = {
  bingkai: { x: 77.17, y: 39.07, w: 448.8, h: 733.4, r: 74.8 },
  logo: { tengah: 301.25, y: 66.6, h: 68.2, wMaks: 59.5 },
  tengahKop: 305,
  tengahKotak: 301.7,
  abu: { x: 82.8, y: 270.5, w: 430.1, h: 74.8, isi: "#A4A4A4", bayang: "#A6A6A6" },
  biru: { x: 82.8, y: 364.0, w: 430.1, h: 95.35, isi: "#5A9BD4", bayang: "#8CA4B9" },
  tepi: "#F1F1F1",
  identitas: { label: 116.2, titik: 189.4, isi: 217.7, baseline: [510.9, 528.5, 547.5], lebarIsi: 290 },
};

/** Kotak judul sampul: bayangan kanan-bawah 1,5 pt, tepi #F1F1F1 3 pt, isi warna. */
function kotak(page: PDFPage, k: { x: number; y: number; w: number; h: number; isi: string; bayang: string }) {
  // Kotak luar tepi (±1,5 pt) digeser +1,5 pt → pita bayangan di kanan & bawah.
  page.drawRectangle({ x: k.x, y: Y(k.y + k.h + 3), width: k.w + 3, height: k.h + 3, color: hex(k.bayang) });
  page.drawRectangle({
    x: k.x,
    y: Y(k.y + k.h),
    width: k.w,
    height: k.h,
    color: hex(k.isi),
    borderColor: hex(SAMPUL.tepi),
    borderWidth: 3,
  });
}

async function sampul(doc: PDFDocument, f: Font, lap: LaporanResult) {
  const page = doc.addPage([LEBAR, TINGGI]);
  const b = SAMPUL.bingkai;
  const r = b.r;
  page.drawSvgPath(
    `M ${r} 0 H ${b.w - r} A ${r} ${r} 0 0 1 ${b.w} ${r} V ${b.h - r} A ${r} ${r} 0 0 1 ${b.w - r} ${b.h} H ${r} A ${r} ${r} 0 0 1 0 ${b.h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`,
    { x: b.x, y: Y(b.y), borderColor: HITAM, borderWidth: 0.75 },
  );

  const logo = loadInstansiLogo();
  if (logo) {
    const img = await doc.embedPng(logo);
    const skala = Math.min(SAMPUL.logo.h / img.height, SAMPUL.logo.wMaks / img.width);
    const w = img.width * skala;
    const h = img.height * skala;
    page.drawImage(img, { x: SAMPUL.logo.tengah - w / 2, y: Y(SAMPUL.logo.y + h), width: w, height: h });
  }

  const p = lap.pengaturan;
  teksTengah(page, p.kop1, SAMPUL.tengahKop, 160.6, f.hb, 16, 86.5, 420);
  teksTengah(page, p.kop2, SAMPUL.tengahKop, 180.1, f.hb, 16, 86.5, 420);

  kotak(page, SAMPUL.abu);
  teksTengah(page, p.instansi1, SAMPUL.tengahKotak, 293.1, f.hb, 17, 99, 410, 0.45);
  teksTengah(page, p.instansi2, SAMPUL.tengahKotak, 314.1, f.hb, 17, 99, 410, 0.45);

  kotak(page, SAMPUL.biru);
  teksTengah(page, "LAPORAN KINERJA HARIAN", SAMPUL.tengahKotak, 388.9, f.hb, 18, 96);
  teksTengah(page, `TAHUN ${lap.tahun}`, SAMPUL.tengahKotak, 405.2, f.hb, 12, 86.5);
  teksTengah(page, `( BULAN ${lap.namaBulan.toUpperCase()} )`, SAMPUL.tengahKotak, 419.8, f.hb, 12, 86.5);

  const id = SAMPUL.identitas;
  const isi = [
    ["NAMA", lap.profil.namaLengkap],
    ["JABATAN", lap.profil.jabatan || "-"],
    ["NIP", lap.profil.nip || "-"],
  ] as const;
  isi.forEach(([label, nilai], i) => {
    const bl = id.baseline[i];
    teks(page, label, id.label, bl, f.tr, 12);
    teks(page, ":", id.titik, bl, f.tr, 12);
    // Nilai panjang dikecilkan agar tetap satu baris di dalam bingkai.
    const s = san(nilai);
    const size = Math.max(8, Math.min(12, (12 * id.lebarIsi) / Math.max(1, f.tr.widthOfTextAtSize(s, 12))));
    teks(page, s, id.isi, bl, f.tr, size);
  });

  teksTengah(page, `TAHUN ${lap.tahun}`, 305.3, 654.6, f.hb, 20, 88.5);
}

/* ================================================================= tabel */

/** Batas kolom (pt): NO | HARI / TANGGAL | CATATAN KINERJA | PROSES | SELESAI | KET (grid Word 562|1825|3845|1276|1276|1559 twip). */
const X = [58.85, 86.95, 178.2, 370.45, 434.25, 498.05, 576.0] as const;
const TABEL_ATAS = 40.5;
/** Halaman lanjutan: tabel mulai tepat di margin atas (35 pt), tanpa kepala (seperti asli). */
const TABEL_ATAS_LANJUT = 35;
const BATAS_BAWAH = 778; // margin bawah 14 pt
const KEPALA_TENGAH = TABEL_ATAS + 14;
const KEPALA_BAWAH = TABEL_ATAS + 28;
const GARIS = 0.5;

const T = {
  size: 12,
  /** Baris tanggal & nomor: spasi tepat 13,4 pt (268 twip); baseline 11,35 pt di bawah tepi atas. */
  lhTanggal: 13.4,
  /** Butir catatan: 1,15 × 13,8 = 15,87 pt; baseline butir pertama 11,6 pt di bawah tepi atas. */
  lhCatatan: 15.87,
  turunPertama: 11.35,
  turunCatatan: 11.6,
  xTanggal: X[1] + 0.6,
  lebarTanggal: X[2] - X[1] - 1.2,
  xPoin: X[2] + 36.1,
  xCatatan: X[2] + 54.1,
  lebarCatatan: X[3] - (X[2] + 54.1) - 1.5,
  /** Tengah centang dari tepi kiri kolom PROSES/SELESAI (diukur: 36,55 pt). */
  centang: 36.55,
};

function garisV(page: PDFPage, x: number, atas: number, bawah: number) {
  page.drawLine({ start: { x, y: Y(atas) }, end: { x, y: Y(bawah) }, thickness: GARIS, color: HITAM });
}
function garisH(page: PDFPage, x1: number, x2: number, y: number) {
  page.drawLine({ start: { x: x1, y: Y(y) }, end: { x: x2, y: Y(y) }, thickness: GARIS, color: HITAM });
}

function kepalaTabel(page: PDFPage, f: Font) {
  const b = f.tb;
  garisH(page, X[0], X[6], TABEL_ATAS);
  garisH(page, X[3], X[5], KEPALA_TENGAH);
  garisH(page, X[0], X[6], KEPALA_BAWAH);
  for (const x of [X[0], X[1], X[2], X[3], X[5], X[6]]) garisV(page, x, TABEL_ATAS, KEPALA_BAWAH);
  garisV(page, X[4], KEPALA_TENGAH, KEPALA_BAWAH);
  teks(page, "NO", X[0] + 9.35, 58.9, b, 12);
  teks(page, "HARI /", X[1] + 0.6, 52.0, b, 12);
  teks(page, "TANGGAL", X[1] + 0.6, 65.8, b, 12);
  teks(page, "CATATAN KINERJA", X[2] + 40.5, 58.9, b, 12);
  teks(page, "TARGET", X[3] + 50.55, 51.6, b, 12);
  teks(page, "PROSES", X[3] + 13.35, 66.0, b, 12);
  teks(page, "SELESAI", X[4] + 5.4, 66.0, b, 12);
  teks(page, "KET", X[5] + 24.1, 58.9, b, 12);
}

/** Tanda ✓ vektor (±9,4 × 8 pt) berpusat di (cx, cy). */
function centang(page: PDFPage, cx: number, cy: number) {
  page.drawSvgPath("M 0 4.3 L 3.3 7.8 L 9.4 0", {
    x: cx - 4.7,
    y: Y(cy - 3.9),
    borderColor: HITAM,
    borderWidth: 0.95,
    borderLineCap: LineCapStyle.Round,
  });
}

type BarisSiap = { b: BarisLaporan; tanggal: { teks: string; tz: number }[]; catatan: string[][]; ket: string[]; tinggi: number };

/** Ukur baris: bungkus tanggal/catatan/ket lalu hitung tinggi (seperti Word: tinggi isi terbesar). */
function siapkan(b: BarisLaporan, f: Font): BarisSiap {
  const s = T.size;
  // Tanggal: muat satu baris bila hanya sedikit melebihi (dipadatkan ≤ 4%), selain itu dibungkus.
  const tgl = san(b.hariTanggal);
  const wTgl = f.tr.widthOfTextAtSize(tgl, s);
  const tanggal =
    wTgl <= T.lebarTanggal
      ? [{ teks: tgl, tz: 100 }]
      : wTgl <= T.lebarTanggal * 1.04
        ? [{ teks: tgl, tz: (T.lebarTanggal / wTgl) * 100 }]
        : bungkus(tgl, f.tr, s, T.lebarTanggal).map((teks) => ({ teks, tz: 100 }));
  const catatan = b.catatan.map((c) => bungkus(c, f.tr, s, T.lebarCatatan));
  const ket = b.ket ? bungkus(b.ket, f.tr, s, X[6] - X[5] - 4) : [];
  const nCatatan = catatan.reduce((n, c) => n + c.length, 0);
  const tinggi = Math.max(
    nCatatan * T.lhCatatan + 0.55,
    tanggal.length * T.lhTanggal + 0.7,
    ket.length * T.lhTanggal + 2,
    16.4,
  );
  return { b, tanggal, catatan, ket, tinggi };
}

function gambarBaris(page: PDFPage, f: Font, r: BarisSiap, atas: number) {
  const bawah = atas + r.tinggi;
  const tengah = atas + r.tinggi / 2;
  const s = T.size;

  teksTengah(page, `${r.b.no}.`, (X[0] + X[1]) / 2, atas + T.turunPertama, f.tr, s);
  r.tanggal.forEach((t, i) => teks(page, t.teks, T.xTanggal, atas + T.turunPertama + i * T.lhTanggal, f.tr, s, t.tz));

  // Catatan rata tengah vertikal (sel Word vAlign center), butir berpoin "-" dengan indentasi gantung.
  const nCatatan = r.catatan.reduce((n, c) => n + c.length, 0);
  let bl = tengah - (nCatatan * T.lhCatatan) / 2 + (T.turunCatatan - 0.25);
  for (const butir of r.catatan) {
    teks(page, "-", T.xPoin, bl, f.tr, s);
    for (const baris of butir) {
      teks(page, baris, T.xCatatan, bl, f.tr, s);
      bl += T.lhCatatan;
    }
  }

  if (r.b.target) centang(page, (r.b.target === "PROSES" ? X[3] : X[4]) + T.centang, tengah);

  const awalKet = tengah - ((r.ket.length - 1) * T.lhTanggal) / 2 + 4.3;
  r.ket.forEach((k, i) => teksTengah(page, k, (X[5] + X[6]) / 2, awalKet + i * T.lhTanggal, f.tr, s));

  garisH(page, X[0], X[6], bawah);
  for (const x of X) garisV(page, x, atas, bawah);
}

/* ======================================================== tanda tangan */

const TTD = {
  tinggi: 216,
  jarakSetelahTabel: 42,
  kiri: 186.3,
  kanan: 446.3,
  mengetahui: 311.1,
  namaMengetahui: 316.4,
  size: 11,
};

/** Gambar TTD (PNG) disisipkan di atas nama blok; dipasang di dalam kotak `w×h`, rata bawah & tengah. */
async function bubuhkanTtd(doc: PDFDocument, page: PDFPage, png: Uint8Array | undefined, tengah: number, atas: number, w: number, h: number) {
  if (!png) return;
  try {
    const img = await doc.embedPng(png);
    const skala = Math.min(w / img.width, h / img.height, 1.2);
    const lw = img.width * skala;
    const lh = img.height * skala;
    page.drawImage(img, { x: tengah - lw / 2, y: Y(atas + h), width: lw, height: lh });
  } catch {
    /* PNG tak terbaca pdf-lib → blok tetap bernama (TTD tercatat di halaman verifikasi) */
  }
}

/** QR verifikasi + keterangan di kanan blok "Mengetahui" (hanya laporan DISETUJUI). */
function stempelVerifikasi(page: PDFPage, f: Font, y0: number, v: Verifikasi) {
  const sisi = 56;
  const x = X[6] - sisi;
  const atas = y0 + 138;
  if (v.url) gambarQr(page, v.url, x, Y(atas + sisi), sisi, "M");
  const tengah = x + sisi / 2;
  const bl = v.url ? atas + sisi + 7 : atas + 20;
  teksTengah(page, "Disahkan elektronik", tengah, bl, f.tr, 6.5);
  teksTengah(page, `Kode ${v.kode}`, tengah, bl + 8, f.tb, 6.5);
}

export type TtdLaporan = Partial<Record<"PEGAWAI" | "ATASAN" | "MENGETAHUI", Uint8Array>>;
type Verifikasi = { url: string | null; kode: string };
export type Pengesahan = { ttd: TtdLaporan; verifikasi: Verifikasi | null };

async function tandaTangan(doc: PDFDocument, page: PDFPage, f: Font, lap: LaporanResult, y0: number, sah?: Pengesahan) {
  const s = TTD.size;
  if (sah) {
    await bubuhkanTtd(doc, page, sah.ttd.PEGAWAI, TTD.kiri, y0 + 4, 130, 36);
    await bubuhkanTtd(doc, page, sah.ttd.ATASAN, TTD.kanan, y0 + 4, 130, 36);
    await bubuhkanTtd(doc, page, sah.ttd.MENGETAHUI, TTD.namaMengetahui, y0 + 136, 150, 50);
    if (sah.verifikasi) stempelVerifikasi(page, f, y0, sah.verifikasi);
  }
  const nama = (t: string, tengah: number, baseline: number) => {
    const n = san(t);
    if (!n) {
      garisBawah(page, tengah - 75, baseline, 150);
      return;
    }
    const w = f.tr.widthOfTextAtSize(n, s);
    teks(page, n, tengah - w / 2, baseline, f.tr, s);
    garisBawah(page, tengah - w / 2, baseline, w);
  };
  const nip = (v: string, tengah: number, baseline: number) => {
    if (v) teksTengah(page, `NIP. ${v}`, tengah, baseline, f.tr, s);
  };

  teksTengah(page, "YANG MELAPORKAN", TTD.kiri, y0, f.tr, s);
  teksTengah(page, "ATASAN LANGSUNG", TTD.kanan, y0, f.tr, s);
  nama(lap.profil.namaTtd, TTD.kiri, y0 + 50.7);
  nama(lap.profil.atasanNama, TTD.kanan, y0 + 50.7);
  nip(lap.profil.nip, TTD.kiri, y0 + 63.3);
  nip(lap.profil.atasanNip, TTD.kanan, y0 + 63.3);

  teksTengah(page, "MENGETAHUI,", TTD.mengetahui, y0 + 116.6, f.tr, s);
  teksTengah(page, lap.pengaturan.mengetahuiJabatan, TTD.mengetahui, y0 + 131.3, f.tr, s, 100, X[6] - X[0]);
  nama(lap.pengaturan.mengetahuiNama, TTD.namaMengetahui, y0 + 197.6);
  nip(lap.pengaturan.mengetahuiNip, TTD.namaMengetahui, y0 + 210.3);
}

/* ================================================================= utama */

/**
 * `sah` (opsional) = laporan dari pengajuan aktif: gambar TTD per blok, dan bila
 * DISETUJUI stempel verifikasi (QR + kode). Tanpa `sah` = laporan biasa (tanpa TTD).
 */
export async function bangunPdfLaporan(lap: LaporanResult, sah?: Pengesahan): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(san(`Laporan Kinerja Harian ${lap.profil.namaLengkap} - ${lap.namaBulan} ${lap.tahun}`));
  doc.setAuthor(san(lap.profil.namaLengkap));
  doc.setSubject("Buku Catatan Kegiatan Harian (BCKH)");
  doc.setCreator("ReportHub RSUD Bolaang Mongondow Timur");
  doc.setProducer("ReportHub");
  const f: Font = {
    tr: await doc.embedFont(StandardFonts.TimesRoman),
    tb: await doc.embedFont(StandardFonts.TimesRomanBold),
    hb: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  await sampul(doc, f, lap);

  // Tabel: kepala hanya di halaman pertama (seperti asli); baris tidak dipecah antarhalaman.
  let page = doc.addPage([LEBAR, TINGGI]);
  kepalaTabel(page, f);
  let y = KEPALA_BAWAH;
  for (const b of lap.baris) {
    const r = siapkan(b, f);
    if (y + r.tinggi > BATAS_BAWAH && y > TABEL_ATAS_LANJUT) {
      page = doc.addPage([LEBAR, TINGGI]);
      y = TABEL_ATAS_LANJUT;
      garisH(page, X[0], X[6], y);
    }
    gambarBaris(page, f, r, y);
    y += r.tinggi;
  }

  let y0 = y + TTD.jarakSetelahTabel;
  if (y0 + TTD.tinggi > BATAS_BAWAH) {
    page = doc.addPage([LEBAR, TINGGI]);
    y0 = TABEL_ATAS + 20;
  }
  await tandaTangan(doc, page, f, lap, y0, sah);

  return doc.save();
}
