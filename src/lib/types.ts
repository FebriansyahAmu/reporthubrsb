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
