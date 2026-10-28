import { z } from "zod";
import { selisihHari } from "@/server/modules/rl32/rl32.periode";
import { RL35_MAKS_HARI } from "./rl35.constants";

const TANGGAL = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD");

/** Tanggal kalender valid (tolak 2026-02-30 dll). */
const tanggalValid = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/**
 * Periode RL 3.5 (SP: TGLAWAL, TGLAKHIR): bulan, triwulan, atau rentang tanggal
 * bebas s.d. RL35_MAKS_HARI hari. Tanggal di-bind (`?`) di DAL → aman injeksi.
 */
export const rl35QuerySchema = z
  .object({ from: TANGGAL, to: TANGGAL })
  .refine((v) => tanggalValid(v.from) && tanggalValid(v.to), { message: "Tanggal tidak valid", path: ["from"] })
  .refine((v) => v.from <= v.to, { message: "Tanggal awal tidak boleh melebihi tanggal akhir", path: ["from"] })
  .refine((v) => selisihHari(v.from, v.to) < RL35_MAKS_HARI, {
    message: `Rentang periode maksimal ${RL35_MAKS_HARI} hari`,
    path: ["to"],
  });

export type Rl35Query = z.infer<typeof rl35QuerySchema>;

export const eksporRl35Schema = z.object({ format: z.enum(["xlsx", "pdf"]).default("xlsx") });
export type FormatEksporRl35 = z.infer<typeof eksporRl35Schema>["format"];

/** ID ruangan SIMGOS (`master.ruangan.ID`, char(10) berisi angka). */
const RUANGAN_ID_RE = /^\d{1,10}$/;

/**
 * Perubahan pemetaan: `tujuan` = ID jenis kegiatan (`master.refrl`),
 * "kecualikan" (sengaja tidak dilaporkan), atau "kosongkan" (kembali ke
 * pemetaan bawaan dari nama ruangan).
 */
export const simpanPemetaanRl35Schema = z.strictObject({
  perubahan: z
    .array(
      z.strictObject({
        ruanganId: z.string().regex(RUANGAN_ID_RE, "ID ruangan tidak valid"),
        tujuan: z.union([z.number().int().min(0).max(65535), z.literal("kecualikan"), z.literal("kosongkan")]),
      }),
    )
    .min(1, "Tidak ada perubahan")
    .max(200)
    .refine((xs) => new Set(xs.map((x) => x.ruanganId)).size === xs.length, "Ruangan ganda dalam satu permintaan"),
});

export type SimpanPemetaanRl35Input = z.infer<typeof simpanPemetaanRl35Schema>;
export type TujuanPetaRl35 = SimpanPemetaanRl35Input["perubahan"][number]["tujuan"];
