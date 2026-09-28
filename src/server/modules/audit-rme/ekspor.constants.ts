/**
 * Konstanta ekspor Audit Trail RME (Fase 2 · K5). BEBAS server-only — dipakai
 * juga oleh tombol ekspor & daftar riwayat ekspor di UI.
 */

/** Jenis laporan yang dapat diekspor (satu per tab/panel sumber). */
export const LAPORAN_EKSPOR = ["petugas", "profil", "ruangan", "kunjungan", "jejak", "log"] as const;
export type LaporanEkspor = (typeof LAPORAN_EKSPOR)[number];

export const LAPORAN_LABEL: Record<LaporanEkspor, string> = {
  petugas: "Rekap kepatuhan petugas",
  profil: "Profil kepatuhan petugas",
  ruangan: "Rekap kepatuhan ruangan",
  kunjungan: "Daftar kunjungan",
  jejak: "Jejak kunjungan",
  log: "Log aktivitas",
};

export const FORMAT_EKSPOR = ["xlsx", "pdf"] as const;
export type FormatEkspor = (typeof FORMAT_EKSPOR)[number];

/** Aksi meta-audit di `audit_log` (DB aplikasi) — satu baris per berkas yang diserahkan. */
export const AKSI_EKSPOR = "audit-rme.ekspor";

/** Ukuran halaman riwayat ekspor. */
export const RIWAYAT_EKSPOR_PAGE_SIZE = 15;
