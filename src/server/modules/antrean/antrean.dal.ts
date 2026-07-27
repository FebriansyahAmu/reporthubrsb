import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/** Baris reservasi (nama kolom apa adanya dari regonline.reservasi + nama poli). */
export type ReservasiRow = {
  ID: string;
  NAMA: string | null;
  NORM: number | string | null;
  NIK: string | null;
  NO_KARTU_BPJS: string | null;
  TANGGALKUNJUNGAN: Date | string | null;
  POLI: number | string | null;
  POLI_BPJS: string | null;
  DOKTER: string | null;
  NOMOR_ANTRIAN: number | null;
  ANTRIAN_POLI: number | null;
  POS_ANTRIAN: string | null;
  STATUS: number | null;
  IS_BATAL_MJKN: number | null;
  /** master.ruangan.DESKRIPSI hasil LEFT JOIN (POLI = ruangan.ID 9-digit). */
  POLI_NAMA: string | null;
};

/** Satu event task antrean (waktu ada di kolom TANGGAL — bukan WAKTU). */
export type TaskActionRow = {
  ANTRIAN: string;
  TASK_ID: number;
  TANGGAL: Date | string | null;
  STATUS: number | null;
};

/**
 * Reservasi BPJS pada satu tanggal kunjungan, plus nama poli (dari master.ruangan).
 * Read-only, lintas-DB. `tanggal` di-bind lewat `?`; nama DB dari konstanta.
 */
export async function queryReservasiByTanggal(tanggal: string): Promise<ReservasiRow[]> {
  const sql = `
    SELECT r.ID,
           r.NAMA,
           r.NORM,
           r.NIK,
           r.NO_KARTU_BPJS,
           r.TANGGALKUNJUNGAN,
           r.POLI,
           r.POLI_BPJS,
           r.DOKTER,
           r.NOMOR_ANTRIAN,
           r.ANTRIAN_POLI,
           r.POS_ANTRIAN,
           r.STATUS,
           r.IS_BATAL_MJKN,
           ru.DESKRIPSI AS POLI_NAMA
    FROM ${SIMGOS_DB.REGONLINE}.reservasi r
    LEFT JOIN ${SIMGOS_DB.MASTER}.ruangan ru ON ru.ID = r.POLI
    WHERE r.TANGGALKUNJUNGAN = ?
    ORDER BY r.NOMOR_ANTRIAN, r.ID
    LIMIT 1000`;
  return getSimgos().$queryRawUnsafe<ReservasiRow[]>(sql, tanggal);
}

/**
 * Semua event task (TASK_ID 1..7) untuk reservasi pada tanggal terpilih.
 * Waktu tiap task dibaca dari kolom `TANGGAL`. Di-scope lewat join ke reservasi
 * agar hanya menarik antrean tanggal tersebut.
 */
export async function queryTaskActionsByTanggal(tanggal: string): Promise<TaskActionRow[]> {
  const sql = `
    SELECT t.ANTRIAN,
           t.TASK_ID,
           t.TANGGAL,
           t.STATUS
    FROM ${SIMGOS_DB.REGONLINE}.task_action_antrian t
    JOIN ${SIMGOS_DB.REGONLINE}.reservasi r ON r.ID = t.ANTRIAN
    WHERE r.TANGGALKUNJUNGAN = ?
      AND t.TASK_ID BETWEEN 1 AND 7
    ORDER BY t.ANTRIAN, t.TASK_ID, t.TANGGAL`;
  return getSimgos().$queryRawUnsafe<TaskActionRow[]>(sql, tanggal);
}
