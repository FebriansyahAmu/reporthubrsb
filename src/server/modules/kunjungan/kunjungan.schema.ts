import { z } from "zod";

/** Query daftar kunjungan: rentang tanggal (wajib) + ruangan (opsional). */
export const kunjunganQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    ruangan: z.string().trim().min(1).max(20).optional(),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type KunjunganQuery = z.infer<typeof kunjunganQuerySchema>;
