import { z } from "zod";

/**
 * Skema Pengaturan Inventaris (5 entitas referensi). Dipakai API route untuk
 * memvalidasi input; entity dipilih dari path param.
 */

export const REF_ENTITIES = ["satuan", "kondisi", "sumber-anggaran", "kategori", "ruangan"] as const;
export type RefEntity = (typeof REF_ENTITIES)[number];

export function isRefEntity(v: string): v is RefEntity {
  return (REF_ENTITIES as readonly string[]).includes(v);
}

/** Tone badge yang diizinkan untuk kondisi (selaras token desain). */
export const KONDISI_TONES = ["success", "warning", "danger", "brand", "accent", "neutral"] as const;

const aktif = z.boolean().default(true);
const urutan = z.coerce.number().int().min(0).max(9999).default(0);
const optStr = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const satuanSchema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi").max(40),
  aktif,
  urutan,
});

export const kondisiSchema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi").max(60),
  kode: z.string().trim().min(1, "Kode wajib diisi").max(10),
  tone: z.enum(KONDISI_TONES).default("neutral"),
  aktif,
  urutan,
});

export const sumberAnggaranSchema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi").max(80),
  singkatan: z.string().trim().min(1, "Singkatan wajib diisi").max(20),
  aktif,
  urutan,
});

export const kategoriSchema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi").max(80),
  kode: optStr(20),
  aktif,
  urutan,
});

export const ruanganSchema = z.object({
  kodePrefix: z
    .string()
    .trim()
    .min(1, "Kode prefix wajib diisi")
    .max(15)
    .regex(/^[A-Za-z0-9.\-]+$/, "Prefix hanya huruf/angka/titik/strip"),
  nama: z.string().trim().min(1, "Nama wajib diisi").max(120),
  pjNama: optStr(120),
  pjNip: optStr(30),
  aktif,
  urutan,
});

export const REF_SCHEMA = {
  satuan: satuanSchema,
  kondisi: kondisiSchema,
  "sumber-anggaran": sumberAnggaranSchema,
  kategori: kategoriSchema,
  ruangan: ruanganSchema,
} as const;

/** Bentuk gabungan input referensi (field opsional per entitas). */
export type RefInput = {
  nama?: string;
  kode?: string;
  tone?: (typeof KONDISI_TONES)[number];
  singkatan?: string;
  kodePrefix?: string;
  pjNama?: string;
  pjNip?: string;
  aktif: boolean;
  urutan: number;
};
