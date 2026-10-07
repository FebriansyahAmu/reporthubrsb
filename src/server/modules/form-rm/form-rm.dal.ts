import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import type { KunciCariPasien } from "@/features/form-rm/cari";

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

// --- Pasien sasaran form (pemilih pasien & daftar per pasien) ---------------

const CAP = "/*+ MAX_EXECUTION_TIME(5000) */";

/** Satu leg kunjungan sasaran Form RM. Waktu = string jam dinding (bebas TZ adapter). */
export type LegSasaranRow = {
  NOMOR: string;
  NOPEN: string;
  RUANGAN_ID: string;
  RUANG: string | null;
  JENIS_KUNJUNGAN: number | string;
  /** "YYYY-MM-DDTHH:mm:ss" */
  MASUK: string;
  KELUAR: string | null;
  NORM: string | number | bigint;
  NAMA: string | null;
  JENIS_KELAMIN: number | string | null;
  /** "YYYY-MM-DD" */
  TANGGAL_LAHIR: string | null;
};

/** `jenis` hanya dari registri (1/2/3) — tetap divalidasi agar tak pernah jadi celah. */
function klausaJenis(jenis: readonly number[]): { sql: string; params: number[] } {
  const sah = [...new Set(jenis)].filter((j) => j === 1 || j === 2 || j === 3);
  if (sah.length === 0) throw new Error("Jenis kunjungan sasaran kosong");
  return { sql: `r.JENIS_KUNJUNGAN IN (${sah.map(() => "?").join(", ")})`, params: sah };
}

/** Leg ruangan layanan (ID 9 digit) dari pendaftaran aktif; leg batal dibuang. */
function sqlLeg(jenisSql: string, syarat: string, batas: number): string {
  const P = SIMGOS_DB.PENDAFTARAN;
  const M = SIMGOS_DB.MASTER;
  return `
    SELECT ${CAP} k.NOMOR, k.NOPEN, r.ID AS RUANGAN_ID, r.DESKRIPSI AS RUANG, r.JENIS_KUNJUNGAN,
           DATE_FORMAT(k.MASUK, '%Y-%m-%dT%H:%i:%s') AS MASUK,
           DATE_FORMAT(k.KELUAR, '%Y-%m-%dT%H:%i:%s') AS KELUAR,
           ps.NORM, ps.NAMA, ps.JENIS_KELAMIN,
           DATE_FORMAT(ps.TANGGAL_LAHIR, '%Y-%m-%d') AS TANGGAL_LAHIR
    FROM ${P}.kunjungan k
    JOIN ${M}.ruangan r ON r.ID = k.RUANGAN
    JOIN ${P}.pendaftaran pp ON pp.NOMOR = k.NOPEN
    JOIN ${M}.pasien ps ON ps.NORM = pp.NORM
    WHERE CHAR_LENGTH(r.ID) = 9 AND ${jenisSql} AND pp.STATUS = 1 AND k.STATUS <> 0
      AND ${syarat}
    ORDER BY k.MASUK DESC, k.NOMOR DESC
    LIMIT ${batas}`;
}

/** Batas bawah leg "masih dilayani": leg yang tak pernah ditutup di SIMGOS tak muncul selamanya. */
const AKTIF_MAKS_HARI = 90;

/**
 * Daftar bawaan pemilih pasien: leg sasaran yang masih dilayani (KELUAR NULL,
 * ≤ 90 hari) atau masuk dalam `jendelaJam` terakhir. READ-ONLY.
 */
export async function queryLegAktif(a: {
  jenis: readonly number[];
  jendelaJam: number;
  ruanganId?: string;
}): Promise<LegSasaranRow[]> {
  const j = klausaJenis(a.jenis);
  const jam = Math.min(Math.max(1, Math.trunc(a.jendelaJam)), 24 * AKTIF_MAKS_HARI);
  let syarat = `k.MASUK >= NOW() - INTERVAL ${AKTIF_MAKS_HARI} DAY AND (k.KELUAR IS NULL OR k.MASUK >= NOW() - INTERVAL ? HOUR)`;
  const params: unknown[] = [...j.params, jam];
  if (a.ruanganId) {
    syarat += " AND k.RUANGAN = ?";
    params.push(a.ruanganId);
  }
  return getSimgos().$queryRawUnsafe<LegSasaranRow[]>(sqlLeg(j.sql, syarat, 1000), ...params);
}

/** Leg sasaran yang MASUK dalam rentang [from, toExclusive) — daftar per pasien. READ-ONLY. */
export async function queryLegRentang(a: {
  jenis: readonly number[];
  from: string;
  toExclusive: string;
  ruanganId?: string;
}): Promise<LegSasaranRow[]> {
  const j = klausaJenis(a.jenis);
  let syarat = "k.MASUK >= ? AND k.MASUK < ?";
  const params: unknown[] = [...j.params, a.from, a.toExclusive];
  if (a.ruanganId) {
    syarat += " AND k.RUANGAN = ?";
    params.push(a.ruanganId);
  }
  return getSimgos().$queryRawUnsafe<LegSasaranRow[]>(sqlLeg(j.sql, syarat, 1000), ...params);
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * NORM pasien yang cocok dengan kunci pencarian (maks 50). Angka dicocokkan
 * persis ke No.RM, NIK (kartu identitas KTP), atau NOPEN — masing-masing lewat
 * indeksnya; nama = LIKE penggalan (indeks NAMA, dibatasi waktu). READ-ONLY.
 */
export async function queryNormCari(kunci: KunciCariPasien): Promise<string[]> {
  const P = SIMGOS_DB.PENDAFTARAN;
  const M = SIMGOS_DB.MASTER;
  let sql: string;
  let params: unknown[];
  if ("angka" in kunci) {
    // No.RM berupa INT: hanya dicocokkan bila panjangnya masuk akal (NIK 16 digit tak pernah jadi NORM).
    const normSql = kunci.angka.length <= 10 ? `SELECT ps.NORM FROM ${M}.pasien ps WHERE ps.NORM = ? UNION ` : "";
    sql = `
      SELECT ${CAP} x.NORM FROM (
        ${normSql}SELECT ki.NORM FROM ${M}.kartu_identitas_pasien ki WHERE ki.NOMOR = ? AND ki.JENIS = 1
        UNION SELECT pp.NORM FROM ${P}.pendaftaran pp WHERE pp.NOMOR = ?
      ) x LIMIT 50`;
    params = kunci.angka.length <= 10 ? [Number(kunci.angka), kunci.angka, kunci.angka] : [kunci.angka, kunci.angka];
  } else {
    sql = `SELECT ${CAP} ps.NORM FROM ${M}.pasien ps WHERE ps.NAMA LIKE ? ORDER BY ps.NAMA LIMIT 50`;
    params = [`%${escapeLike(kunci.nama)}%`];
  }
  const rows = await getSimgos().$queryRawUnsafe<{ NORM: string | number | bigint }[]>(sql, ...params);
  return [...new Set(rows.map((r) => String(r.NORM)))];
}

/** Leg sasaran milik pasien tertentu (terbaru dulu, maks 300). READ-ONLY. */
export async function queryLegPasien(a: { jenis: readonly number[]; norm: readonly string[] }): Promise<LegSasaranRow[]> {
  if (a.norm.length === 0) return [];
  const j = klausaJenis(a.jenis);
  const syarat = `pp.NORM IN (${a.norm.map(() => "?").join(", ")})`;
  return getSimgos().$queryRawUnsafe<LegSasaranRow[]>(sqlLeg(j.sql, syarat, 300), ...j.params, ...a.norm.map(Number));
}

/**
 * Jenis kunjungan (1/2/3) seluruh leg aktif tiap episode — penentu form wajib
 * (`wajibUntuk`), termasuk leg di luar rentang daftar. READ-ONLY.
 */
export async function queryJenisEpisode(nopens: readonly string[]): Promise<{ NOPEN: string; JENIS_KUNJUNGAN: number | string }[]> {
  if (nopens.length === 0) return [];
  const sql = `
    SELECT ${CAP} DISTINCT k.NOPEN, r.JENIS_KUNJUNGAN
    FROM ${SIMGOS_DB.PENDAFTARAN}.kunjungan k
    JOIN ${SIMGOS_DB.MASTER}.ruangan r ON r.ID = k.RUANGAN
    WHERE k.NOPEN IN (${nopens.map(() => "?").join(", ")}) AND k.STATUS <> 0
      AND CHAR_LENGTH(r.ID) = 9 AND r.JENIS_KUNJUNGAN IN (1, 2, 3)`;
  return getSimgos().$queryRawUnsafe(sql, ...nopens);
}

/** Susun nama lengkap pegawai + gelar (alias `pg`). */
const PEGAWAI_NAMA = `TRIM(CONCAT_WS(' ', NULLIF(pg.GELAR_DEPAN, ''), pg.NAMA, NULLIF(pg.GELAR_BELAKANG, '')))`;

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
