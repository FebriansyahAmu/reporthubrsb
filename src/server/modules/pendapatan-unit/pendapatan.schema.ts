import { z } from "zod";
import {
  BATAS,
  CAKUPAN_DEFAULT,
  CAKUPAN_KEYS,
  STATUS_DEFAULT,
  STATUS_KEYS,
  type StatusTagihanKey,
} from "./pendapatan.constants";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** Selisih hari kalender `b − a` (`YYYY-MM-DD`). */
export function selisihHari(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** `YYYY-MM-DD` + n hari (kalender, UTC). */
export function tambahHari(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Tanggal kalender yang benar-benar ada (tolak mis. 2026-02-30). */
function tanggalAda(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const tanggal = z.string().regex(ISO_DATE, "format tanggal harus YYYY-MM-DD").refine(tanggalAda, "tanggal tidak valid");

/** `status=final,belum` → daftar unik; kosong → default (Final + Belum Final). */
const statusList = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((s, ctx): StatusTagihanKey[] => {
    if (!s) return [...STATUS_DEFAULT];
    const parts = [...new Set(s.split(",").map((p) => p.trim()).filter(Boolean))];
    const valid = new Set<string>(STATUS_KEYS);
    const salah = parts.filter((p) => !valid.has(p));
    if (salah.length || parts.length === 0) {
      ctx.addIssue({ code: "custom", message: `status tidak dikenal: ${salah.join(", ") || "(kosong)"}` });
      return z.NEVER;
    }
    return parts as StatusTagihanKey[];
  });

/**
 * Query Laporan Pendapatan per Unit: cakupan layanan (default Rawat Jalan),
 * rentang TANGGAL TAGIHAN (inklusif, maks 1 tahun) + filter status tagihan,
 * cara bayar (0 = semua), & unit (opsional).
 */
export const pendapatanQuerySchema = z
  .object({
    layanan: z.enum(CAKUPAN_KEYS).default(CAKUPAN_DEFAULT),
    from: tanggal,
    to: tanggal,
    status: statusList,
    caraBayar: z.coerce.number().int().min(0).max(999).default(0),
    /** ID `master.ruangan` 9 digit — divalidasi terhadap cakupan di service. */
    ruangan: z.string().trim().regex(/^\d{9}$/, "ID unit tidak valid").optional(),
  })
  .refine((v) => v.from <= v.to, { message: "Tanggal awal tidak boleh melebihi tanggal akhir", path: ["from"] })
  .refine((v) => selisihHari(v.from, v.to) < BATAS.RENTANG_MAKS_HARI, {
    message: `Rentang maksimal ${BATAS.RENTANG_MAKS_HARI} hari`,
    path: ["to"],
  });

export type PendapatanQuery = z.infer<typeof pendapatanQuerySchema>;

export const FORMAT_EKSPOR = ["xlsx", "pdf"] as const;
export type FormatEkspor = (typeof FORMAT_EKSPOR)[number];

export const eksporQuerySchema = z.object({ format: z.enum(FORMAT_EKSPOR).default("xlsx") });
