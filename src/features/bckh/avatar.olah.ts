"use client";

import { AVATAR } from "@/server/modules/bckh/bckh.constants";

/**
 * Pengolahan foto profil di browser: dekode (orientasi EXIF diterapkan), potong
 * persegi sesuai bingkai yang diatur pengguna, perkecil ke ≤ AVATAR.sisi px, lalu
 * enkode ulang WebP (JPEG bila browser tak bisa WebP). Enkode ulang membuang
 * metadata EXIF (termasuk lokasi GPS foto HP); yang terkirim hanya puluhan KB.
 */

export class AvatarTidakValid extends Error {}

export type SumberAvatar = { gambar: CanvasImageSource; lebar: number; tinggi: number; tutup: () => void };

/** Bingkai potong dalam koordinat piksel gambar: pusat (cx, cy) & perbesaran ≥ 1. */
export type Bingkai = { cx: number; cy: number; zoom: number };

export const ZOOM_MAKS = 4;

export async function dekodeAvatar(file: Blob): Promise<SumberAvatar> {
  if (file.type && !file.type.startsWith("image/")) throw new AvatarTidakValid("Berkas yang dipilih bukan gambar.");
  if (file.size > AVATAR.masukanMaks) throw new AvatarTidakValid(`Foto terlalu besar (maks ${AVATAR.masukanMaks / 1024 / 1024} MB).`);
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { gambar: bmp, lebar: bmp.width, tinggi: bmp.height, tutup: () => bmp.close() };
    } catch {
      /* jatuh ke <img> */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new AvatarTidakValid("Format foto tidak dapat dibaca. Gunakan JPG, PNG, atau WebP.");
  }
  return { gambar: img, lebar: img.naturalWidth, tinggi: img.naturalHeight, tutup: () => URL.revokeObjectURL(url) };
}

/** Sisi persegi yang terlihat (piksel gambar) pada perbesaran ini. */
export const sisiTerlihat = (s: Pick<SumberAvatar, "lebar" | "tinggi">, zoom: number) => Math.min(s.lebar, s.tinggi) / zoom;

/** Jaga bingkai tetap di dalam gambar (tanpa area kosong). */
export function rapikan(s: Pick<SumberAvatar, "lebar" | "tinggi">, b: Bingkai): Bingkai {
  const zoom = Math.min(ZOOM_MAKS, Math.max(1, b.zoom));
  const setengah = sisiTerlihat(s, zoom) / 2;
  const jepit = (v: number, maks: number) => Math.min(maks - setengah, Math.max(setengah, v));
  return { zoom, cx: jepit(b.cx, s.lebar), cy: jepit(b.cy, s.tinggi) };
}

export const bingkaiAwal = (s: Pick<SumberAvatar, "lebar" | "tinggi">): Bingkai => ({ cx: s.lebar / 2, cy: s.tinggi / 2, zoom: 1 });

/** Gambar bagian bingkai ke kanvas persegi berukuran `sisi` piksel. */
export function lukis(ctx: CanvasRenderingContext2D, s: SumberAvatar, b: Bingkai, sisi: number) {
  const v = sisiTerlihat(s, b.zoom);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sisi, sisi);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(s.gambar, b.cx - v / 2, b.cy - v / 2, v, v, 0, 0, sisi, sisi);
}

const keBlob = (c: HTMLCanvasElement, jenis: string, mutu: number) => new Promise<Blob | null>((res) => c.toBlob(res, jenis, mutu));

/** Potong + kompres → berkas siap unggah (WebP, atau JPEG bila WebP tak didukung). */
export async function potongAvatar(s: SumberAvatar, b: Bingkai): Promise<Blob> {
  const sisi = Math.max(64, Math.min(AVATAR.sisi, Math.round(sisiTerlihat(s, b.zoom))));
  const c = document.createElement("canvas");
  c.width = sisi;
  c.height = sisi;
  const ctx = c.getContext("2d");
  if (!ctx) throw new AvatarTidakValid("Browser tidak mendukung pemrosesan foto.");
  lukis(ctx, s, b, sisi);
  for (const mutu of [0.9, 0.8, 0.65]) {
    const webp = await keBlob(c, "image/webp", mutu);
    const hasil = webp?.type === "image/webp" ? webp : await keBlob(c, "image/jpeg", mutu);
    if (hasil && hasil.size <= AVATAR.maksByte) return hasil;
  }
  throw new AvatarTidakValid("Foto gagal dikompres. Coba foto lain.");
}

/** Berkas gambar pertama dari seret-lepas / tempel. */
export function gambarDari(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  for (const f of Array.from(dt.files)) if (f.type.startsWith("image/")) return f;
  for (const it of Array.from(dt.items ?? [])) {
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  return null;
}
