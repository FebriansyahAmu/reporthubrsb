import { z } from "zod";

/** Satu baris tindakan pada form Bukti Pelayanan. */
export const buktiTindakanRowSchema = z.object({
  tanggal: z.string().max(40).default(""),
  nama: z.string().trim().max(300).default(""),
  pelaksana: z.string().trim().max(150).default(""),
  keterangan: z.string().trim().max(300).default(""),
});

/** Isi form Bukti Pelayanan yang disimpan ke DB reporthub. */
export const buktiPelayananFormSchema = z.object({
  tanggalPelayanan: z.string().max(40).default(""),
  dpjp: z.string().trim().max(150).default(""),
  penjamin: z.string().trim().max(50).default(""),
  noSep: z.string().trim().max(50).default(""),
  catatan: z.string().trim().max(2000).default(""),
  tindakan: z.array(buktiTindakanRowSchema).max(200).default([]),
});

/** Body POST: form + header pasien (untuk kolom ringkas di tabel). */
export const buktiPelayananSaveSchema = z.object({
  data: buktiPelayananFormSchema,
  header: z
    .object({
      norm: z.string().max(30).optional(),
      nama: z.string().max(150).optional(),
      kategori: z.string().max(40).optional(),
      ruang: z.string().max(150).optional(),
    })
    .default({}),
});

export type BuktiPelayananSaveInput = z.infer<typeof buktiPelayananSaveSchema>;
