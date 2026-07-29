import { z } from "zod";

/** Query daftar Berkas Klaim RM: rentang tanggal (wajib) + filter + paginasi. */
export const berkasKlaimQuerySchema = z
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

export type BerkasKlaimQuery = z.infer<typeof berkasKlaimQuerySchema>;
