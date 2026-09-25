import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { NotFoundError } from "@/server/lib/errors";
import {
  addDaysIso,
  AKSI_JENIS,
  AUDIT_OBJEKS,
  getAuditObjek,
  idBounds,
  idToIsoDate,
  todayWitaIso,
  type JenisAktivitas,
} from "./audit.constants";
import {
  queryActiveUserCount,
  queryEventDetail,
  queryLoginDaily,
  queryLoginEvents,
  queryLoginSummary,
  queryObjekMeta,
  queryRmeByHour,
  queryRmeByObjek,
  queryRmeDailyByAksi,
  queryRmeDistinctUsers,
  queryRmeEvents,
  queryRmeTopUsers,
  queryScopeCounts,
  queryScopeIdRange,
} from "./audit.dal";
import { computeDiff, detectSoftDelete, type DiffField } from "./audit.diff";
import { getUserResolver, type UserMini } from "./audit.resolver";
import { decodeCursor, encodeCursor, type DashboardQuery, type EventsQuery } from "./audit.schema";

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

/* ------------------------------------------------------------- refs & timeline */

export type AuditRefs = {
  scope: { objek: string; label: string; tabel: string }[];
  users: UserMini[];
  coverage: { minDate: string | null; maxDate: string | null };
};

/** Opsi filter timeline: objek scope, daftar pengguna, rentang cakupan. */
export async function getRefs(): Promise<AuditRefs> {
  const empty: AuditRefs = {
    scope: AUDIT_OBJEKS.map((o) => ({ objek: o.objek, label: o.label, tabel: o.tabel })),
    users: [],
    coverage: { minDate: null, maxDate: null },
  };
  if (!isSimgosConfigured()) return empty;
  const [resolver, range] = await Promise.all([getUserResolver(), queryScopeIdRange()]);
  return {
    scope: empty.scope,
    users: resolver.list,
    coverage: { minDate: idToIsoDate(range.minId), maxDate: idToIsoDate(range.maxId) },
  };
}

export type AuditEvent = {
  /** uid unik (kunci React + prefiks sumber). */
  id: string;
  sumber: "RME" | "LOGIN";
  /** Waktu wall-clock WITA (naive `YYYY-MM-DDTHH:mm:ss`). */
  ts: string;
  jenis: JenisAktivitas;
  aksi: "C" | "U" | null;
  /** ID mentah log CRUD (untuk detail diff Stage 2); null utk login. */
  logId: string | null;
  pengguna: { id: string; nama: string | null; login: string | null };
  objek: { id: string; label: string; tabel: string } | null;
  ref: string | null;
  ip: string | null;
};

export type EventsPage = { items: AuditEvent[]; nextCursor: string | null; hasMore: boolean };

type Merged = AuditEvent & { srcId: string };

/** Urut TERBARU dulu: ts desc, lalu (dalam sumber sama) id desc. */
function cmpDesc(a: Merged, b: Merged): number {
  if (a.ts !== b.ts) return a.ts < b.ts ? 1 : -1;
  if (a.sumber !== b.sumber) return a.sumber < b.sumber ? 1 : -1;
  if (a.sumber === "RME") return a.srcId < b.srcId ? 1 : a.srcId > b.srcId ? -1 : 0;
  return Number(b.srcId) - Number(a.srcId);
}

/**
 * Timeline gabungan (RME CRUD + Login), keyset-paginated. Tiap sumber diambil
 * dgn index-nya sendiri (RME: ID/prefix tanggal; Login: TANGGAL_AKSES), lalu
 * di-merge kronologis di memori. Kursor menyimpan id terakhir per sumber.
 */
export async function listEvents(q: EventsQuery): Promise<EventsPage> {
  if (!isSimgosConfigured()) return { items: [], nextCursor: null, hasMore: false };

  const to = q.to ?? todayWitaIso();
  const from = q.from ?? addDaysIso(to, -6);
  const cursor = decodeCursor(q.cursor);
  const N = q.limit;

  // Filter khusus-RME (aksi/objek/cari REF) → login tak relevan.
  const rmeSpecific = !!q.aksi || !!q.objek || !!q.q;
  const wantRme = q.sumber !== "LOGIN";
  const wantLogin = q.sumber !== "RME" && !rmeSpecific;

  const [rmeRows, loginRows, resolver] = await Promise.all([
    wantRme
      ? queryRmeEvents({ from, to, objek: q.objek, aksi: q.aksi, pengguna: q.pengguna, q: q.q }, cursor?.r ?? null, N + 1)
      : Promise.resolve([]),
    wantLogin ? queryLoginEvents({ from, to, pengguna: q.pengguna }, cursor?.l ?? null, N + 1) : Promise.resolve([]),
    getUserResolver(),
  ]);

  const resolveUser = (id: string) => {
    const u = resolver.map.get(id);
    return { id, nama: u?.nama ?? null, login: u?.login ?? null };
  };

  const merged: Merged[] = [
    ...rmeRows.map((r): Merged => {
      const o = getAuditObjek(r.objek);
      return {
        id: `R:${r.id}`,
        srcId: r.id,
        sumber: "RME",
        ts: r.ts,
        jenis: AKSI_JENIS[r.aksi],
        aksi: r.aksi,
        logId: r.id,
        pengguna: resolveUser(r.pengguna),
        objek: o ? { id: o.objek, label: o.label, tabel: o.tabel } : { id: r.objek, label: r.objek, tabel: "" },
        ref: r.ref,
        ip: null,
      };
    }),
    ...loginRows.map((r): Merged => ({
      id: `L:${r.id}`,
      srcId: r.id,
      sumber: "LOGIN",
      ts: r.ts,
      jenis: "LOGIN",
      aksi: null,
      logId: null,
      pengguna: resolveUser(r.pengguna),
      objek: null,
      ref: null,
      ip: r.ip,
    })),
  ].sort(cmpDesc);

  const emitted = merged.slice(0, N);
  const hasMore = merged.length > N;

  // Kursor: id terakhir yang DITAMPILKAN per sumber (jika tak ada, pertahankan lama).
  let lastR = cursor?.r ?? null;
  let lastL = cursor?.l ?? null;
  for (const it of emitted) {
    if (it.sumber === "RME") lastR = it.srcId;
    else lastL = it.srcId;
  }

  const items: AuditEvent[] = emitted.map((m) => ({
    id: m.id,
    sumber: m.sumber,
    ts: m.ts,
    jenis: m.jenis,
    aksi: m.aksi,
    logId: m.logId,
    pengguna: m.pengguna,
    objek: m.objek,
    ref: m.ref,
    ip: m.ip,
  }));
  return {
    items,
    nextCursor: hasMore ? encodeCursor({ r: lastR, l: lastL }) : null,
    hasMore,
  };
}

/* ------------------------------------------------------------------ detail */

export type EventDetail = {
  logId: string;
  ts: string;
  aksi: "C" | "U";
  jenis: JenisAktivitas;
  pengguna: { id: string; nama: string | null; login: string | null };
  objek: { id: string; label: string; tabel: string };
  ref: string | null;
  /** Terdeteksi soft-delete/pembatalan (perubahan status → nonaktif). */
  softDelete: boolean;
  isCreate: boolean;
  fields: DiffField[];
  changedCount: number;
  hasSnapshot: boolean;
};

/**
 * Detail satu event RME + diff SEBELUM→SESUDAH. Dibatasi objek scope (di luar
 * scope → NotFound). Mengambil kolom berat hanya untuk baris ini.
 */
export async function getEventDetail(logId: string): Promise<EventDetail> {
  const row = await queryEventDetail(logId);
  if (!row) throw new NotFoundError("Aktivitas tidak ditemukan atau di luar cakupan modul.");

  const resolver = await getUserResolver();
  const u = resolver.map.get(row.pengguna);
  const o = getAuditObjek(row.objek);
  const fields = computeDiff(row.sebelum, row.sesudah);
  const softDelete = detectSoftDelete(fields);
  const changedCount = fields.filter((f) => f.status !== "unchanged").length;

  return {
    logId: row.id,
    ts: row.ts,
    aksi: row.aksi,
    jenis: softDelete ? "PENGHAPUSAN" : AKSI_JENIS[row.aksi],
    pengguna: { id: row.pengguna, nama: u?.nama ?? null, login: u?.login ?? null },
    objek: o ? { id: o.objek, label: o.label, tabel: o.tabel } : { id: row.objek, label: row.objek, tabel: "" },
    ref: row.ref,
    softDelete,
    isCreate: row.aksi === "C",
    fields,
    changedCount,
    hasSnapshot: !!(row.sebelum?.trim() || row.sesudah?.trim()),
  };
}

/* --------------------------------------------------------------- dashboard */

export type AuditDashboard = {
  range: { from: string; to: string; days: number };
  totals: { rme: number; penambahan: number; perubahan: number; login: number; penggunaAktif: number };
  trenRme: { date: string; penambahan: number; perubahan: number; total: number }[];
  trenLogin: { date: string; total: number }[];
  perObjek: { objek: string; label: string; total: number }[];
  topPengguna: { id: string; nama: string | null; login: string | null; total: number }[];
  perJam: { hour: number; value: number }[];
};

const EMPTY_DASHBOARD = (from: string, to: string, days: number): AuditDashboard => ({
  range: { from, to, days },
  totals: { rme: 0, penambahan: 0, perubahan: 0, login: 0, penggunaAktif: 0 },
  trenRme: [],
  trenLogin: [],
  perObjek: AUDIT_OBJEKS.map((o) => ({ objek: o.objek, label: o.label, total: 0 })),
  topPengguna: [],
  perJam: Array.from({ length: 24 }, (_, h) => ({ hour: h, value: 0 })),
});

function enumerateDays(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  for (let i = 0; i < 400 && cur <= to; i++) {
    out.push(cur);
    cur = addDaysIso(cur, 1);
  }
  return out;
}

/** yymmdd (LEFT(ID,6)) → YYYY-MM-DD. */
function yymmddToIso(d: string): string {
  return `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
}

/** Dashboard tren & kepatuhan (agregasi read-only, rentang default 30 hari). */
export async function getDashboard(q: DashboardQuery): Promise<AuditDashboard> {
  const to = q.to ?? todayWitaIso();
  const from = q.from ?? addDaysIso(to, -29);
  const days = enumerateDays(from, to).length;
  if (!isSimgosConfigured()) return EMPTY_DASHBOARD(from, to, days);

  const { lo, hi } = idBounds(from, to);
  const loB = lo ?? "000000000000000";
  const hiB = hi ?? "999999999999999";

  const [daily, byObjek, byHour, distinct, topUsers, loginDaily, resolver] = await Promise.all([
    queryRmeDailyByAksi(loB, hiB),
    queryRmeByObjek(loB, hiB),
    queryRmeByHour(loB, hiB),
    queryRmeDistinctUsers(loB, hiB),
    queryRmeTopUsers(loB, hiB, 10),
    queryLoginDaily(from, to),
    getUserResolver(),
  ]);

  // Tren RME per hari (isi hari kosong = 0).
  const rmeByDay = new Map<string, { penambahan: number; perubahan: number }>();
  for (const r of daily) {
    const iso = yymmddToIso(r.d);
    const e = rmeByDay.get(iso) ?? { penambahan: 0, perubahan: 0 };
    if (r.a === "C") e.penambahan += r.n;
    else e.perubahan += r.n;
    rmeByDay.set(iso, e);
  }
  const loginByDay = new Map(loginDaily.map((r) => [r.d, r.n]));
  const axis = enumerateDays(from, to);
  const trenRme = axis.map((date) => {
    const e = rmeByDay.get(date) ?? { penambahan: 0, perubahan: 0 };
    return { date, penambahan: e.penambahan, perubahan: e.perubahan, total: e.penambahan + e.perubahan };
  });
  const trenLogin = axis.map((date) => ({ date, total: loginByDay.get(date) ?? 0 }));

  const penambahan = trenRme.reduce((s, x) => s + x.penambahan, 0);
  const perubahan = trenRme.reduce((s, x) => s + x.perubahan, 0);
  const login = trenLogin.reduce((s, x) => s + x.total, 0);

  const objekCount = new Map(byObjek.map((r) => [r.objek, r.n]));
  const perObjek = AUDIT_OBJEKS.map((o) => ({ objek: o.objek, label: o.label, total: objekCount.get(o.objek) ?? 0 }))
    .sort((a, b) => b.total - a.total);

  const hourCount = new Map(byHour.map((r) => [r.h, r.n]));
  const perJam = Array.from({ length: 24 }, (_, h) => ({ hour: h, value: hourCount.get(h) ?? 0 }));

  const topPengguna = topUsers.map((u) => {
    const m = resolver.map.get(u.pengguna);
    return { id: u.pengguna, nama: m?.nama ?? null, login: m?.login ?? null, total: u.n };
  });

  return {
    range: { from, to, days },
    totals: { rme: penambahan + perubahan, penambahan, perubahan, login, penggunaAktif: distinct },
    trenRme,
    trenLogin,
    perObjek,
    topPengguna,
    perJam,
  };
}
