import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { NotFoundError } from "@/server/lib/errors";
import {
  AKSI_JENIS,
  AUDIT_OBJEKS,
  getAuditObjek,
  idToIsoDate,
  todayWitaIso,
  type JenisAktivitas,
} from "./audit.constants";
import {
  queryActiveUserCount,
  queryEventDetail,
  queryLoginEvents,
  queryLoginSummary,
  queryObjekMeta,
  queryRmeEvents,
  queryScopeCounts,
  queryScopeIdRange,
} from "./audit.dal";
import { computeDiff, detectSoftDelete, type DiffField } from "./audit.diff";
import { getUserResolver, type UserMini } from "./audit.resolver";
import { decodeCursor, encodeCursor, type EventsQuery } from "./audit.schema";

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

const p2 = (n: number) => String(n).padStart(2, "0");
function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

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
