import "server-only";
import { writeAudit } from "@/server/lib/audit";
import type { SessionUser } from "@/server/auth/session";

/**
 * Wiring audit modul Rekap Klaim di atas fasilitas audit generik (`audit_log`).
 * Menyimpan diff field-level {field, lama, baru}[] di `metadata` (JSON-safe:
 * BigInt→Number, Date→YYYY-MM-DD). Aksi diberi prefix "rekap-klaim." agar viewer
 * (Sesi 7) mudah memfilter.
 */

export type FieldDiff = { field: string; lama: PlainVal; baru: PlainVal };
type PlainVal = string | number | boolean | null;

/** Konversi nilai apa pun menjadi bentuk primitif aman-JSON. */
function toPlain(v: unknown): PlainVal {
  if (v == null) return null;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return JSON.stringify(v);
}

/** Diff field-level antara dua objek — hanya field yang benar-benar berubah. */
export function buildDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[],
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const f of fields) {
    const a = toPlain(before[f]);
    const b = toPlain(after[f]);
    if (String(a) !== String(b)) diffs.push({ field: f, lama: a, baru: b });
  }
  return diffs;
}

/** Snapshot seluruh field (untuk CREATE/DELETE) sebagai daftar {field, baru/lama}. */
export function snapshot(
  obj: Record<string, unknown>,
  fields: readonly string[],
): Record<string, PlainVal> {
  const out: Record<string, PlainVal> = {};
  for (const f of fields) out[f] = toPlain(obj[f]);
  return out;
}

export type KlaimEntity = "klaim" | "potongan";
export type KlaimAuditAction = "create" | "update" | "delete" | "import";

/** Tulis jejak audit untuk entitas modul Rekap Klaim. Best-effort (tak menggagalkan aksi). */
export async function writeKlaimAudit(opts: {
  user: SessionUser | null;
  entity: KlaimEntity;
  action: KlaimAuditAction;
  targetId: string;
  diffs?: FieldDiff[];
  extra?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  await writeAudit({
    actorId: opts.user?.id ?? null,
    actorName: opts.user?.name ?? null,
    action: `rekap-klaim.${opts.entity}.${opts.action}`,
    targetId: opts.targetId,
    metadata: {
      modul: "rekap-klaim",
      entity: opts.entity,
      ...(opts.diffs && opts.diffs.length ? { diffs: opts.diffs } : {}),
      ...(opts.extra ?? {}),
    },
    ip: opts.ip ?? null,
  });
}
