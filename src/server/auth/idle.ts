/**
 * Keluar otomatis saat idle (PRD Form RM Terpadu K6 — PC bersama di loket/bangsal).
 *
 * Dua lapis:
 * - **Klien** (`PenjagaIdle`): tanpa input pengguna di SEMUA tab selama batas →
 *   draf form disimpan, layar ditutup, lalu keluar.
 * - **Server** (rotasi refresh token): sesi yang tidak mengirim permintaan apa pun
 *   lebih lama dari masa access token + batas idle (mis. browser ditutup lalu
 *   dibuka lagi, JS mati) tidak bisa dipulihkan → wajib masuk ulang.
 *
 * Edge-safe (hanya env) — dipakai layout server, proxy, dan auth service.
 */
import { ACCESS_TTL_SEC } from "./tokens";

export const MENIT_IDLE_BAWAAN = 15;

/** `SESI_IDLE_MENIT`: kosong/tak sah → 15; `0` → nonaktif; selain itu dijepit 5–480. */
export function bacaMenitIdle(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return MENIT_IDLE_BAWAAN;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 0) return MENIT_IDLE_BAWAAN;
  if (n === 0) return 0;
  return Math.min(Math.max(n, 5), 480);
}

export function menitIdle(): number {
  return bacaMenitIdle(process.env.SESI_IDLE_MENIT);
}

/**
 * Umur maksimum refresh token saat dirotasi (0 = tanpa batas). Selama tab aktif,
 * token dirotasi setiap access token habis; jadi umur > masa access + batas idle
 * berarti tidak ada permintaan sama sekali selama ≥ batas idle.
 */
export function batasIdleRefreshMs(menit = menitIdle()): number {
  return menit > 0 ? (ACCESS_TTL_SEC + menit * 60) * 1000 : 0;
}
