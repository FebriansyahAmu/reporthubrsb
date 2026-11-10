/**
 * Aturan kredensial perangkat TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md §7.6).
 * MURNI (tanpa I/O, tanpa `server-only`) agar teruji unit; service yang
 * menerapkan keputusannya.
 *
 * - Token 256 bit (base64url 43 karakter); DB hanya menyimpan sha256-nya.
 * - Rotasi lewat `POST /api/ttd-siaga/segarkan` (paling sering 1×/24 jam).
 *   Hash token sebelumnya disimpan sebagai `token_hash_lama` selama grasi.
 * - Token lama dipakai SETELAH grasi = indikasi kredensial disalin → cabut.
 * - Token yang tak dirotasi 30 hari = kedaluwarsa (tablet lama mati → pasang ulang).
 */

export const TOKEN_PERANGKAT_RE = /^[A-Za-z0-9_-]{43}$/;

export const ROTASI_SETIAP_MS = 24 * 60 * 60_000;
export const GRASI_ROTASI_MS = 2 * 60_000;
export const UMUR_KREDENSIAL_MS = 30 * 24 * 60 * 60_000;
export const UMUR_COOKIE_DETIK = UMUR_KREDENSIAL_MS / 1000;

/** `__Host-` (wajib Secure, Path=/, tanpa Domain) di HTTPS; nama biasa hanya di HTTP dev/LAN. */
export const COOKIE_PERANGKAT = { aman: "__Host-rh_perangkat", biasa: "rh_perangkat" } as const;
export const namaCookiePerangkat = (aman: boolean): string => (aman ? COOKIE_PERANGKAT.aman : COOKIE_PERANGKAT.biasa);

export type BarisKredensial = {
  aktif: boolean;
  tokenHash: string | null;
  tokenHashLama: string | null;
  tokenDiputarAt: Date | null;
};

export type KeputusanKredensial =
  | { jenis: "sah"; perluRotasi: boolean }
  /** Token lama, masih dalam grasi (respons rotasi kemungkinan tak sampai). */
  | { jenis: "grasi" }
  /** Token lama dipakai setelah grasi → indikasi disalin; perangkat dicabut. */
  | { jenis: "curi" }
  | { jenis: "tolak"; alasan: "tak-dikenal" | "dicabut" | "kedaluwarsa" };

/**
 * Putuskan nasib token yang hash-nya `hash`, terhadap baris yang cocok (atau
 * null bila tak ada baris yang memuat hash itu di kolom aktif maupun lama).
 */
export function putuskanKredensial(
  baris: BarisKredensial | null,
  hash: string,
  sekarang: number,
): KeputusanKredensial {
  if (!baris) return { jenis: "tolak", alasan: "tak-dikenal" };
  if (!baris.aktif) return { jenis: "tolak", alasan: "dicabut" };
  const diputar = baris.tokenDiputarAt?.getTime() ?? 0;
  const umur = sekarang - diputar;
  if (baris.tokenHash === hash) {
    if (!baris.tokenDiputarAt || umur >= UMUR_KREDENSIAL_MS) return { jenis: "tolak", alasan: "kedaluwarsa" };
    return { jenis: "sah", perluRotasi: umur >= ROTASI_SETIAP_MS };
  }
  if (baris.tokenHashLama === hash) {
    return umur < GRASI_ROTASI_MS && umur >= 0 ? { jenis: "grasi" } : { jenis: "curi" };
  }
  return { jenis: "tolak", alasan: "tak-dikenal" };
}
