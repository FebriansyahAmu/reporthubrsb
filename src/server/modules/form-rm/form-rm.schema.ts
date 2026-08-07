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
