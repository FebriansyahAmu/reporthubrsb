import { z } from "zod";

/** Query daftar Form RM (pasien IGD) — rentang tanggal + filter + paginasi. */
export const formRmListQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    ruangan: z.string().trim().min(1).max(20).optional(),
    search: z.string().trim().max(60).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type FormRmListQuery = z.infer<typeof formRmListQuerySchema>;

/** Persiapan edukasi (RM.21 bagian atas). */
const persiapanSchema = z.object({
  bahasa: z.array(z.string()).default([]),
  bahasaLain: z.string().default(""),
  penerjemah: z.enum(["", "Ya", "Tidak"]).default(""),
  pendidikan: z.string().default(""),
  pendidikanLain: z.string().default(""),
  bacaTulis: z.enum(["", "Baik", "Kurang"]).default(""),
  tipePembelajaran: z.array(z.string()).default([]),
  hambatan: z.array(z.string()).default([]),
  hambatanLain: z.string().default(""),
  kesediaan: z.enum(["", "Bersedia", "Tidak Bersedia"]).default(""),
});

/** Data-URL tanda tangan (PNG). Dibatasi ~1,5 MB agar payload aman. */
const ttdSchema = z
  .string()
  .max(1_500_000, "Tanda tangan terlalu besar")
  .refine((s) => s === "" || s.startsWith("data:image/"), "Format tanda tangan tidak valid")
  .default("");

const entrySchema = z.object({
  kategori: z.string().min(1),
  aktif: z.boolean().default(false),
  edukatorNama: z.string().default(""),
  tanggalJam: z.string().default(""),
  durasiMenit: z.string().default(""),
  sasaran: z.string().default(""),
  sasaranNama: z.string().default(""),
  sasaranHubungan: z.string().default(""),
  sasaranTtd: ttdSchema,
  metode: z.array(z.string()).default([]),
  sarana: z.array(z.string()).default([]),
  saranaLain: z.string().default(""),
  pemahaman: z.array(z.string()).default([]),
  evaluasi: z.array(z.string()).default([]),
  tanggalReEdukasi: z.string().default(""),
});

export const edukasiFormSchema = z.object({
  persiapan: persiapanSchema,
  entries: z.array(entrySchema).max(20),
  catatan: z.string().default(""),
});

export const edukasiSaveSchema = z.object({
  data: edukasiFormSchema,
  header: z
    .object({
      norm: z.string().optional(),
      nama: z.string().optional(),
      ruang: z.string().optional(),
    })
    .default({}),
});

export type EdukasiSaveInput = z.infer<typeof edukasiSaveSchema>;

// --- General Consent (RM.03) ---------------------------------------------

const str = (max = 300) => z.string().max(max).default("");

export const consentFormSchema = z.object({
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

export const consentSaveSchema = z.object({
  data: consentFormSchema,
  header: z
    .object({
      norm: z.string().optional(),
      nama: z.string().optional(),
      ruang: z.string().optional(),
    })
    .default({}),
});

export type ConsentSaveInput = z.infer<typeof consentSaveSchema>;

// --- Ringkasan Masuk & Keluar (RM.01) ------------------------------------

const yaTidak = z.enum(["", "Ya", "Tidak"]).default("");
const skBarisSchema = z.object({ teks: str(200), lama: str(60) });

export const ringkasanFormSchema = z.object({
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

export const ringkasanSaveSchema = z.object({
  data: ringkasanFormSchema,
  header: z
    .object({
      norm: z.string().optional(),
      nama: z.string().optional(),
      ruang: z.string().optional(),
    })
    .default({}),
});

export type RingkasanSaveInput = z.infer<typeof ringkasanSaveSchema>;
