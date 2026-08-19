/**
 * Tipe modul Laporan Farmasi — "10 Obat Terbanyak".
 *
 * Logika DI-PORT dari stored procedure SIMGOS `laporan.LaporanFarmasiPerobat`
 * menjadi SELECT read-only di aplikasi (SIMGOS TIDAK diubah — HIGH ALERT).
 * Penyesuaian dari SP asli: filter Formularium & Golongan Barang dibuang,
 * Kategori jadi multi-pilih (centang), hasil dibatasi 10 obat terbesar.
 */

/** 0 = semua, 1 = Umum/tanpa asuransi, 2 = BPJS/JKN (referensi JENIS=10). */
export type CaraBayar = 0 | 1 | 2;

/** Metrik pemeringkatan "terbanyak". */
export type UrutMetric = "qty" | "nilai";

/** Satu baris peringkat obat (agregat per obat pada periode & filter). */
export type ObatTerbanyakItem = {
  rank: number;
  farmasiId: number;
  nama: string;
  /** Header kategori lengkap, mis. "Farmasi - Obat - Tablet". */
  kategori: string;
  /** Nama kategori daun saja, mis. "Tablet". */
  kategoriLeaf: string;
  generik: boolean;
  merk: string;
  /** Total kuantitas terpakai (SUM lf.JUMLAH). */
  qty: number;
  /** Total nilai Rp (SUM lf.JUMLAH × tarif). */
  nilai: number;
  /** Jumlah baris resep (SUM). */
  resep: number;
};

/** Ringkasan analitik: total keseluruhan vs sumbangan 10 besar. */
export type ObatTerbanyakSummary = {
  /** Jumlah jenis obat berbeda pada filter (keseluruhan, bukan cuma 10 besar). */
  jenisObat: number;
  /** Total kuantitas keseluruhan pada filter. */
  totalQty: number;
  /** Total nilai Rp keseluruhan pada filter. */
  totalNilai: number;
  /** Total kuantitas 10 besar. */
  top10Qty: number;
  /** Total nilai Rp 10 besar. */
  top10Nilai: number;
  /** Porsi kuantitas 10 besar terhadap total (0..1). */
  qtyShare: number;
};

export type ObatTerbanyakResult = {
  data: ObatTerbanyakItem[];
  summary: ObatTerbanyakSummary;
  periode: { from: string; to: string };
  metric: UrutMetric;
  caraBayar: CaraBayar;
  updatedAt: string; // ISO
};

/** Filter tervalidasi yang dipakai DAL. */
export type ObatFilter = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  caraBayar: CaraBayar;
  /** Daftar ID kategori (numerik, prefix-match). Kosong = semua kategori. */
  kategori: string[];
  metric: UrutMetric;
  limit: number;
};

/** Opsi kategori untuk multi-pilih (centang) di FE. */
export type KategoriOption = {
  id: string; // inventory.kategori.ID (daun, JENIS=3)
  nama: string; // nama daun, mis. "Tablet"
  grup: string; // nama induk JENIS=2, mis. "Obat"
  grupId: string; // ID induk, mis. "101"
};
