import { z } from "zod";

/** ID baris aplikasi (cuid / seed) — dibatasi agar tak bisa menyelundupkan apa pun. */
export const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[A-Za-z0-9_-]+$/, "ID tidak valid");

/** Batas jumlah petugas per ruangan (cukup untuk satu bangsal; mencegah muatan raksasa). */
export const MAKS_PETUGAS = 50;

/** PUT petugas ruangan: daftar lengkap akun (mengganti daftar lama). */
export const petugasPutSchema = z.strictObject({
  userIds: z.array(idSchema).max(MAKS_PETUGAS, `Maksimal ${MAKS_PETUGAS} petugas per ruangan`),
});

/** GET cari akun: teks bebas (nama / username / NIP). Kosong = 20 akun pertama. */
export const penggunaQuerySchema = z.strictObject({
  q: z.string().trim().max(60).optional().default(""),
});

/** Batas ruangan tugas per akun (64 ruangan aktif saat ini; satu PJ sampai 12). */
export const MAKS_RUANGAN_PENGGUNA = 100;

/** PUT ruangan tugas satu akun (dari Master › Pengguna): daftar lengkap, mengganti daftar lama. */
export const ruanganPenggunaPutSchema = z.strictObject({
  ruanganIds: z
    .array(idSchema)
    .max(MAKS_RUANGAN_PENGGUNA, `Maksimal ${MAKS_RUANGAN_PENGGUNA} ruangan per akun`),
});

export type PetugasPutInput = z.infer<typeof petugasPutSchema>;
export type RuanganPenggunaPutInput = z.infer<typeof ruanganPenggunaPutSchema>;
