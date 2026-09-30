/**
 * Konstanta notifikasi dalam aplikasi (GENERIK, dipakai lintas modul) — AMAN
 * untuk client. Sasaran: pengguna tertentu, NIP (mis. DPJP), ruangan (akses
 * ruangan SIMGOS pengguna), atau peran aplikasi. PRD Verifikasi Klaim §7.5.
 */

export const SASARAN_NOTIFIKASI = ["USER", "NIP", "RUANGAN", "PERAN"] as const;
export type SasaranNotifikasi = (typeof SASARAN_NOTIFIKASI)[number];

export const BATAS_NOTIFIKASI = {
  DAFTAR_DEFAULT: 15,
  DAFTAR_MAKS: 30,
  /** Notifikasi lebih tua dari ini tidak ditampilkan maupun dihitung. */
  UMUR_HARI: 60,
  /** Cache akses ruangan SIMGOS per pengguna (lonceng dipoll tiap menit). */
  AKSES_TTL_MS: 5 * 60_000,
  /** Interval polling jumlah belum dibaca di klien. */
  POLL_MS: 60_000,
  /** Maks id per permintaan "tandai dibaca". */
  BACA_MAKS: 100,
} as const;
