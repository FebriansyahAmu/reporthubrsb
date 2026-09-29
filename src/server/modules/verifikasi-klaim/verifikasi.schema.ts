import { z } from "zod";
import {
  BATAS,
  CAKUPAN_PENJAMIN,
  KATEGORI,
  STATUS_VERIFIKASI,
} from "./verifikasi.constants";
import { ATURAN_TAHAP1 } from "./verifikasi.rules";

/* ------------------------------------------------------------ util tanggal */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` + n hari (kalender, UTC — bebas zona waktu server). */
export function tambahHari(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Selisih hari kalender `b − a` (keduanya `YYYY-MM-DD…`). */
export function selisihHari(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / DAY_MS);
}

/* ------------------------------------------------------------ query antrean */

const tanggal = z.string().regex(ISO_DATE, "format tanggal harus YYYY-MM-DD");
const KODE_ATURAN = ATURAN_TAHAP1.map((a) => a.key) as [string, ...string[]];

/**
 * GET antrean verifikasi: rentang TANGGAL PULANG (inklusif, maks 31 hari) +
 * filter di memori + paginasi. `segar=1` = hitung ulang dari SIMGOS (lewati cache).
 */
export const antreanQuerySchema = z
  .object({
    from: tanggal,
    to: tanggal,
    cakupan: z.enum(CAKUPAN_PENJAMIN).default("bpjs"),
    status: z.enum(STATUS_VERIFIKASI).optional(),
    kategori: z.enum(KATEGORI).optional(),
    /** Prefiks ID ruangan SIMGOS (hierarki: 7 digit bangsal, 9 digit ruang). */
    ruangan: z.string().trim().regex(/^\d{1,9}$/, "ID ruangan tidak valid").optional(),
    /** Kunci aturan yang GAGAL (chip masalah). */
    masalah: z.enum(KODE_ATURAN).optional(),
    lengkap: z.enum(["ya", "tidak"]).optional(),
    q: z.string().trim().max(60).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(BATAS.HALAMAN_MAKS).default(25),
    segar: z.enum(["1"]).optional(),
  })
  .refine((v) => v.from <= v.to, { message: "Tanggal awal tidak boleh melebihi tanggal akhir", path: ["from"] })
  .refine((v) => selisihHari(v.from, v.to) < BATAS.RENTANG_MAKS_HARI, {
    message: `Rentang maksimal ${BATAS.RENTANG_MAKS_HARI} hari`,
    path: ["to"],
  });

export type AntreanQuery = z.infer<typeof antreanQuerySchema>;

/** NOPEN SIMGOS: 10 digit (char). Longgar sedikit untuk format lama. */
export const nopenSchema = z.string().trim().regex(/^\d{6,20}$/, "NOPEN tidak valid");
