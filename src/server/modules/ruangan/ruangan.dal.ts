import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import {
  JENIS_KUNJUNGAN_KATEGORI,
  type RuanganOption,
} from "@/server/modules/kunjungan/kunjungan.types";

type Row = { ID: string; DESKRIPSI: string; JENIS_KUNJUNGAN: number };

/**
 * Ambil ruangan pelayanan dari `master.ruangan`:
 *  - hanya ID **9 digit** (ruangan/unit leaf, bukan grup/instalasi),
 *  - hanya kategori RI/RJ Klinik/IGD (JENIS_KUNJUNGAN 1/2/3),
 *  - hanya yang aktif (STATUS = 1).
 * Nama tabel/kolom fixed (bukan input user) → aman di raw SQL.
 */
export async function queryRuanganKunjungan(): Promise<RuanganOption[]> {
  const sql = `
    SELECT ID, DESKRIPSI, JENIS_KUNJUNGAN
    FROM ${SIMGOS_DB.MASTER}.ruangan
    WHERE CHAR_LENGTH(ID) = 9
      AND JENIS_KUNJUNGAN IN (1, 2, 3)
      AND STATUS = 1
    ORDER BY JENIS_KUNJUNGAN, DESKRIPSI`;
  const rows = await getSimgos().$queryRawUnsafe<Row[]>(sql);
  return rows.map((r) => ({
    id: String(r.ID),
    nama: r.DESKRIPSI,
    kategori: JENIS_KUNJUNGAN_KATEGORI[Number(r.JENIS_KUNJUNGAN)] ?? "Rawat Jalan Klinik",
  }));
}
