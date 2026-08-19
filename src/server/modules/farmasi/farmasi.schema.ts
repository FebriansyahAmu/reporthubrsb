import { z } from "zod";

/**
 * Query "10 Obat Terbanyak".
 * `kategori` = daftar ID kategori dipisah koma (mis. "10101,10102"); hanya angka
 * yang diterima karena nilai ini di-inline ke SQL (LIKE prefix) di DAL — validasi
 * ketat ini mencegah injeksi.
 */
export const obatTerbanyakQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    caraBayar: z.coerce
      .number()
      .int()
      .refine((v) => v === 0 || v === 1 || v === 2, "caraBayar harus 0, 1, atau 2")
      .default(0),
    kategori: z
      .string()
      .trim()
      .regex(/^(\d{1,6})(,\d{1,6})*$/, "kategori harus daftar ID numerik dipisah koma")
      .optional(),
    metric: z.enum(["qty", "nilai"]).default("qty"),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type ObatTerbanyakQuery = z.infer<typeof obatTerbanyakQuerySchema>;

/** Pecah CSV kategori → array ID unik (maks 40, aman untuk klausa OR). */
export function parseKategoriCsv(csv: string | undefined): string[] {
  if (!csv) return [];
  const seen = new Set<string>();
  for (const raw of csv.split(",")) {
    const id = raw.trim();
    if (/^\d{1,6}$/.test(id)) seen.add(id);
    if (seen.size >= 40) break;
  }
  return [...seen];
}
