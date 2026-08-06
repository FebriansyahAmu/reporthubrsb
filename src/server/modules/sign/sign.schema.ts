import { z } from "zod";

/** Data-URL PNG tanda tangan, dibatasi ~1,5 MB (sama dgn ttdSchema form RM). */
const signaturePayload = z
  .string()
  .max(1_500_000, "Tanda tangan terlalu besar")
  .refine((s) => s.startsWith("data:image/"), "Format tanda tangan tidak valid");

/** Body pembuatan sesi TTD jarak jauh (PC → HP). */
export const signCreateSchema = z.object({
  label: z.string().trim().min(1).max(120),
  context: z.string().trim().max(200).default(""),
});

/** Body pengiriman TTD dari HP. */
export const signSubmitSchema = z.object({
  payload: signaturePayload,
});

export type SignCreateInput = z.infer<typeof signCreateSchema>;
