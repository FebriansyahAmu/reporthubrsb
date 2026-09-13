import { z } from "zod";
import { INSTALASI } from "./ruangan-pejabat.types";

/** TTD: PNG data-URL (atau string kosong). Dibatasi ±2 MB agar aman di kolom JSON. */
const ttdSchema = z
  .string()
  .trim()
  .max(2_000_000)
  .refine((v) => v === "" || v.startsWith("data:image/"), "TTD harus data-URL gambar")
  .optional();

/** Satu pejabat (nama + NIP + TTD). Semua opsional (boleh kosong = belum diisi). */
export const pejabatSchema = z.object({
  nama: z.string().trim().max(150).default(""),
  nip: z.string().trim().max(40).default(""),
  ttd: ttdSchema,
});

/** Isi jabatan yang boleh disimpan untuk satu entitas (ruangan/instalasi). */
export const pejabatDataSchema = z.object({
  kepalaInstalasi: pejabatSchema.optional(),
  kepalaRuangan: pejabatSchema.optional(),
  ketuaTim: pejabatSchema.optional(),
});

/** Body POST simpan pejabat satu ruangan/instalasi. */
export const saveRuanganPejabatSchema = z.object({
  nama: z.string().trim().max(191).optional(),
  kategori: z.string().trim().max(191).optional(),
  data: pejabatDataSchema,
});

export type SaveRuanganPejabatInput = z.infer<typeof saveRuanganPejabatSchema>;

/** Kategori instalasi yang valid (dari katalog INSTALASI). */
const KATEGORI_VALUES = INSTALASI.map((i) => i.kategori) as [string, ...string[]];

/**
 * Body POST "terapkan Kepala Ruangan ke semua ruangan satu instalasi".
 * `pejabat` null → mengosongkan Kepala Ruangan di semua ruangan kategori tsb.
 */
export const applyKepalaRuanganSchema = z.object({
  kategori: z.enum(KATEGORI_VALUES),
  pejabat: pejabatSchema.nullable(),
});

export type ApplyKepalaRuanganInput = z.infer<typeof applyKepalaRuanganSchema>;
