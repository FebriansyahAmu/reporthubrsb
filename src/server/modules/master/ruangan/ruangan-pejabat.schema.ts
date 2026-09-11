import { z } from "zod";

/** Satu pejabat (nama + NIP). Keduanya opsional (boleh kosong = belum diisi). */
export const pejabatSchema = z.object({
  nama: z.string().trim().max(150).default(""),
  nip: z.string().trim().max(40).default(""),
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
