/**
 * Utilitas tanda tangan (client-only — pakai <canvas>). Mengubah goresan/foto
 * menjadi PNG **hitam di atas transparan** (biner) yang rapi: grayscale →
 * threshold → despeckle → crop ke kotak tinta. Cocok ditempel di formulir cetak.
 */

/** Muat data-URL / URL gambar menjadi HTMLImageElement. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat gambar"));
    img.src = src;
  });
}

/**
 * Biner-kan isi sebuah canvas: piksel "tinta" (cukup gelap & tak transparan)
 * → hitam pekat, sisanya transparan; opsional buang bintik terisolasi; lalu
 * crop ke kotak tinta (+padding). Mengembalikan PNG data-URL, atau "" bila kosong.
 */
function binarizeCanvas(
  src: HTMLCanvasElement,
  threshold: number,
  despeckle: boolean,
): string {
  const w = src.width;
  const h = src.height;
  const ctx = src.getContext("2d");
  if (!ctx || w === 0 || h === 0) return "";
  const px = ctx.getImageData(0, 0, w, h).data;

  const ink = new Uint8Array(w * h);
  for (let p = 0, i = 0; p < ink.length; p++, i += 4) {
    const a = px[i + 3];
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    if (a > 24 && lum < threshold) ink[p] = 1;
  }

  if (despeckle) {
    const s = ink.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (!s[p]) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            if (s[yy * w + xx]) n++;
          }
        }
        if (n < 1) ink[p] = 0; // piksel tinta terisolasi → buang
      }
    }
  }

  const out = new Uint8ClampedArray(w * h * 4);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!ink[p]) continue;
      const i = p * 4;
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 255;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return ""; // tidak ada tinta

  const pad = 6;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;

  const full = document.createElement("canvas");
  full.width = w;
  full.height = h;
  full.getContext("2d")?.putImageData(new ImageData(out, w, h), 0, 0);

  const crop = document.createElement("canvas");
  crop.width = cw;
  crop.height = ch;
  crop.getContext("2d")?.drawImage(full, x0, y0, cw, ch, 0, 0, cw, ch);
  return crop.toDataURL("image/png");
}

/** Ambang default untuk foto (0–255) & ukuran (sisi terpanjang, px). */
export const PHOTO_THRESHOLD_DEFAULT = 150;
export const PHOTO_MAXDIM_DEFAULT = 480;

/** Kotak crop dalam pecahan 0..1 terhadap ukuran gambar sumber. */
export type CropRect = { x: number; y: number; w: number; h: number };

/** Crop penuh (tanpa pemotongan). */
export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Proses tanda tangan dari gambar sumber (gambar tangan / foto / kamera):
 * potong sesuai `crop` (pecahan) → perkecil ke `maxDim` px (sisi terpanjang =
 * resize) → grayscale → threshold (hitam-putih) → despeckle → **buang latar
 * (transparan)** → rapatkan ke tinta. Return PNG data-URL, "" bila kosong.
 */
export async function processPhoto(
  src: string,
  threshold: number,
  maxDim: number = PHOTO_MAXDIM_DEFAULT,
  crop: CropRect = FULL_CROP,
): Promise<string> {
  const img = await loadImage(src);
  const sx = Math.max(0, Math.round(crop.x * img.width));
  const sy = Math.max(0, Math.round(crop.y * img.height));
  const sw = Math.max(1, Math.round(crop.w * img.width));
  const sh = Math.max(1, Math.round(crop.h * img.height));
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return binarizeCanvas(c, threshold, true);
}

/**
 * Proses tanda tangan **gambar** (dari signature_pad — goresan hitam di atas latar
 * PUTIH). Menghapus latar tanpa ambang keras: `alpha = 255 − luminance`, warna
 * dipaksa hitam → putih jadi transparan, tepi anti-alias tetap halus (grayscale →
 * alpha sebagian). Lalu rapatkan ke kotak tinta. Return PNG hitam-di-atas-transparan,
 * "" bila kosong. (Butuh latar putih agar tepi membaur → mulus; jangan transparan.)
 */
export async function processDrawing(src: string): Promise<string> {
  const img = await loadImage(src);
  const w = img.width;
  const h = img.height;
  if (!w || !h) return "";
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, w, h);
  const px = id.data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const a = px[i + 3];
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const alpha = a === 0 ? 0 : Math.max(0, Math.min(255, Math.round(255 - lum)));
    px[i] = 0;
    px[i + 1] = 0;
    px[i + 2] = 0;
    px[i + 3] = alpha;
    if (alpha > 12) {
      const x = p % w;
      const y = (p / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return ""; // tidak ada goresan
  ctx.putImageData(id, 0, 0);

  const pad = 6;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d")?.drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
  return out.toDataURL("image/png");
}

/** Ambil 1 frame dari elemen <video> kamera → PNG data-URL (untuk diproses). */
export function captureVideoFrame(video: HTMLVideoElement): string {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return "";
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(video, 0, 0, w, h);
  return c.toDataURL("image/png");
}

/** Baca File gambar → data-URL (untuk diproses/diperbaiki ambangnya). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca berkas"));
    reader.readAsDataURL(file);
  });
}
