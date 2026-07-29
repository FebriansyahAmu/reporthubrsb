import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/** Header pasien + jumlah keberadaan tiap dokumen klaim untuk satu NOPEN. */
export type BerkasDetailRow = {
  NOPEN: string;
  NORM: string | number;
  NAMA: string;
  JENIS_KELAMIN: number | string;
  TANGGAL_LAHIR: Date | string | null;
  TRIAGE_N: number | string | null;
  RESUME_N: number | string | null;
  SPRI_N: number | string | null;
  CPPT_N: number | string | null;
  DIAGNOSA_N: number | string | null;
};

/**
 * Header episode + agregat keberadaan dokumen klaim (READ-ONLY, lintas-DB).
 * Dokumen dideteksi via kunci masing-masing:
 *   triase/resume → `medicalrecord.*` per NOPEN (STATUS=1)
 *   SPRI          → `medicalrecord.perencanaan_rawat_inap.PENDAFTARAN_RI_NOMOR`
 *   CPPT          → `medicalrecord.cppt.KUNJUNGAN` (join ke leg kunjungan NOPEN)
 *   diagnosa      → penanda kelengkapan rekam medis
 * SEP & Bukti Pelayanan TIDAK dideteksi di sini (belum ada pemetaan andal).
 */
export async function queryBerkasDetail(nopen: string): Promise<BerkasDetailRow | null> {
  const sql = `
    SELECT pp.NOMOR AS NOPEN,
           ps.NORM, ps.NAMA, ps.JENIS_KELAMIN, ps.TANGGAL_LAHIR,
           (SELECT COUNT(*) FROM ${SIMGOS_DB.MEDICALRECORD}.triage t
              WHERE t.NOPEN = pp.NOMOR AND t.STATUS = 1) AS TRIAGE_N,
           (SELECT COUNT(*) FROM ${SIMGOS_DB.MEDICALRECORD}.resume rs
              WHERE rs.NOPEN = pp.NOMOR AND rs.STATUS = 1) AS RESUME_N,
           (SELECT COUNT(*) FROM ${SIMGOS_DB.MEDICALRECORD}.perencanaan_rawat_inap s
              WHERE s.PENDAFTARAN_RI_NOMOR = pp.NOMOR) AS SPRI_N,
           (SELECT COUNT(*) FROM ${SIMGOS_DB.MEDICALRECORD}.cppt c
              JOIN ${SIMGOS_DB.PENDAFTARAN}.kunjungan kk ON kk.NOMOR = c.KUNJUNGAN
              WHERE kk.NOPEN = pp.NOMOR AND c.STATUS = 1) AS CPPT_N,
           (SELECT COUNT(*) FROM ${SIMGOS_DB.MEDICALRECORD}.diagnosa d
              WHERE d.NOPEN = pp.NOMOR AND d.STATUS = 1) AS DIAGNOSA_N
    FROM ${SIMGOS_DB.PENDAFTARAN}.pendaftaran pp
    JOIN ${SIMGOS_DB.MASTER}.pasien ps ON ps.NORM = pp.NORM
    WHERE pp.NOMOR = ? AND pp.STATUS = 1
    LIMIT 1`;

  const rows = await getSimgos().$queryRawUnsafe<BerkasDetailRow[]>(sql, nopen);
  return rows[0] ?? null;
}

/** Baris tindakan medis (untuk prefill Bukti Pelayanan). */
export type TindakanRow = {
  TANGGAL: Date | string | null;
  NAMA: string | null;
  RUANG: string | null;
};

/**
 * Tindakan medis pada satu episode (NOPEN), ditarik dari `layanan.tindakan_medis`
 * (join ke leg kunjungan & `master.tindakan` untuk nama). READ-ONLY — hanya untuk
 * prefill; hasil isian disimpan di DB reporthub, bukan di sini.
 */
export async function queryTindakanByNopen(nopen: string): Promise<TindakanRow[]> {
  const sql = `
    SELECT tm.TANGGAL,
           mt.NAMA      AS NAMA,
           r.DESKRIPSI  AS RUANG
    FROM ${SIMGOS_DB.LAYANAN}.tindakan_medis tm
    JOIN ${SIMGOS_DB.PENDAFTARAN}.kunjungan k ON k.NOMOR = tm.KUNJUNGAN
    LEFT JOIN ${SIMGOS_DB.MASTER}.ruangan r   ON r.ID = k.RUANGAN
    LEFT JOIN ${SIMGOS_DB.MASTER}.tindakan mt ON mt.ID = tm.TINDAKAN
    WHERE k.NOPEN = ? AND tm.STATUS = 1
    ORDER BY tm.TANGGAL ASC
    LIMIT 200`;

  return getSimgos().$queryRawUnsafe<TindakanRow[]>(sql, nopen);
}
