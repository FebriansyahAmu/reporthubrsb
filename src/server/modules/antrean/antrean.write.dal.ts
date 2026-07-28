import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/**
 * ⚠️⚠️ SATU-SATUNYA modul yang MENULIS ke SIMGOS. ⚠️⚠️
 *
 * Disetujui user (2026-07-28) khusus untuk fitur "Sesuaikan Task": mengoreksi
 * nilai kolom `TANGGAL` pada satu baris `regonline.task_action_antrian` agar
 * Task 5 tidak mendahului Task 6. Ini penulisan NILAI DATA satu baris by PK —
 * TIDAK menambah tabel / mengubah struktur (aturan HIGH ALERT tetap dihormati).
 *
 * Batasan ketat: hanya UPDATE kolom TANGGAL, hanya baris TASK_ID=5, hanya by PK.
 * Tidak ada INSERT/DELETE/DDL. Nilai selalu di-bind lewat `?`.
 */

export type LatestTaskRow = { ID: string; TANGGAL: Date | string | null };

/** Baris task PALING BARU (TANGGAL terbesar) untuk (ANTRIAN, taskId). Read-only. */
export async function queryLatestTaskRow(
  antrian: string,
  taskId: number,
): Promise<LatestTaskRow | null> {
  const sql = `
    SELECT ID, TANGGAL
    FROM ${SIMGOS_DB.REGONLINE}.task_action_antrian
    WHERE ANTRIAN = ? AND TASK_ID = ?
    ORDER BY TANGGAL DESC
    LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<LatestTaskRow[]>(sql, antrian, taskId);
  return rows[0] ?? null;
}

/**
 * UPDATE nilai TANGGAL sebuah baris Task 5 (by PK). Mengembalikan jumlah baris
 * terpengaruh. `mysqlDatetime` = "YYYY-MM-DD HH:MM:SS" (di-bind sbg string agar
 * MySQL menyimpannya apa adanya, tanpa konversi timezone).
 */
export async function updateTask5Tanggal(id: string, mysqlDatetime: string): Promise<number> {
  const sql = `
    UPDATE ${SIMGOS_DB.REGONLINE}.task_action_antrian
    SET TANGGAL = ?
    WHERE ID = ? AND TASK_ID = 5`;
  return getSimgos().$executeRawUnsafe(sql, mysqlDatetime, id);
}
