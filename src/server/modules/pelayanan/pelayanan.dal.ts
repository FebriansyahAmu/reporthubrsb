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
      AND pp.STATUS = 1
      AND k.MASUK >= ? AND k.MASUK < ?
      ${ruanganClause}
    ORDER BY k.MASUK DESC
    LIMIT 1000`;

  return getSimgos().$queryRawUnsafe<KunjunganPelayananRow[]>(sql, ...params);
}

/**
 * Kunjungan yang BELUM difinalkan (KELUAR NULL) dalam 90 hari terakhir, diurut
 * MASUK menaik (terlama terbuka lebih dulu). `LAMA_MENIT` = MASUK→NOW() = lama
 * tunggakan. Read-only; ruangan opsional.
 */
export async function queryBelumFinal(ruanganId?: string): Promise<KunjunganPelayananRow[]> {
  const params: unknown[] = [];
  let ruanganClause = "";
  if (ruanganId) {
    ruanganClause = "AND k.RUANGAN = ?";
    params.push(ruanganId);
  }

  const sql = `
    SELECT k.NOMOR,
           k.NOPEN,
           r.ID              AS RUANGAN_ID,
           r.DESKRIPSI       AS RUANG,
           r.JENIS_KUNJUNGAN,
           k.MASUK,
           k.KELUAR,
           TIMESTAMPDIFF(MINUTE, k.MASUK, NOW()) AS LAMA_MENIT,
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
      AND pp.STATUS = 1
      AND k.KELUAR IS NULL
      AND k.MASUK >= NOW() - INTERVAL 90 DAY
      ${ruanganClause}
    ORDER BY k.MASUK ASC
    LIMIT 1000`;

  return getSimgos().$queryRawUnsafe<KunjunganPelayananRow[]>(sql, ...params);
}

/** Baris kunjungan FINAL + agregat kelengkapan diagnosa (per NOPEN). */
export type DiagnosaRow = {
  NOMOR: string;
  NOPEN: string;
  RUANGAN_ID: string;
  RUANG: string;
  JENIS_KUNJUNGAN: number;
  MASUK: Date | string;
  KELUAR: Date | string | null;
  NORM: string | number;
  NAMA: string;
  JENIS_KELAMIN: number | string;
  TANGGAL_LAHIR: Date | string | null;
  JML: number | string | null;
  JML_UTAMA: number | string | null;
  JML_KODE: number | string | null;
  UTAMA_NAMA: string | null;
  UTAMA_KODE: string | null;
  REP_NAMA: string | null;
  REP_KODE: string | null;
};

/**
 * Kunjungan FINAL (KELUAR terisi, pendaftaran aktif) pada rentang tanggal, di-LEFT
 * JOIN agregat `medicalrecord.diagnosa` (STATUS=1) per NOPEN untuk menilai
 * kelengkapan: jumlah diagnosa, jumlah UTAMA(=1 primer), jumlah ber-KODE ICD,
 * plus diagnosa representatif. Read-only, lintas-DB; ruangan opsional.
 */
export async function queryDiagnosaKelengkapan(
  a: KunjunganRangeArgs,
): Promise<DiagnosaRow[]> {
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
           ps.NORM,
           ps.NAMA,
           ps.JENIS_KELAMIN,
           ps.TANGGAL_LAHIR,
           dx.JML,
           dx.JML_UTAMA,
           dx.JML_KODE,
           dx.UTAMA_NAMA,
           dx.UTAMA_KODE,
           dx.REP_NAMA,
           dx.REP_KODE
    FROM ${SIMGOS_DB.PENDAFTARAN}.kunjungan k
    JOIN ${SIMGOS_DB.MASTER}.ruangan r        ON r.ID = k.RUANGAN
    JOIN ${SIMGOS_DB.PENDAFTARAN}.pendaftaran pp ON pp.NOMOR = k.NOPEN
    JOIN ${SIMGOS_DB.MASTER}.pasien ps        ON ps.NORM = pp.NORM
    LEFT JOIN (
      SELECT NOPEN,
             COUNT(*)                                   AS JML,
             SUM(UTAMA = 1)                             AS JML_UTAMA,
             SUM(KODE IS NOT NULL AND KODE <> '')       AS JML_KODE,
             MAX(CASE WHEN UTAMA = 1 THEN DIAGNOSA END) AS UTAMA_NAMA,
             MAX(CASE WHEN UTAMA = 1 THEN KODE END)     AS UTAMA_KODE,
             MAX(DIAGNOSA)                              AS REP_NAMA,
             MAX(KODE)                                  AS REP_KODE
      FROM ${SIMGOS_DB.MEDICALRECORD}.diagnosa
      WHERE STATUS = 1
      GROUP BY NOPEN
    ) dx ON dx.NOPEN = k.NOPEN
    WHERE CHAR_LENGTH(r.ID) = 9
      AND r.JENIS_KUNJUNGAN IN (1, 2, 3)
      AND pp.STATUS = 1
      AND k.KELUAR IS NOT NULL
      AND k.MASUK >= ? AND k.MASUK < ?
      ${ruanganClause}
    ORDER BY k.MASUK DESC
    LIMIT 1000`;

  return getSimgos().$queryRawUnsafe<DiagnosaRow[]>(sql, ...params);
}
