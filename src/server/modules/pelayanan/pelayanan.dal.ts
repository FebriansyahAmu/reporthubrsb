import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/** Baris mentah kunjungan + lama rawat (nama kolom apa adanya dari SIMGOS). */
export type KunjunganPelayananRow = {
  NOMOR: string;
  NOPEN: string;
  RUANGAN_ID: string;
  RUANG: string;
  JENIS_KUNJUNGAN: number;
  MASUK: Date | string;
  KELUAR: Date | string | null;
  /** Menit MASUK→COALESCE(KELUAR, NOW()) dihitung di DB. */
  LAMA_MENIT: number | string | null;
  NORM: string | number;
  NAMA: string;
  JENIS_KELAMIN: number | string;
  TANGGAL_LAHIR: Date | string | null;
};

export type KunjunganRangeArgs = {
  /** Batas bawah MASUK, inklusif — "YYYY-MM-DD". */
  from: string;
  /** Batas atas MASUK, eksklusif — "YYYY-MM-DD". */
  to: string;
  /** ID ruangan opsional (master.ruangan.ID). */
  ruanganId?: string;
};

/**
 * Kunjungan pada rentang tanggal (+ ruangan opsional) beserta LAMA rawat.
 * `LAMA_MENIT` dihitung di DB: final = MASUK→KELUAR (bebas timezone), berjalan =
 * MASUK→NOW() (mengikuti jam server DB). Read-only, lintas-DB; param via `?`.
 */
export async function queryKunjunganRange(
  a: KunjunganRangeArgs,
): Promise<KunjunganPelayananRow[]> {
  const params: unknown[] = [a.from, a.to];
  let ruanganClause = "";
  if (a.ruanganId) {
    ruanganClause = "AND k.RUANGAN = ?";
    params.push(a.ruanganId);
  }

  const sql = `
    SELECT k.NOMOR,
           k.NOPEN,
           r.ID              AS RUANGAN_ID,
           r.DESKRIPSI       AS RUANG,
           r.JENIS_KUNJUNGAN,
           k.MASUK,
           k.KELUAR,
           TIMESTAMPDIFF(MINUTE, k.MASUK, COALESCE(k.KELUAR, NOW())) AS LAMA_MENIT,
           ps.NORM,
           ps.NAMA,
           ps.JENIS_KELAMIN,
           ps.TANGGAL_LAHIR
    FROM ${SIMGOS_DB.PENDAFTARAN}.kunjungan k
    JOIN ${SIMGOS_DB.MASTER}.ruangan r        ON r.ID = k.RUANGAN
    JOIN ${SIMGOS_DB.PENDAFTARAN}.pendaftaran pp ON pp.NOMOR = k.NOPEN
    JOIN ${SIMGOS_DB.MASTER}.pasien ps        ON ps.NORM = pp.NORM
    WHERE CHAR_LENGTH(r.ID) = 9
      AND r.JENIS_KUNJUNGAN IN (1, 2, 3)
      AND k.MASUK >= ? AND k.MASUK < ?
      ${ruanganClause}
    ORDER BY k.MASUK DESC
    LIMIT 1000`;

  return getSimgos().$queryRawUnsafe<KunjunganPelayananRow[]>(sql, ...params);
}
