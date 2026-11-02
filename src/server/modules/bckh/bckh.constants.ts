/**
 * Konstanta BCKH (Buku Catatan Kegiatan Harian) — bebas server-only (dipakai UI
 * & server). Rancangan: docs/PRD_Modul_BCKH.md.
 */

/* ------------------------------------------------------------ status hari */

export const STATUS_HARI = ["MASUK", "TUGAS_LUAR", "OFF", "CUTI", "SAKIT", "IZIN", "LIBUR"] as const;
export type StatusHari = (typeof STATUS_HARI)[number];

/** Status yang berisi kegiatan (bekerja). Status lain = tidak bekerja, tanpa kegiatan. */
export const STATUS_BEKERJA: ReadonlySet<StatusHari> = new Set(["MASUK", "TUGAS_LUAR"]);

export const LABEL_STATUS: Record<StatusHari, string> = {
  MASUK: "Masuk",
  TUGAS_LUAR: "Tugas Luar",
  OFF: "Off",
  CUTI: "Cuti",
  SAKIT: "Sakit",
  IZIN: "Izin",
  LIBUR: "Libur",
};

/** Teks di kolom CATATAN KINERJA / KET laporan untuk status ini (huruf besar, seperti contoh). */
export const TEKS_LAPORAN_STATUS: Record<StatusHari, string> = {
  MASUK: "",
  TUGAS_LUAR: "TUGAS LUAR",
  OFF: "OFF",
  CUTI: "CUTI",
  SAKIT: "SAKIT",
  IZIN: "IZIN",
  LIBUR: "LIBUR",
};

/* -------------------------------------------------------------- kategori */

export const KATEGORI = [
  "tugas-pokok",
  "pemantauan",
  "pelayanan",
  "koordinasi",
  "apel",
  "pengembangan",
  "lainnya",
] as const;
export type Kategori = (typeof KATEGORI)[number];

/**
 * Kategori kegiatan — warna mengikuti KATEGORI, urutan tetap (palet kategorikal
 * tervalidasi CVD untuk pasangan bersebelahan; "Lainnya" netral). Tiga warna
 * < 3:1 pada permukaan putih → legenda berlabel + persentase selalu tampil.
 */
export const INFO_KATEGORI: Record<Kategori, { label: string; warna: string }> = {
  "tugas-pokok": { label: "Tugas Pokok", warna: "#2a78d6" },
  pemantauan: { label: "Pemantauan & Pemeliharaan", warna: "#eb6834" },
  pelayanan: { label: "Pelayanan & Dukungan", warna: "#1baf7a" },
  koordinasi: { label: "Rapat & Koordinasi", warna: "#eda100" },
  apel: { label: "Apel & Administrasi", warna: "#e87ba4" },
  pengembangan: { label: "Pengembangan Diri", warna: "#008300" },
  lainnya: { label: "Lainnya", warna: "#8a9bab" },
};

/** Saran kategori dari uraian (urutan aturan penting: pola paling khusus dulu). */
const ATURAN_KATEGORI: readonly [RegExp, Kategori][] = [
  [/\b(apel|upacara|senam|absen\w*|administrasi|surat|arsip|laporan)\b/i, "apel"],
  [/\b(rapat|koordinasi|pertemuan|meeting|zoom|sosialisasi|briefing|audiensi|konsultasi)\b/i, "koordinasi"],
  [/\b(pelatihan|diklat|bimtek|workshop|seminar|webinar|kursus|belajar|sertifikasi)\b/i, "pengembangan"],
  [/\b(monitor\w*|pantau\w*|memantau|pemantauan|cek|pengecekan|periksa|backup|pemeliharaan|perawatan|maintenance)\b/i, "pemantauan"],
  [/\b(bantu\w*|membantu|dukungan|support|layanan|pelayanan|melayani|instal\w*|setting|konfigurasi|helpdesk)\b/i, "pelayanan"],
];

export function saranKategori(uraian: string): Kategori {
  for (const [pola, k] of ATURAN_KATEGORI) if (pola.test(uraian)) return k;
  return "tugas-pokok";
}

/* ---------------------------------------------------------------- target */

export const TARGET = ["SELESAI", "PROSES"] as const;
export type Target = (typeof TARGET)[number];
export const LABEL_TARGET: Record<Target, string> = { SELESAI: "Selesai", PROSES: "Proses" };

/* ----------------------------------------------------------------- batas */

export const MAKS_KEGIATAN_PER_HARI = 30;
export const MAKS_URAIAN = 300;
export const MAKS_KETERANGAN = 191;
/** Rentang daftar catatan / dasbor. */
export const MAKS_RENTANG_HARI = 366;
/** Kegiatan rutin: N uraian tersering dalam JENDELA_RUTIN hari terakhir. */
export const JUMLAH_RUTIN = 6;
export const JENDELA_RUTIN_HARI = 90;
/** Catatan dianggap tepat waktu bila dibuat paling lambat H+BATAS_TEPAT_WAKTU (WITA). */
export const BATAS_TEPAT_WAKTU_HARI = 1;
export const LOG_PER_HALAMAN = 30;

/** Aksi log pengisian. */
export const AKSI_LOG = ["BUAT", "UBAH", "HAPUS", "EKSPOR"] as const;
export type AksiLog = (typeof AKSI_LOG)[number];

/** Aksi audit_log untuk perubahan pengaturan laporan. */
export const AKSI_AUDIT_PENGATURAN = "bckh.pengaturan";

/* ------------------------------------------------------------- kalender */

export const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;
export const NAMA_HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;
export const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;
export const NAMA_BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"] as const;

/* ----------------------------------------------------- pengaturan laporan */

export type PengaturanLaporan = {
  kop1: string;
  kop2: string;
  instansi1: string;
  instansi2: string;
  mengetahuiJabatan: string;
  mengetahuiNama: string;
  mengetahuiNip: string;
};

/** Bawaan = dokumen contoh Laporan Kinerja Harian RSUD Boltim (bisa diubah di Pengaturan). */
export const PENGATURAN_BAWAAN: PengaturanLaporan = {
  kop1: "PEMERINTAH KABUPATEN",
  kop2: "BOLAANG MONGONDOW TIMUR",
  instansi1: "DINAS KESEHATAN",
  instansi2: "RSUD BOLAANG MONGONDOW TIMUR",
  mengetahuiJabatan: "DIREKTUR RSUD BOLAANG MONGONDOW TIMUR",
  mengetahuiNama: "dr. RANDYA PERMADI",
  mengetahuiNip: "19840731 201201 1 001",
};
