/**
 * Tipe DTO frontend — cerminan kontrak dari docs/04-backend-layering.md.
 * Untuk sekarang diisi mock; nanti ditarik dari API (bentuk sama).
 */

export type KunjunganStatus = "BARU" | "DALAM_PROSES" | "SELESAI" | "BATAL";
export type CaraBayar = "BPJS" | "UMUM" | "ASURANSI";
export type JenisKunjungan = "RAWAT_JALAN" | "IGD" | "RAWAT_INAP";

export type KunjunganListItem = {
  id: string;
  nomorKunjungan: string;
  namaPasien: string;
  noRekamMedis: string;
  tanggalKunjungan: string; // ISO
  unit: string;
  dokter: string | null;
  caraBayar: CaraBayar;
  jenisKunjungan: JenisKunjungan;
  status: KunjunganStatus;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type LaporanSummary = {
  totalKunjungan: number;
  totalSelesai: number;
  totalBatal: number;
  totalDalamProses: number;
  perCaraBayar: { caraBayar: CaraBayar; jumlah: number }[];
  perUnit: { label: string; jumlah: number }[];
};

export type ResumeMedik = {
  kunjungan: {
    id: string;
    nomorKunjungan: string;
    tanggalMasuk: string;
    tanggalKeluar: string | null;
    unit: string;
    jenisKunjungan: JenisKunjungan;
    caraBayar: CaraBayar;
    status: KunjunganStatus;
  };
  pasien: {
    noRekamMedis: string;
    nama: string;
    tanggalLahir: string;
    jenisKelamin: "L" | "P";
    alamat: string;
  };
  dokter: { nama: string; spesialisasi: string };
  anamnesis: string;
  pemeriksaanFisik: string;
  diagnosa: { kode: string; nama: string; tipe: "PRIMER" | "SEKUNDER" }[];
  tindakan: { kode: string; nama: string; tanggal: string }[];
  resep: { namaObat: string; aturanPakai: string; jumlah: number }[];
  anjuran: string;
};

export const STATUS_LABEL: Record<KunjunganStatus, string> = {
  BARU: "Baru",
  DALAM_PROSES: "Dalam Proses",
  SELESAI: "Selesai",
  BATAL: "Batal",
};

export const CARA_BAYAR_LABEL: Record<CaraBayar, string> = {
  BPJS: "BPJS",
  UMUM: "Umum",
  ASURANSI: "Asuransi",
};

export const JENIS_KUNJUNGAN_LABEL: Record<JenisKunjungan, string> = {
  RAWAT_JALAN: "Rawat Jalan",
  IGD: "IGD",
  RAWAT_INAP: "Rawat Inap",
};

// ---------------------------------------------------------------------------
// Monitoring Antrean BPJS — Task ID 1..7 (bridging Antrean RS BPJS).
// Waktu tiap task wajib dikirim ke BPJS; monitoring memantau progres & ketertinggalan.
// ---------------------------------------------------------------------------

export type TaskId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type AntreanTask = {
  taskId: TaskId;
  waktu: string | null; // ISO; null = belum tercatat/terkirim
};

export type AntreanStatus =
  | "BERLANGSUNG" // sedang berjalan, on-time
  | "TERLAMBAT" // task berjalan melewati ambang waktu
  | "SELESAI"; // seluruh task (s.d. T7) tercatat

export type AntreanBpjs = {
  id: string;
  tanggal: string; // YYYY-MM-DD tanggal kunjungan/antrean
  kodeBooking: string;
  noAntrean: string;
  namaPasien: string;
  noKartu: string;
  poli: string;
  dokter: string;
  tasks: AntreanTask[]; // panjang 7, urut taskId 1..7
  currentTaskId: TaskId | null; // task berikutnya yang ditunggu; null jika selesai
  status: AntreanStatus;
  menitTertahan: number; // lama task berjalan tertahan (menit), untuk flag terlambat
};

export const TASK_META: {
  taskId: TaskId;
  kode: string;
  nama: string;
  deskripsi: string;
}[] = [
  { taskId: 1, kode: "T1", nama: "Kedatangan", deskripsi: "Pasien tiba — mulai waktu tunggu admisi" },
  { taskId: 2, kode: "T2", nama: "Mulai Admisi", deskripsi: "Mulai dilayani pendaftaran/admisi" },
  { taskId: 3, kode: "T3", nama: "Selesai Admisi", deskripsi: "Selesai admisi — mulai tunggu poli" },
  { taskId: 4, kode: "T4", nama: "Mulai Poli", deskripsi: "Mulai dilayani dokter" },
  { taskId: 5, kode: "T5", nama: "Selesai Poli", deskripsi: "Selesai dilayani dokter" },
  { taskId: 6, kode: "T6", nama: "Mulai Farmasi", deskripsi: "Resep diterima farmasi" },
  { taskId: 7, kode: "T7", nama: "Selesai Farmasi", deskripsi: "Obat diserahkan — antrean selesai" },
];

/** Label durasi antar-task (waktu tunggu / waktu layan). Index = segmen ke-n (T_n → T_{n+1}). */
export const SEGMEN_LABEL: string[] = [
  "Tunggu Admisi", // T1→T2
  "Layan Admisi", // T2→T3
  "Tunggu Poli", // T3→T4
  "Layan Poli", // T4→T5
  "Tunggu Farmasi", // T5→T6
  "Layan Farmasi", // T6→T7
];

export const ANTREAN_STATUS_LABEL: Record<AntreanStatus, string> = {
  BERLANGSUNG: "Berlangsung",
  TERLAMBAT: "Terlambat",
  SELESAI: "Selesai",
};
