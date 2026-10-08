import type { z } from "zod";
import type { BagianSimrs } from "./asal";
import { emptyConsentForm, CONSENT_JENIS } from "./consent.constants";
import type { StrukturDeklaratif } from "./deklaratif";
import { emptyEdukasiForm, EDUKASI_JENIS } from "./edukasi.constants";
import { morse } from "./forms/morse";
import { emptyRingkasanForm, RINGKASAN_JENIS } from "./ringkasan.constants";
import { emptyTriaseForm, hitungKategori, TRIASE_JENIS } from "./triase.constants";
import { KATEGORI_FORM, type KategoriForm } from "./kategori";
import { consentFormSchema, edukasiFormSchema, ringkasanFormSchema, triaseFormSchema } from "./skema";

/**
 * REGISTRI FORM RM — sumber kebenaran daftar formulir (di kode, bukan DB; pola
 * sama dengan katalog modul RBAC). Murni & aman untuk klien; isi otomatis dari
 * SIMRS ada di server (`server/modules/form-rm/isian.petakan.ts`).
 *
 * Menambah form DEKLARATIF (PRD §8.2): satu berkas definisi di `forms/`, lalu
 * daftarkan kodenya di KODE_FORM, DEFINISI_FORM, dan `tampilan.ts` (TypeScript
 * menolak bila salah satu terlewat). Renderer form & cetak generik dipakai
 * otomatis. Form KHUSUS (tampilan & cetak ditulis tangan) tetap didefinisikan
 * di bawah.
 */

export { KATEGORI_FORM, type KategoriForm };

/** "RM.MORSE" = kode sementara — diganti nomor RM resmi dari templat RS sebelum dipakai di produksi. */
export const KODE_FORM = ["RM.04", "RM.21", "RM.01", "RM.03", "RM.MORSE"] as const;
export type KodeForm = (typeof KODE_FORM)[number];

/** EPISODE = satu isian per pendaftaran (NOPEN); KUNJUNGAN = per kunjungan ruang. */
export type CakupanForm = "EPISODE" | "KUNJUNGAN";

/** `master.ruangan.JENIS_KUNJUNGAN` SIMGOS: 1 = rawat jalan, 2 = IGD, 3 = rawat inap. */
export const JENIS_KUNJUNGAN = [1, 2, 3] as const;
export type JenisKunjungan = (typeof JENIS_KUNJUNGAN)[number];
export const LABEL_JENIS_KUNJUNGAN: Record<JenisKunjungan, string> = { 1: "Rawat Jalan", 2: "IGD", 3: "Rawat Inap" };

/** Penyaring pemilih pasien sebuah form (PRD §6.1). */
export type SasaranPasien = {
  /** Episode menjadi sasaran bila punya kunjungan (leg) berjenis ini. */
  readonly jenis: readonly JenisKunjungan[];
  /**
   * Daftar bawaan: leg sasaran yang masih dilayani (belum keluar) atau masuk
   * dalam N jam terakhir. Pasien lain dicari lewat No.RM / nama / NIK.
   */
  readonly jendelaJam: number;
};

/** "Pasien IGD & Rawat Inap" — ringkasan sasaran untuk katalog & pemilih pasien. */
export const labelSasaran = (s: SasaranPasien): string =>
  `Pasien ${s.jenis.map((j) => LABEL_JENIS_KUNJUNGAN[j]).join(" & ")}`;

export type Kertas = { ukuran: "A4" | "F4"; orientasi: "potret" | "lanskap" };

/** Pemeta slot TTD: dipanggil sekali per slot, nilai kembalian menggantikan isinya. */
export type PetaSlotTtd = (nilai: string, slot: string) => string;

export type DefinisiForm<T extends object = object> = {
  readonly kode: KodeForm;
  /** Nilai kolom `form_rm.jenis` lama — penaut migrasi & rute lama (hanya 4 form awal). */
  readonly jenisLama?: string;
  /** Ada = form deklaratif (renderer form & cetak generik); tidak ada = form khusus. */
  readonly struktur?: StrukturDeklaratif;
  /** Naik bila struktur/tata letak berubah; isian lama tetap memakai versinya. */
  readonly versi: number;
  readonly judul: string;
  readonly kategori: KategoriForm;
  readonly cakupan: CakupanForm;
  /** Boleh lebih dari satu isian per subjek (mis. informed consent per tindakan). */
  readonly berulang: boolean;
  readonly sasaran: SasaranPasien;
  /**
   * Ada = boleh diisi sebelum pasien terdaftar di SIMRS: isian dibuat dengan
   * identitas sementara ("Belum tertaut"), lalu ditautkan ke pendaftaran (lihat
   * `sementara.ts`). `waktuAcuan` = jam dinding "YYYY-MM-DDTHH:mm" dari isi form
   * untuk menyarankan pendaftaran yang cocok ("" = pakai waktu isian dibuat).
   */
  readonly tanpaPendaftaran?: { waktuAcuan(data: T): string };
  /** Form dihitung wajib (kelengkapan) untuk episode yang punya leg berjenis ini. */
  readonly wajibUntuk: readonly JenisKunjungan[];
  readonly kertas: Kertas;
  /**
   * Kolom yang dapat diisi dari SIMRS, dikelompokkan per bagian (penanda asal &
   * "Muat ulang dari SIMRS"). Pemetaan nilainya ada di server
   * (`server/modules/form-rm/isian.petakan.ts`).
   */
  readonly simrs: readonly BagianSimrs[];
  readonly skema: z.ZodType<T>;
  /** Isian baru tanpa data SIMRS (sudah lolos skema). */
  kosong(): T;
  /** Petakan setiap slot tanda tangan (path stabil, mis. `entries.2.sasaranTtd`). */
  petaTtd(data: T, f: PetaSlotTtd): T;
  /** Kekurangan yang menghalangi FINAL (kosong = boleh difinalkan). */
  syaratFinal(data: T): string[];
};

const kosongBila = (kondisi: boolean, pesan: string) => (kondisi ? [pesan] : []);
const belumDiisi = (s: string) => s.trim() === "";

/*
 * SIMGOS membuat NOPEN BARU untuk rawat inap (552 dari 566 episode RI dalam 90
 * hari berasal dari episode IGD ber-NOPEN lain; tak satu pun berbagi NOPEN).
 * Praktik saat ini: keempat form diisi admisi pada episode IGD (keputusan K8
 * terbuka). Bila diisi pada episode rawat inap, sumber asesmen (triase,
 * edukasi) otomatis diambil dari episode IGD asalnya (PRD §6.4).
 */
/** Triase: pasien yang baru tiba di IGD. */
const SASARAN_TRIASE: SasaranPasien = { jenis: [2], jendelaJam: 24 };
/** Dokumen episode admisi IGD; jendela 7 hari = bawaan daftar lama. */
const SASARAN_ADMISI_IGD: SasaranPasien = { jenis: [2], jendelaJam: 24 * 7 };

/*
 * Kolom isi otomatis per form. Kolom tanpa data di SIMGOS (penanggung jawab,
 * baca-tulis, imunisasi, sebab kematian, dst.) sengaja tidak dicantumkan.
 * Kriteria & kesadaran triase tidak pernah diisi otomatis (keputusan klinis).
 */
const SIMRS_TRIASE: readonly BagianSimrs[] = [
  {
    id: "kedatangan",
    judul: "Kedatangan",
    kolom: [
      { path: "kedatanganWaktu", label: "Tanggal & pukul kedatangan", sumber: "triase" },
      { path: "caraDatang", label: "Cara datang", sumber: "triase" },
      { path: "caraDatangLain", label: "Cara datang lain-lain", sumber: "triase" },
    ],
  },
  {
    id: "kasus",
    judul: "Jenis kasus",
    kolom: [
      { path: "kasus", label: "Jenis kasus", sumber: "triase" },
      { path: "kecelakaan", label: "Kecelakaan", sumber: "triase" },
      { path: "doa", label: "DOA", sumber: "triase" },
      { path: "doaWaktu", label: "Pukul DOA", sumber: "triase" },
    ],
  },
  {
    id: "ttv",
    judul: "Tanda-tanda vital",
    kolom: [
      { path: "tdSistolik", label: "TD sistolik", sumber: "triase" },
      { path: "tdDiastolik", label: "TD diastolik", sumber: "triase" },
      { path: "nadi", label: "Nadi", sumber: "triase" },
      { path: "suhu", label: "Suhu", sumber: "triase" },
      { path: "saturasi", label: "Saturasi O₂", sumber: "triase" },
      { path: "pernapasan", label: "Pernapasan", sumber: "triase" },
    ],
  },
  {
    id: "petugas",
    judul: "Petugas triase",
    kolom: [
      { path: "waktuTriase", label: "Tanggal & pukul triase", sumber: "triase" },
      { path: "petugasNama", label: "Nama petugas", sumber: "triase" },
    ],
  },
];

const SIMRS_EDUKASI: readonly BagianSimrs[] = [
  {
    id: "persiapan",
    judul: "Persiapan edukasi",
    kolom: [
      { path: "persiapan.bahasa", label: "Bahasa", sumber: "sosial" },
      { path: "persiapan.bahasaLain", label: "Bahasa lain", sumber: "sosial" },
      { path: "persiapan.penerjemah", label: "Kebutuhan penerjemah", sumber: "edukasi" },
      { path: "persiapan.pendidikan", label: "Pendidikan pasien", sumber: "sosial" },
      { path: "persiapan.pendidikanLain", label: "Pendidikan lain", sumber: "sosial" },
      { path: "persiapan.hambatan", label: "Hambatan edukasi", sumber: "edukasi" },
      { path: "persiapan.hambatanLain", label: "Hambatan lain", sumber: "edukasi" },
      { path: "persiapan.kesediaan", label: "Kesediaan menerima edukasi", sumber: "edukasi" },
    ],
  },
];

const SIMRS_RINGKASAN: readonly BagianSimrs[] = [
  {
    id: "identitas",
    judul: "Identitas",
    kolom: [
      { path: "alamat", label: "Alamat", sumber: "sosial" },
      { path: "telp", label: "Telp / HP", sumber: "sosial" },
      { path: "dirawatKe", label: "Dirawat ke-", sumber: "episode" },
      { path: "golDarah", label: "Gol. darah", sumber: "sosial" },
    ],
  },
  {
    id: "sosial",
    judul: "Data sosial",
    kolom: [
      { path: "pendidikan", label: "Pendidikan", sumber: "sosial" },
      { path: "pendidikanLain", label: "Pendidikan lain", sumber: "sosial" },
      { path: "bangsa", label: "Bangsa", sumber: "sosial" },
      { path: "agama", label: "Agama", sumber: "sosial" },
      { path: "statusPerkawinan", label: "Status perkawinan", sumber: "sosial" },
      { path: "pekerjaan", label: "Pekerjaan", sumber: "sosial" },
      { path: "caraMasuk", label: "Cara masuk rumah sakit", sumber: "episode" },
      { path: "jenisPelayanan", label: "Jenis pelayanan", sumber: "episode" },
      { path: "namaOrangTua", label: "Nama orang tua", sumber: "keluarga" },
      { path: "pekerjaanOrangTua", label: "Pekerjaan orang tua", sumber: "keluarga" },
    ],
  },
  {
    id: "keluarga",
    judul: "Keluarga terdekat",
    kolom: [
      { path: "keluargaNama", label: "Nama", sumber: "keluarga" },
      { path: "keluargaAlamat", label: "Alamat", sumber: "keluarga" },
      { path: "keluargaTelp", label: "Telp / HP", sumber: "keluarga" },
    ],
  },
  {
    id: "perawatan",
    judul: "Data perawatan",
    kolom: [
      { path: "tglMasuk", label: "Tanggal & jam masuk", sumber: "episode" },
      { path: "tglKeluar", label: "Tanggal & jam keluar", sumber: "episode" },
      { path: "lamaRawat", label: "Lama rawat", sumber: "episode" },
      { path: "diagnosaSementara", label: "Diagnosa sementara", sumber: "episode" },
      { path: "dpjp", label: "Dokter jaga / DPJP", sumber: "episode" },
      { path: "peserta", label: "Peserta", sumber: "episode" },
      { path: "izinKeluar", label: "Izin keluar", sumber: "pulang" },
    ],
  },
  {
    id: "diagnosa",
    judul: "Diagnosa akhir",
    kolom: [
      { path: "diagnosaUtama", label: "Diagnosa utama", sumber: "diagnosa" },
      { path: "diagnosaUtamaKode", label: "Kode ICD diagnosa utama", sumber: "diagnosa" },
      { path: "diagnosaSekunder", label: "Diagnosa sekunder", sumber: "diagnosa" },
      { path: "diagnosaSekunderKode", label: "Kode ICD diagnosa sekunder", sumber: "diagnosa" },
    ],
  },
  {
    id: "keluar",
    judul: "Dokter merawat & keadaan keluar",
    kolom: [
      { path: "dokterMerawatNama", label: "Nama dokter yang merawat", sumber: "episode" },
      { path: "keadaanKeluar", label: "Keadaan keluar", sumber: "pulang" },
    ],
  },
];

const SIMRS_CONSENT: readonly BagianSimrs[] = [
  {
    id: "identitas",
    judul: "Identitas",
    kolom: [{ path: "nik", label: "NIK", sumber: "identitas" }],
  },
  {
    id: "pendaftaran",
    judul: "Waktu pendaftaran & ruang",
    kolom: [
      { path: "waktuPendaftaran", label: "Tanggal & jam pendaftaran", sumber: "identitas" },
      { path: "ruanganRawat", label: "Ruangan rawat", sumber: "identitas" },
      { path: "kelas", label: "Kelas", sumber: "episode" },
    ],
  },
  {
    id: "ttd",
    judul: "Penanda tangan",
    kolom: [{ path: "pasienNama", label: "Nama pasien / penanggung jawab", sumber: "identitas" }],
  },
];

const triase: DefinisiForm<z.output<typeof triaseFormSchema>> = {
  kode: "RM.04",
  jenisLama: TRIASE_JENIS,
  versi: 1,
  judul: "Triase Instalasi Gawat Darurat",
  kategori: "gawat-darurat",
  cakupan: "EPISODE",
  berulang: false,
  sasaran: SASARAN_TRIASE,
  // Pasien ditriase saat tiba, sebelum didaftarkan di SIMRS.
  tanpaPendaftaran: { waktuAcuan: (d) => d.kedatanganWaktu || d.waktuTriase },
  wajibUntuk: [2],
  kertas: { ukuran: "F4", orientasi: "potret" },
  simrs: SIMRS_TRIASE,
  skema: triaseFormSchema,
  kosong: () => triaseFormSchema.parse(emptyTriaseForm()),
  petaTtd: (d, f) => ({ ...d, petugasTtd: f(d.petugasTtd, "petugasTtd") }),
  syaratFinal: (d) => [
    ...kosongBila(hitungKategori(d) === null, "Kategori triase (centang minimal satu kriteria pemeriksaan)"),
    ...kosongBila(belumDiisi(d.waktuTriase), "Tanggal & pukul triase"),
    ...kosongBila(belumDiisi(d.petugasNama), "Nama petugas triase"),
    ...kosongBila(d.petugasTtd === "", "Tanda tangan petugas triase"),
  ],
};

const edukasi: DefinisiForm<z.output<typeof edukasiFormSchema>> = {
  kode: "RM.21",
  jenisLama: EDUKASI_JENIS,
  versi: 1,
  judul: "Edukasi Pasien & Keluarga Terintegrasi",
  kategori: "edukasi",
  cakupan: "EPISODE",
  berulang: false,
  sasaran: SASARAN_ADMISI_IGD,
  wajibUntuk: [2],
  kertas: { ukuran: "F4", orientasi: "lanskap" },
  simrs: SIMRS_EDUKASI,
  skema: edukasiFormSchema,
  kosong: () => edukasiFormSchema.parse(emptyEdukasiForm()),
  petaTtd: (d, f) => ({
    ...d,
    entries: d.entries.map((e, i) => ({ ...e, sasaranTtd: f(e.sasaranTtd, `entries.${i}.sasaranTtd`) })),
  }),
  syaratFinal: (d) => {
    const aktif = d.entries.filter((e) => e.aktif);
    if (aktif.length === 0) return ["Minimal satu kebutuhan edukasi diisi"];
    return aktif.flatMap((e) => [
      ...kosongBila(belumDiisi(e.edukatorNama), `${e.kategori}: nama edukator`),
      ...kosongBila(belumDiisi(e.tanggalJam), `${e.kategori}: tanggal & jam edukasi`),
      ...kosongBila(e.sasaranTtd === "", `${e.kategori}: tanda tangan sasaran edukasi`),
    ]);
  },
};

const ringkasan: DefinisiForm<z.output<typeof ringkasanFormSchema>> = {
  kode: "RM.01",
  jenisLama: RINGKASAN_JENIS,
  versi: 1,
  judul: "Ringkasan Masuk & Keluar",
  kategori: "ringkasan-pemulangan",
  cakupan: "EPISODE",
  berulang: false,
  sasaran: SASARAN_ADMISI_IGD,
  wajibUntuk: [2],
  kertas: { ukuran: "A4", orientasi: "potret" },
  simrs: SIMRS_RINGKASAN,
  skema: ringkasanFormSchema,
  kosong: () => ringkasanFormSchema.parse(emptyRingkasanForm()),
  petaTtd: (d, f) => ({
    ...d,
    dokterMerawatTtd: f(d.dokterMerawatTtd, "dokterMerawatTtd"),
    dokterKematianTtd: f(d.dokterKematianTtd, "dokterKematianTtd"),
  }),
  syaratFinal: (d) => [
    ...kosongBila(belumDiisi(d.dokterMerawatNama), "Nama dokter yang merawat"),
    ...kosongBila(d.dokterMerawatTtd === "", "Tanda tangan dokter yang merawat"),
    ...(d.sebabKematianAktif
      ? [
          ...kosongBila(belumDiisi(d.skA), "Sebab kematian langsung (I.a)"),
          ...kosongBila(belumDiisi(d.dokterKematianNama), "Nama dokter pemberi keterangan sebab kematian"),
          ...kosongBila(d.dokterKematianTtd === "", "Tanda tangan dokter pemberi keterangan sebab kematian"),
        ]
      : []),
  ],
};

const consent: DefinisiForm<z.output<typeof consentFormSchema>> = {
  kode: "RM.03",
  jenisLama: CONSENT_JENIS,
  versi: 1,
  judul: "Persetujuan Umum (General Consent)",
  kategori: "administrasi-persetujuan",
  cakupan: "EPISODE",
  berulang: false,
  sasaran: SASARAN_ADMISI_IGD,
  wajibUntuk: [2],
  kertas: { ukuran: "A4", orientasi: "potret" },
  simrs: SIMRS_CONSENT,
  skema: consentFormSchema,
  kosong: () => consentFormSchema.parse(emptyConsentForm()),
  petaTtd: (d, f) => ({
    ...d,
    pasienTtd: f(d.pasienTtd, "pasienTtd"),
    petugasTtd: f(d.petugasTtd, "petugasTtd"),
  }),
  syaratFinal: (d) => [
    ...kosongBila(belumDiisi(d.pasienNama), "Nama pasien / penanggung jawab yang menandatangani"),
    ...kosongBila(d.pasienTtd === "", "Tanda tangan pasien / penanggung jawab"),
    ...kosongBila(belumDiisi(d.petugasNama), "Nama petugas"),
    ...kosongBila(d.petugasTtd === "", "Tanda tangan petugas"),
    ...kosongBila(belumDiisi(d.tanggalTtd), "Tanggal tanda tangan"),
  ],
};

/** Urutan = urutan tampil di katalog. */
export const DEFINISI_FORM: readonly DefinisiForm[] = [triase, edukasi, ringkasan, consent, morse];

const BY_KODE = new Map(DEFINISI_FORM.map((d) => [d.kode, d]));
const BY_JENIS_LAMA = new Map(DEFINISI_FORM.flatMap((d) => (d.jenisLama ? [[d.jenisLama, d] as const] : [])));

export const definisiForm = (kode: string): DefinisiForm | undefined => BY_KODE.get(kode as KodeForm);
export const definisiDariJenisLama = (jenis: string): DefinisiForm | undefined => BY_JENIS_LAMA.get(jenis);
