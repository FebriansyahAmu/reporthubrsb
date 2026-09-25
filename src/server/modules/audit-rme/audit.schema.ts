import { z } from "zod";
import { AUDIT_OBJEK_IDS } from "./audit.constants";

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
