import { z } from "zod";
import { AUDIT_OBJEK_IDS } from "./audit.constants";
import { SUMBER_OBJEK_IDS } from "./kunjungan.constants";

/**
 * Skema query timeline Audit Trail RME. Nilai di-bind sebagai parameter (`?`) di
 * DAL; enum/limit divalidasi di sini agar aman.
 */

const optNum = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().regex(/^\d+$/, "ID pengguna tidak valid").optional(),
);
const optText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus YYYY-MM-DD");

export const eventsQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  /** Sumber baris: gabungan, hanya RME (CRUD), atau hanya Login. */
  sumber: z.enum(["SEMUA", "RME", "LOGIN"]).default("SEMUA"),
  /** Filter aksi CRUD (khusus RME). */
  aksi: z.enum(["C", "U"]).optional(),
  /** Filter objek (salah satu objek scope). */
  objek: z.enum(AUDIT_OBJEK_IDS as unknown as [string, ...string[]]).optional(),
  /** Filter pengguna (PENGGUNA id). */
  pengguna: optNum,
  /** Cari berdasarkan REF (prefix). */
  q: optText(60),
  /** Kursor keyset buram (base64url). */
  cursor: optText(300),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
export type EventsQuery = z.infer<typeof eventsQuerySchema>;

const optDate = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), isoDate.optional());

/**
 * Log Aktivitas berpaginasi bernomor (Fase 2 · K4). Cakupan objek = 7 sumber
 * data aktual (Asesmen ×3, CPPT, TTV, Diagnosis, Tindakan).
 */
export const logQuerySchema = z.object({
  from: optDate,
  to: optDate,
  sumber: z.enum(["SEMUA", "RME", "LOGIN"]).default("SEMUA"),
  objek: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.enum(SUMBER_OBJEK_IDS as unknown as [string, ...string[]]).optional(),
  ),
  aksi: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["C", "U"]).optional()),
  pengguna: optNum,
  q: optText(60),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(50).default(25),
});
export type LogQuery = z.infer<typeof logQuerySchema>;

/** Query dashboard: rentang tanggal (default 30 hari terakhir di service). */
export const dashboardQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/* --------------------------------------------------------------- kursor keyset */

/** Kursor per-sumber: id terakhir yang sudah ditampilkan dari tiap tabel. */
export type EventCursor = { r: string | null; l: string | null };

export function encodeCursor(c: EventCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(s?: string | null): EventCursor | null {
  if (!s) return null;
  try {
    const o = JSON.parse(Buffer.from(s, "base64url").toString("utf8")) as Partial<EventCursor>;
    if (o && typeof o === "object") {
      return {
        r: typeof o.r === "string" ? o.r : null,
        l: typeof o.l === "string" ? o.l : null,
      };
    }
  } catch {
    /* kursor rusak → mulai dari awal */
  }
  return null;
}
