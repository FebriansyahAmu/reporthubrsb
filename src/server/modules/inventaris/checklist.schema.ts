import { z } from "zod";

/**
 * Checklist Pemeliharaan Berkala PER BARANG (per ruangan).
 * Isi checklist = daftar unit barang di ruangan (dari Master Barang). Tiap barang
 * dicentang (diperiksa) + input Kondisi. Run = pelaksanaan (ruangan × frekuensi × periode).
 */

/* ------------------------------------------------------------------- konstanta */

export const FREKUENSI = ["HARIAN", "MINGGUAN", "BULANAN"] as const;
export type Frekuensi = (typeof FREKUENSI)[number];
export const FREKUENSI_LABEL: Record<Frekuensi, string> = {
  HARIAN: "Harian",
  MINGGUAN: "Mingguan",
  BULANAN: "Bulanan",
};
/** Warna badge per frekuensi (token Cord). */
export const FREKUENSI_TONE: Record<Frekuensi, "brand" | "accent" | "warning"> = {
  HARIAN: "brand",
  MINGGUAN: "accent",
  BULANAN: "warning",
};
export function isFrekuensi(v: unknown): v is Frekuensi {
  return typeof v === "string" && (FREKUENSI as readonly string[]).includes(v);
}

/* --------------------------------------------------------------- helper zod */

const optId = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(40).optional(),
);
const optText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );

/* ------------------------------------------------------------------- schema */

/** Overview: daftar barang satu ruangan pada satu frekuensi (periode berjalan). */
export const overviewQuerySchema = z.object({
  ruanganId: z.string().trim().min(1, "Ruangan wajib dipilih"),
  frekuensi: z.enum(FREKUENSI).default("HARIAN"),
});
export type OverviewQuery = z.infer<typeof overviewQuerySchema>;

/** Centang/ubah pemeriksaan satu barang pada periode berjalan. */
export const periksaSchema = z.object({
  ruanganId: z.string().trim().min(1),
  frekuensi: z.enum(FREKUENSI),
  barangId: z.string().trim().min(1),
  checked: z.coerce.boolean(),
  kondisiId: optId,
  catatan: optText(1000),
});
export type PeriksaInput = z.infer<typeof periksaSchema>;

/** Tandai seluruh ruangan selesai / batalkan pada periode berjalan. */
export const completeSchema = z.object({
  ruanganId: z.string().trim().min(1),
  frekuensi: z.enum(FREKUENSI),
  selesai: z.coerce.boolean(),
  catatan: optText(2000),
});
export type CompleteInput = z.infer<typeof completeSchema>;
