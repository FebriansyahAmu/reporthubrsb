"use client";

import { FOTO_BARANG } from "@/server/modules/inventaris/barang.schema";

/**
 * Siapkan foto barang di browser sebelum diunggah: dekode (orientasi EXIF
 * diterapkan), perkecil sisi terpanjang ke ≤ 2560 px, enkode ulang WebP (JPEG
 * bila browser tak bisa WebP), plus miniatur 360 px. Foto 20 MB pun yang
 * terkirim ke server hanya ratusan KB. Enkode ulang sekaligus
 * membuang metadata EXIF (termasuk lokasi GPS foto HP).
 */

export type FotoSiap = {
  foto: Blob;
  thumb: Blob;
  /** Object URL `foto` untuk pratinjau — dicabut pemiliknya saat tak dipakai. */
  preview: string;
  lebar: number;
  tinggi: number;
  ukuranAsli: number;
};

export class FotoTidakValid extends Error {}

type Sumber = { gambar: CanvasImageSource; lebar: number; tinggi: number; tutup: () => void };

async function dekode(file: Blob): Promise<Sumber> {
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
    throw new FotoTidakValid("Format foto tidak dapat dibaca. Gunakan JPG, PNG, atau WebP.");
  }
  return { gambar: img, lebar: img.naturalWidth, tinggi: img.naturalHeight, tutup: () => URL.revokeObjectURL(url) };
}

const keBlob = (c: HTMLCanvasElement, jenis: string, mutu: number) =>
  new Promise<Blob | null>((res) => c.toBlob(res, jenis, mutu));

function gambarKe(src: CanvasImageSource, lebar: number, tinggi: number, sisi: number): HTMLCanvasElement {
  const k = Math.min(1, sisi / Math.max(lebar, tinggi));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(lebar * k));
  c.height = Math.max(1, Math.round(tinggi * k));
  const ctx = c.getContext("2d");
  if (!ctx) throw new FotoTidakValid("Browser tidak mendukung pemrosesan foto.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

async function enkode(c: HTMLCanvasElement, mutu: number): Promise<Blob> {
  const webp = await keBlob(c, "image/webp", mutu);
  if (webp && webp.type === "image/webp") return webp;
  // Browser tanpa enkoder WebP → JPEG; area transparan diberi latar putih.
  const ctx = c.getContext("2d")!;
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  const jpeg = await keBlob(c, "image/jpeg", mutu);
  if (!jpeg) throw new FotoTidakValid("Foto gagal diproses.");
  return jpeg;
}

export async function siapkanFoto(file: File): Promise<FotoSiap> {
  if (file.type && !file.type.startsWith("image/")) throw new FotoTidakValid("Berkas yang dipilih bukan gambar.");
  if (file.size > FOTO_BARANG.masukanMaks) {
    throw new FotoTidakValid(`Foto terlalu besar (maks ${FOTO_BARANG.masukanMaks / 1024 / 1024} MB).`);
  }
  const sumber = await dekode(file);
  try {
    const utama = gambarKe(sumber.gambar, sumber.lebar, sumber.tinggi, FOTO_BARANG.sisiMaks);
    // Mutu diturunkan bertahap sampai ≤ target (foto berderau/sangat detail).
    let foto = await enkode(utama, 0.85);
    for (const mutu of [0.75, 0.65]) {
      if (foto.size <= FOTO_BARANG.ukuranTarget) break;
      foto = await enkode(utama, mutu);
    }
    if (foto.size > FOTO_BARANG.ukuranMaks) throw new FotoTidakValid("Foto terlalu detail untuk dikompres. Coba foto lain.");
    // Miniatur diturunkan dari kanvas utama (lebih tajam daripada dari 4000 px langsung).
    const thumb = await enkode(gambarKe(utama, utama.width, utama.height, FOTO_BARANG.sisiThumb), 0.8);
    return {
      foto,
      thumb,
      preview: URL.createObjectURL(foto),
      lebar: utama.width,
      tinggi: utama.height,
      ukuranAsli: file.size,
    };
  } finally {
    sumber.tutup();
  }
}

/** Ambil berkas gambar pertama dari DataTransfer (seret-lepas / tempel). */
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
