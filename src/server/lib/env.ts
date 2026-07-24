/**
 * Akses environment terpusat & tervalidasi. Kredensial DB HANYA dibaca di
 * server (file ini tidak boleh diimport komponen client).
 *
 * Catatan: variabel bersifat OPSIONAL agar aplikasi tetap jalan dengan data
 * mock ketika SIMGOS belum dikonfigurasi (mis. saat pengembangan UI). Service
 * yang memutuskan memakai DB atau fallback mock lewat `isSimgosConfigured()`.
 */
import "server-only";

export const env = {
  DATABASE_URL_SIMGOS: process.env.DATABASE_URL_SIMGOS,
  DATABASE_URL_APP: process.env.DATABASE_URL_APP,
  SIMGOS_DEFAULT_DB: process.env.SIMGOS_DEFAULT_DB,
} as const;

/** True bila koneksi SIMGOS read-only tersedia. */
export function isSimgosConfigured(): boolean {
  return !!env.DATABASE_URL_SIMGOS && env.DATABASE_URL_SIMGOS.trim() !== "";
}

/** Ambil URL SIMGOS atau lempar bila diminta padahal belum dikonfigurasi. */
export function requireSimgosUrl(): string {
  const url = env.DATABASE_URL_SIMGOS;
  if (!url || url.trim() === "") {
    throw new Error(
      "DATABASE_URL_SIMGOS belum di-set. Salin .env.example ke .env dan isi kredensial read-only.",
    );
  }
  return url;
}
