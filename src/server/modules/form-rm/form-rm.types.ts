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
  /** NIK dari SIMGOS (kartu identitas KTP) bila ada; "" bila belum terdaftar. */
  nik: string;
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
  /** Nama edukator/dokter — saat cetak jadi QR (bukan tanda tangan gambar). */
  edukatorNama: string;
  /** ISO lokal "YYYY-MM-DDTHH:mm". */
  tanggalJam: string;
  durasiMenit: string;
  /** Sasaran: Pasien/Keluarga/Lain-lain. */
  sasaran: string;
  sasaranNama: string;
  sasaranHubungan: string;
  /** Tanda tangan sasaran/keluarga — PNG data-URL hitam-putih. */
  sasaranTtd: string;
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

// ---------------------------------------------------------------------------
// Persetujuan Umum Rawat Inap / General Consent (RM.03)
// ---------------------------------------------------------------------------

/** Data isian General Consent (RM.03). Teks legal I–X bersifat tetap (di konstanta). */
export type ConsentForm = {
  /** Waktu pendaftaran (ISO lokal "YYYY-MM-DDTHH:mm"). */
  waktuPendaftaran: string;
  ruanganRawat: string;
  kelas: string;
  /** NIK pasien — prefill dari SIMGOS (kartu identitas) bila ada, bisa disunting. */
  nik: string;
  // Penanggung Jawab
  pjNama: string;
  pjJenisKelamin: "" | "Laki-Laki" | "Perempuan";
  pjUmur: string;
  pjHubungan: string;
  pjAlamat: string;
  pjTelepon: string;
  /** III — pihak yang diberi wewenang menerima informasi (maks 3). */
  pelepasanInfo: string[];
  /** IV — izin akses pengunjung. */
  izinPrivasi: "" | "Mengijinkan" | "Tidak Mengijinkan";
  /** IV — permintaan khusus nama/profesi (maks 2). */
  permintaanKhusus: string[];
  // Tanda tangan
  pasienNama: string;
  /** PNG data-URL. */
  pasienTtd: string;
  petugasNama: string;
  /** PNG data-URL. */
  petugasTtd: string;
  /** Tanggal tanda tangan (ISO "YYYY-MM-DD"). */
  tanggalTtd: string;
};

/** Respons GET form Consent: rekaman tersimpan (bila ada) + header pasien. */
export type ConsentContext = {
  saved: FormRmSaved<ConsentForm> | null;
  header: FormRmHeader;
};

// ---------------------------------------------------------------------------
// Ringkasan Masuk & Keluar (RM.01) — termasuk Sebab Kematian
// ---------------------------------------------------------------------------

/** Satu baris rantai/entri Sebab Kematian (teks + lama sakit s/d meninggal). */
export type SebabKematianBaris = { teks: string; lama: string };

/** Data isian Ringkasan Masuk & Keluar (RM.01). */
export type RingkasanForm = {
  // Identitas & sosial (banyak di-prefill dari SIMGOS)
  alamat: string;
  telp: string;
  dirawatKe: string;
  golDarah: string;
  pendidikan: string; // salah satu PENDIDIKAN_OPTS, atau "" (pakai pendidikanLain)
  pendidikanLain: string;
  bangsa: "" | "Indonesia" | "Asing";
  agama: string;
  statusPerkawinan: string;
  pekerjaan: string;
  caraMasuk: string;
  jenisPelayanan: string;
  namaOrangTua: string;
  pekerjaanOrangTua: string;
  keluargaNama: string;
  keluargaAlamat: string;
  keluargaTelp: string;
  // Perawatan
  tglMasuk: string; // ISO lokal "YYYY-MM-DDTHH:mm"
  tglKeluar: string; // ISO lokal
  lamaRawat: string;
  diagnosaSementara: string;
  dpjp: string;
  peserta: "" | "BPJS" | "Asuransi" | "Umum";
  izinKeluar: string;
  // Diagnosa akhir + kode ICD
  diagnosaUtama: string;
  diagnosaUtamaKode: string;
  diagnosaSekunder: string;
  diagnosaSekunderKode: string;
  komplikasi: string;
  komplikasiKode: string;
  penyebabLuar: string;
  penyebabLuarKode: string;
  operasi: string;
  operasiKode: string;
  catatan: string;
  infeksiNosokomial: string;
  penyebabInfeksiNosokomial: string;
  imunisasi: string[];
  dokterMerawatNama: string;
  /** PNG data-URL. */
  dokterMerawatTtd: string;
  keadaanKeluar: string;
  // ===== Halaman 2: Sebab Kematian (hanya bila toggle aktif) =====
  sebabKematianAktif: boolean;
  // I. Sebab kematian (rantai a → b → c) + lama masing-masing
  skA: string;
  skALama: string;
  skB: string;
  skBLama: string;
  skC: string;
  skCLama: string;
  // II. Penyakit-penyakit lain yang mempengaruhi (3 baris)
  skLain: SebabKematianBaris[];
  // Keterangan khusus
  rudaPaksaMacam: string; // RUDA_PAKSA_OPTS
  rudaPaksaCara: string;
  rudaPaksaSifat: string;
  lahirMatiJanin: "" | "Ya" | "Tidak";
  lahirMatiSebab: string;
  persalinan: "" | "Ya" | "Tidak";
  kehamilan: "" | "Ya" | "Tidak";
  operasiKhususAda: "" | "Ya" | "Tidak";
  operasiKhususJenis: string;
  // TTD pemberi keterangan sebab kematian
  sebabKematianTanggal: string; // ISO "YYYY-MM-DD"
  dokterKematianNama: string;
  /** PNG data-URL. */
  dokterKematianTtd: string;
};

/**
 * Nilai prefill RM.01 dari SIMGOS (sudah diformat siap-isi). Dipakai hanya saat
 * form belum pernah disimpan; setelah disimpan, isian dari reporthub yang dipakai.
 */
export type RingkasanPrefill = {
  alamat: string;
  golDarah: string;
  dirawatKe: string;
  pendidikan: string;
  pendidikanLain: string;
  bangsa: "" | "Indonesia" | "Asing";
  agama: string;
  statusPerkawinan: string;
  pekerjaan: string;
  tglMasuk: string;
  tglKeluar: string;
  lamaRawat: string;
  dpjp: string;
  peserta: "" | "BPJS" | "Asuransi" | "Umum";
  diagnosaUtama: string;
  diagnosaUtamaKode: string;
  diagnosaSekunder: string;
  diagnosaSekunderKode: string;
};

/** Respons GET form Ringkasan (RM.01): rekaman tersimpan + header + prefill SIMGOS. */
export type RingkasanContext = {
  saved: FormRmSaved<RingkasanForm> | null;
  header: FormRmHeader;
  prefill: RingkasanPrefill;
};
