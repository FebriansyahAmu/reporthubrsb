import { z } from "zod";
import { JENIS_INFORMASI, JK_PILIHAN, type IdInformasi } from "./persetujuan/informasi";
import { LEMBAR_RM22 } from "./rm22.constants";
import { KEPUTUSAN_RM33 } from "./rm33.constants";
import { SELAKU_RM41 } from "./rm41.constants";
import { FASE_TTV, GOLONGAN_DARAH, KEADAAN_KANTONG, MAKS_KANTONG, POLA_TTV, YA_TIDAK, type IdFase } from "./rm50.constants";
import {
  ATONIA_UTERI,
  BARIS_KALA4,
  BUTIR_KALA3,
  DAFTAR_LAJUR_SEL,
  DERAJAT_LASERASI,
  DISTOSIA_BAHU,
  DURASI_KONTRAKSI,
  GARIS_AKHIR,
  GAWAT_JANIN,
  KETUBAN,
  KOLOM_GRAFIK,
  KONDISI_BAYI,
  LAJUR_SEL,
  MATERI_KIE,
  PENDAMPING,
  PENYUSUPAN,
  SUHU_KALA4,
  SUMBU,
  TEMPAT_PERSALINAN,
  TINDAKAN_BAYI,
  TINDAKAN_LASERASI,
  type IdButirKala3,
  type LajurSel,
} from "./rm70.constants";
import {
  CARA_DATANG_OPTS,
  EMERGENCY_OPTS,
  KASUS_OPTS,
  KECELAKAAN_OPTS,
  TRIASE_KRITERIA_ID,
} from "./triase.constants";

/**
 * Skema data isian form RM khusus — sumber tunggal validasi (API simpan & finalkan,
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

/** Nilai TTD → `src` gambar: referensi tersimpan dimuat dari API, data-URL baru apa adanya. */
export function srcTtd(v: string): string {
  const id = idDariRefTtd(v);
  return id ? `/api/form-rm/ttd/${id}` : v;
}

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

/* --------------------- Informasi & Persetujuan (bagian bersama RM.22 & RM.33) */

const barisInformasiSchema = z.strictObject({ isi: str(1000), tanda: z.boolean().default(false) });
/** Umur dalam tahun (angka saja, mengikuti "umur ___ tahun" di formulir). */
const umurTahunSchema = z.string().regex(/^(\d{1,3})?$/, "Umur diisi angka tahun").default("");
const jkPilihanSchema = z.enum(["", ...JK_PILIHAN]).default("");
const tanggalSchema = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Format tanggal YYYY-MM-DD").default("");

/** PEMBERIAN INFORMASI: pihak, 11 baris informasi, TTD pemberi & penerima. */
const pemberianInformasiShape = {
  dokterPelaksana: str(120),
  pemberiInformasi: str(120),
  penerimaInformasi: str(120),
  informasi: z.strictObject(
    Object.fromEntries(JENIS_INFORMASI.map((j) => [j.id, barisInformasiSchema])) as Record<
      IdInformasi,
      typeof barisInformasiSchema
    >,
  ),
  pemberiTtd: ttdSchema,
  penerimaTtd: ttdSchema,
};

/** "Saya yang bertandatangan…" + "terhadap saya / ___ saya bernama …". */
const yangMenyatakanShape = {
  pernyataNama: str(120),
  pernyataUmur: umurTahunSchema,
  pernyataJk: jkPilihanSchema,
  pernyataAlamat: str(300),
  terhadap: z.enum(["", "diri", "keluarga"]).default(""),
  hubungan: str(60),
  pasienNama: str(120),
  pasienUmur: umurTahunSchema,
  pasienJk: jkPilihanSchema,
  pasienAlamat: str(300),
};

const saksiShape = {
  saksi1Nama: str(120),
  saksi1Ttd: ttdSchema,
  saksi2Nama: str(120),
  saksi2Ttd: ttdSchema,
};

/* ------------------------- RM.22 Informasi & Persetujuan/Penolakan Tindakan */

export const rm22FormSchema = z.strictObject({
  lembar: z.enum(["", ...LEMBAR_RM22]).default(""),
  ...pemberianInformasiShape,
  ...yangMenyatakanShape,
  tindakan: str(300),
  tanggal: tanggalSchema,
  pernyataTtd: ttdSchema,
  ...saksiShape,
});

/* ------------------- RM.33 Informasi & Persetujuan/Penundaan-Penolakan Rujukan */

export const rm33FormSchema = z.strictObject({
  keputusan: z.enum(["", ...KEPUTUSAN_RM33]).default(""),
  tujuanRujukan: str(200),
  tanggalRujuk: tanggalSchema,
  ...pemberianInformasiShape,
  ...yangMenyatakanShape,
  tanggal: tanggalSchema,
  pernyataTtd: ttdSchema,
  dokterNama: str(120),
  dokterTtd: ttdSchema,
  ...saksiShape,
});

/* --------------------------- RM.41 Surat Pernyataan Pulang Atas Permintaan Sendiri */

export const rm41FormSchema = z.strictObject({
  pernyataNama: str(120),
  pernyataUmur: umurTahunSchema,
  pernyataAlamat: str(300),
  selaku: z.enum(["", ...SELAKU_RM41]).default(""),
  pasienNama: str(120),
  pasienJk: jkPilihanSchema,
  pasienTglLahir: tanggalSchema,
  pasienNorm: z.string().regex(/^\d{0,12}$/, "Nomor RM diisi angka").default(""),
  alasan: str(300),
  waktu: z.string().regex(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/, "Format waktu YYYY-MM-DDTHH:mm").default(""),
  petugasNama: str(120),
  petugasTtd: ttdSchema,
  saksiNama: str(120),
  saksiTtd: ttdSchema,
  pernyataTtd: ttdSchema,
});

/* --------------------------- RM.50 Monitoring Pemberian Transfusi Darah/Produk Darah */

const waktuSchema = z.string().regex(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/, "Format waktu YYYY-MM-DDTHH:mm").default("");
const ttvRm50Schema = z.strictObject({
  td: z.string().regex(POLA_TTV.td, "TD mis. 120/80").default(""),
  n: z.string().regex(POLA_TTV.n, "Nadi angka").default(""),
  r: z.string().regex(POLA_TTV.r, "Napas angka").default(""),
  s: z.string().regex(POLA_TTV.s, "Suhu mis. 36,5").default(""),
});
const kantongRm50Schema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]{6,16}$/, "Pengenal baris tidak valid"),
  waktu: waktuSchema,
  jenis: str(30),
  noSeri: str(40),
  kadaluarsa: tanggalSchema,
  isi: z.string().regex(/^\d{0,4}$/, "Isi (ml) diisi angka").default(""),
  ttv: z.strictObject(
    Object.fromEntries(FASE_TTV.map((f) => [f.id, ttvRm50Schema])) as Record<IdFase, typeof ttvRm50Schema>,
  ),
  reaksi: str(80),
  parafNama: str(120),
  paraf: ttdSchema,
});

export const rm50FormSchema = z.strictObject({
  waktu: waktuSchema,
  ruangRawat: str(120),
  dokter: str(120),
  alergi: z.enum(["", ...YA_TIDAK]).default(""),
  alergiKet: str(200),
  pernahTransfusi: z.enum(["", ...YA_TIDAK]).default(""),
  transfusiTahun: z.string().regex(/^(\d{4})?$/, "Tahun 4 angka").default(""),
  golonganDarah: z.enum(["", ...GOLONGAN_DARAH]).default(""),
  kantongKeadaan: z.enum(["", ...KEADAAN_KANTONG]).default(""),
  kantongKet: str(120),
  diterimaWaktu: waktuSchema,
  kantong: z
    .array(kantongRm50Schema)
    .max(MAKS_KANTONG, `Paling banyak ${MAKS_KANTONG} kantong (kapasitas formulir)`)
    .default([])
    .refine((k) => new Set(k.map((x) => x.id)).size === k.length, "Pengenal baris kantong ganda"),
});

/* ------------------------------------------- RM.70 Partograf & Catatan Persalinan */

const jamSchema = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, "Format jam HH:mm").default("");
const garisSchema = z.number().int().min(0).max(GARIS_AKHIR);
const kolomSchema = z.number().int().min(0).max(KOLOM_GRAFIK - 1);
const unik = (a: readonly unknown[]) => new Set(a).size === a.length;

/** Titik pada garis waktu; satu titik per garis, nilai dalam rentang sah lajurnya. */
const daftarTitik = (s: { sahMin: number; sahMax: number }) =>
  z
    .array(z.strictObject({ k: garisSchema, v: z.number().int().min(s.sahMin).max(s.sahMax) }))
    .max(GARIS_AKHIR + 1)
    .default([])
    .refine((a) => unik(a.map((x) => x.k)), "Satu nilai per garis waktu");

/** Isi kotak per kolom; satu isi per kotak. Kotak kosong tidak disimpan. */
const daftarSel = <V extends z.ZodType>(v: V) =>
  z
    .array(z.strictObject({ c: kolomSchema, v }))
    .max(KOLOM_GRAFIK)
    .default([])
    .refine((a) => unik(a.map((x) => x.c)), "Satu isi per kotak waktu");

const idEnum = <T extends readonly { id: string }[]>(opsi: T) =>
  z.enum(opsi.map((o) => o.id) as [T[number]["id"], ...T[number]["id"][]]);
const pilihanGanda = <T extends readonly { id: string }[]>(opsi: T) =>
  z.array(idEnum(opsi)).max(opsi.length).default([]).refine(unik, "Pilihan ganda");

const nilaiTd = z.number().int().min(SUMBU.td.sahMin).max(SUMBU.td.sahMax).nullable();

const grafikRm70Schema = z.strictObject({
  mulai: waktuSchema,
  djj: daftarTitik(SUMBU.djj),
  ketuban: daftarSel(idEnum(KETUBAN)),
  penyusupan: daftarSel(idEnum(PENYUSUPAN)),
  pembukaan: daftarTitik(SUMBU.pembukaan),
  penurunan: daftarTitik(SUMBU.penurunan),
  kontraksi: z
    .array(z.strictObject({ c: kolomSchema, n: z.number().int().min(1).max(5), d: idEnum(DURASI_KONTRAKSI) }))
    .max(KOLOM_GRAFIK)
    .default([])
    .refine((a) => unik(a.map((x) => x.c)), "Satu isi per kotak waktu"),
  ...(Object.fromEntries(DAFTAR_LAJUR_SEL.map((l) => [l, daftarSel(z.string().min(1).max(LAJUR_SEL[l].maks))])) as Record<
    LajurSel,
    ReturnType<typeof daftarSel<z.ZodString>>
  >),
  nadi: daftarTitik(SUMBU.nadi),
  td: z
    .array(
      z
        .strictObject({ k: garisSchema, s: nilaiTd, d: nilaiTd })
        .refine((t) => t.s !== null || t.d !== null, "TD tanpa nilai")
        .refine((t) => t.s === null || t.d === null || t.s > t.d, "Sistolik harus lebih tinggi dari diastolik"),
    )
    .max(GARIS_AKHIR + 1)
    .default([])
    .refine((a) => unik(a.map((x) => x.k)), "Satu nilai per garis waktu"),
  paraf: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-z0-9]{6,16}$/, "Pengenal paraf tidak valid"),
        c: kolomSchema,
        nama: str(120),
        paraf: ttdSchema,
      }),
    )
    .max(KOLOM_GRAFIK)
    .default([])
    .refine((a) => unik(a.map((x) => x.c)) && unik(a.map((x) => x.id)), "Satu paraf per kotak waktu"),
  catatan: str(240),
});

const yaTidakAlasanSchema = z.strictObject({ jawab: z.enum(["", "ya", "tidak"]).default(""), alasan: str(120) });
const angkaMaks = (digit: number, pesan: string) => z.string().regex(new RegExp(`^\\d{0,${digit}}$`), pesan).default("");

const persalinanRm70Schema = z.strictObject({
  tanggal: tanggalSchema,
  penolong: str(120),
  tempat: z.enum(["", ...TEMPAT_PERSALINAN.map((t) => t.id)] as ["", ...(typeof TEMPAT_PERSALINAN)[number]["id"][]]).default(""),
  tempatLain: str(80),
  alamat: str(160),
  kala1: z.strictObject({
    waspada: z.enum(["", "Y", "T"]).default(""),
    lain: z.boolean().default(false),
    lainKet: str(120),
    tatalaksana: str(300),
    hasil: str(200),
  }),
  kala2: z.strictObject({
    lama: angkaMaks(3, "Lama Kala II diisi menit"),
    episiotomi: z.enum(["", "ya", "tidak"]).default(""),
    indikasi: str(120),
    pendamping: pilihanGanda(PENDAMPING),
    gawatJanin: pilihanGanda(GAWAT_JANIN),
    distosia: pilihanGanda(DISTOSIA_BAHU),
    tatalaksana: str(300),
    hasil: str(200),
  }),
  kala3: z.strictObject({
    lama: angkaMaks(3, "Lama Kala III diisi menit"),
    perdarahan: angkaMaks(4, "Jumlah perdarahan diisi ml"),
    ...(Object.fromEntries(BUTIR_KALA3.map((b) => [b.id, yaTidakAlasanSchema])) as Record<IdButirKala3, typeof yaTidakAlasanSchema>),
    laserasi: z.enum(["", ...DERAJAT_LASERASI]).default(""),
    tindakan: pilihanGanda(TINDAKAN_LASERASI),
    tindakanLain: str(80),
    atonia: pilihanGanda(ATONIA_UTERI),
    lain: str(160),
    tatalaksana: str(300),
    hasil: str(200),
  }),
});

const bayiRm70Schema = z.strictObject({
  berat: angkaMaks(4, "Berat badan diisi gram"),
  panjang: z.string().regex(/^(\d{1,2}([.,]\d)?)?$/, "Panjang badan mis. 48 atau 48,5").default(""),
  jk: z.enum(["", "L", "P"]).default(""),
  apgar1: z.string().regex(/^(10|\d)?$/, "APGAR 0–10").default(""),
  apgar5: z.string().regex(/^(10|\d)?$/, "APGAR 0–10").default(""),
  asi: z.enum(["", "ya", "tidak"]).default(""),
  asiAlasan: str(120),
  kondisi: pilihanGanda(KONDISI_BAYI),
  tindakan: pilihanGanda(TINDAKAN_BAYI),
  tindakanLain: str(80),
  cacat: z.boolean().default(false),
  cacatKet: str(160),
  lain: z.boolean().default(false),
  lainKet: str(160),
  tatalaksana: str(300),
  hasil: str(200),
});

const barisKala4Schema = z.strictObject({
  pukul: jamSchema,
  td: z.string().regex(/^(\d{2,3}\/\d{2,3})?$/, "TD mis. 120/80").default(""),
  nadi: angkaMaks(3, "Nadi diisi angka"),
  suhu: z.string().regex(/^(\d{2}([.,]\d{1,2})?)?$/, "Suhu mis. 36,5").default(""),
  tfu: str(24),
  kontraksi: str(24),
  kandungKemih: str(24),
  perdarahan: angkaMaks(4, "Perdarahan diisi ml"),
});

export const rm70FormSchema = z.strictObject({
  gravida: z.string().regex(/^(\d{1,2})?$/, "G diisi angka").default(""),
  para: z.string().regex(/^(\d{1,2})?$/, "P diisi angka").default(""),
  abortus: z.string().regex(/^(\d{1,2})?$/, "A diisi angka").default(""),
  masukWaktu: waktuSchema,
  ketubanJam: jamSchema,
  mulesJam: jamSchema,
  grafik: grafikRm70Schema,
  persalinan: persalinanRm70Schema,
  bayi: bayiRm70Schema,
  kala4: z.strictObject({
    baris: z
      .array(barisKala4Schema)
      .length(BARIS_KALA4.length)
      // Kotak suhu selain awal tiap jam diarsir di kertas (suhu diukur sekali per jam).
      .refine((b) => b.every((x, i) => SUHU_KALA4.has(i) || x.suhu === ""), "Suhu Kala IV hanya pada baris pertama tiap jam"),
    masalah: str(200),
    tatalaksana: str(300),
    hasil: str(200),
  }),
  kie: z.array(z.strictObject({ tanggal: tanggalSchema, pelaksana: str(120), ket: str(120) })).length(MATERI_KIE.length),
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
