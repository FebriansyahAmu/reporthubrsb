import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { AUDIT_OBJEKS, idToIsoDate } from "./audit.constants";
import {
  queryActiveUserCount,
  queryLoginSummary,
  queryObjekMeta,
  queryScopeCounts,
  queryScopeIdRange,
} from "./audit.dal";

export type AuditScopeItem = {
  objek: string;
  label: string;
  /** Nama tabel dari resolver aplikasi.objek (fallback ke konstanta). */
  tabel: string;
  total: number;
};

export type AuditStatus = {
  /** SIMGOS read-only terkonfigurasi. */
  configured: boolean;
  scope: AuditScopeItem[];
  totalEvents: number;
  coverage: { minDate: string | null; maxDate: string | null };
  login: { total: number; lastAt: string | null };
  users: { aktif: number };
};

const EMPTY_STATUS: AuditStatus = {
  configured: false,
  scope: AUDIT_OBJEKS.map((o) => ({ objek: o.objek, label: o.label, tabel: o.tabel, total: 0 })),
  totalEvents: 0,
  coverage: { minDate: null, maxDate: null },
  login: { total: 0, lastAt: null },
  users: { aktif: 0 },
};

/**
 * Status fondasi modul (Stage 0): membuktikan jalur baca SIMGOS lintas-DB
 * (logs + aplikasi) + resolver objek berfungsi, sekaligus ringkasan cakupan.
 */
export async function getAuditStatus(): Promise<AuditStatus> {
  if (!isSimgosConfigured()) return EMPTY_STATUS;

  const [counts, range, meta, login, usersAktif] = await Promise.all([
    queryScopeCounts(),
    queryScopeIdRange(),
    queryObjekMeta(),
    queryLoginSummary(),
    queryActiveUserCount(),
  ]);

  const countBy = new Map(counts.map((c) => [c.objek, c.n]));
  const tabelBy = new Map(meta.map((m) => [m.id, m.tabel]));

  const scope: AuditScopeItem[] = AUDIT_OBJEKS.map((o) => ({
    objek: o.objek,
    label: o.label,
    tabel: tabelBy.get(o.objek) ?? o.tabel,
    total: countBy.get(o.objek) ?? 0,
  }));
  const totalEvents = scope.reduce((s, x) => s + x.total, 0);

  return {
    configured: true,
    scope,
    totalEvents,
    coverage: { minDate: idToIsoDate(range.minId), maxDate: idToIsoDate(range.maxId) },
    login,
    users: { aktif: usersAktif },
  };
}
