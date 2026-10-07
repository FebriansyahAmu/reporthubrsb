import { z } from "zod";
import { PATH_RE } from "@/features/form-rm/asal";
import { KODE_FORM } from "@/features/form-rm/registry";
import { AKSI_ISIAN } from "@/features/form-rm/isian.status";

/** Amplop permintaan API isian Form RM — semua strict (kunci asing → 422). */

/** NOPEN SIMGOS: deret angka. */
export const nopenSchema = z.string().regex(/^\d{6,20}$/, "NOPEN tidak valid");

/** id isian / TTD (cuid). Format salah diperlakukan sama dengan tidak ada (404). */
export const ID_RE = /^[a-z0-9]{20,32}$/;

export const buatIsianSchema = z.strictObject({
  kode: z.enum(KODE_FORM),
  nopen: nopenSchema,
});

export const simpanIsianSchema = z.strictObject({
  rev: z.number().int().min(1),
  /** Divalidasi skema form yang bersangkutan di service. */
  data: z.unknown(),
});

export const aksiIsianSchema = z
  .strictObject({
    aksi: z.enum(AKSI_ISIAN),
    rev: z.number().int().min(1),
    alasan: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.aksi === "FINALKAN" || (v.alasan?.length ?? 0) >= 5, {
    message: "Alasan wajib diisi (minimal 5 karakter)",
    path: ["alasan"],
  });

/** Terapkan nilai SIMRS terkini ke kolom terpilih (path dicek lagi terhadap registri form di service). */
export const terapkanSimrsSchema = z.strictObject({
  rev: z.number().int().min(1),
  kolom: z
    .array(z.string().max(80).regex(PATH_RE, "Path kolom tidak valid"))
    .min(1, "Pilih minimal satu kolom")
    .max(100),
});

export type BuatIsianInput = z.infer<typeof buatIsianSchema>;
export type TerapkanSimrsInput = z.infer<typeof terapkanSimrsSchema>;
export type SimpanIsianInput = z.infer<typeof simpanIsianSchema>;
export type AksiIsianInput = z.infer<typeof aksiIsianSchema>;
