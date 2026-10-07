import type { z } from "zod";
import { emptyConsentForm, CONSENT_JENIS } from "./consent.constants";
import { emptyEdukasiForm, EDUKASI_JENIS } from "./edukasi.constants";
import { emptyRingkasanForm, RINGKASAN_JENIS } from "./ringkasan.constants";
import { emptyTriaseForm, hitungKategori, TRIASE_JENIS } from "./triase.constants";
import { KATEGORI_FORM, type KategoriForm } from "./kategori";
import { consentFormSchema, edukasiFormSchema, ringkasanFormSchema, triaseFormSchema } from "./skema";

/**
 * REGISTRI FORM RM — sumber kebenaran daftar formulir (di kode, bukan DB; pola
 * sama dengan katalog modul RBAC). Menambah formulir = menambah satu definisi.
 * Murni & aman untuk klien; isi otomatis dari SIMRS ada di server
 * (`server/modules/form-rm/isian.prefill.ts`).
 */

export { KATEGORI_FORM, type KategoriForm };

export const KODE_FORM = ["RM.04", "RM.21", "RM.01", "RM.03"] as const;
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
  /** Nilai kolom `form_rm.jenis` lama — penaut migrasi & rute lama. */
  readonly jenisLama: string;
  /** Naik bila struktur/tata letak berubah; isian lama tetap memakai versinya. */
  readonly versi: number;
  readonly judul: string;
  readonly kategori: KategoriForm;
  readonly cakupan: CakupanForm;
  /** Boleh lebih dari satu isian per subjek (mis. informed consent per tindakan). */
  readonly berulang: boolean;
  readonly sasaran: SasaranPasien;
  /** Form dihitung wajib (kelengkapan) untuk episode yang punya leg berjenis ini. */
  readonly wajibUntuk: readonly JenisKunjungan[];
  readonly kertas: Kertas;
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
 * Praktik saat ini: keempat form diisi admisi pada episode IGD. Mengisi di
 * episode rawat inap (atau menaut episode IGD asal, PRD §6.4) menunggu keputusan.
 */
/** Triase: pasien yang baru tiba di IGD. */
const SASARAN_TRIASE: SasaranPasien = { jenis: [2], jendelaJam: 24 };
/** Dokumen episode admisi IGD; jendela 7 hari = bawaan daftar lama. */
const SASARAN_ADMISI_IGD: SasaranPasien = { jenis: [2], jendelaJam: 24 * 7 };

const triase: DefinisiForm<z.output<typeof triaseFormSchema>> = {
  kode: "RM.04",
  jenisLama: TRIASE_JENIS,
  versi: 1,
  judul: "Triase Instalasi Gawat Darurat",
  kategori: "gawat-darurat",
  cakupan: "EPISODE",
  berulang: false,
  sasaran: SASARAN_TRIASE,
  wajibUntuk: [2],
  kertas: { ukuran: "F4", orientasi: "potret" },
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
export const DEFINISI_FORM: readonly DefinisiForm[] = [triase, edukasi, ringkasan, consent];

const BY_KODE = new Map(DEFINISI_FORM.map((d) => [d.kode, d]));
const BY_JENIS_LAMA = new Map(DEFINISI_FORM.map((d) => [d.jenisLama, d]));

export const definisiForm = (kode: string): DefinisiForm | undefined => BY_KODE.get(kode as KodeForm);
export const definisiDariJenisLama = (jenis: string): DefinisiForm | undefined => BY_JENIS_LAMA.get(jenis);
