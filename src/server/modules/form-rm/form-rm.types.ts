/**
 * Tipe modul Form RM (formulir Rekam Medis diisi admisi/petugas, disimpan di
 * reporthub). Type-only → aman diimpor client & server.
 */
import type { PageMeta } from "@/lib/types";
import type { KategoriKunjungan } from "@/server/modules/pelayanan/pelayanan.types";

/** Satu pasien di daftar Form RM (target admisi — biasanya kunjungan IGD). */
export type FormRmPatient = {
  nopen: string;
  nomor: string;
  norm: string;
  nama: string;
  jenisKelamin: string;
  umur: string | null;
  kategori: KategoriKunjungan;
  ruang: string;
  masuk: string;
  keluar: string | null;
};

export type FormRmListResult = {
  data: FormRmPatient[];
  meta: PageMeta;
  total: number;
  updatedAt: string;
};

/** Header identitas pasien untuk kepala formulir RM. */
export type FormRmHeader = {
  nopen: string;
  norm: string;
  nama: string;
  jenisKelamin: string;
  tanggalLahir: string | null;
  umur: string | null;
  ruang: string;
  masuk: string;
};

// ---------------------------------------------------------------------------
// Form Edukasi Pasien & Keluarga Terintegrasi (RM.21)
// ---------------------------------------------------------------------------

/** PERSIAPAN EDUKASI (bagian atas RM.21). */
export type EdukasiPersiapan = {
  /** Bahasa yang dipakai (multi): Indonesia/Daerah/Inggris. */
  bahasa: string[];
  bahasaLain: string;
  /** Kebutuhan penerjemah. */
  penerjemah: "" | "Ya" | "Tidak";
  /** Pendidikan pasien (tunggal). */
  pendidikan: string;
  pendidikanLain: string;
  /** Baca & tulis. */
  bacaTulis: "" | "Baik" | "Kurang";
  /** Pilihan tipe pembelajaran (multi): Verbal/Tulisan. */
  tipePembelajaran: string[];
  /** Hambatan edukasi (multi). */
  hambatan: string[];
  hambatanLain: string;
  /** Kesediaan menerima edukasi. */
  kesediaan: "" | "Bersedia" | "Tidak Bersedia";
};

/** Satu baris kebutuhan edukasi (per kategori edukator). */
export type EdukasiEntry = {
  /** Kategori edukator (Keperawatan/Tenaga Gizi/Farmasi/…/Dokter). */
  kategori: string;
  /** Diisi bila edukasi kategori ini benar-benar dilakukan. */
  aktif: boolean;
  edukatorNama: string;
  /** ISO lokal "YYYY-MM-DDTHH:mm". */
  tanggalJam: string;
  durasiMenit: string;
  /** Sasaran: Pasien/Keluarga/Lain-lain. */
  sasaran: string;
  sasaranNama: string;
  sasaranHubungan: string;
  metode: string[];
  sarana: string[];
  saranaLain: string;
  pemahaman: string[];
  evaluasi: string[];
  tanggalReEdukasi: string;
};

export type EdukasiForm = {
  persiapan: EdukasiPersiapan;
  entries: EdukasiEntry[];
  catatan: string;
};

/** Rekaman form RM tersimpan + metadata. */
export type FormRmSaved<T = EdukasiForm> = {
  nopen: string;
  jenis: string;
  data: T;
  updatedAt: string;
  updatedBy: string | null;
};

/** Respons GET form Edukasi: rekaman tersimpan (bila ada) + header pasien. */
export type EdukasiContext = {
  saved: FormRmSaved<EdukasiForm> | null;
  header: FormRmHeader;
};
