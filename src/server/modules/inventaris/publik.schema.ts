import { z } from "zod";

/**
 * Tautan publik (QR) daftar barang per ruangan — konstanta & skema bersama
 * (bebas server-only: dipakai juga proxy & UI).
 *
 * Model keamanan = *capability URL* (W3C TAG): tautan `/ruang/<token>` itu
 * sendiri adalah izinnya. Karena itu token acak kriptografis 192-bit, bisa
 * dicabut/diganti kapan saja, dan halaman publiknya membatasi data seminimal
 * mungkin (nama barang, kondisi, tahun — tanpa ID, kode, harga, PJ).
 */

/** Prefiks rute halaman publik (dicocokkan proxy; folder `src/app/ruang`). */
export const RUTE_PUBLIK_RUANG = "/ruang";

/** 24 byte acak → base64url tepat 32 karakter. */
export const TOKEN_PUBLIK_BYTES = 24;
export const TOKEN_PUBLIK_RE = /^[A-Za-z0-9_-]{32}$/;

/** Batas keluaran halaman publik (melindungi DB & ukuran respons). */
export const MAKS_UNIT_PUBLIK = 5000;

export const AKSI_TAUTAN = ["TERBITKAN", "NONAKTIFKAN", "AKTIFKAN", "GANTI"] as const;
export type AksiTautan = (typeof AKSI_TAUTAN)[number];

export const aksiTautanSchema = z.object({ aksi: z.enum(AKSI_TAUTAN) }).strict();

/** ID ruangan (cuid, kolom VARCHAR(30)) dari segmen URL. */
export const idRuanganSchema = z.string().regex(/^[A-Za-z0-9_-]{1,30}$/, "ID ruangan tidak sah");

export type StatusTautan = "BELUM" | "AKTIF" | "NONAKTIF";

/** Info tautan untuk panel admin. `url` null bila belum terbit / origin publik belum diatur. */
export type TautanPublik = {
  status: StatusTautan;
  url: string | null;
  /** false → env PUBLIC_APP_ORIGIN (atau SIGN_PUBLIC_ORIGIN) belum diatur/valid. */
  asalDiatur: boolean;
  dibuatOleh: string | null;
  diubahOleh: string | null;
  dibuatPada: string | null;
  diubahPada: string | null;
};
