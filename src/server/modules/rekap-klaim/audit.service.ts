import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import type { FieldDiff } from "./klaim.audit";

/**
 * Viewer Audit Trail modul Rekap Klaim (F-05, read-only). Membaca `audit_log`
 * beraksi prefix "rekap-klaim." lalu mem-parsing metadata (entity, diff, snapshot)
 * agar bisa ditampilkan "siapa mengubah apa & kapan".
 */

export type AuditEntity = "klaim" | "potongan" | "lainnya";
export type AuditActionType = "create" | "update" | "delete" | "import" | "other";

export type AuditItem = {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entity: AuditEntity;
  actionType: AuditActionType;
  targetId: string | null;
  ip: string | null;
  diffs: FieldDiff[];
  /** Snapshot field (untuk create/delete). */
  data: Record<string, string | number | boolean | null> | null;
  /** Klaim induk (untuk entity potongan). */
  klaimId: string | null;
};

export type AuditListMeta = {
  total: number;
  page: number;
  pageSize: number;
  counts: { total: number; create: number; update: number; delete: number; import: number };
  actorTersedia: string[];
};

const isoDay = /^\d{4}-\d{2}-\d{2}$/;

export const auditListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  entity: z.enum(["klaim", "potongan"]).optional(),
  aksi: z.enum(["create", "update", "delete", "import"]).optional(),
  actor: z.string().trim().max(120).optional(),
  q: z.string().trim().max(120).optional(),
  from: z.string().regex(isoDay).optional(),
  to: z.string().regex(isoDay).optional(),
});
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

const PREFIX = "rekap-klaim.";

/** Parse metadata JSON (objek atau string) → objek aman. */
function parseMeta(meta: unknown): Record<string, unknown> {
  if (meta == null) return {};
  if (typeof meta === "string") {
    try { return JSON.parse(meta) as Record<string, unknown>; } catch { return {}; }
  }
  if (typeof meta === "object") return meta as Record<string, unknown>;
  return {};
}

function actionTypeOf(action: string): AuditActionType {
  const suffix = action.split(".")[2];
  if (suffix === "create" || suffix === "update" || suffix === "delete" || suffix === "import") return suffix;
  return "other";
}
function entityOf(action: string, meta: Record<string, unknown>): AuditEntity {
  const e = (meta.entity as string) ?? action.split(".")[1];
  return e === "klaim" || e === "potongan" ? e : "lainnya";
}

function serialize(row: {
  id: string; createdAt: Date; actorId: string | null; actorName: string | null;
  action: string; targetId: string | null; metadata: unknown; ip: string | null;
}): AuditItem {
  const meta = parseMeta(row.metadata);
  const diffs = Array.isArray(meta.diffs) ? (meta.diffs as FieldDiff[]) : [];
  const data = meta.data && typeof meta.data === "object"
    ? (meta.data as Record<string, string | number | boolean | null>)
    : null;
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    actorId: row.actorId,
    actorName: row.actorName,
    action: row.action,
    entity: entityOf(row.action, meta),
    actionType: actionTypeOf(row.action),
    targetId: row.targetId,
    ip: row.ip,
    diffs,
    data,
    klaimId: typeof meta.klaimId === "string" ? meta.klaimId : null,
  };
}

export async function listKlaimAudit(q: AuditListQuery): Promise<{ data: AuditItem[]; meta: AuditListMeta }> {
  const db = getAppDb();

  // Filter dasar (tanpa jenis aksi) → dipakai untuk kartu ringkasan.
  const scopeAnd: Prisma.AuditLogWhereInput[] = [{ action: { startsWith: PREFIX } }];
  if (q.entity) scopeAnd.push({ action: { startsWith: `${PREFIX}${q.entity}.` } });
  if (q.actor) scopeAnd.push({ actorName: { contains: q.actor } });
  if (q.q) {
    scopeAnd.push({
      OR: [
        { actorName: { contains: q.q } },
        { targetId: { contains: q.q } },
        { action: { contains: q.q } },
      ],
    });
  }
  if (q.from || q.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (q.from) createdAt.gte = new Date(`${q.from}T00:00:00.000`);
    if (q.to) createdAt.lte = new Date(`${q.to}T23:59:59.999`);
    scopeAnd.push({ createdAt });
  }
  const whereScope: Prisma.AuditLogWhereInput = { AND: scopeAnd };

  // Filter daftar (+ jenis aksi).
  const whereList: Prisma.AuditLogWhereInput = q.aksi
    ? { AND: [...scopeAnd, { action: { endsWith: `.${q.aksi}` } }] }
    : whereScope;

  const [rows, total, byAction, actors] = await Promise.all([
    db.auditLog.findMany({
      where: whereList,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    db.auditLog.count({ where: whereList }),
    db.auditLog.groupBy({ by: ["action"], where: whereScope, _count: { _all: true } }),
    db.auditLog.findMany({
      where: { action: { startsWith: PREFIX }, actorName: { not: null } },
      distinct: ["actorName"],
      select: { actorName: true },
      orderBy: { actorName: "asc" },
      take: 100,
    }),
  ]);

  const counts = { total: 0, create: 0, update: 0, delete: 0, import: 0 };
  for (const g of byAction) {
    const c = g._count._all;
    counts.total += c;
    const t = actionTypeOf(g.action);
    if (t !== "other") counts[t] += c;
  }

  return {
    data: rows.map(serialize),
    meta: {
      total,
      page: q.page,
      pageSize: q.pageSize,
      counts,
      actorTersedia: actors.map((a) => a.actorName).filter((n): n is string => !!n),
    },
  };
}
