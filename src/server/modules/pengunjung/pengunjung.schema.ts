import { z } from "zod";

/**
 * Query "Laporan Pengunjung Per Pasien".
 * Nilai selain tanggal berupa enum/angka tervalidasi; `ruangan` dibatasi digit
 * saja (di-inline sebagai prefix LIKE di DAL → validasi ini mencegah injeksi).
 */
export const pengunjungQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    jenis: z.coerce
      .number()
      .int()
      .refine((v) => v === 1 || v === 2 || v === 3, "jenis harus 1 (RJ), 2 (IGD), atau 3 (RI)")
      .default(2),
    ruangan: z
      .string()
      .trim()
      .regex(/^\d{0,12}$/, "ruangan harus digit")
      .optional()
      .default(""),
    caraBayar: z.coerce
      .number()
      .int()
      .refine((v) => v === 0 || v === 1 || v === 2, "caraBayar harus 0, 1, atau 2")
      .default(0),
    tindak: z.enum(["all", "rajal", "ranap"]).default("all"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type PengunjungQuery = z.infer<typeof pengunjungQuerySchema>;

/** Query khusus export (tanpa paginasi — batas baris di service). */
export const pengunjungExportQuerySchema = pengunjungQuerySchema;
