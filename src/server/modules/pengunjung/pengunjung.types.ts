/**
 * Tipe modul "Laporan Pengunjung Per Pasien".
 *
 * Logika DI-PORT dari stored procedure SIMGOS `laporan.LaporanPengunjungPerpasien`
 * menjadi SELECT read-only + paginasi di aplikasi (SIMGOS TIDAK diubah — HIGH ALERT;
 * SP-nya sendiri bahkan gagal di-CALL via driver: kolom `TGLKELUAR` ganda).
 *
 * Satu baris = satu kunjungan/pendaftaran (GROUP BY pd.NOMOR). Jenis layanan
 * (RJ/IGD/RI) ditentukan `ruangan.JENIS_KUNJUNGAN` (= param LAPORAN). Khusus IGD,
 * "IGD Rawat Jalan" vs "IGD → Rawat Inap" dibedakan dari ada/tidaknya NOPEN rawat
 * inap lanjutan (`master.getNopenIRNA` kosong = rawat jalan / pulang).
 */

/** 0 = semua, 1 = Umum/tanpa asuransi, 2 = BPJS/JKN (referensi JENIS=10). */
export type CaraBayar = 0 | 1 | 2;

/** Jenis layanan = ruangan.JENIS_KUNJUNGAN (referensi JENIS=15): 1 RJ, 2 IGD, 3 RI. */
export type JenisLayanan = 1 | 2 | 3;

/** Tindak lanjut IGD: semua / rawat jalan (pulang) / lanjut rawat inap. */
export type TindakLanjut = "all" | "rajal" | "ranap";

export type PengunjungItem = {
  nopen: string;
  norm: string;
  nama: string;
  jk: "L" | "P";
  /** Umur (tahun) saat registrasi. */
  umur: number;
  /** true = pasien baru (kunjungan pertama = tanggal daftar RM). */
  baru: boolean;
  /** Tanggal registrasi (ISO). */
  tglReg: string;
  /** Tanggal masuk/diterima (ISO) | null. */
  tglMasuk: string | null;
  /** Tanggal keluar (ISO) | null. */
  tglKeluar: string | null;
  /** Unit/ruangan pelayanan. */
  unit: string;
  /** Cara bayar (deskripsi), mis. "BPJS / JKN". */
  caraBayar: string;
  dokter: string;
  /** IGD: NOPEN rawat inap lanjutan (null/"" = IGD rawat jalan). */
  nopenRi: string | null;
  /** IGD: klasifikasi tindak lanjut. */
  tindakLanjut: "rajal" | "ranap" | null;
};

export type PengunjungSummary = {
  total: number;
  baru: number;
  lama: number;
  lk: number;
  pr: number;
  /** IGD saja: jumlah "IGD Rawat Jalan". */
  igdRajal: number | null;
  /** IGD saja: jumlah "IGD → Rawat Inap". */
  igdRanap: number | null;
};

export type PengunjungMeta = { page: number; pageSize: number; total: number; totalPages: number };

export type PengunjungResult = {
  data: PengunjungItem[];
  meta: PengunjungMeta;
  summary: PengunjungSummary;
  jenis: JenisLayanan;
  caraBayar: CaraBayar;
  tindak: TindakLanjut;
  ruangan: string;
  periode: { from: string; to: string };
  updatedAt: string; // ISO
};

/** Filter tervalidasi yang dipakai DAL. */
export type PengunjungFilter = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  jenis: JenisLayanan;
  /** Prefix ID ruangan (9-digit) atau "" = semua ruangan pada jenis ini. */
  ruangan: string;
  caraBayar: CaraBayar;
  tindak: TindakLanjut;
  page: number;
  pageSize: number;
};

/** Opsi ruangan untuk selektor (per jenis layanan). */
export type RuanganOption = { id: string; nama: string; jenis: JenisLayanan };
