import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import { AUDIT_OBJEK_IDS, idBounds } from "./audit.constants";
import type { UserMini } from "./audit.resolver";

/**
 * DAL Audit Trail RME — **READ-ONLY** atas SIMGOS (HIGH ALERT: hanya SELECT).
 *
 * Optimasi: filter objek pakai index `OBJEK`; rentang tanggal lewat prisma ID
 * (kronologis); tak pernah mengambil `SEBELUM`/`SESUDAH` (mediumtext) di query
 * ringkas; setiap agregasi diberi `MAX_EXECUTION_TIME`. Konvensi layering: hanya
 * file `*.dal.ts` yang boleh mengimpor `getSimgos`.
 */

const L = SIMGOS_DB.LOGS; // "logs"
const A = SIMGOS_DB.APLIKASI; // "aplikasi"
const CAP = "/*+ MAX_EXECUTION_TIME(8000) */";

const objekPlaceholders = AUDIT_OBJEK_IDS.map(() => "?").join(",");

/** Jumlah baris audit (CRUD) per objek dalam scope. Index `OBJEK`. */
export async function queryScopeCounts(): Promise<{ objek: string; n: number }[]> {
  const sql = `SELECT ${CAP} OBJEK AS objek, COUNT(*) AS n
    FROM ${L}.pengguna_akses_log
    WHERE OBJEK IN (${objekPlaceholders})
    GROUP BY OBJEK`;
  const rows = await getSimgos().$queryRawUnsafe<{ objek: string; n: number | bigint }[]>(
    sql,
    ...AUDIT_OBJEK_IDS,
  );
  return rows.map((r) => ({ objek: String(r.objek), n: Number(r.n) }));
}

/** ID terkecil & terbesar dalam scope (kronologis) → rentang cakupan data. */
export async function queryScopeIdRange(): Promise<{ minId: string | null; maxId: string | null }> {
  const sql = `SELECT ${CAP} MIN(ID) AS minId, MAX(ID) AS maxId
    FROM ${L}.pengguna_akses_log
    WHERE OBJEK IN (${objekPlaceholders})`;
  const rows = await getSimgos().$queryRawUnsafe<{ minId: string | null; maxId: string | null }[]>(
    sql,
    ...AUDIT_OBJEK_IDS,
  );
  const r = rows[0];
  return { minId: r?.minId ?? null, maxId: r?.maxId ?? null };
}

/** Metadata objek scope dari resolver `aplikasi.objek` (bukti resolver + nama tabel nyata). */
export async function queryObjekMeta(): Promise<{ id: string; tabel: string; deskripsi: string | null }[]> {
  const sql = `SELECT ID AS id, TABEL AS tabel, DESKRIPSI AS deskripsi
    FROM ${A}.objek
    WHERE ID IN (${objekPlaceholders})`;
  const rows = await getSimgos().$queryRawUnsafe<{ id: string; tabel: string; deskripsi: string | null }[]>(
    sql,
    ...AUDIT_OBJEK_IDS,
  );
  return rows.map((r) => ({ id: String(r.id), tabel: r.tabel, deskripsi: r.deskripsi ?? null }));
}

/** Ringkasan log login: total + waktu login terakhir. Index `TANGGAL_AKSES`. */
export async function queryLoginSummary(): Promise<{ total: number; lastAt: string | null }> {
  const sql = `SELECT ${CAP}
      (SELECT COUNT(*) FROM ${A}.pengguna_log) AS total,
      (SELECT DATE_FORMAT(MAX(TANGGAL_AKSES), '%Y-%m-%d %H:%i:%s') FROM ${A}.pengguna_log) AS lastAt`;
  const rows = await getSimgos().$queryRawUnsafe<{ total: number | bigint; lastAt: string | null }[]>(sql);
  const r = rows[0];
  return { total: Number(r?.total ?? 0), lastAt: r?.lastAt ?? null };
}

/** Jumlah pengguna aktif (STATUS=1). Tidak pernah menyentuh kolom PASSWORD. */
export async function queryActiveUserCount(): Promise<number> {
  const rows = await getSimgos().$queryRawUnsafe<{ n: number | bigint }[]>(
    `SELECT COUNT(*) AS n FROM ${A}.pengguna WHERE STATUS = 1`,
  );
  return Number(rows[0]?.n ?? 0);
}

/** Master pengguna ringkas untuk resolver & filter (TANPA PASSWORD). */
export async function queryAllUsers(): Promise<UserMini[]> {
  const rows = await getSimgos().$queryRawUnsafe<{ id: number | bigint; nama: string | null; login: string | null }[]>(
    `SELECT ID AS id, NAMA AS nama, LOGIN AS login FROM ${A}.pengguna ORDER BY NAMA`,
  );
  return rows.map((r) => ({ id: String(r.id), nama: r.nama ?? null, login: r.login ?? null }));
}

/* ------------------------------------------------------------- timeline events */

export type RmeFilter = {
  from: string;
  to: string;
  objek?: string;
  aksi?: "C" | "U";
  pengguna?: string;
  q?: string;
};

export type RmeRow = {
  id: string;
  ts: string;
  aksi: "C" | "U";
  pengguna: string;
  objek: string;
  ref: string | null;
};

/**
 * Baris audit CRUD (RME) — TERBARU dulu, keyset by `ID`. Rentang tanggal lewat
 * prefix `ID` (kronologis, ter-index). TIDAK mengambil SEBELUM/SESUDAH (berat).
 */
export async function queryRmeEvents(f: RmeFilter, cursorId: string | null, limit: number): Promise<RmeRow[]> {
  const cond: string[] = [];
  const params: unknown[] = [];

  if (f.objek) {
    cond.push("OBJEK = ?");
    params.push(f.objek);
  } else {
    cond.push(`OBJEK IN (${objekPlaceholders})`);
    params.push(...AUDIT_OBJEK_IDS);
  }
  const { lo, hi } = idBounds(f.from, f.to);
  if (lo) {
    cond.push("ID >= ?");
    params.push(lo);
  }
  if (hi) {
    cond.push("ID <= ?");
    params.push(hi);
  }
  if (f.aksi) {
    cond.push("AKSI = ?");
    params.push(f.aksi);
  }
  if (f.pengguna) {
    cond.push("PENGGUNA = ?");
    params.push(Number(f.pengguna));
  }
  if (f.q) {
    cond.push("REF LIKE ?");
    params.push(`${f.q}%`);
  }
  if (cursorId) {
    cond.push("ID < ?");
    params.push(cursorId);
  }

  const sql = `SELECT ${CAP} ID AS id, DATE_FORMAT(TANGGAL, '%Y-%m-%dT%H:%i:%s') AS ts,
      AKSI AS aksi, PENGGUNA AS pengguna, OBJEK AS objek, REF AS ref
    FROM ${L}.pengguna_akses_log
    WHERE ${cond.join(" AND ")}
    ORDER BY ID DESC
    LIMIT ${Math.trunc(limit)}`;
  const rows = await getSimgos().$queryRawUnsafe<
    { id: string; ts: string; aksi: "C" | "U"; pengguna: number | bigint; objek: string; ref: string | null }[]
  >(sql, ...params);
  return rows.map((r) => ({
    id: String(r.id),
    ts: r.ts,
    aksi: r.aksi,
    pengguna: String(r.pengguna),
    objek: String(r.objek),
    ref: r.ref ?? null,
  }));
}

export type RmeDetailRow = {
  id: string;
  ts: string;
  aksi: "C" | "U";
  pengguna: string;
  objek: string;
  ref: string | null;
  sebelum: string | null;
  sesudah: string | null;
};

/**
 * Satu baris audit CRUD lengkap dgn snapshot diff (SEBELUM/SESUDAH mediumtext) —
 * HANYA untuk satu ID (index) & DIBATASI objek scope (cegah akses di luar modul).
 * Ini satu-satunya query yang mengambil kolom berat.
 */
export async function queryEventDetail(logId: string): Promise<RmeDetailRow | null> {
  const sql = `SELECT ID AS id, DATE_FORMAT(TANGGAL, '%Y-%m-%dT%H:%i:%s') AS ts,
      AKSI AS aksi, PENGGUNA AS pengguna, OBJEK AS objek, REF AS ref, SEBELUM AS sebelum, SESUDAH AS sesudah
    FROM ${L}.pengguna_akses_log
    WHERE ID = ? AND OBJEK IN (${objekPlaceholders})
    LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<
    {
      id: string; ts: string; aksi: "C" | "U"; pengguna: number | bigint; objek: string;
      ref: string | null; sebelum: string | null; sesudah: string | null;
    }[]
  >(sql, logId, ...AUDIT_OBJEK_IDS);
  const r = rows[0];
  if (!r) return null;
  return {
    id: String(r.id),
    ts: r.ts,
    aksi: r.aksi,
    pengguna: String(r.pengguna),
    objek: String(r.objek),
    ref: r.ref ?? null,
    sebelum: r.sebelum ?? null,
    sesudah: r.sesudah ?? null,
  };
}

export type LoginFilter = { from: string; to: string; pengguna?: string };

export type LoginRow = { id: string; ts: string; pengguna: string; ip: string | null };

/** Baris login — TERBARU dulu, keyset by `ID`. Rentang via `TANGGAL_AKSES` (ter-index). */
export async function queryLoginEvents(f: LoginFilter, cursorId: string | null, limit: number): Promise<LoginRow[]> {
  const cond: string[] = [];
  const params: unknown[] = [];
  cond.push("TANGGAL_AKSES >= ?");
  params.push(`${f.from} 00:00:00`);
  cond.push("TANGGAL_AKSES <= ?");
  params.push(`${f.to} 23:59:59`);
  if (f.pengguna) {
    cond.push("PENGGUNA = ?");
    params.push(Number(f.pengguna));
  }
  if (cursorId) {
    cond.push("ID < ?");
    params.push(cursorId);
  }
  const sql = `SELECT ${CAP} ID AS id, DATE_FORMAT(TANGGAL_AKSES, '%Y-%m-%dT%H:%i:%s') AS ts,
      PENGGUNA AS pengguna, LOKASI_AKSES AS ip
    FROM ${A}.pengguna_log
    WHERE ${cond.join(" AND ")}
    ORDER BY ID DESC
    LIMIT ${Math.trunc(limit)}`;
  const rows = await getSimgos().$queryRawUnsafe<
    { id: number | bigint; ts: string; pengguna: number | bigint; ip: string | null }[]
  >(sql, ...params);
  return rows.map((r) => ({ id: String(r.id), ts: r.ts, pengguna: String(r.pengguna), ip: r.ip ?? null }));
}

/* ------------------------------------------------------------- agregasi (dashboard) */

const RME_SCOPE = `OBJEK IN (${objekPlaceholders}) AND ID >= ? AND ID <= ?`;

/** Aktivitas RME per hari (YYMMDD) × AKSI. Rentang via prefix ID. */
export async function queryRmeDailyByAksi(lo: string, hi: string): Promise<{ d: string; a: "C" | "U"; n: number }[]> {
  const sql = `SELECT ${CAP} LEFT(ID, 6) AS d, AKSI AS a, COUNT(*) AS n
    FROM ${L}.pengguna_akses_log WHERE ${RME_SCOPE}
    GROUP BY LEFT(ID, 6), AKSI`;
  const rows = await getSimgos().$queryRawUnsafe<{ d: string; a: "C" | "U"; n: number | bigint }[]>(sql, ...AUDIT_OBJEK_IDS, lo, hi);
  return rows.map((r) => ({ d: String(r.d), a: r.a, n: Number(r.n) }));
}

/** Aktivitas RME per objek. */
export async function queryRmeByObjek(lo: string, hi: string): Promise<{ objek: string; n: number }[]> {
  const sql = `SELECT ${CAP} OBJEK AS objek, COUNT(*) AS n
    FROM ${L}.pengguna_akses_log WHERE ${RME_SCOPE} GROUP BY OBJEK`;
  const rows = await getSimgos().$queryRawUnsafe<{ objek: string; n: number | bigint }[]>(sql, ...AUDIT_OBJEK_IDS, lo, hi);
  return rows.map((r) => ({ objek: String(r.objek), n: Number(r.n) }));
}

/** Distribusi aktivitas RME per jam (0–23). */
export async function queryRmeByHour(lo: string, hi: string): Promise<{ h: number; n: number }[]> {
  const sql = `SELECT ${CAP} HOUR(TANGGAL) AS h, COUNT(*) AS n
    FROM ${L}.pengguna_akses_log WHERE ${RME_SCOPE} GROUP BY HOUR(TANGGAL)`;
  const rows = await getSimgos().$queryRawUnsafe<{ h: number; n: number | bigint }[]>(sql, ...AUDIT_OBJEK_IDS, lo, hi);
  return rows.map((r) => ({ h: Number(r.h), n: Number(r.n) }));
}

/** Jumlah pengguna unik yang beraktivitas RME dalam rentang. */
export async function queryRmeDistinctUsers(lo: string, hi: string): Promise<number> {
  const sql = `SELECT ${CAP} COUNT(DISTINCT PENGGUNA) AS n
    FROM ${L}.pengguna_akses_log WHERE ${RME_SCOPE}`;
  const rows = await getSimgos().$queryRawUnsafe<{ n: number | bigint }[]>(sql, ...AUDIT_OBJEK_IDS, lo, hi);
  return Number(rows[0]?.n ?? 0);
}

/** Pengguna teraktif (RME) — top N. */
export async function queryRmeTopUsers(lo: string, hi: string, limit: number): Promise<{ pengguna: string; n: number }[]> {
  const sql = `SELECT ${CAP} PENGGUNA AS pengguna, COUNT(*) AS n
    FROM ${L}.pengguna_akses_log WHERE ${RME_SCOPE}
    GROUP BY PENGGUNA ORDER BY n DESC LIMIT ${Math.trunc(limit)}`;
  const rows = await getSimgos().$queryRawUnsafe<{ pengguna: number | bigint; n: number | bigint }[]>(sql, ...AUDIT_OBJEK_IDS, lo, hi);
  return rows.map((r) => ({ pengguna: String(r.pengguna), n: Number(r.n) }));
}

/** Login per hari (YYYY-MM-DD). Rentang via TANGGAL_AKSES (ter-index). */
export async function queryLoginDaily(from: string, to: string): Promise<{ d: string; n: number }[]> {
  const sql = `SELECT ${CAP} DATE_FORMAT(TANGGAL_AKSES, '%Y-%m-%d') AS d, COUNT(*) AS n
    FROM ${A}.pengguna_log WHERE TANGGAL_AKSES >= ? AND TANGGAL_AKSES <= ?
    GROUP BY DATE_FORMAT(TANGGAL_AKSES, '%Y-%m-%d')`;
  const rows = await getSimgos().$queryRawUnsafe<{ d: string; n: number | bigint }[]>(sql, `${from} 00:00:00`, `${to} 23:59:59`);
  return rows.map((r) => ({ d: String(r.d), n: Number(r.n) }));
}
