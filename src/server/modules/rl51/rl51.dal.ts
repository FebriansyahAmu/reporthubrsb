import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import type { Rl51Filter } from "./rl51.types";

const PEND = SIMGOS_DB.PENDAFTARAN;
const MASTER = SIMGOS_DB.MASTER;
const MED = SIMGOS_DB.MEDICALRECORD;
const APP = SIMGOS_DB.APLIKASI;

/**
 * Ekspresi 25 kelompok umur RL (SIRS Kemenkes) — sama persis dengan RL 4.1
 * (harus sinkron dengan `RL41_AGE_GROUPS` di rl41.constants). Umur dihitung
 * pada tanggal KUNJUNGAN (`pp.TANGGAL`) relatif ke `ps.TANGGAL_LAHIR`.
 *
 * CATATAN: SP `LaporanRL51Revisi` keliru memakai `master.getKelompokUmur`
 * (9 kelompok) untuk kolom KLP1..25 → KLP10-25 selalu 0. Port ini memakai 25
 * batas yang benar. Tak ada input user → aman.
 */
const KLP = `CASE
  WHEN TIMESTAMPDIFF(HOUR, ps.TANGGAL_LAHIR, pp.TANGGAL) < 1 THEN 1
  WHEN TIMESTAMPDIFF(HOUR, ps.TANGGAL_LAHIR, pp.TANGGAL) < 24 THEN 2
  WHEN TIMESTAMPDIFF(DAY, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 7 THEN 3
  WHEN TIMESTAMPDIFF(DAY, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 28 THEN 4
  WHEN TIMESTAMPDIFF(MONTH, ps.TANGGAL_LAHIR, pp.TANGGAL) < 3 THEN 5
  WHEN TIMESTAMPDIFF(MONTH, ps.TANGGAL_LAHIR, pp.TANGGAL) < 6 THEN 6
  WHEN TIMESTAMPDIFF(MONTH, ps.TANGGAL_LAHIR, pp.TANGGAL) < 12 THEN 7
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 4 THEN 8
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 9 THEN 9
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 14 THEN 10
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 19 THEN 11
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 24 THEN 12
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 29 THEN 13
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 34 THEN 14
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 39 THEN 15
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 44 THEN 16
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 49 THEN 17
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 54 THEN 18
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 59 THEN 19
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 64 THEN 20
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 69 THEN 21
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 74 THEN 22
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 79 THEN 23
  WHEN TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, pp.TANGGAL) <= 84 THEN 24
  ELSE 25 END`;

export type Rl51MatrixRow = Record<string, string | number | bigint | null>;

/**
 * SQL agregat RL 5.1. Sub-query dalam = SATU baris per kasus (NOPEN,KODE):
 * jenis kelamin & kelompok umur konstan per kunjungan (MAX), status kasus baru
 * `md.BARU` (MAX). Agregat luar per kode ICD: total kunjungan, L/P, kasus baru
 * (+ L/P), dan 50 sel (25 kelompok × L/P) KHUSUS kasus baru.
 *
 * Dedup lewat grain (NOPEN,KODE) menangani baris diagnosa duplikat & fan-out
 * multi-leg. Rawat Jalan + Gawat Darurat (JENIS_KUNJUNGAN IN (1,2)); tanggal
 * pakai `pp.TANGGAL` (kunjungan). Join kosmetik SP (referensi, penjamin,
 * pasien_pulang, instansi cross-join) dibuang.
 */
function buildMatrixSql(): string {
  const age: string[] = [];
  for (let n = 1; n <= 25; n++) {
    age.push(`SUM(c.jk = 1 AND c.baru = 1 AND c.klp = ${n}) AS k${n}l`);
    age.push(`SUM(c.jk = 2 AND c.baru = 1 AND c.klp = ${n}) AS k${n}p`);
  }
  return `
    SELECT c.kode AS kode,
           ${MASTER}.getDeskripsiICD(c.kode) AS nama,
           COUNT(*) AS total,
           SUM(c.jk = 1) AS lk,
           SUM(c.jk = 2) AS pr,
           SUM(c.baru = 1) AS baru,
           SUM(c.jk = 1 AND c.baru = 1) AS baruLk,
           SUM(c.jk = 2 AND c.baru = 1) AS baruPr,
           ${age.join(",\n           ")}
    FROM (
      SELECT md.NOPEN AS nopen, md.KODE AS kode,
             MAX(ps.JENIS_KELAMIN) AS jk,
             MAX(md.BARU) AS baru,
             MAX(${KLP}) AS klp
      FROM ${PEND}.kunjungan pk
        JOIN ${MASTER}.ruangan r
          ON pk.RUANGAN = r.ID AND r.JENIS = 5 AND r.JENIS_KUNJUNGAN IN (1, 2)
        JOIN ${PEND}.pendaftaran pp ON pk.NOPEN = pp.NOMOR
        JOIN ${PEND}.tujuan_pasien tp ON pp.NOMOR = tp.NOPEN AND pk.RUANGAN = tp.RUANGAN
        JOIN ${MED}.diagnosa md
          ON pk.NOPEN = md.NOPEN AND md.\`STATUS\` = 1 AND md.INA_GROUPER = 0
        LEFT JOIN ${MASTER}.pasien ps ON pp.NORM = ps.NORM
      WHERE md.KODE IS NOT NULL AND md.KODE <> ''
        AND pp.TANGGAL BETWEEN ? AND ?
      GROUP BY md.NOPEN, md.KODE
    ) c
    GROUP BY c.kode
    ORDER BY total DESC, c.kode`;
}

/** Matriks RL 5.1 per kode ICD-10 pada periode. Placeholder `?` = from, to. */
export async function queryRl51Matrix(f: Rl51Filter): Promise<Rl51MatrixRow[]> {
  const sql = buildMatrixSql();
  return getSimgos().$queryRawUnsafe<Rl51MatrixRow[]>(
    sql,
    `${f.from} 00:00:00`,
    `${f.to} 23:59:59`,
  );
}

export type Rl51InstansiRow = Record<string, string | number | null>;

/** Identitas instansi (RS) untuk header laporan. Null bila belum terkonfigurasi. */
export async function queryRl51Instansi(): Promise<Rl51InstansiRow | null> {
  const sql = `
    SELECT p.KODE AS kodeRs, p.NAMA AS nama, p.WILAYAH AS kodeProp, w.DESKRIPSI AS kota
    FROM ${APP}.instansi ai, ${MASTER}.ppk p, ${MASTER}.wilayah w
    WHERE ai.PPK = p.ID AND p.WILAYAH = w.ID
    LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<Rl51InstansiRow[]>(sql);
  return rows[0] ?? null;
}
