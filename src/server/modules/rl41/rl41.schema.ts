import { z } from "zod";

/**
 * Query RL 4.1. Hanya rentang tanggal (sesuai SP `LaporanRL41Revisi` yang
 * berparameter TGLAWAL, TGLAKHIR). Tanggal di-bind (`?`) di DAL → aman injeksi.
 */
export const rl41QuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type Rl41Query = z.infer<typeof rl41QuerySchema>;
