import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import { menularWhereFragment } from "@/server/lib/icd-menular";
import { diagnosaSumberSql } from "@/server/lib/diagnosa-sumber";
import type { MenularMode, Rl51Filter } from "./rl51.types";

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
 * Kasus baru dihitung dari RIWAYAT, bukan dari kolom `md.BARU`: kode ICD-10
 * kasus `k` belum pernah tercatat (diagnosa STATUS=1, klinis maupun grouper)
 * pada pendaftaran LAIN pasien yang sama yang lebih awal. Definisinya sama
 * dengan trigger SIMGOS `onBeforeInsertDiagnosa` yang mengisi `BARU`, tetapi
 * tidak bergantung pada urutan simpan.
 *
 * Kenapa: trigger itu juga memeriksa baris kunjungan yang SAMA, sehingga
 * `BARU = 1` jatuh ke baris yang tersimpan lebih dulu. Sejak 10 Mei 2026
 * baris grouper tersimpan lebih dulu → baris klinis selalu `BARU = 0` → kasus
 * baru & seluruh kolom umur RL 5.1 = 0. Divalidasi Jan–Apr 2026 (saat `BARU`
 * masih benar): cocok ±99,5%.
 */
const BARU_RIWAYAT = `NOT EXISTS (
          SELECT 1 FROM ${PEND}.pendaftaran p2
            JOIN ${MED}.diagnosa d2 ON d2.NOPEN = p2.NOMOR
          WHERE p2.NORM = k.norm AND p2.NOMOR <> k.nopen AND p2.TANGGAL < k.tgl
            AND d2.KODE = k.kode AND d2.\`STATUS\` = 1)`;

/**
 * SQL agregat RL 5.1, tiga lapis:
 *  1. `k` = SATU baris per kasus (NOPEN,KODE): jenis kelamin, kelompok umur,
 *     NORM & tanggal kunjungan (konstan per kunjungan → MAX), dan penanda
 *     diagnosa grouper;
 *  2. `c` = `k` + status kasus baru dari riwayat (`BARU_RIWAYAT`);
 *  3. agregat per kode ICD: total kunjungan, L/P, kasus baru (+ L/P), kasus
 *     dari diagnosa grouper, dan 50 sel (25 kelompok × L/P) KHUSUS kasus baru.
 *
 * Dedup lewat grain (NOPEN,KODE) menangani baris diagnosa duplikat & fan-out
 * multi-leg. Rawat Jalan + Gawat Darurat (JENIS_KUNJUNGAN IN (1,2)); tanggal
 * pakai `pp.TANGGAL` (kunjungan). Sumber diagnosa per kunjungan: klinis, atau
 * grouper bila tak ada klinis (`diagnosaSumberSql`). Join kosmetik SP
 * (referensi, penjamin, pasien_pulang, instansi cross-join) dibuang.
 */
function buildMatrixSql(menular: MenularMode): string {
  const age: string[] = [];
  for (let n = 1; n <= 25; n++) {
    age.push(`SUM(c.jk = 1 AND c.baru = 1 AND c.klp = ${n}) AS k${n}l`);
    age.push(`SUM(c.jk = 2 AND c.baru = 1 AND c.klp = ${n}) AS k${n}p`);
  }
  // Filter kelompok penyakit (menular/non) — kondisi berbasis prefiks ICD tetap.
  const menularWhere = menularWhereFragment(menular, "md.KODE");
  return `
    SELECT c.kode AS kode,
           ${MASTER}.getDeskripsiICD(c.kode) AS nama,
           COUNT(*) AS total,
           SUM(c.jk = 1) AS lk,
           SUM(c.jk = 2) AS pr,
           SUM(c.baru = 1) AS baru,
           SUM(c.jk = 1 AND c.baru = 1) AS baruLk,
           SUM(c.jk = 2 AND c.baru = 1) AS baruPr,
           SUM(c.grouper = 1) AS dariGrouper,
           ${age.join(",\n           ")}
    FROM (
      SELECT k.kode, k.jk, k.klp, k.grouper, ${BARU_RIWAYAT} AS baru
      FROM (
        SELECT md.NOPEN AS nopen, md.KODE AS kode,
               MAX(pp.NORM) AS norm,
               MAX(pp.TANGGAL) AS tgl,
               MAX(ps.JENIS_KELAMIN) AS jk,
               MAX(md.INA_GROUPER) AS grouper,
               MAX(${KLP}) AS klp
        FROM ${PEND}.kunjungan pk
          JOIN ${MASTER}.ruangan r
            ON pk.RUANGAN = r.ID AND r.JENIS = 5 AND r.JENIS_KUNJUNGAN IN (1, 2)
          JOIN ${PEND}.pendaftaran pp ON pk.NOPEN = pp.NOMOR
          JOIN ${PEND}.tujuan_pasien tp ON pp.NOMOR = tp.NOPEN AND pk.RUANGAN = tp.RUANGAN
          JOIN ${MED}.diagnosa md
            ON pk.NOPEN = md.NOPEN AND md.\`STATUS\` = 1 AND ${diagnosaSumberSql("md", MED)}
          LEFT JOIN ${MASTER}.pasien ps ON pp.NORM = ps.NORM
        WHERE md.KODE IS NOT NULL AND md.KODE <> ''${menularWhere}
          AND pp.TANGGAL BETWEEN ? AND ?
        GROUP BY md.NOPEN, md.KODE
      ) k
    ) c
    GROUP BY c.kode
    ORDER BY total DESC, c.kode`;
}

/** Matriks RL 5.1 per kode ICD-10 pada periode. Placeholder `?` = from, to. */
export async function queryRl51Matrix(f: Rl51Filter): Promise<Rl51MatrixRow[]> {
  const sql = buildMatrixSql(f.menular);
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
