import { z } from "zod";

/** Data-URL PNG base64 (TTD dari HP); isinya dinormalkan server (`normalkanPng`). */
const PNG_PREFIX = "data:image/png;base64,";
const signaturePayload = z
  .string()
  .max(700_000, "Tanda tangan terlalu besar")
  .refine((s) => s.startsWith(PNG_PREFIX) && /^[A-Za-z0-9+/]+={0,2}$/.test(s.slice(PNG_PREFIX.length)), {
    message: "Tanda tangan harus berupa gambar PNG",
  });

/** Body pembuatan sesi TTD jarak jauh (PC → HP). Kolom asing → 422. */
export const signCreateSchema = z.strictObject({
  label: z.string().trim().min(1).max(120),
  context: z.string().trim().max(200).default(""),
});

/** Body pengiriman TTD dari HP. Kolom asing → 422. */
export const signSubmitSchema = z.strictObject({
  payload: signaturePayload,
});

/** Batas body: buat sesi (label + konteks) & kirim TTD dari HP (dibaca bertahap sebelum di-parse). */
export const BATAS_BODY_SIGN = { buat: 4 * 1024, kirim: 512 * 1024 } as const;

export type SignCreateInput = z.infer<typeof signCreateSchema>;
