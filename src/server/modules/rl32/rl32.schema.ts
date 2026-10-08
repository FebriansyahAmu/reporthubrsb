import { z } from "zod";
import { RL32_MAKS_HARI } from "./rl32.constants";
import { selisihHari } from "./rl32.periode";

const TANGGAL = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD");

/** Tanggal kalender valid (tolak 2026-02-30 dll). */
const tanggalValid = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/**
 * Periode RL 3.2 (SP: TGLAWAL, TGLAKHIR): bulan, triwulan, atau rentang tanggal
 * bebas s.d. RL32_MAKS_HARI hari (satu tahun penuh muat). Tanggal di-bind (`?`)
 * di DAL → aman injeksi.
 */
export const rl32QuerySchema = z
  .object({ from: TANGGAL, to: TANGGAL })
  .refine((v) => tanggalValid(v.from) && tanggalValid(v.to), { message: "Tanggal tidak valid", path: ["from"] })
  .refine((v) => v.from <= v.to, { message: "Tanggal awal tidak boleh melebihi tanggal akhir", path: ["from"] })
  .refine((v) => selisihHari(v.from, v.to) < RL32_MAKS_HARI, {
    message: `Rentang periode maksimal ${RL32_MAKS_HARI} hari`,
    path: ["to"],
  });

export type Rl32Query = z.infer<typeof rl32QuerySchema>;

export const eksporRl32Schema = z.object({ format: z.enum(["xlsx", "pdf"]).default("xlsx") });
export type FormatEksporRl32 = z.infer<typeof eksporRl32Schema>["format"];

/** ID ruangan SIMGOS (`master.ruangan.ID`, char(10) berisi angka). */
export const RUANGAN_ID_RE = /^\d{1,10}$/;

const ID_KATEGORI = z.number().int().min(0).max(65535);

/**
 * Perubahan pemetaan.
 * - `perubahan` (ruangan): `tujuan` = ID jenis pelayanan (`master.refrl`),
 *   "kecualikan" (sengaja tidak dilaporkan), atau "kosongkan" (kembali belum
 *   dipetakan); `pisahDpjp` = kelompokkan pasien menurut SMF DPJP (hanya untuk
 *   tujuan berupa ID; tak diisi = nilai tersimpan dipertahankan).
 * - `smf`: SMF DPJP (`master.referensi` JENIS 26) → ID jenis pelayanan, atau
 *   "kosongkan" (kembali ikut jenis pelayanan ruangan).
 */
export const simpanPemetaanSchema = z
  .strictObject({
    perubahan: z
      .array(
        z.strictObject({
          ruanganId: z.string().regex(RUANGAN_ID_RE, "ID ruangan tidak valid"),
          tujuan: z.union([ID_KATEGORI, z.literal("kecualikan"), z.literal("kosongkan")]),
          pisahDpjp: z.boolean().optional(),
        }),
      )
      .max(200)
      .refine((xs) => new Set(xs.map((x) => x.ruanganId)).size === xs.length, "Ruangan ganda dalam satu permintaan")
      .default([]),
    smf: z
      .array(
        z.strictObject({
          smfId: z.number().int().min(0).max(255),
          tujuan: z.union([ID_KATEGORI, z.literal("kosongkan")]),
        }),
      )
      .max(255)
      .refine((xs) => new Set(xs.map((x) => x.smfId)).size === xs.length, "SMF ganda dalam satu permintaan")
      .default([]),
  })
  .refine((v) => v.perubahan.length + v.smf.length > 0, "Tidak ada perubahan");

export type SimpanPemetaanInput = z.infer<typeof simpanPemetaanSchema>;
export type TujuanPeta = SimpanPemetaanInput["perubahan"][number]["tujuan"];
export type TujuanSmf = SimpanPemetaanInput["smf"][number]["tujuan"];
