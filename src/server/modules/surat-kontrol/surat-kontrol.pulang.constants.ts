/**
 * Audit "Terbit saat pulang" — konstanta bersama server & klien (bebas server-only).
 *
 * Aturan RS: Surat Kontrol pasien BPJS TERBIT DI BPJS pada TANGGAL YANG SAMA
 * dengan tanggal pasien pulang — berlaku untuk Rawat Inap (tanggal pulang =
 * `layanan.pasien_pulang.TANGGAL`) dan Rawat Jalan (tanggal kunjungan poli).
 * Tanggal terbit = `tglTerbitKontrol` BPJS (webservice / cache SIMGOS), BUKAN
 * `jadwal_kontrol.DIBUAT_TANGGAL` (kolom itu `ON UPDATE CURRENT_TIMESTAMP` —
 * ikut berubah tiap baris diperbarui). Lihat docs/audit-surat-kontrol.md §10.
 */

export type NadaPulang = "danger" | "warning" | "brand" | "success" | "neutral";

/** Urutan kunci = urutan prioritas tampilan (terberat dulu). */
export const STATUS_PULANG = {
  BELUM_TERBIT: {
    label: "Belum terbit",
    pendek: "Belum terbit",
    nada: "danger",
    dinilai: true,
    jelas: "Pasien BPJS sudah pulang, tetapi belum ada Surat Kontrol aktif yang terbit di BPJS untuk SEP kunjungannya.",
  },
  TERLAMBAT: {
    label: "Terbit setelah pulang",
    pendek: "Terlambat",
    nada: "warning",
    dinilai: true,
    jelas: "Surat Kontrol terbit di BPJS SETELAH tanggal pasien pulang.",
  },
  LEBIH_AWAL: {
    label: "Terbit sebelum pulang",
    pendek: "Lebih awal",
    nada: "brand",
    dinilai: true,
    jelas: "Surat Kontrol terbit di BPJS SEBELUM tanggal pasien pulang (mis. dibuat saat masih dirawat).",
  },
  TAK_TERVERIFIKASI: {
    label: "Tanggal terbit belum terbaca",
    pendek: "Belum terbaca",
    nada: "neutral",
    dinilai: false,
    jelas: "Nomor surat tercatat di SIMRS, tetapi tanggal terbitnya belum terbaca dari BPJS. Tekan “Segarkan dari BPJS”.",
  },
  TEPAT: {
    label: "Terbit di hari pulang",
    pendek: "Tepat",
    nada: "success",
    dinilai: true,
    jelas: "Surat Kontrol terbit di BPJS pada tanggal yang sama dengan tanggal pasien pulang.",
  },
  TIDAK_WAJIB: {
    label: "Tidak wajib kontrol",
    pendek: "Tidak wajib",
    nada: "neutral",
    dinilai: false,
    jelas: "Surat Kontrol tidak diperlukan atau tidak dapat diterbitkan (kontrol pasca rawat inap — kontrol berikutnya perlu rujukan FKTP baru; dirujuk; pulang paksa; meninggal; lanjut rawat inap; dll.) dan memang tidak ada surat.",
  },
} as const satisfies Record<string, { label: string; pendek: string; nada: NadaPulang; dinilai: boolean; jelas: string }>;

export type StatusPulang = keyof typeof STATUS_PULANG;
export const STATUS_PULANG_KEYS = Object.keys(STATUS_PULANG) as StatusPulang[];
/** Status yang masuk penyebut kepatuhan (urutan segmen grafik: tepat → belum). */
export const STATUS_DINILAI = ["TEPAT", "LEBIH_AWAL", "TERLAMBAT", "BELUM_TERBIT"] as const satisfies readonly StatusPulang[];

export const LAYANAN_PULANG = {
  RI: { label: "Rawat Inap", pendek: "RI", tanggal: "Tanggal pulang" },
  RJ: { label: "Rawat Jalan", pendek: "RJ", tanggal: "Tanggal kunjungan" },
} as const;
export type LayananPulang = keyof typeof LAYANAN_PULANG;
export const LAYANAN_PULANG_KEYS = Object.keys(LAYANAN_PULANG) as LayananPulang[];

/** `master.referensi` JENIS 45 (Cara Keluar). Hanya 1 = Diizinkan pulang yang wajib Surat Kontrol. */
export const CARA_PULANG: Record<number, string> = {
  1: "Diizinkan pulang",
  2: "Pulang paksa (APS)",
  3: "Dirujuk ke RS lain",
  4: "Lari",
  5: "Pindah RS lain",
  6: "Meninggal",
  7: "DOA",
  8: "Lanjut rawat inap",
};
export const CARA_WAJIB_KONTROL = 1;

/** Rentang tanggal pulang per permintaan (data kecil; ± 300 episode / bulan). */
export const RENTANG_PULANG_MAKS_HARI = 31;
