import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/**
 * DAL penerima notifikasi — **READ-ONLY** SIMGOS (hanya SELECT).
 * ⚠️ Tidak pernah membaca `aplikasi.pengguna.PASSWORD`.
 */

const AP = SIMGOS_DB.APLIKASI;
const MS = SIMGOS_DB.MASTER;

/**
 * Ruang leaf (`master.ruangan` JENIS 5) yang boleh diakses pengguna SIMGOS
 * (akses aktif). Akses di tingkat instalasi/bangsal dikembangkan ke ruang di
 * bawahnya (prefiks ID). Index `pengguna.LOGIN` + `akses_ruangan.PENGGUNA_STATUS`.
 */
export async function queryRuanganAksesPengguna(login: string): Promise<string[]> {
  const rows = await getSimgos().$queryRawUnsafe<{ id: string }[]>(
    `SELECT /*+ MAX_EXECUTION_TIME(5000) */ DISTINCT r.ID AS id
       FROM ${AP}.pengguna p
       JOIN ${AP}.pengguna_akses_ruangan a ON a.PENGGUNA = p.ID AND a.STATUS = 1
       JOIN ${MS}.ruangan r ON r.ID LIKE CONCAT(a.RUANGAN, '%') AND r.JENIS = 5
      WHERE p.LOGIN = ? AND p.STATUS = 1`,
    login,
  );
  return rows.map((r) => String(r.id));
}
