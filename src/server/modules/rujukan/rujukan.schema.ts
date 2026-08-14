import { z } from "zod";

/** Query daftar Rujukan Keluar — rentang tanggal + jenis + cari + paginasi. */
export const rujukanKeluarQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD").optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD").optional(),
    jnsPelayanan: z.coerce
      .number()
      .int()
      .refine((v) => v === 1 || v === 2, "jnsPelayanan harus 1 (RI) atau 2 (RJ)")
      .optional(),
    search: z.string().trim().max(60).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type RujukanKeluarQuery = z.infer<typeof rujukanKeluarQuerySchema>;
