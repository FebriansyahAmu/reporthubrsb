import { z } from "zod";

/**
 * Validasi input boundary untuk modul resume-medis.
 * `id` = NOPEN (nomor pendaftaran) saat terhubung SIMGOS, atau id data simulasi.
 */
export const resumeMedisParamSchema = z.object({
  id: z.string().trim().min(1, "id wajib diisi").max(64),
});

export type ResumeMedisParam = z.infer<typeof resumeMedisParamSchema>;
