import { z } from "zod";
import { JENIS_KUNJUNGAN_IDS } from "./kunjungan.constants";

/**
 * Skema query papan kunjungan (Fase 2). Semua nilai di-bind sebagai parameter
 * (`?`) di DAL; di sini hanya validasi bentuk & batas.
 */

const blankToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus YYYY-MM-DD");
const flag = z.preprocess(
  (v) => (v === "1" || v === "true" ? true : v === "0" || v === "false" ? false : blankToUndef(v)),
  z.boolean().optional(),
);

/** Filter bersama papan kunjungan & pohon ruangan. */
const baseFilter = {
  from: z.preprocess(blankToUndef, isoDate.optional()),
  to: z.preprocess(blankToUndef, isoDate.optional()),
  /** Hanya kunjungan yang sedang dilayani (`kunjungan.STATUS = 1`). */
  aktif: flag,
  /** Sertakan kunjungan/pendaftaran batal (STATUS 0). Default: disembunyikan. */
  batal: flag,
  /** Cari nama pasien (mengandung) atau No. RM (persis, angka). */
  q: z.preprocess(blankToUndef, z.string().trim().min(2).max(60).optional()),
};

export const kunjunganQuerySchema = z.object({
  ...baseFilter,
  /** `master.ruangan.JENIS_KUNJUNGAN`. */
  jenis: z.preprocess(
    blankToUndef,
    z.coerce
      .number()
      .int()
      .refine((n) => JENIS_KUNJUNGAN_IDS.includes(n), "Jenis kunjungan tidak dikenal")
      .optional(),
  ),
  /** Prefiks ID ruangan: 7 digit = bangsal/grup, 9 digit = ruang. */
  ruangan: z.preprocess(blankToUndef, z.string().regex(/^\d{7}(\d{2})?$/, "ID ruangan tidak valid").optional()),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(6).max(48).default(24),
});
export type KunjunganQuery = z.infer<typeof kunjunganQuerySchema>;

export const ruanganTreeQuerySchema = z.object(baseFilter);
export type RuanganTreeQuery = z.infer<typeof ruanganTreeQuerySchema>;
