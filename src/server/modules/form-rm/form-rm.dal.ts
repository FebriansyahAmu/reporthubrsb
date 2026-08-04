import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/** Baris header identitas pasien untuk kepala formulir RM (READ-ONLY). */
export type FormRmHeaderRow = {
  NORM: string | number;
  NAMA: string;
  JENIS_KELAMIN: number | string;
  TANGGAL_LAHIR: Date | string | null;
  RUANG: string | null;
  MASUK: Date | string | null;
};

/**
 * Identitas pasien + ruang/waktu masuk leg awal untuk kepala formulir RM.
 * Ruang diambil dari leg IGD bila ada (prioritas), lalu leg terawal. READ-ONLY.
 * Null bila NOPEN tak ada / pendaftaran tak aktif.
 */
export async function queryFormRmHeader(nopen: string): Promise<FormRmHeaderRow | null> {
  const sql = `
    SELECT ps.NORM, ps.NAMA, ps.JENIS_KELAMIN, ps.TANGGAL_LAHIR,
           (SELECT r.DESKRIPSI
              FROM ${SIMGOS_DB.PENDAFTARAN}.kunjungan k
              JOIN ${SIMGOS_DB.MASTER}.ruangan r ON r.ID = k.RUANGAN
              WHERE k.NOPEN = pp.NOMOR AND k.STATUS <> 0
              ORDER BY (r.JENIS_KUNJUNGAN = 2) DESC, (r.JENIS_KUNJUNGAN = 3) DESC, k.MASUK ASC
              LIMIT 1) AS RUANG,
           (SELECT k.MASUK
              FROM ${SIMGOS_DB.PENDAFTARAN}.kunjungan k
              WHERE k.NOPEN = pp.NOMOR AND k.STATUS <> 0
              ORDER BY k.MASUK ASC LIMIT 1) AS MASUK
    FROM ${SIMGOS_DB.PENDAFTARAN}.pendaftaran pp
    JOIN ${SIMGOS_DB.MASTER}.pasien ps ON ps.NORM = pp.NORM
    WHERE pp.NOMOR = ? AND pp.STATUS = 1
    LIMIT 1`;

  const rows = await getSimgos().$queryRawUnsafe<FormRmHeaderRow[]>(sql, nopen);
  return rows[0] ?? null;
}
