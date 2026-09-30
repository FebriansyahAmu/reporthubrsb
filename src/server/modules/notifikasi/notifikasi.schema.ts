import { z } from "zod";
import { BATAS_NOTIFIKASI } from "./notifikasi.constants";

const idNotifikasi = z.string().trim().regex(/^[a-z0-9]{10,30}$/i, "ID notifikasi tidak valid");

export const daftarNotifikasiSchema = z.object({
  limit: z.coerce.number().int().min(1).max(BATAS_NOTIFIKASI.DAFTAR_MAKS).default(BATAS_NOTIFIKASI.DAFTAR_DEFAULT),
});

/** `{ ids: [...] }` untuk notifikasi tertentu, atau `{ semua: true }`. */
export const bacaNotifikasiSchema = z.union([
  z.object({ ids: z.array(idNotifikasi).min(1).max(BATAS_NOTIFIKASI.BACA_MAKS) }).strict(),
  z.object({ semua: z.literal(true) }).strict(),
]);

export type BacaNotifikasiInput = z.infer<typeof bacaNotifikasiSchema>;
