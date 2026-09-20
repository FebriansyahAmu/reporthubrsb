import { z } from "zod";

/**
 * Query RL 5.1. Hanya rentang tanggal (sesuai SP `LaporanRL51Revisi`:
 * TGLAWAL, TGLAKHIR). Tanggal di-bind (`?`) di DAL → aman injeksi.
 */
export const rl51QuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    /** Filter kelompok penyakit: semua / hanya menular / non-menular. */
    menular: z.enum(["all", "menular", "non"]).default("all"),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type Rl51Query = z.infer<typeof rl51QuerySchema>;
