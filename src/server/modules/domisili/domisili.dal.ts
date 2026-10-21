import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

const PEND = SIMGOS_DB.PENDAFTARAN;
const MASTER = SIMGOS_DB.MASTER;

/** Batas waktu eksekusi di server DB (MySQL 8) — laporan berat tak boleh menyandera koneksi. */
const CAP = "/*+ MAX_EXECUTION_TIME(15000) */";

/**
 * Satu baris per pendaftaran (episode) per jenis layanan — definisi kunjungan
 * yang sama dengan Laporan Pengunjung & Dasbor (port SP
 * `LaporanPengunjungPerpasien`): kunjungan masuk utama (`REF IS NULL`) ke ruangan
 * tujuan pendaftaran, pendaftaran & kunjungan tidak batal, ruangan pelayanan
 * (`JENIS = 5`) berjenis 1 RJ / 2 IGD / 3 RI.
 *
 * Domisili = 6 digit pertama `master.pasien.WILAYAH` (kecamatan; '' bila kosong).
 * `FORCE INDEX (MASUK)`: biaya sebanding panjang periode, bukan ukuran tabel
 * (tanpa itu optimizer memindai indeks `REF` — seluruh kunjungan utama sepanjang masa).
 */
const EPISODE = `
  SELECT pd.NOMOR nopen, pd.NORM norm, jkr.JENIS_KUNJUNGAN jenis,
         COALESCE(LEFT(TRIM(ps.WILAYAH), 6), '') kec
  FROM ${PEND}.kunjungan tk FORCE INDEX (MASUK)
  JOIN ${PEND}.pendaftaran pd ON pd.NOMOR = tk.NOPEN
  JOIN ${PEND}.tujuan_pasien tp ON tp.NOPEN = pd.NOMOR AND tp.RUANGAN = tk.RUANGAN
  JOIN ${MASTER}.ruangan jkr ON jkr.ID = tk.RUANGAN AND jkr.JENIS = 5
  JOIN ${MASTER}.pasien ps ON ps.NORM = pd.NORM
  WHERE tk.MASUK BETWEEN ? AND ?
    AND tk.REF IS NULL AND tk.\`STATUS\` IN (1, 2)
    AND pd.\`STATUS\` IN (1, 2)
    AND jkr.JENIS_KUNJUNGAN IN (1, 2, 3)
  GROUP BY pd.NOMOR, pd.NORM, jkr.JENIS_KUNJUNGAN, ps.WILAYAH`;
// ⚠️ GROUP BY memakai kolom eksplisit, bukan alias: MySQL mengikat nama di GROUP BY
// ke kolom tabel lebih dulu (mis. `jenis` → master.ruangan.JENIS), baru ke alias.

export type AgregatRow = {
  kec: string | null;
  jenis: number | null;
  /** 1 = baris subtotal ROLLUP (kecamatan semua layanan / total keseluruhan). */
  gKec: number | bigint;
  gJenis: number | bigint;
  kunjungan: number | bigint;
  pasien: number | bigint;
  namaKab: string | null;
  namaKec: string | null;
  namaProv: string | null;
};

/**
 * Agregat per (kecamatan domisili × jenis layanan) + subtotal per kecamatan +
 * total (`WITH ROLLUP`, `COUNT(DISTINCT)` dihitung ulang di tiap tingkat →
 * pasien unik "semua layanan" tepat). Nama wilayah di-join SETELAH agregasi (PK,
 * puluhan baris). Hanya dua tanggal yang di-bind; tak ada nilai pengguna di-inline.
 */
export async function queryAgregatDomisili(from: string, to: string): Promise<AgregatRow[]> {
  const sql = `
    SELECT ${CAP} a.kec, a.jenis, a.gKec, a.gJenis, a.kunjungan, a.pasien,
           kab.DESKRIPSI namaKab, kc.DESKRIPSI namaKec, prov.DESKRIPSI namaProv
    FROM (
      SELECT e.kec, e.jenis, GROUPING(e.kec) gKec, GROUPING(e.jenis) gJenis,
             COUNT(*) kunjungan, COUNT(DISTINCT e.norm) pasien
      FROM ( ${EPISODE} ) e
      GROUP BY e.kec, e.jenis WITH ROLLUP
    ) a
    LEFT JOIN ${MASTER}.wilayah kab ON kab.ID = LEFT(a.kec, 4) AND kab.JENIS = 2
    LEFT JOIN ${MASTER}.wilayah kc ON kc.ID = a.kec AND kc.JENIS = 3
    LEFT JOIN ${MASTER}.wilayah prov ON prov.ID = LEFT(a.kec, 2) AND prov.JENIS = 1`;
  return getSimgos().$queryRawUnsafe<AgregatRow[]>(sql, `${from} 00:00:00`, `${to} 23:59:59`);
}

export type WilayahRow = { id: string; jenis: number | bigint; nama: string };

/** Kabupaten + seluruh kecamatannya (`master.wilayah`), untuk baris kecamatan bernilai nol. */
export async function queryWilayahKabupaten(kodeKab: string): Promise<WilayahRow[]> {
  const sql = `
    SELECT ${CAP} ID id, JENIS jenis, DESKRIPSI nama
    FROM ${MASTER}.wilayah
    WHERE (ID = ? AND JENIS = 2) OR (ID LIKE CONCAT(?, '__') AND JENIS = 3)
    ORDER BY ID`;
  return getSimgos().$queryRawUnsafe<WilayahRow[]>(sql, kodeKab, kodeKab);
}
