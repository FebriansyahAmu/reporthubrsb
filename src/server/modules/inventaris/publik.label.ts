import "server-only";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { loadInstansiLogo, san } from "@/server/lib/pdf";

/**
 * Label QR ruangan siap tempel (A6 potret, 105 × 148 mm). QR digambar sebagai
 * VEKTOR (persegi per modul) agar tajam di printer apa pun; koreksi galat "Q"
 * (±25%) tahan noda/lecet label.
 */

const MM = 72 / 25.4;
const W = 105 * MM;
const H = 148 * MM;
const MARGIN = 9 * MM;

const NAVY = rgb(0.043, 0.212, 0.345);
const MUTED = rgb(0.38, 0.45, 0.52);
const GARIS = rgb(0.8, 0.85, 0.89);

function tengah(page: PDFPage, teks: string, y: number, font: PDFFont, size: number, color = NAVY) {
  const t = san(teks);
  page.drawText(t, { x: (W - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
}

/** Pecah teks jadi baris ≤ lebar (per kata; kata kepanjangan dipotong per karakter). */
function bungkus(teks: string, font: PDFFont, size: number, lebar: number, maksBaris: number): string[] {
  const baris: string[] = [];
  let kini = "";
  const muat = (s: string) => font.widthOfTextAtSize(s, size) <= lebar;
  for (const kata of san(teks).split(/\s+/).filter(Boolean)) {
    const coba = kini ? `${kini} ${kata}` : kata;
    if (muat(coba)) kini = coba;
    else {
      if (kini) baris.push(kini);
      kini = kata;
      while (!muat(kini)) {
        let i = kini.length - 1;
        while (i > 1 && !muat(kini.slice(0, i))) i--;
        baris.push(kini.slice(0, i));
        kini = kini.slice(i);
      }
    }
  }
  if (kini) baris.push(kini);
  if (baris.length > maksBaris) {
    baris.length = maksBaris;
    baris[maksBaris - 1] = `${baris[maksBaris - 1].replace(/.{0,3}$/, "")}...`;
  }
  return baris;
}

/** Gambar QR vektor; modul hitam sebaris digabung jadi satu persegi panjang. */
function gambarQr(page: PDFPage, teks: string, x: number, y: number, sisi: number) {
  const qr = QRCode.create(teks, { errorCorrectionLevel: "Q" });
  const n = qr.modules.size;
  const quiet = 4; // zona sunyi standar (modul)
  const m = sisi / (n + quiet * 2);
  page.drawRectangle({ x, y, width: sisi, height: sisi, color: rgb(1, 1, 1) });
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c)) continue;
      let akhir = c;
      while (akhir + 1 < n && qr.modules.get(r, akhir + 1)) akhir++;
      page.drawRectangle({
        x: x + (quiet + c) * m,
        y: y + sisi - (quiet + r + 1) * m,
        width: (akhir - c + 1) * m + 0.01, // tumpang 0,01 pt: tanpa garis rambut antar modul
        height: m + 0.01,
        color: rgb(0, 0, 0),
      });
      c = akhir;
    }
  }
}

export async function buildLabelQrPdf(opts: { url: string; ruangan: string; kodePrefix: string }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(san(`Label QR Inventaris - ${opts.ruangan}`));
  pdf.setCreator("ReportHub RSUD Boltim");
  const page = pdf.addPage([W, H]);
  const [reg, bold] = await Promise.all([pdf.embedFont(StandardFonts.Helvetica), pdf.embedFont(StandardFonts.HelveticaBold)]);

  // Garis potong tipis.
  page.drawRectangle({ x: 3 * MM, y: 3 * MM, width: W - 6 * MM, height: H - 6 * MM, borderColor: GARIS, borderWidth: 0.6, borderDashArray: [3, 2] });

  let y = H - MARGIN;
  const logoBytes = loadInstansiLogo();
  if (logoBytes) {
    const logo = await pdf.embedPng(logoBytes);
    const h = 13 * MM;
    const w = (logo.width / logo.height) * h;
    y -= h;
    page.drawImage(logo, { x: (W - w) / 2, y, width: w, height: h });
  }
  y -= 4.5 * MM;
  tengah(page, "RSUD BOLAANG MONGONDOW TIMUR", y, bold, 7.5, MUTED);
  y -= 4.2 * MM;
  tengah(page, "INVENTARIS RUANGAN", y, bold, 10);

  y -= 7.5 * MM;
  for (const baris of bungkus(opts.ruangan, bold, 15, W - 2 * MARGIN, 2)) {
    tengah(page, baris, y, bold, 15);
    y -= 6 * MM;
  }
  tengah(page, `Kode ruangan: ${opts.kodePrefix}`, y + 1.2 * MM, reg, 7.5, MUTED);

  const sisiQr = 68 * MM;
  const yQr = 24 * MM;
  gambarQr(page, opts.url, (W - sisiQr) / 2, yQr, sisiQr);

  tengah(page, "Pindai untuk melihat daftar barang", yQr - 5 * MM, bold, 8.5);
  tengah(page, "di ruangan ini (nama, kondisi, tahun).", yQr - 8.6 * MM, reg, 7.5, MUTED);
  let yUrl = yQr - 12.8 * MM;
  for (const baris of bungkus(opts.url.replace(/^https?:\/\//, ""), reg, 5.6, W - 2 * MARGIN, 2)) {
    tengah(page, baris, yUrl, reg, 5.6, MUTED);
    yUrl -= 2.4 * MM;
  }

  return pdf.save();
}
