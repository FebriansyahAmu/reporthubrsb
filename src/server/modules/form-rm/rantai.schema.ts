import { z } from "zod";
import { nopenSchema } from "./isian.schema";

/** Amplop API tautan episode IGD → RI (strict: kunci asing → 422). */

/** Konfirmasi petugas RI: lanjutkan isian episode IGD `nopenAkar`, atau `null` = isian terpisah. */
export const konfirmasiTautanSchema = z.strictObject({
  nopenLanjutan: nopenSchema,
  nopenAkar: nopenSchema.nullable(),
});

/** Lepas tautan oleh pengelola RM — alasan wajib (tercatat di baris tautan & audit). */
export const lepasTautanEpisodeSchema = z.strictObject({
  alasan: z.string().trim().min(10, "Alasan minimal 10 karakter").max(500),
});

export type KonfirmasiTautanInput = z.infer<typeof konfirmasiTautanSchema>;
