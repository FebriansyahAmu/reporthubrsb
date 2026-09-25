import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import { AUDIT_OBJEK_IDS } from "./audit.constants";

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
