import { z } from "zod";

/**
 * Input Berita Acara Serah Terima Barang (BAST). Semua field boleh diedit di UI;
 * builder PDF memberi nilai default bila kosong. Dikirim sbg query JSON (`bast`).
 */

const trimStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max).optional());

export const bastPihakSchema = z.object({
  nama: trimStr(120),
  nip: trimStr(60),
  jabatan: trimStr(120),
});
export type BastPihakInput = z.infer<typeof bastPihakSchema>;

export const bastInputSchema = z.object({
  nomor: trimStr(120),
  /** ISO YYYY-MM-DD (tanggal serah terima). */
  tanggal: z.preprocess(
    (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : undefined),
    z.string().optional(),
  ),
  pihak1: bastPihakSchema.optional(),
  pihak2: bastPihakSchema.optional(),
  direktur: bastPihakSchema.optional(),
});
export type BastInput = z.infer<typeof bastInputSchema>;

/** Parse aman param query `bast` (JSON) → input BAST, atau undefined (pakai default). */
export function parseBastParam(raw: string | null): BastInput | undefined {
  if (!raw) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const parsed = bastInputSchema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}
