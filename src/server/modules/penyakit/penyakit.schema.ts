import { z } from "zod";

/**
 * Query "10 Penyakit Terbanyak".
 * Semua nilai selain tanggal adalah enum/angka tervalidasi; tanggal di-bind (`?`)
 * di DAL. Tak ada nilai bebas yang di-inline ke SQL → aman dari injeksi.
 */
export const penyakitQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    jenis: z.coerce
      .number()
      .int()
      .refine((v) => v === 1 || v === 2 || v === 3, "jenis harus 1 (RJ), 2 (GD), atau 3 (RI)")
      .default(3),
    caraBayar: z.coerce
      .number()
      .int()
      .refine((v) => v === 0 || v === 1 || v === 2, "caraBayar harus 0, 1, atau 2")
      .default(0),
    utama: z
      .enum(["0", "1", "true", "false"])
      .default("1")
      .transform((v) => v === "1" || v === "true"),
    metric: z.enum(["kasus", "pasien"]).default("kasus"),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type PenyakitQuery = z.infer<typeof penyakitQuerySchema>;
