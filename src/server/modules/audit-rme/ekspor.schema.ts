import { z } from "zod";
import { logQuerySchema } from "./audit.schema";
import { FORMAT_EKSPOR } from "./ekspor.constants";
import {
  kunjunganFilterSchema,
  nomorKunjunganSchema,
  petaQuerySchema,
  petugasIdSchema,
  petugasQuerySchema,
} from "./kunjungan.schema";

/**
 * Query ekspor (K5): `laporan` memilih skema filter yang SAMA dengan endpoint
 * layar sumbernya — ekspor tidak punya filter sendiri, jadi tak bisa menyimpang.
 */

const format = { format: z.enum(FORMAT_EKSPOR).default("xlsx") };

export const eksporQuerySchema = z.discriminatedUnion("laporan", [
  petugasQuerySchema.extend({ laporan: z.literal("petugas"), ...format }),
  petugasQuerySchema.extend({ laporan: z.literal("profil"), id: petugasIdSchema, ...format }),
  petaQuerySchema.extend({ laporan: z.literal("ruangan"), ...format }),
  kunjunganFilterSchema.extend({ laporan: z.literal("kunjungan"), ...format }),
  z.object({ laporan: z.literal("jejak"), nomor: nomorKunjunganSchema, ...format }),
  logQuerySchema.omit({ page: true, pageSize: true }).extend({ laporan: z.literal("log"), ...format }),
]);
export type EksporQuery = z.infer<typeof eksporQuerySchema>;

export const riwayatEksporQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
