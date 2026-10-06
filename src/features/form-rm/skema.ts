import { z } from "zod";
import {
  CARA_DATANG_OPTS,
  EMERGENCY_OPTS,
  KASUS_OPTS,
  KECELAKAAN_OPTS,
  TRIASE_KRITERIA_ID,
} from "./triase.constants";

/**
 * Skema data isian 4 form RM — sumber tunggal validasi (API simpan & finalkan,
 * migrasi data lama). Murni & aman untuk klien. Semua objek `strictObject`:
 * kunci yang tidak dikenal DITOLAK (bukan dibuang diam-diam), di setiap tingkat.
 */

/* ------------------------------------------------------------- tanda tangan */

/** Referensi TTD yang sudah tersimpan terpisah (`form_rm_ttd.id`, cuid). */
export const TTD_REF_RE = /^ttd:[a-z0-9]{20,32}$/;
export const TTD_DATA_URL_PREFIX = "data:image/png;base64,";
const TTD_DATA_URL_RE = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
/** ≈ 450 KB PNG setelah base64 — TTD hasil SignaturePad jauh di bawah ini. */
export const TTD_MAKS_KARAKTER = 600_000;

export const refTtd = (id: string) => `ttd:${id}`;
export const idDariRefTtd = (v: string): string | null => (TTD_REF_RE.test(v) ? v.slice(4) : null);
export const adalahDataUrlTtd = (v: string) => v.startsWith(TTD_DATA_URL_PREFIX);

/** "" (belum ditandatangani) | PNG data-URL baru | referensi TTD tersimpan. */
export const ttdSchema = z
  .string()
  .max(TTD_MAKS_KARAKTER, "Tanda tangan terlalu besar")
  .refine((s) => s === "" || TTD_REF_RE.test(s) || TTD_DATA_URL_RE.test(s), "Format tanda tangan tidak valid")
  .default("");

const str = (max = 300) => z.string().max(max).default("");
const yaTidak = z.enum(["", "Ya", "Tidak"]).default("");

/* -------------------------------------------- RM.21 Edukasi Pasien & Keluarga */

const persiapanSchema = z.strictObject({
  bahasa: z.array(z.string().max(60)).max(10).default([]),
  bahasaLain: str(120),
  penerjemah: yaTidak,
  pendidikan: str(30),
  pendidikanLain: str(60),
  bacaTulis: z.enum(["", "Baik", "Kurang"]).default(""),
  tipePembelajaran: z.array(z.string().max(30)).max(5).default([]),
  hambatan: z.array(z.string().max(60)).max(12).default([]),
  hambatanLain: str(200),
  kesediaan: z.enum(["", "Bersedia", "Tidak Bersedia"]).default(""),
});

const entrySchema = z.strictObject({
  kategori: z.string().min(1).max(60),
  aktif: z.boolean().default(false),
  edukatorNama: str(120),
  tanggalJam: str(30),
  durasiMenit: str(10),
  sasaran: str(30),
  sasaranNama: str(120),
  sasaranHubungan: str(60),
  sasaranTtd: ttdSchema,
  metode: z.array(z.string().max(40)).max(10).default([]),
  sarana: z.array(z.string().max(40)).max(10).default([]),
  saranaLain: str(120),
  pemahaman: z.array(z.string().max(40)).max(5).default([]),
  evaluasi: z.array(z.string().max(40)).max(5).default([]),
  tanggalReEdukasi: str(30),
});

export const edukasiFormSchema = z.strictObject({
  persiapan: persiapanSchema,
  entries: z.array(entrySchema).max(20),
  catatan: str(2000),
});

/* --------------------------------------------- RM.03 Persetujuan Umum (Consent) */

export const consentFormSchema = z.strictObject({
  waktuPendaftaran: str(30),
  ruanganRawat: str(120),
  kelas: str(60),
  nik: str(32),
  pjNama: str(120),
  pjJenisKelamin: z.enum(["", "Laki-Laki", "Perempuan"]).default(""),
  pjUmur: str(20),
  pjHubungan: str(60),
  pjAlamat: str(400),
  pjTelepon: str(40),
  pelepasanInfo: z.array(z.string().max(160)).max(3).default([]),
  izinPrivasi: z.enum(["", "Mengijinkan", "Tidak Mengijinkan"]).default(""),
  permintaanKhusus: z.array(z.string().max(160)).max(2).default([]),
  pasienNama: str(120),
  pasienTtd: ttdSchema,
  petugasNama: str(120),
  petugasTtd: ttdSchema,
  tanggalTtd: str(30),
});

/* ------------------------------------------- RM.01 Ringkasan Masuk & Keluar */

const skBarisSchema = z.strictObject({ teks: str(200), lama: str(60) });

export const ringkasanFormSchema = z.strictObject({
  alamat: str(300),
  telp: str(40),
  dirawatKe: str(20),
  golDarah: str(20),
  pendidikan: str(30),
  pendidikanLain: str(60),
  bangsa: z.enum(["", "Indonesia", "Asing"]).default(""),
  agama: str(30),
  statusPerkawinan: str(30),
  pekerjaan: str(30),
  caraMasuk: str(30),
  jenisPelayanan: str(30),
  namaOrangTua: str(120),
  pekerjaanOrangTua: str(60),
  keluargaNama: str(120),
  keluargaAlamat: str(300),
  keluargaTelp: str(40),
  tglMasuk: str(30),
  tglKeluar: str(30),
  lamaRawat: str(30),
  diagnosaSementara: str(300),
  dpjp: str(120),
  peserta: z.enum(["", "BPJS", "Asuransi", "Umum"]).default(""),
  izinKeluar: str(40),
  diagnosaUtama: str(300),
  diagnosaUtamaKode: str(30),
  diagnosaSekunder: str(400),
  diagnosaSekunderKode: str(60),
  komplikasi: str(300),
  komplikasiKode: str(30),
  penyebabLuar: str(300),
  penyebabLuarKode: str(30),
  operasi: str(300),
  operasiKode: str(30),
  catatan: str(600),
  infeksiNosokomial: str(200),
  penyebabInfeksiNosokomial: str(200),
  imunisasi: z.array(z.string().max(40)).max(10).default([]),
  dokterMerawatNama: str(120),
  dokterMerawatTtd: ttdSchema,
  keadaanKeluar: str(30),
  sebabKematianAktif: z.boolean().default(false),
  skA: str(200),
  skALama: str(60),
  skB: str(200),
  skBLama: str(60),
  skC: str(200),
  skCLama: str(60),
  skLain: z.array(skBarisSchema).max(3).default([]),
  rudaPaksaMacam: str(30),
  rudaPaksaCara: str(200),
  rudaPaksaSifat: str(200),
  lahirMatiJanin: yaTidak,
  lahirMatiSebab: str(200),
  persalinan: yaTidak,
  kehamilan: yaTidak,
  operasiKhususAda: yaTidak,
  operasiKhususJenis: str(200),
  sebabKematianTanggal: str(30),
  dokterKematianNama: str(120),
  dokterKematianTtd: ttdSchema,
});

/* ----------------------------------------------------------- RM.04 Triase IGD */

export const triaseFormSchema = z.strictObject({
  kedatanganWaktu: str(30),
  caraDatang: z.enum(["", ...CARA_DATANG_OPTS]).default(""),
  caraDatangLain: str(80),
  kasus: z.enum(["", ...KASUS_OPTS]).default(""),
  kecelakaan: z.array(z.enum(KECELAKAAN_OPTS)).max(KECELAKAAN_OPTS.length).default([]),
  doa: z.boolean().default(false),
  doaWaktu: str(30),
  tdSistolik: str(10),
  tdDiastolik: str(10),
  nadi: str(10),
  suhu: str(10),
  saturasi: str(10),
  pernapasan: str(10),
  kriteria: z
    .array(z.string().refine((id) => TRIASE_KRITERIA_ID.has(id), "Kriteria triase tidak dikenal"))
    .max(TRIASE_KRITERIA_ID.size)
    .default([]),
  kesadaran: z.enum(["", "1", "2", "3", "4", "5"]).default(""),
  catatan: z.array(z.string().max(300)).max(5).default([]),
  emergency: z.enum(["", ...EMERGENCY_OPTS]).default(""),
  waktuTriase: str(30),
  petugasNama: str(120),
  petugasTtd: ttdSchema,
});

/* --------------------------------------------------- penyesuaian data */

const ambilDi = (akar: unknown, path: readonly PropertyKey[]) =>
  path.reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<PropertyKey, unknown>)[k] : undefined), akar);

/**
 * Pangkas teks yang melebihi batas kolom (mis. alamat/diagnosa panjang dari
 * SIMRS) agar isi otomatis tidak menggagalkan pembuatan isian. Pelanggaran lain
 * tetap gagal (`null`).
 */
export function pangkasTeksPanjang<S extends z.ZodType>(skema: S, data: unknown): z.output<S> | null {
  const kerja: unknown = structuredClone(data);
  for (let putaran = 0; putaran < 3; putaran++) {
    const hasil = skema.safeParse(kerja);
    if (hasil.success) return hasil.data;
    const panjang = hasil.error.issues.filter((i) => i.code === "too_big" && i.origin === "string");
    if (panjang.length === 0 || panjang.length !== hasil.error.issues.length) return null;
    for (const isu of panjang) {
      const induk = ambilDi(kerja, isu.path.slice(0, -1));
      const kunci = isu.path.at(-1);
      const maks = Number(isu.code === "too_big" ? isu.maximum : 0);
      if (induk && typeof induk === "object" && kunci !== undefined && maks > 1) {
        const rec = induk as Record<PropertyKey, unknown>;
        if (typeof rec[kunci] === "string") rec[kunci] = `${(rec[kunci] as string).slice(0, maks - 1)}…`;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------ data lama */

/**
 * Bersihkan data lama agar lolos skema strict: kunci yang sudah tidak dikenal
 * (mis. field yang dihapus dari formulir) dibuang, lalu di-parse ulang. Hanya
 * kunci asing yang dibuang — pelanggaran lain tetap gagal (`null`).
 */
export function bersihkanDataLama<S extends z.ZodType>(skema: S, data: unknown): z.output<S> | null {
  const kerja: unknown = structuredClone(data);
  for (let putaran = 0; putaran < 5; putaran++) {
    const hasil = skema.safeParse(kerja);
    if (hasil.success) return hasil.data;
    const asing = hasil.error.issues.filter((i) => i.code === "unrecognized_keys");
    if (asing.length === 0 || asing.length !== hasil.error.issues.length) return null;
    for (const isu of asing) {
      const induk = ambilDi(kerja, isu.path);
      if (induk && typeof induk === "object") {
        for (const k of isu.keys) delete (induk as Record<string, unknown>)[k];
      }
    }
  }
  return null;
}
