/**
 * Tipe modul Laporan **RL 5.1 — Data Morbiditas Pasien Rawat Jalan** (format
 * SIRS Kemenkes). Satu baris per kode ICD-10: jumlah kunjungan, kasus baru
 * (`md.BARU`), rincian jenis kelamin, dan 25 kelompok umur untuk KASUS BARU.
 *
 * Logika DI-PORT dari SP `laporan.LaporanRL51Revisi` menjadi SELECT agregat
 * read-only (SIMGOS TIDAK diubah — HIGH ALERT). SP asli BISA jalan, TETAPI
 * memakai `master.getKelompokUmur` (hanya 9 kelompok) padahal berkolom
 * KLP1..KLP25 → KLP10–25 selalu 0 dan KLP1–9 memakai batas 9-kelompok lama
 * yang tak cocok dengan 25 kelompok resmi. Di sini kelompok umur dihitung ulang
 * dengan 25 batas resmi (lihat rl41.constants — dipakai bersama).
 *
 * Inklusi baris (mengikuti SP): kunjungan Rawat Jalan/Gawat Darurat (ruangan
 * JENIS_KUNJUNGAN IN (1,2)), diagnosa klinis manual (STATUS=1 & INA_GROUPER=0),
 * tanggal kunjungan (`pendaftaran.TANGGAL`) dalam periode.
 */

/** Sel satu kelompok umur: cacah laki-laki & perempuan (kasus baru). */
export type Rl51AgeCell = { lk: number; pr: number };

/** Satu baris matriks RL 5.1 (agregat per kode ICD-10). */
export type Rl51Row = {
  rank: number;
  /** Kode ICD-10. */
  kode: string;
  /** Deskripsi diagnosa (mrconso; fallback ke kode). */
  diagnosa: string;
  /** Jumlah kunjungan (semua kasus baru+lama) = (NOPEN,KODE) berbeda. */
  total: number;
  /** Kunjungan laki-laki. */
  lk: number;
  /** Kunjungan perempuan. */
  pr: number;
  /** Jumlah kasus baru (md.BARU=1). */
  baru: number;
  /** Kasus baru laki-laki. */
  baruLk: number;
  /** Kasus baru perempuan. */
  baruPr: number;
  /** 25 sel kelompok umur untuk KASUS BARU; index 0 = kelompok 1 (< 1 jam). */
  umur: Rl51AgeCell[];
};

/** Ringkasan keseluruhan periode. */
export type Rl51Summary = {
  /** Jumlah kode ICD-10 berbeda. */
  jenisDiag: number;
  /** Total seluruh kunjungan. */
  totalKunjungan: number;
  /** Total kasus baru. */
  totalBaru: number;
  /** Total kunjungan laki-laki. */
  totalLk: number;
  /** Total kunjungan perempuan. */
  totalPr: number;
};

/** Identitas instansi (untuk header laporan resmi). */
export type Rl51Instansi = {
  kodeRs: string;
  nama: string;
  kodeProp: string;
  kota: string;
};

export type Rl51Result = {
  data: Rl51Row[];
  summary: Rl51Summary;
  periode: { from: string; to: string };
  bulan: string;
  tahun: number;
  instansi: Rl51Instansi | null;
  updatedAt: string; // ISO
};

/** Filter tervalidasi yang dipakai DAL. */
export type Rl51Filter = { from: string; to: string };
