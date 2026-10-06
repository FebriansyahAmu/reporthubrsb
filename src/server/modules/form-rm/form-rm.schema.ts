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
