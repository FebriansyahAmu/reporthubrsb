import { z } from "zod";

/** Query kunjungan pelayanan: rentang tanggal (wajib) + filter + paginasi. */
export const kunjunganPelayananQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    ruangan: z.string().trim().min(1).max(20).optional(),
    kategori: z.enum(["Rawat Inap", "Rawat Jalan Klinik", "IGD"]).optional(),
    search: z.string().trim().max(60).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(60).default(12),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type KunjunganPelayananQuery = z.infer<typeof kunjunganPelayananQuerySchema>;

/** Query "Belum Difinalkan": filter kategori/bucket/ruangan/cari + paginasi. */
export const belumFinalQuerySchema = z.object({
  ruangan: z.string().trim().min(1).max(20).optional(),
  kategori: z.enum(["Rawat Inap", "Rawat Jalan Klinik", "IGD"]).optional(),
  bucket: z.enum(["b1", "b2", "b3", "b4"]).optional(),
  search: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(12),
});

export type BelumFinalQuery = z.infer<typeof belumFinalQuerySchema>;

/** Query "Kelengkapan Diagnosa": rentang + filter kategori/status/ruangan/cari. */
export const diagnosaQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    ruangan: z.string().trim().min(1).max(20).optional(),
    kategori: z.enum(["Rawat Inap", "Rawat Jalan Klinik", "IGD"]).optional(),
    status: z.enum(["TANPA_DX", "TANPA_ICD", "TANPA_UTAMA", "LENGKAP"]).optional(),
    search: z.string().trim().max(60).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(60).default(12),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type DiagnosaQuery = z.infer<typeof diagnosaQuerySchema>;

/** Query "Kelengkapan Resume": rentang + filter kategori/status/ruangan/cari. */
export const resumeQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    ruangan: z.string().trim().min(1).max(20).optional(),
    kategori: z.enum(["Rawat Inap", "Rawat Jalan Klinik", "IGD"]).optional(),
    status: z.enum(["TANPA_RESUME", "RESUME_MINIM", "LENGKAP"]).optional(),
    search: z.string().trim().max(60).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(60).default(12),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type ResumeQuery = z.infer<typeof resumeQuerySchema>;
