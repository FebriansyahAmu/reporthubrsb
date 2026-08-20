/**
 * Tipe modul Laporan "10 Penyakit Terbanyak" (ICD-10).
 *
 * Logika DI-PORT dari stored procedure SIMGOS `laporan.LaporanPasienPerICD10`
 * menjadi SELECT agregat read-only di aplikasi (SIMGOS TIDAK diubah — HIGH ALERT).
 * SP asli adalah daftar per-pasien; di sini kita AGREGASI per kode ICD-10 untuk
 * memperoleh peringkat 10 penyakit terbanyak. Join & filter inti dipertahankan
 * (diagnosa STATUS=1 & INA_GROUPER=0, ruangan sesuai jenis kunjungan via
 * tujuan_pasien, penjamin, rentang tanggal masuk/pulang, diagnosa utama).
 */

/** 0 = semua, 1 = Umum/tanpa asuransi, 2 = BPJS/JKN (referensi JENIS=10). */
export type CaraBayar = 0 | 1 | 2;

/** Jenis layanan = r.JENIS_KUNJUNGAN (referensi JENIS=15): 1 RJ, 2 GD, 3 RI. */
export type JenisLayanan = 1 | 2 | 3;

/** Metrik pemeringkatan: jumlah kasus (kunjungan) atau pasien unik. */
export type UrutMetric = "kasus" | "pasien";

/** Satu baris peringkat penyakit (agregat per kode ICD-10 pada periode & filter). */
export type PenyakitItem = {
  rank: number;
  /** Kode ICD-10, mis. "A09.9". */
  kode: string;
  /** Deskripsi diagnosa (mrconso; fallback ke teks diagnosa / kode). */
  nama: string;
  /** Jumlah kasus = pendaftaran/kunjungan berbeda (COUNT DISTINCT NOPEN). */
  kasus: number;
  /** Jumlah pasien unik (COUNT DISTINCT NORM). */
  pasien: number;
  /** Kasus berjenis kelamin laki-laki. */
  lk: number;
  /** Kasus berjenis kelamin perempuan. */
  pr: number;
};

/** Ringkasan analitik: total keseluruhan vs sumbangan 10 besar. */
export type PenyakitSummary = {
  /** Jumlah jenis diagnosa (kode ICD-10 berbeda) pada filter. */
  jenisDiag: number;
  /** Total kasus keseluruhan = kombinasi (NOPEN,KODE) berbeda pada filter. */
  totalKasus: number;
  /** Total pasien unik keseluruhan pada filter. */
  totalPasien: number;
  /** Total kasus 10 besar. */
  top10Kasus: number;
  /** Total pasien 10 besar (perkiraan; overlap antar penyakit diabaikan). */
  top10Pasien: number;
  /** Porsi kasus 10 besar terhadap total kasus (0..1). */
  kasusShare: number;
};

export type PenyakitResult = {
  data: PenyakitItem[];
  summary: PenyakitSummary;
  periode: { from: string; to: string };
  jenis: JenisLayanan;
  metric: UrutMetric;
  caraBayar: CaraBayar;
  /** true = hanya diagnosa utama (md.UTAMA=1). */
  utama: boolean;
  updatedAt: string; // ISO
};

/** Filter tervalidasi yang dipakai DAL. */
export type PenyakitFilter = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  jenis: JenisLayanan;
  caraBayar: CaraBayar;
  utama: boolean;
  metric: UrutMetric;
  limit: number;
};
