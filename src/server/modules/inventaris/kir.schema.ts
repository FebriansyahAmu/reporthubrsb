import { z } from "zod";

/** Satu kolom penanda tangan KIR (jabatan/caption bisa multi-baris via "\n"). */
export const kirSignatorySchema = z.object({
  caption: z.string().trim().max(160).default(""),
  name: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(120).optional(),
  ),
  nip: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().max(60).optional(),
  ),
});
export type KirSignatoryInput = z.infer<typeof kirSignatorySchema>;

/** Blok tanda tangan lengkap: tempat + 1–3 kolom. */
export const kirSignBlockSchema = z.object({
  place: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(80).optional(),
  ),
  columns: z.array(kirSignatorySchema).min(1).max(3),
});
export type KirSignBlockInput = z.infer<typeof kirSignBlockSchema>;

/** Parse aman param query `sig` (JSON) → blok tanda tangan, atau undefined (pakai default). */
export function parseSignBlockParam(raw: string | null): KirSignBlockInput | undefined {
  if (!raw) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const parsed = kirSignBlockSchema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}
