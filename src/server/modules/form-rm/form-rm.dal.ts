import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/** Baris header identitas pasien untuk kepala formulir RM (READ-ONLY). */
export type FormRmHeaderRow = {
  NORM: string | number;
  NAMA: string;
  JENIS_KELAMIN: number | string;
  TANGGAL_LAHIR: Date | string | null;
  RUANG: string | null;
  MASUK: Date | string | null;
  /** NIK (kartu identitas JENIS=1/KTP) bila terdaftar di SIMGOS, else null. */
  NIK: string | null;
};

/**
 * Identitas pasien + ruang/waktu masuk leg awal untuk kepala formulir RM.
 * Ruang diambil dari leg IGD bila ada (prioritas), lalu leg terawal. READ-ONLY.
 * NIK diambil dari `master.kartu_identitas_pasien` (JENIS=1 = KTP) via NORM.
 * Null bila NOPEN tak ada / pendaftaran tak aktif.
 */
export async function queryFormRmHeader(nopen: string): Promise<FormRmHeaderRow | null> {
  const sql = `
    SELECT ps.NORM, ps.NAMA, ps.JENIS_KELAMIN, ps.TANGGAL_LAHIR,
           (SELECT r.DESKRIPSI
              FROM ${SIMGOS_DB.PENDAFTARAN}.kunjungan k
              JOIN ${SIMGOS_DB.MASTER}.ruangan r ON r.ID = k.RUANGAN
              WHERE k.NOPEN = pp.NOMOR AND k.STATUS <> 0
              ORDER BY (r.JENIS_KUNJUNGAN = 2) DESC, (r.JENIS_KUNJUNGAN = 3) DESC, k.MASUK ASC
              LIMIT 1) AS RUANG,
           (SELECT k.MASUK
              FROM ${SIMGOS_DB.PENDAFTARAN}.kunjungan k
              WHERE k.NOPEN = pp.NOMOR AND k.STATUS <> 0
              ORDER BY k.MASUK ASC LIMIT 1) AS MASUK,
           (SELECT ki.NOMOR
              FROM ${SIMGOS_DB.MASTER}.kartu_identitas_pasien ki
              WHERE ki.NORM = ps.NORM AND ki.JENIS = 1
              LIMIT 1) AS NIK
    FROM ${SIMGOS_DB.PENDAFTARAN}.pendaftaran pp
    JOIN ${SIMGOS_DB.MASTER}.pasien ps ON ps.NORM = pp.NORM
    WHERE pp.NOMOR = ? AND pp.STATUS = 1
    LIMIT 1`;

  const rows = await getSimgos().$queryRawUnsafe<FormRmHeaderRow[]>(sql, nopen);
  return rows[0] ?? null;
}

/** Susun nama lengkap pegawai + gelar (alias `pg`). */
const PEGAWAI_NAMA = `TRIM(CONCAT_WS(' ', NULLIF(pg.GELAR_DEPAN, ''), pg.NAMA, NULLIF(pg.GELAR_BELAKANG, '')))`;

/** Baris data auto-fill RM.01 (Ringkasan Masuk & Keluar) — READ-ONLY. */
export type RingkasanHeaderRow = {
  ALAMAT: string | null;
  RT: string | null;
  RW: string | null;
  AGAMA: string | null;
  PENDIDIKAN: string | null;
  PEKERJAAN: string | null;
  PERKAWINAN: string | null;
  GOL_DARAH: string | null;
  NEGARA: string | null;
  MASUK: Date | string | null;
  KELUAR: Date | string | null;
  RUANG: string | null;
  DPJP: string | null;
  PENJAMIN_JENIS: number | string | null;
  DIRAWAT_KE: number | string | null;
};

/**
 * Data tambahan untuk auto-fill Ringkasan Masuk & Keluar (RM.01), READ-ONLY.
 * Menarik: alamat + RT/RW (`master.pasien`), referensi (agama/pendidikan/pekerjaan/
 * status perkawinan/gol.darah via `master.referensi` JENIS 1/3/4/5/6; bangsa via
 * `master.negara`), tanggal masuk (leg RI diprioritaskan) & keluar (MAX antar-leg),
 * ruang, DPJP (kunjungan.DPJP→dokter→pegawai), jenis penjamin episode
 * (`pendaftaran.penjamin.JENIS` 2=BPJS/1=Umum), dan "dirawat ke" (jumlah episode RI
 * pasien s/d episode ini). Null bila NOPEN tak ada / tak aktif.
 */
export async function queryRingkasanHeader(nopen: string): Promise<RingkasanHeaderRow | null> {
  const P = SIMGOS_DB.PENDAFTARAN;
  const M = SIMGOS_DB.MASTER;
  const sql = `
    SELECT ps.ALAMAT, ps.RT, ps.RW,
      (SELECT r.DESKRIPSI FROM ${M}.referensi r WHERE r.JENIS=1 AND r.ID=ps.AGAMA LIMIT 1) AS AGAMA,
      (SELECT r.DESKRIPSI FROM ${M}.referensi r WHERE r.JENIS=3 AND r.ID=ps.PENDIDIKAN LIMIT 1) AS PENDIDIKAN,
      (SELECT r.DESKRIPSI FROM ${M}.referensi r WHERE r.JENIS=4 AND r.ID=ps.PEKERJAAN LIMIT 1) AS PEKERJAAN,
      (SELECT r.DESKRIPSI FROM ${M}.referensi r WHERE r.JENIS=5 AND r.ID=ps.STATUS_PERKAWINAN LIMIT 1) AS PERKAWINAN,
      (SELECT r.DESKRIPSI FROM ${M}.referensi r WHERE r.JENIS=6 AND r.ID=ps.GOLONGAN_DARAH LIMIT 1) AS GOL_DARAH,
      (SELECT n.DESKRIPSI FROM ${M}.negara n WHERE n.ID=ps.KEWARGANEGARAAN LIMIT 1) AS NEGARA,
      (SELECT k.MASUK FROM ${P}.kunjungan k JOIN ${M}.ruangan r ON r.ID=k.RUANGAN
         WHERE k.NOPEN=pp.NOMOR AND k.STATUS<>0
         ORDER BY (r.JENIS_KUNJUNGAN=3) DESC, k.MASUK ASC LIMIT 1) AS MASUK,
      (SELECT MAX(k.KELUAR) FROM ${P}.kunjungan k WHERE k.NOPEN=pp.NOMOR AND k.STATUS<>0) AS KELUAR,
      (SELECT r.DESKRIPSI FROM ${P}.kunjungan k JOIN ${M}.ruangan r ON r.ID=k.RUANGAN
         WHERE k.NOPEN=pp.NOMOR AND k.STATUS<>0
         ORDER BY (r.JENIS_KUNJUNGAN=3) DESC, (r.JENIS_KUNJUNGAN=2) DESC, k.MASUK ASC LIMIT 1) AS RUANG,
      (SELECT ${PEGAWAI_NAMA} FROM ${P}.kunjungan k JOIN ${M}.ruangan r ON r.ID=k.RUANGAN
         JOIN ${M}.dokter dk ON dk.ID=k.DPJP JOIN ${M}.pegawai pg ON pg.NIP=dk.NIP
         WHERE k.NOPEN=pp.NOMOR AND k.STATUS<>0 AND k.DPJP IS NOT NULL AND k.DPJP<>0
         ORDER BY (r.JENIS_KUNJUNGAN=3) DESC, (r.JENIS_KUNJUNGAN=2) DESC, k.MASUK ASC LIMIT 1) AS DPJP,
      (SELECT pj.JENIS FROM ${P}.penjamin pj WHERE pj.NOPEN=pp.NOMOR ORDER BY pj.ID DESC LIMIT 1) AS PENJAMIN_JENIS,
      (SELECT COUNT(DISTINCT pp2.NOMOR) FROM ${P}.pendaftaran pp2
         WHERE pp2.NORM=pp.NORM AND pp2.STATUS=1 AND pp2.TANGGAL<=pp.TANGGAL
           AND EXISTS (SELECT 1 FROM ${P}.kunjungan k2 JOIN ${M}.ruangan r2 ON r2.ID=k2.RUANGAN
                        WHERE k2.NOPEN=pp2.NOMOR AND k2.STATUS<>0 AND r2.JENIS_KUNJUNGAN=3)) AS DIRAWAT_KE
    FROM ${P}.pendaftaran pp
    JOIN ${M}.pasien ps ON ps.NORM=pp.NORM
    WHERE pp.NOMOR = ? AND pp.STATUS = 1
    LIMIT 1`;

  const rows = await getSimgos().$queryRawUnsafe<RingkasanHeaderRow[]>(sql, nopen);
  return rows[0] ?? null;
}

/** Baris triase SIMGOS (`medicalrecord.triage`) — field JSON sudah dipecah jadi skalar. */
export type TriaseSimgosRow = {
  /** "YYYY-MM-DDTHH:mm" (jam dinding). */
  WAKTU: string | null;
  DATANG_TGL: string | null;
  DATANG_JENIS: string | null;
  DATANG_ALAT: string | null;
  DATANG_PENGANTAR: string | null;
  KASUS_JENIS: string | null;
  KASUS_LL: string | null;
  KASUS_KK: string | null;
  KELUHAN: string | null;
  TERPIMPIN: string | null;
  SISTOLE: string | null;
  DIASTOLE: string | null;
  NADI: string | null;
  NAFAS: string | null;
  SUHU: string | null;
  SATURASI: string | null;
  K1: string | null;
  K2: string | null;
  K3: string | null;
  K4: string | null;
  K5: string | null;
  KDOA: string | null;
  ZONA: string | null;
  DOKTER: string | null;
  PERAWAT: string | null;
  PENGGUNA: string | null;
};

/**
 * Triase terakhir satu episode dari SIMGOS (READ-ONLY) untuk prefill RM.04.
 * JSON dipecah via `JSON_VALUE` supaya tak bergantung cara driver memetakan kolom JSON.
 * Saturasi tak ada di triase → diambil dari `tanda_vital` pertama leg yang sama.
 * Petugas: dokter → perawat → pengguna penginput (hanya NAMA). Null bila tak ada.
 */
export async function queryTriaseSimgos(nopen: string): Promise<TriaseSimgosRow | null> {
  const MR = SIMGOS_DB.MEDICALRECORD;
  const M = SIMGOS_DB.MASTER;
  const sql = `
    SELECT DATE_FORMAT(t.TANGGAL, '%Y-%m-%dT%H:%i') AS WAKTU,
      JSON_VALUE(t.KEDATANGAN, '$.TANGGAL') AS DATANG_TGL,
      JSON_VALUE(t.KEDATANGAN, '$.JENIS') AS DATANG_JENIS,
      JSON_VALUE(t.KEDATANGAN, '$.ALAT_TRANSPORTASI') AS DATANG_ALAT,
      JSON_VALUE(t.KEDATANGAN, '$.PENGANTAR') AS DATANG_PENGANTAR,
      JSON_VALUE(t.KASUS, '$.JENIS') AS KASUS_JENIS,
      JSON_VALUE(t.KASUS, '$.LAKA_LANTAS') AS KASUS_LL,
      JSON_VALUE(t.KASUS, '$.KECELAKAAN_KERJA') AS KASUS_KK,
      JSON_VALUE(t.ANAMNESE, '$.KELUHAN_UTAMA') AS KELUHAN,
      JSON_VALUE(t.ANAMNESE, '$.TERPIMPIN') AS TERPIMPIN,
      JSON_VALUE(t.TANDA_VITAL, '$.SISTOLE') AS SISTOLE,
      JSON_VALUE(t.TANDA_VITAL, '$.DIASTOLE') AS DIASTOLE,
      JSON_VALUE(t.TANDA_VITAL, '$.FREK_NADI') AS NADI,
      JSON_VALUE(t.TANDA_VITAL, '$.FREK_NAFAS') AS NAFAS,
      JSON_VALUE(t.TANDA_VITAL, '$.SUHU') AS SUHU,
      (SELECT CAST(tv.SATURASI_O2 AS CHAR) FROM ${MR}.tanda_vital tv
         WHERE tv.KUNJUNGAN = t.KUNJUNGAN AND tv.STATUS <> 0 AND tv.SATURASI_O2 > 0
         ORDER BY tv.WAKTU_PEMERIKSAAN ASC, tv.ID ASC LIMIT 1) AS SATURASI,
      JSON_VALUE(t.RESUSITASI, '$.CHECKED') AS K1,
      JSON_VALUE(t.EMERGENCY, '$.CHECKED') AS K2,
      JSON_VALUE(t.URGENT, '$.CHECKED') AS K3,
      JSON_VALUE(t.LESS_URGENT, '$.CHECKED') AS K4,
      JSON_VALUE(t.NON_URGENT, '$.CHECKED') AS K5,
      JSON_VALUE(t.DOA, '$.CHECKED') AS KDOA,
      (SELECT r.DESKRIPSI FROM ${M}.referensi r WHERE r.JENIS = 223 AND r.ID = t.PLAN LIMIT 1) AS ZONA,
      (SELECT ${PEGAWAI_NAMA} FROM ${M}.dokter dk JOIN ${M}.pegawai pg ON pg.NIP = dk.NIP
         WHERE dk.ID = t.DOKTER_ID LIMIT 1) AS DOKTER,
      (SELECT ${PEGAWAI_NAMA} FROM ${M}.perawat pr JOIN ${M}.pegawai pg ON pg.NIP = pr.NIP
         WHERE pr.ID = t.PERAWAT_ID LIMIT 1) AS PERAWAT,
      (SELECT u.NAMA FROM ${SIMGOS_DB.APLIKASI}.pengguna u WHERE u.ID = t.OLEH LIMIT 1) AS PENGGUNA
    FROM ${MR}.triage t
    WHERE t.NOPEN = ? AND t.STATUS <> 0
    ORDER BY t.TANGGAL DESC, t.ID DESC
    LIMIT 1`;

  const rows = await getSimgos().$queryRawUnsafe<TriaseSimgosRow[]>(sql, nopen);
  return rows[0] ?? null;
}

/** Baris diagnosa akhir (medicalrecord.diagnosa). */
export type DiagnosaRow = {
  UTAMA: number | string | null;
  KODE: string | null;
  DIAGNOSA: string | null;
};

/**
 * Diagnosa akhir satu episode (NOPEN), READ-ONLY. `UTAMA` 1=primer/2=sekunder.
 * SIMGOS bisa menyimpan baris duplikat → di-DISTINCT-kan di SQL; urut primer dulu.
 */
export async function queryDiagnosaByNopen(nopen: string): Promise<DiagnosaRow[]> {
  const sql = `
    SELECT DISTINCT d.UTAMA, d.KODE, d.DIAGNOSA
    FROM ${SIMGOS_DB.MEDICALRECORD}.diagnosa d
    WHERE d.NOPEN = ? AND d.STATUS = 1
    ORDER BY (d.UTAMA = 1) DESC, d.KODE ASC`;
  return getSimgos().$queryRawUnsafe<DiagnosaRow[]>(sql, nopen);
}
