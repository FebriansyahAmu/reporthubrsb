import { z } from "zod";
import { MIN_CARI, tafsirCari } from "@/features/form-rm/cari";

/** ID ruangan SIMGOS (`master.ruangan.ID`, deret angka). */
const ruanganSchema = z.string().trim().regex(/^\d{1,10}$/, "ruangan tidak valid");

/** Query daftar per pasien — rentang tanggal + filter + paginasi. */
export const formRmListQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
    ruangan: ruanganSchema.optional(),
    /** Disaring lagi ke jenis sasaran form yang boleh dilihat (service). */
    jenis: z.coerce.number().int().pipe(z.union([z.literal(1), z.literal(2), z.literal(3)])).optional(),
    search: z.string().trim().max(60).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type FormRmListQuery = z.infer<typeof formRmListQuerySchema>;

/** Query pemilih pasien satu form (`GET /api/form-rm/f/[kode]/pasien`) — strict. */
export const pasienFormQuerySchema = z.strictObject({
  q: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => v === undefined || tafsirCari(v) !== null, {
      message: `Cari dengan No.RM, NIK, atau NOPEN (angka), atau nama (huruf), minimal ${MIN_CARI} karakter`,
    }),
  ruangan: ruanganSchema.optional(),
  status: z.enum(["KOSONG", "DRAF", "FINAL"]).optional(),
  halaman: z.coerce.number().int().min(1).max(1000).default(1),
});

export type PasienFormQuery = z.infer<typeof pasienFormQuerySchema>;
