import "server-only";
import QRCode from "qrcode";
import { rgb, type PDFPage } from "pdf-lib";

/**
 * Gambar QR VEKTOR di halaman pdf-lib (persegi per modul; modul hitam sebaris
 * digabung jadi satu persegi panjang) → tajam di printer apa pun. `x`,`y` = sudut
 * kiri-bawah (koordinat pdf-lib), `sisi` termasuk zona sunyi 4 modul.
 */
export function gambarQr(page: PDFPage, teks: string, x: number, y: number, sisi: number, koreksi: "M" | "Q" = "Q") {
  const qr = QRCode.create(teks, { errorCorrectionLevel: koreksi });
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
