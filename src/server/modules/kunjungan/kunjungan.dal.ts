import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/** Baris mentah hasil join kunjungan (nama kolom apa adanya dari SIMGOS). */
export type KunjunganRow = {
  NOPEN: string;
  RUANG: string;
  JENIS_KUNJUNGAN: number;
  MASUK: Date | string;
  KELUAR: Date | string | null;
  NORM: string | number;
  NAMA: string;
  JENIS_KELAMIN: number | string;
  TANGGAL_LAHIR: Date | string | null;
};

export type KunjunganQueryArgs = {
  /** Batas bawah tanggal MASUK, inklusif — "YYYY-MM-DD". */
  from: string;
  /** Batas atas tanggal MASUK, eksklusif — "YYYY-MM-DD". */
  to: string;
  /** ID ruangan (master.ruangan.ID) opsional. */
  ruanganId?: string;
};

/**
 * Ambil kunjungan pada rentang tanggal (dan ruangan opsional), dipisah kategori
 * lewat `master.ruangan`, plus identitas pasien. Read-only, lintas-DB.
 *
 * Nilai parameter (tanggal & ruangan) SELALU di-bind lewat `?`. Nama DB berasal
 * dari konstanta SIMGOS_DB (bukan input user).
 */
export async function queryKunjunganResume(a: KunjunganQueryArgs): Promise<KunjunganRow[]> {
  const params: unknown[] = [a.from, a.to];
  let ruanganClause = "";
  if (a.ruanganId) {
    ruanganClause = "AND k.RUANGAN = ?";
    params.push(a.ruanganId);
  }

  const sql = `
    SELECT k.NOPEN,
           r.DESKRIPSI       AS RUANG,
           r.JENIS_KUNJUNGAN,
           k.MASUK,
           k.KELUAR,
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
    LIMIT 500`;

  return getSimgos().$queryRawUnsafe<KunjunganRow[]>(sql, ...params);
}
