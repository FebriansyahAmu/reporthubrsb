import { z } from "zod";

/** Skema Katalog Item (inv_item) — kelola jenis barang. */

const optStr = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );
const optId = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(40).optional(),
);

export const katalogUpdateSchema = z.object({
  nama: z.string().trim().min(1, "Nama item wajib diisi").max(191),
  kategoriId: optId,
  satuanId: optId,
  spesifikasi: optStr(2000),
  aktif: z.boolean().default(true),
});
export type KatalogUpdateInput = z.infer<typeof katalogUpdateSchema>;

export const katalogQuerySchema = z.object({
  search: optStr(120),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type KatalogQuery = z.infer<typeof katalogQuerySchema>;
