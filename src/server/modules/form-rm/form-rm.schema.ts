import { z } from "zod";
import {
  consentFormSchema,
  edukasiFormSchema,
  ringkasanFormSchema,
  triaseFormSchema,
} from "@/features/form-rm/skema";

/** Query daftar Form RM (pasien IGD) — rentang tanggal + filter + paginasi. */
export const formRmListQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    ruangan: z.string().trim().min(1).max(20).optional(),
    search: z.string().trim().max(60).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type FormRmListQuery = z.infer<typeof formRmListQuerySchema>;

/*
 * Amplop simpan rute lama `/api/form-rm/<jenis>/<nopen>` (dipakai UI sampai
 * Langkah 2 / cutover ke isian). Data divalidasi skema strict bersama.
 */
const headerLama = z
  .object({
    norm: z.string().optional(),
    nama: z.string().optional(),
    ruang: z.string().optional(),
  })
  .default({});

export const edukasiSaveSchema = z.object({ data: edukasiFormSchema, header: headerLama });
export const consentSaveSchema = z.object({ data: consentFormSchema, header: headerLama });
export const ringkasanSaveSchema = z.object({ data: ringkasanFormSchema, header: headerLama });
export const triaseSaveSchema = z.object({ data: triaseFormSchema, header: headerLama });
