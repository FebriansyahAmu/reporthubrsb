import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import type { PenyakitFilter } from "./penyakit.types";

const PEND = SIMGOS_DB.PENDAFTARAN;
const MASTER = SIMGOS_DB.MASTER;
const MED = SIMGOS_DB.MEDICALRECORD;
const LAY = SIMGOS_DB.LAYANAN;

/**
 * FROM + JOIN inti yang menentukan inklusi baris (diporting dari SP
 * `LaporanPasienPerICD10`). Hanya join yang MEMENGARUHI himpunan kasus yang
 * dipertahankan; join kosmetik SP (INA-CBG, tagihan, instansi, referensi label)
 * dibuang → hasil identik namun jauh lebih ringan.
 *
 * - `ruangan r` (JENIS=5) menentukan JENIS_KUNJUNGAN (RJ/GD/RI).
 * - `tujuan_pasien tp` mengunci kunjungan ke ruangan tujuan pasien (mencegah
 *   satu pendaftaran tercatat lewat ruangan transit).
 * - Untuk Rawat Inap (jenis=3) dipakai `pasien_pulang lpp` (episode selesai);
 *   tanggal & keberadaan kepulangan diverifikasi.
 *
 * `jenis`/`caraBayar` sudah dijamin angka (1..3 / 0..2) oleh schema — aman di-inline.
 */
function coreFrom(jenis: number, caraBayar: number): string {
  const isRI = jenis === 3;
  const discharge = isRI
    ? `JOIN ${PEND}.kunjungan pk2 ON pk.NOPEN = pk2.NOPEN AND pk2.\`STATUS\` IN (1, 2)
       JOIN ${LAY}.pasien_pulang lpp ON lpp.KUNJUNGAN = pk2.NOMOR AND lpp.\`STATUS\` = 1`
    : "";
  const pj = caraBayar > 0 ? `JOIN ${PEND}.penjamin pj ON pp.NOMOR = pj.NOPEN` : "";
  return `
    FROM ${PEND}.kunjungan pk
      JOIN ${MASTER}.ruangan r ON pk.RUANGAN = r.ID AND r.JENIS = 5
      JOIN ${PEND}.pendaftaran pp ON pk.NOPEN = pp.NOMOR
      JOIN ${PEND}.tujuan_pasien tp ON pp.NOMOR = tp.NOPEN AND pk.RUANGAN = tp.RUANGAN
      JOIN ${MED}.diagnosa md ON pk.NOPEN = md.NOPEN AND md.\`STATUS\` = 1 AND md.INA_GROUPER = 0
      LEFT JOIN ${MASTER}.pasien ps ON pp.NORM = ps.NORM
      ${discharge}
      ${pj}`;
}

/**
 * WHERE bersama. Tanggal memakai `lpp.TANGGAL` (RI, tanggal pulang) atau
 * `pp.TANGGAL` (RJ/GD, tanggal masuk) — mengikuti SP. Kode kosong (uncoded)
 * dibuang agar peringkat penyakit bermakna. Placeholder `?` untuk from & to.
 */
function coreWhere(f: PenyakitFilter): string {
  const isRI = f.jenis === 3;
  const dateCol = isRI ? "lpp.TANGGAL" : "pp.TANGGAL";
  const bayar = f.caraBayar > 0 ? `AND pj.JENIS = ${f.caraBayar}` : "";
  const utama = f.utama ? "AND md.UTAMA = 1" : "";
  return `
    WHERE r.JENIS_KUNJUNGAN = ${f.jenis}
      AND md.KODE IS NOT NULL AND md.KODE <> ''
      ${bayar}
      ${utama}
      AND ${dateCol} BETWEEN ? AND ?`;
}

function params(f: PenyakitFilter): unknown[] {
  return [`${f.from} 00:00:00`, `${f.to} 23:59:59`];
}

export type TopPenyakitRow = {
  kode: string;
  nama: string | null;
  dxText: string | null;
  kasus: number | bigint | null;
  pasien: number | bigint | null;
  lk: number | bigint | null;
  pr: number | bigint | null;
};

/**
 * Peringkat N penyakit terbanyak (per kasus / pasien) pada periode & filter.
 * Agregasi kode ICD-10 dilakukan di sub-query lebih dulu, LIMIT-nya baru diberi
 * deskripsi via `master.getDeskripsiICD` (fungsi hanya dipanggil untuk 10 baris).
 */
export async function queryTopPenyakit(f: PenyakitFilter): Promise<TopPenyakitRow[]> {
  const order = f.metric === "pasien" ? "pasien" : "kasus";
  const sql = `
    SELECT k.kode AS kode,
           ${MASTER}.getDeskripsiICD(k.kode) AS nama,
           k.dxText AS dxText,
           k.kasus AS kasus, k.pasien AS pasien, k.lk AS lk, k.pr AS pr
    FROM (
      SELECT md.KODE AS kode,
             COUNT(DISTINCT md.NOPEN) AS kasus,
             COUNT(DISTINCT pp.NORM) AS pasien,
             COUNT(DISTINCT IF(ps.JENIS_KELAMIN = 1, md.NOPEN, NULL)) AS lk,
             COUNT(DISTINCT IF(ps.JENIS_KELAMIN = 2, md.NOPEN, NULL)) AS pr,
             MIN(NULLIF(TRIM(md.DIAGNOSA), '')) AS dxText
      ${coreFrom(f.jenis, f.caraBayar)}
      ${coreWhere(f)}
      GROUP BY md.KODE
      ORDER BY ${order} DESC, kasus DESC, md.KODE
      LIMIT ${Math.trunc(f.limit)}
    ) k`;
  return getSimgos().$queryRawUnsafe<TopPenyakitRow[]>(sql, ...params(f));
}

export type PenyakitGrandRow = {
  jenisDiag: number | bigint | null;
  totalKasus: number | bigint | null;
  totalPasien: number | bigint | null;
};

/** Total keseluruhan (semua penyakit pada filter) untuk konteks "10 besar vs total". */
export async function queryPenyakitGrandTotal(f: PenyakitFilter): Promise<PenyakitGrandRow> {
  const sql = `
    SELECT COUNT(DISTINCT md.KODE) AS jenisDiag,
           COUNT(DISTINCT CONCAT(md.NOPEN, '|', md.KODE)) AS totalKasus,
           COUNT(DISTINCT pp.NORM) AS totalPasien
    ${coreFrom(f.jenis, f.caraBayar)}
    ${coreWhere(f)}`;
  const rows = await getSimgos().$queryRawUnsafe<PenyakitGrandRow[]>(sql, ...params(f));
  return rows[0] ?? { jenisDiag: 0, totalKasus: 0, totalPasien: 0 };
}
