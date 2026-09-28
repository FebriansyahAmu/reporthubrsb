import { z } from "zod";
import { JENIS_KUNJUNGAN_IDS, SUMBER_KEYS } from "./kunjungan.constants";

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

/** Filter lokasi bersama papan kunjungan & kepatuhan petugas. */
const lokasiFilter = {
  /** `master.ruangan.JENIS_KUNJUNGAN`. */
  jenis: z.preprocess(
    blankToUndef,
    z.coerce
      .number()
      .int()
      .refine((n) => JENIS_KUNJUNGAN_IDS.includes(n), "Jenis kunjungan tidak dikenal")
      .optional(),
  ),
  /** Kelompok jenis (mis. KLINIS = RJ/IGD/RI). Diabaikan bila `jenis` diisi. */
  kelompok: z.preprocess(blankToUndef, z.enum(["KLINIS"]).optional()),
  /** Prefiks ID ruangan: 7 digit = bangsal/grup, 9 digit = ruang. */
  ruangan: z.preprocess(blankToUndef, z.string().regex(/^\d{7}(\d{2})?$/, "ID ruangan tidak valid").optional()),
};

export const kunjunganQuerySchema = z.object({
  ...baseFilter,
  ...lokasiFilter,
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(6).max(48).default(24),
});
export type KunjunganQuery = z.infer<typeof kunjunganQuerySchema>;

/** Kepatuhan petugas (K3): rentang hari dinas + lokasi input. */
export const petugasQuerySchema = z.object({
  from: baseFilter.from,
  to: baseFilter.to,
  ...lokasiFilter,
});
export type PetugasQuery = z.infer<typeof petugasQuerySchema>;

/** `aplikasi.pengguna.ID` (smallint). */
export const petugasIdSchema = z.string().regex(/^\d{1,6}$/, "ID petugas tidak valid");

export const ruanganTreeQuerySchema = z.object(baseFilter);
export type RuanganTreeQuery = z.infer<typeof ruanganTreeQuerySchema>;

/** `pendaftaran.kunjungan.NOMOR` (char 19, angka). */
export const nomorKunjunganSchema = z.string().regex(/^\d{10,19}$/, "Nomor kunjungan tidak valid");

/** Satu record aktual: sumber (allow-list) + ID (angka). */
export const rekamParamSchema = z.object({
  sumber: z.enum(SUMBER_KEYS),
  id: z.string().regex(/^\d{1,20}$/, "ID record tidak valid"),
});
