import type { z } from "zod";
import type { BagianSimrs } from "./asal";
import { emptyConsentForm, CONSENT_JENIS } from "./consent.constants";
import type { StrukturDeklaratif } from "./deklaratif";
import { emptyEdukasiForm, EDUKASI_JENIS } from "./edukasi.constants";
import { morse } from "./forms/morse";
import { emptyRingkasanForm, RINGKASAN_JENIS } from "./ringkasan.constants";
import { cekTtdPernyataan, emptyRm22Form, kekuranganRm22, ringkasRm22, type Rm22Data } from "./rm22.constants";
import { cekTtdRm33, emptyRm33Form, kekuranganRm33, ringkasRm33, type Rm33Data } from "./rm33.constants";
import { cekTtdRm41, emptyRm41Form, kekuranganRm41 } from "./rm41.constants";
import { cekParafRm50, emptyRm50Form, kekuranganRm50, ringkasRm50, type Rm50Data } from "./rm50.constants";
import { emptyTriaseForm, hitungKategori, TRIASE_JENIS } from "./triase.constants";
import { KATEGORI_FORM, type KategoriForm } from "./kategori";
import {
  consentFormSchema,
  edukasiFormSchema,
  ringkasanFormSchema,
  rm22FormSchema,
  rm33FormSchema,
  rm41FormSchema,
  rm50FormSchema,
  triaseFormSchema,
} from "./skema";

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
export const KODE_FORM = ["RM.04", "RM.21", "RM.01", "RM.03", "RM.22", "RM.33", "RM.41", "RM.50", "RM.MORSE"] as const;
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

/** "Pasien IGD & Rawat Inap" / "Pasien Rawat Jalan, IGD & Rawat Inap" — ringkasan sasaran untuk katalog & pemilih pasien. */
export const labelSasaran = (s: SasaranPasien): string => {
  const label = s.jenis.map((j) => LABEL_JENIS_KUNJUNGAN[j]);
  return `Pasien ${label.length > 1 ? `${label.slice(0, -1).join(", ")} & ${label[label.length - 1]}` : label.join("")}`;
};

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
  /**
   * Form berulang: pembeda satu isian dari isian lain milik pasien yang sama
   * (mis. nama tindakan + keputusan) untuk daftar isian per pasien. Menerima
   * data tersimpan apa adanya → wajib defensif.
   */
  ringkasIsian?(data: unknown): RingkasanIsianForm;
  /**
   * Aturan perubahan antar-simpan (lama = data tersimpan apa adanya, baru =
   * data lolos skema). Kembalikan pesan untuk menolak simpan, atau null.
   */
  cekPerubahan?(lama: unknown, baru: T): string | null;
};

export type RingkasanIsianForm = {
  judul: string;
  lencana?: { label: string; nada: "success" | "danger" | "warning" | "neutral" };
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

/*
 * RM.22: satu isian per tindakan kedokteran (berulang). Formulir resmi ada di
 * berkas form IGD dan rawat inap. Tidak wajib per episode — hanya bila ada
 * tindakan. Isi otomatis: DPJP, diagnosis, dan identitas pasien (dipakai bila
 * yang menyatakan adalah keluarga).
 */
const SIMRS_RM22: readonly BagianSimrs[] = [
  {
    id: "informasi",
    judul: "Pemberian informasi",
    kolom: [
      { path: "pemberiInformasi", label: "Pemberi informasi / DPJP", sumber: "episode" },
      { path: "informasi.diagnosis.isi", label: "Diagnosis (WD & DD)", sumber: "diagnosa" },
    ],
  },
  {
    id: "pasien",
    judul: "Identitas pasien (pernyataan oleh keluarga)",
    kolom: [
      { path: "pasienNama", label: "Nama pasien", sumber: "identitas" },
      { path: "pasienUmur", label: "Umur pasien", sumber: "identitas" },
      { path: "pasienJk", label: "Jenis kelamin pasien", sumber: "identitas" },
      { path: "pasienAlamat", label: "Alamat pasien", sumber: "sosial" },
    ],
  },
];

const persetujuanTindakan: DefinisiForm<z.output<typeof rm22FormSchema>> = {
  kode: "RM.22",
  versi: 1,
  judul: "Informasi dan Persetujuan / Penolakan Tindakan Kedokteran",
  kategori: "administrasi-persetujuan",
  cakupan: "EPISODE",
  berulang: true,
  sasaran: { jenis: [2, 3], jendelaJam: 72 },
  wajibUntuk: [],
  kertas: { ukuran: "F4", orientasi: "potret" },
  simrs: SIMRS_RM22,
  skema: rm22FormSchema,
  kosong: () => rm22FormSchema.parse(emptyRm22Form()),
  petaTtd: (d, f) => ({
    ...d,
    pemberiTtd: f(d.pemberiTtd, "pemberiTtd"),
    penerimaTtd: f(d.penerimaTtd, "penerimaTtd"),
    pernyataTtd: f(d.pernyataTtd, "pernyataTtd"),
    saksi1Ttd: f(d.saksi1Ttd, "saksi1Ttd"),
    saksi2Ttd: f(d.saksi2Ttd, "saksi2Ttd"),
  }),
  syaratFinal: (d) => Object.values(kekuranganRm22(d)).flat(),
  ringkasIsian: (data) => ringkasRm22(data && typeof data === "object" ? (data as Partial<Rm22Data>) : null),
  cekPerubahan: cekTtdPernyataan,
};

/*
 * RM.33: satu isian per rujukan (berulang) — pasien bisa menunda lalu
 * menyetujui rujukan, atau dirujuk lebih dari sekali. Rujukan keluar SIMGOS
 * dibuat dari rawat jalan, IGD, dan rawat inap → ketiganya sasaran. Tidak wajib
 * per episode. Isi otomatis: rujukan keluar SIMRS (tujuan + poli, tanggal,
 * dokter perujuk, keterangan), DPJP, diagnosis, dan identitas pasien.
 */
const SIMRS_RM33: readonly BagianSimrs[] = [
  {
    id: "rujukan",
    judul: "Rencana rujukan",
    kolom: [
      { path: "tujuanRujukan", label: "Tujuan rujukan", sumber: "rujukan" },
      { path: "tanggalRujuk", label: "Tanggal rujuk", sumber: "rujukan" },
      { path: "dokterPelaksana", label: "Dokter pelaksana (perujuk)", sumber: "rujukan" },
      { path: "dokterNama", label: "Dokter (tanda tangan pernyataan)", sumber: "rujukan" },
      { path: "informasi.tindakan.isi", label: "Tindakan kedokteran", sumber: "rujukan" },
      { path: "informasi.tujuan.isi", label: "Tujuan (keterangan rujukan)", sumber: "rujukan" },
    ],
  },
  {
    id: "informasi",
    judul: "Pemberian informasi",
    kolom: [
      { path: "pemberiInformasi", label: "Pemberi informasi / DPJP", sumber: "episode" },
      { path: "informasi.diagnosis.isi", label: "Diagnosis (WD & DD)", sumber: "diagnosa" },
    ],
  },
  {
    id: "pasien",
    judul: "Identitas pasien (pernyataan oleh keluarga)",
    kolom: [
      { path: "pasienNama", label: "Nama pasien", sumber: "identitas" },
      { path: "pasienUmur", label: "Umur pasien", sumber: "identitas" },
      { path: "pasienJk", label: "Jenis kelamin pasien", sumber: "identitas" },
      { path: "pasienAlamat", label: "Alamat pasien", sumber: "sosial" },
    ],
  },
];

const persetujuanRujukan: DefinisiForm<z.output<typeof rm33FormSchema>> = {
  kode: "RM.33",
  versi: 1,
  judul: "Informasi dan Persetujuan / Penundaan & Penolakan Rujukan",
  kategori: "administrasi-persetujuan",
  cakupan: "EPISODE",
  berulang: true,
  sasaran: { jenis: [1, 2, 3], jendelaJam: 72 },
  wajibUntuk: [],
  kertas: { ukuran: "F4", orientasi: "potret" },
  simrs: SIMRS_RM33,
  skema: rm33FormSchema,
  kosong: () => rm33FormSchema.parse(emptyRm33Form()),
  petaTtd: (d, f) => ({
    ...d,
    pemberiTtd: f(d.pemberiTtd, "pemberiTtd"),
    penerimaTtd: f(d.penerimaTtd, "penerimaTtd"),
    pernyataTtd: f(d.pernyataTtd, "pernyataTtd"),
    dokterTtd: f(d.dokterTtd, "dokterTtd"),
    saksi1Ttd: f(d.saksi1Ttd, "saksi1Ttd"),
    saksi2Ttd: f(d.saksi2Ttd, "saksi2Ttd"),
  }),
  syaratFinal: (d) => Object.values(kekuranganRm33(d)).flat(),
  ringkasIsian: (data) => ringkasRm33(data && typeof data === "object" ? (data as Partial<Rm33Data>) : null),
  cekPerubahan: cekTtdRm33,
};

/*
 * RM.41: satu isian per episode — pasien pulang sekali. Pulang atas
 * permintaan sendiri (SIMGOS: cara keluar 2 "Pulang Paksa") tercatat dari IGD
 * dan rawat inap. Tidak wajib per episode — hanya bila pasien pulang APS. Isi
 * otomatis: identitas pasien, alamat (cadangan alamat yang menyatakan), dan —
 * bila kepulangan APS sudah dicatat di SIMRS — waktu serta petugas pencatatnya.
 */
const SIMRS_RM41: readonly BagianSimrs[] = [
  {
    id: "pasien",
    judul: "Identitas pasien",
    kolom: [
      { path: "pasienNama", label: "Nama pasien", sumber: "identitas" },
      { path: "pasienJk", label: "Jenis kelamin pasien", sumber: "identitas" },
      { path: "pasienTglLahir", label: "Tanggal lahir pasien", sumber: "identitas" },
      { path: "pasienNorm", label: "Nomor RM", sumber: "identitas" },
      { path: "pernyataAlamat", label: "Alamat yang menyatakan (alamat pasien)", sumber: "sosial" },
    ],
  },
  {
    id: "pulang",
    judul: "Kepulangan APS di SIMRS",
    kolom: [
      { path: "waktu", label: "Tanggal & jam pulang", sumber: "pulang" },
      { path: "petugasNama", label: "Petugas RS (pencatat kepulangan)", sumber: "pulang" },
    ],
  },
];

const pulangAps: DefinisiForm<z.output<typeof rm41FormSchema>> = {
  kode: "RM.41",
  versi: 1,
  judul: "Surat Pernyataan Pulang Atas Permintaan Sendiri",
  kategori: "ringkasan-pemulangan",
  cakupan: "EPISODE",
  berulang: false,
  sasaran: { jenis: [2, 3], jendelaJam: 72 },
  wajibUntuk: [],
  kertas: { ukuran: "F4", orientasi: "potret" },
  simrs: SIMRS_RM41,
  skema: rm41FormSchema,
  kosong: () => rm41FormSchema.parse(emptyRm41Form()),
  petaTtd: (d, f) => ({
    ...d,
    petugasTtd: f(d.petugasTtd, "petugasTtd"),
    saksiTtd: f(d.saksiTtd, "saksiTtd"),
    pernyataTtd: f(d.pernyataTtd, "pernyataTtd"),
  }),
  syaratFinal: (d) => Object.values(kekuranganRm41(d)).flat(),
  cekPerubahan: cekTtdRm41,
};

/*
 * RM.50: satu isian per pemberian transfusi (berulang) — baris = kantong darah
 * (maks. 23, kapasitas dua halaman kertas). Diisi perawat/bidan IGD & rawat
 * inap; tidak wajib per episode. Monitoring transfusi belum pernah dicatat di
 * SIMRS (tabel transfusi SIMGOS kosong) → isi otomatis hanya ruang rawat,
 * dokter (DPJP), golongan darah, dan riwayat alergi.
 */
const SIMRS_RM50: readonly BagianSimrs[] = [
  {
    id: "transfusi",
    judul: "Data transfusi",
    kolom: [
      { path: "ruangRawat", label: "Ruang rawat", sumber: "identitas" },
      { path: "dokter", label: "Dokter yang merawat (DPJP)", sumber: "episode" },
    ],
  },
  {
    id: "riwayat",
    judul: "Riwayat & golongan darah",
    kolom: [
      { path: "alergi", label: "Riwayat alergi", sumber: "alergi" },
      { path: "alergiKet", label: "Alergi yang disebutkan", sumber: "alergi" },
      { path: "golonganDarah", label: "Golongan darah", sumber: "sosial" },
    ],
  },
];

const monitoringTransfusi: DefinisiForm<z.output<typeof rm50FormSchema>> = {
  kode: "RM.50",
  versi: 1,
  judul: "Monitoring Pemberian Transfusi Darah / Produk Darah",
  kategori: "asesmen-keperawatan",
  cakupan: "EPISODE",
  berulang: true,
  sasaran: { jenis: [2, 3], jendelaJam: 72 },
  wajibUntuk: [],
  kertas: { ukuran: "F4", orientasi: "lanskap" },
  simrs: SIMRS_RM50,
  skema: rm50FormSchema,
  kosong: () => rm50FormSchema.parse(emptyRm50Form()),
  petaTtd: (d, f) => ({ ...d, kantong: d.kantong.map((k, i) => ({ ...k, paraf: f(k.paraf, `kantong.${i}.paraf`) })) }),
  syaratFinal: (d) => Object.values(kekuranganRm50(d)).flat(),
  ringkasIsian: (data) => ringkasRm50(data && typeof data === "object" ? (data as Partial<Rm50Data>) : null),
  cekPerubahan: cekParafRm50,
};

/** Urutan = urutan tampil di katalog. */
export const DEFINISI_FORM: readonly DefinisiForm[] = [
  triase,
  edukasi,
  ringkasan,
  consent,
  persetujuanTindakan,
  persetujuanRujukan,
  pulangAps,
  monitoringTransfusi,
  morse,
];

const BY_KODE = new Map(DEFINISI_FORM.map((d) => [d.kode, d]));
const BY_JENIS_LAMA = new Map(DEFINISI_FORM.flatMap((d) => (d.jenisLama ? [[d.jenisLama, d] as const] : [])));

export const definisiForm = (kode: string): DefinisiForm | undefined => BY_KODE.get(kode as KodeForm);
export const definisiDariJenisLama = (jenis: string): DefinisiForm | undefined => BY_JENIS_LAMA.get(jenis);
