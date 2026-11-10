import { z } from "zod";
import { PERANGKAT_ID_RE } from "./perangkat.schema";

/**
 * Skema masukan permintaan TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md §7.4).
 * `strictObject` di semua body: kolom asing (mis. `userId`, `status`) → 422.
 * Tanpa `server-only` agar teruji unit.
 */

/** ID permintaan: 128 bit acak base64url (22 karakter). */
export const PERMINTAAN_ID_RE = /^[A-Za-z0-9_-]{22}$/;

/** ID isian Form RM (cuid) — sama dengan `isian.schema.ts`. */
const ISIAN_ID_RE = /^[a-z0-9]{20,32}$/;

/**
 * Label slot TTD (mis. "Tanda tangan yang menyatakan", "Paraf 10:30") — hanya
 * untuk jejak audit. Label di Form RM statis (tanpa nama pasien); karakternya
 * tetap dibatasi.
 */
export const slotSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} .,:/()+-]*$/u, "Label slot tidak valid");

export const mintaTtdSchema = z.strictObject({
  perangkatId: z.string().regex(PERANGKAT_ID_RE, "Perangkat tidak valid"),
  isianId: z.string().regex(ISIAN_ID_RE, "Isian tidak valid"),
  slot: slotSchema,
});

export const TTD_PNG_PREFIX = "data:image/png;base64,";

/** Body kirim TTD dari tablet: satu PNG data-URL base64 (dinormalkan server). */
export const kirimTtdSchema = z.strictObject({
  png: z
    .string()
    .max(700_000)
    .refine((s) => s.startsWith(TTD_PNG_PREFIX) && /^[A-Za-z0-9+/]+={0,2}$/.test(s.slice(TTD_PNG_PREFIX.length)), {
      message: "Tanda tangan harus berupa gambar PNG",
    }),
});

export type MintaTtdInput = z.infer<typeof mintaTtdSchema>;
