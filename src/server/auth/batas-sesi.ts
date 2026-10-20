/**
 * Kebijakan sesi "tetap masuk" (20 Okt 2026, menggantikan keluar-otomatis-idle
 * sebagai bawaan):
 *
 * - **Penyegaran latar** — selama ada tab aplikasi terbuka, klien merotasi
 *   refresh token sebelum access token habis, walau pengguna tidak menyentuh
 *   apa pun. Idle tidak lagi mengeluarkan pengguna.
 * - **Batas refresh token** (`AUTH_REFRESH_TTL_MIN`, bawaan 60 menit, bergeser
 *   tiap rotasi) — berlaku saat tidak ada tab terbuka: browser/PC ditutup atau
 *   tidur lebih lama dari itu → wajib masuk ulang.
 * - **Batas mutlak** (`SESI_MAKS_JAM`, bawaan 12 jam) — dihitung sejak kata
 *   sandi dimasukkan (`auth_time`) dan tidak diperpanjang rotasi; kendali
 *   pengganti batas idle di PC bersama (pergantian dinas).
 *
 * Edge-safe (hanya env) — dipakai layout server, proxy, dan auth service.
 */
import { ACCESS_TTL_SEC } from "./tokens";

export const JAM_MAKS_SESI_BAWAAN = 12;
const JAM_MAKS_SESI_TERBESAR = 72;

/** `SESI_MAKS_JAM`: kosong/tak sah → 12; `0` → tanpa batas; selain itu dijepit 1–72. */
export function bacaJamMaksSesi(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return JAM_MAKS_SESI_BAWAAN;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 0) return JAM_MAKS_SESI_BAWAAN;
  if (n === 0) return 0;
  return Math.min(Math.max(n, 1), JAM_MAKS_SESI_TERBESAR);
}

export function jamMaksSesi(): number {
  return bacaJamMaksSesi(process.env.SESI_MAKS_JAM);
}

/** Batas mutlak (detik epoch) sesi yang dimulai `mulaiSec`; null = tanpa batas. */
export function batasSesiSec(mulaiSec: number, jam = jamMaksSesi()): number | null {
  return jam > 0 ? mulaiSec + jam * 3600 : null;
}

/** Sisakan 2 menit sebelum access habis — cukup untuk timer tab latar yang diperlambat browser. */
const CADANGAN_SEGAR_MS = 120_000;

/**
 * Jeda penyegaran latar di klien: access token selalu segar selama tab terbuka,
 * sehingga permintaan setelah lama idle tidak perlu memutar lewat proxy refresh.
 */
export function jedaSegarkanMs(aksesSec = ACCESS_TTL_SEC): number {
  return Math.max(60_000, aksesSec * 1000 - CADANGAN_SEGAR_MS);
}
