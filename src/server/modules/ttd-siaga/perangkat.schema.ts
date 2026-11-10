import { z } from "zod";

/**
 * Skema masukan pengelola perangkat TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md
 * §7.4). `strictObject`: kolom tak dikenal (mis. `aktif`, `tokenHash`) → 422,
 * sehingga tak ada mass assignment (OWASP API3). Tanpa `server-only` agar
 * teruji unit.
 */

/** ID cuid Prisma; format lain diperlakukan sama dengan "tidak ada" (404). */
export const PERANGKAT_ID_RE = /^[a-z0-9]{20,32}$/;

/**
 * Nama tampilan perangkat: huruf/angka di awal, lalu huruf, angka, spasi, dan
 * `. _ ( ) # / -`. Tanpa baris baru/kontrol/kurung sudut. Spasi beruntun
 * dirapatkan. Panjang divalidasi di sini karena sql_mode reporthub non-strict
 * (kelebihan panjang akan dipotong diam-diam oleh DB).
 */
const NAMA_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._()#/-]*$/u;

export const namaPerangkatSchema = z
  .string()
  .trim()
  .min(3, "Nama minimal 3 karakter")
  .max(80, "Nama maksimal 80 karakter")
  .regex(NAMA_RE, "Nama hanya boleh berisi huruf, angka, spasi, dan . _ ( ) # / -")
  .transform((s) => s.replace(/ {2,}/g, " "));

/** `master.ruangan.ID` SIMGOS untuk ruangan pelayanan (9 digit). */
export const ruanganIdSchema = z.string().regex(/^\d{9}$/, "Ruangan tidak valid");

export const buatPerangkatSchema = z.strictObject({
  nama: namaPerangkatSchema,
  ruanganId: ruanganIdSchema.nullable().optional(),
});

export const ubahPerangkatSchema = z
  .strictObject({
    nama: namaPerangkatSchema.optional(),
    ruanganId: ruanganIdSchema.nullable().optional(),
  })
  .refine((v) => v.nama !== undefined || v.ruanganId !== undefined, { message: "Tidak ada perubahan" });

/** Body `POST /api/ttd-siaga/pasang` (tablet, publik). Isi kode dinilai `normalkanKode`. */
export const pasangSchema = z.strictObject({ kode: z.string().max(32) });

export type BuatPerangkatInput = z.infer<typeof buatPerangkatSchema>;
export type UbahPerangkatInput = z.infer<typeof ubahPerangkatSchema>;
