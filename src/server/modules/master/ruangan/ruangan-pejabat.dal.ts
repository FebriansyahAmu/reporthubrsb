import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

export type PegawaiRow = { NIP: string | null; NAMA: string | null };

/**
 * Cari pegawai di `master.pegawai` untuk combobox penunjukan pejabat (READ-ONLY).
 * Cocokkan pada nama; kembalikan NIP + nama lengkap (gelar depan/belakang).
 * `limit` di-clamp & di-inline (bukan input user mentah).
 */
export async function queryPegawaiSearch(q: string, limit = 15): Promise<PegawaiRow[]> {
  const n = Math.min(30, Math.max(1, Math.trunc(limit)));
  const sql = `
    SELECT pg.NIP AS NIP,
           TRIM(CONCAT_WS(' ', NULLIF(pg.GELAR_DEPAN, ''), pg.NAMA, NULLIF(pg.GELAR_BELAKANG, ''))) AS NAMA
    FROM ${SIMGOS_DB.MASTER}.pegawai pg
    WHERE pg.NAMA LIKE CONCAT('%', ?, '%')
    ORDER BY pg.NAMA
    LIMIT ${n}`;
  return getSimgos().$queryRawUnsafe<PegawaiRow[]>(sql, q);
}
