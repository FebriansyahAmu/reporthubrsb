/**
 * Tipe modul Form RM (formulir Rekam Medis diisi admisi/petugas, disimpan di
 * reporthub). Type-only → aman diimpor client & server.
 */
import type { PageMeta } from "@/lib/types";
import type { JenisKunjungan, KodeForm } from "@/features/form-rm/registry";
import type { RingkasIsian } from "./isian.types";

/** Status satu form untuk pasien: isian aktif DRAF/FINAL, atau belum ada. */
export type StatusFormPasien = "KOSONG" | "DRAF" | "FINAL";

/** Kelengkapan form RM satu episode, atas form yang boleh dilihat pengguna. */
export type FormRmKelengkapan = {
  /** Status tiap form (urutan registri); `wajib` = `wajibUntuk` cocok dengan jenis kunjungan episode. */
  formulir: { kode: KodeForm; status: StatusFormPasien; wajib: boolean }[];
  /** Form WAJIB yang punya isian aktif (DRAF/FINAL). */
  terisi: number;
  /** Form WAJIB yang sudah FINAL. */
  final: number;
  /** Jumlah form wajib. */
  total: number;
  /** Ada form wajib dan semuanya FINAL. */
  lengkap: boolean;
};

/** Satu episode (pendaftaran) sasaran form, diwakili leg sasaran terbarunya. */
export type EpisodeSasaran = {
  nopen: string;
  norm: string;
  nama: string;
  jenisKelamin: string;
  umur: string | null;
  /** Ruang & jenis leg terbaru yang cocok sasaran. */
  ruang: string;
  ruanganId: string;
  jenis: JenisKunjungan;
  /** "YYYY-MM-DDTHH:mm:ss" jam dinding. */
  masuk: string;
  keluar: string | null;
  /** Masih ada leg sasaran yang belum keluar. */
  dirawat: boolean;
};

/** Satu episode di daftar per pasien, beserta kelengkapan form RM-nya (reporthub). */
export type FormRmPatient = EpisodeSasaran & { kelengkapan: FormRmKelengkapan };

export type FormRmListResult = {
  data: FormRmPatient[];
  meta: PageMeta;
  total: number;
  /** Episode (dalam filter) yang semua form wajibnya FINAL. */
  lengkapCount: number;
  /** Episode yang punya form wajib tetapi belum semuanya FINAL. */
  belumLengkapCount: number;
  updatedAt: string;
};

/** Satu baris pemilih pasien sebuah form: episode + isian aktif form itu (bila ada). */
export type PasienSasaran = EpisodeSasaran & { isian: RingkasIsian | null };

export type DaftarPasienForm = {
  data: PasienSasaran[];
  meta: PageMeta;
  /** `aktif` = daftar bawaan sasaran form; `cari` = hasil pencarian No.RM / nama / NIK. */
  mode: "aktif" | "cari";
  /** Hitungan status isian atas seluruh hasil (sebelum saring status). */
  ringkas: Record<StatusFormPasien, number>;
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

// ---------------------------------------------------------------------------
// Triase IGD (RM.04)
// ---------------------------------------------------------------------------

/** Data isian Triase (RM.04). Kriteria disimpan sebagai ID stabil dari `TRIASE_KRITERIA`. */
export type TriaseForm = {
  // Kedatangan
  /** ISO lokal "YYYY-MM-DDTHH:mm". */
  kedatanganWaktu: string;
  caraDatang: "" | "Sendiri" | "Ambulans" | "Diantar" | "Lain-lain";
  caraDatangLain: string;
  // Jenis kasus
  kasus: "" | "Non Trauma" | "Trauma";
  /** Jenis kecelakaan (boleh lebih dari satu) — hanya bermakna bila Trauma. */
  kecelakaan: string[];
  /** Death on Arrival. */
  doa: boolean;
  /** ISO lokal "YYYY-MM-DDTHH:mm" (dicetak jam-nya saja). */
  doaWaktu: string;
  // Tanda-tanda vital (teks, seperti di formulir kertas)
  tdSistolik: string;
  tdDiastolik: string;
  nadi: string;
  suhu: string;
  saturasi: string;
  pernapasan: string;
  // Pemeriksaan (matriks kategori I–V)
  /** ID kriteria yang dicentang. */
  kriteria: string[];
  /** Kolom kesadaran (GCS) yang dilingkari: "" atau "1".."5". */
  kesadaran: string;
  /** Catatan per kategori (indeks 0 = Kategori I … 4 = Kategori V). */
  catatan: string[];
  emergency: "" | "True Emergency" | "False Emergency";
  // Penutup
  /** Tanggal & pukul triase — ISO lokal "YYYY-MM-DDTHH:mm". */
  waktuTriase: string;
  petugasNama: string;
  /** PNG data-URL. */
  petugasTtd: string;
};

/** Ringkasan triase yang tercatat di SIMRS — rujukan baca-saja di form. */
export type TriaseSimrs = {
  /** ISO lokal "YYYY-MM-DDTHH:mm". */
  waktu: string;
  /** Kategori yang dicentang di SIMRS (1..5), null bila tak ada. */
  kategori: number | null;
  doa: boolean;
  /** Zona rencana (Zona Merah/Kuning/Hijau/Hitam) bila ada. */
  zona: string;
  keluhan: string;
  petugas: string;
  /** NOPEN episode IGD asal bila triase diambil dari sana (episode rawat inap). */
  episodeIgd?: string | null;
};

/** Kebutuhan edukasi menurut asesmen SIMRS — rujukan baca-saja di RM.21. */
export type KebutuhanEdukasiSimrs = {
  /** Kategori edukator RM.21 → topik yang dibutuhkan. */
  perKategori: Record<string, string[]>;
  episodeIgd: string | null;
};

/** Kode + deskripsi `master.referensi` apa adanya di SIMRS. */
export type ReferensiSimrs = { kode: number; label: string };

/**
 * Keluar pasien menurut SIMRS (`layanan.pasien_pulang`) — dasar kolom Keadaan
 * Keluar RM.01 yang TERTAUT (hanya baca) dan panel rujukannya.
 */
export type KeluarSimrs = {
  /** Cara keluar (referensi 45). */
  cara: ReferensiSimrs | null;
  /** Keadaan keluar (referensi 46). */
  keadaan: ReferensiSimrs | null;
  /** ISO lokal "YYYY-MM-DDTHH:mm" pasien dipulangkan. */
  waktu: string;
  /** Pilihan Keadaan Keluar RM.01 yang sesuai ("" bila keadaan SIMRS tak punya pilihan di formulir). */
  nilaiForm: string;
  /** Keadaan SIMRS tanpa pilihan di RM.01 (DOA, lanjut rawat inap). */
  tanpaPilihan: boolean;
  /** Pasien meninggal / DOA menurut SIMRS (Sebab Kematian halaman 2 relevan). */
  meninggal: boolean;
  /**
   * Label ≤ / > 48 jam SIMRS tak sesuai selisih waktu daftar → keluar (acuan
   * `SensusHarianPasienKeluarMati`); null bila sesuai atau tak relevan.
   */
  selisih48: { jam: number; sesuaiWaktu: string } | null;
};

/** Hasil baca keluar SIMRS: "kosong" = belum dipulangkan di SIMRS, "gagal" = SIMRS tak terbaca. */
export type BacaKeluarSimrs = { status: "ada" | "kosong" | "gagal"; keluar: KeluarSimrs | null };
