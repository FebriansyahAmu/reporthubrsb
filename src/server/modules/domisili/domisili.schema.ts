import { z } from "zod";
import { selisihHari } from "@/server/modules/rl32/rl32.periode";
import { DOMISILI_MAKS_HARI } from "./domisili.constants";

const TANGGAL = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD");

/** Tanggal kalender valid (tolak 2026-02-30 dll). */
const tanggalValid = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/**
 * Periode laporan: hanya dua tanggal, di-bind (`?`) di DAL → aman injeksi.
 * Rentang dibatasi {@link DOMISILI_MAKS_HARI} hari agar satu permintaan tak
 * memindai bertahun-tahun data kunjungan.
 */
export const domisiliQuerySchema = z
  .object({ from: TANGGAL, to: TANGGAL })
  .refine((v) => tanggalValid(v.from) && tanggalValid(v.to), { message: "Tanggal tidak valid", path: ["from"] })
  .refine((v) => v.from <= v.to, { message: "Tanggal awal tidak boleh melebihi tanggal akhir", path: ["from"] })
  .refine((v) => selisihHari(v.from, v.to) < DOMISILI_MAKS_HARI, {
    message: `Rentang periode maksimal ${DOMISILI_MAKS_HARI} hari`,
    path: ["to"],
  });

export type DomisiliQuery = z.infer<typeof domisiliQuerySchema>;
