/**
 * Tipe modul Laporan **RL 4.1 — Data Morbiditas & Mortalitas Pasien Rawat Inap**
 * (format SIRS Kemenkes). Satu baris per kode ICD-10 dengan rincian jenis
 * kelamin, kematian, dan 25 kelompok umur.
 *
 * Logika DI-PORT dari SP `laporan.LaporanRL41Revisi` menjadi SELECT agregat
 * read-only (SIMGOS TIDAK diubah — HIGH ALERT). SP asli gagal jalan karena
 * bergantung pada `master.getKelompokUmurRevisi` yang hilang; pengelompokan
 * umur di sini dihitung sendiri (lihat rl41.constants & rl41.dal).
 *
 * Inklusi baris (mengikuti SP): kunjungan Rawat Inap (ruangan JENIS_KUNJUNGAN=3),
 * diagnosa klinis manual (STATUS=1 & INA_GROUPER=0), pasien pulang dalam periode
 * (`layanan.pasien_pulang.TANGGAL`). Kematian = cara keluar (`CARA`) 6/7.
 */

/** Sel satu kelompok umur: cacah laki-laki & perempuan. */
export type Rl41AgeCell = { lk: number; pr: number };

/** Satu baris matriks RL 4.1 (agregat per kode ICD-10). */
export type Rl41Row = {
  rank: number;
  /** Kode ICD-10, mis. "I10". */
  kode: string;
  /** Deskripsi diagnosa (mrconso; fallback ke kode). */
  diagnosa: string;
  /** Total kasus = kombinasi (NOPEN,KODE) berbeda. */
  total: number;
  /** Kasus laki-laki. */
  lk: number;
  /** Kasus perempuan. */
  pr: number;
  /** Kasus meninggal (cara keluar 6/7). */
  mati: number;
  /** Meninggal laki-laki. */
  matiLk: number;
  /** Meninggal perempuan. */
  matiPr: number;
  /** 25 sel kelompok umur; index 0 = kelompok 1 (< 1 jam). */
  umur: Rl41AgeCell[];
};

/** Ringkasan keseluruhan periode. */
export type Rl41Summary = {
  /** Jumlah kode ICD-10 berbeda. */
  jenisDiag: number;
  /** Total seluruh kasus. */
  totalKasus: number;
  /** Total kasus laki-laki. */
  totalLk: number;
  /** Total kasus perempuan. */
  totalPr: number;
  /** Total kematian. */
  totalMati: number;
};

/** Identitas instansi (untuk header laporan resmi). */
export type Rl41Instansi = {
  kodeRs: string;
  nama: string;
  kodeProp: string;
  kota: string;
};

export type Rl41Result = {
  data: Rl41Row[];
  summary: Rl41Summary;
  periode: { from: string; to: string };
  /** Nama bulan (dari tanggal awal) untuk header laporan. */
  bulan: string;
  /** Tahun (dari tanggal akhir) untuk header laporan. */
  tahun: number;
  instansi: Rl41Instansi | null;
  updatedAt: string; // ISO
};

/** Filter tervalidasi yang dipakai DAL. */
export type Rl41Filter = { from: string; to: string };
