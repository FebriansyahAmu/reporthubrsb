/**
 * Header keamanan halaman PUBLIK (tanpa login). Dipasang oleh `src/proxy.ts`.
 *
 * CSP ketat ber-nonce: skrip hanya dari origin sendiri yang membawa nonce per
 * request ('strict-dynamic' untuk chunk turunannya) — Next.js membaca nonce
 * dari header CSP request dan menempelkannya ke skrip/style framework secara
 * otomatis (halaman wajib dirender dinamis). Tanpa sumber eksternal sama sekali.
 */

/** Nonce acak 128-bit (base64) per request. */
export function buatNonce(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b));
}

export function cspPublik(nonce: string, opsi: { dev: boolean; https: boolean }): string {
  return [
    "default-src 'self'",
    // Dev: React butuh eval untuk tumpukan galat; produksi tidak.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opsi.dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${opsi.dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    // Hanya bila disajikan via HTTPS — di HTTP (LAN) justru memutus aset.
    ...(opsi.https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** Header statis halaman publik (selain CSP). */
export const HEADER_PUBLIK: Readonly<Record<string, string>> = {
  // Jangan diindeks/diarsipkan mesin pencari; tautan = kapabilitas.
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  // Tautan bertoken tak bocor lewat Referer ke situs lain.
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  // Data selalu terbaru (pencabutan tautan berlaku seketika) & tak disimpan cache bersama.
  "Cache-Control": "no-store, max-age=0",
};
