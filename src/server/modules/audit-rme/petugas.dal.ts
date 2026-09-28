import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import {
  CPPT_PERAN_DOKTER,
  CPPT_PERAN_KEPERAWATAN,
  HARI_DINAS_MULAI_JAM,
  JENIS_RAWAT_INAP,
  SHIFTS,
  SUMBER,
  SUMBER_KEYS,
  TTV_RENTANG_WAJAR,
  TTV_TERLAMBAT_MENIT,
  type KategoriKey,
  type SumberKey,
} from "./kunjungan.constants";
import { legKlinisSql, SUMBER_SQL } from "./kunjungan.dal";

/**
 * DAL Fase 2 · K3 — input aktual per PETUGAS (`OLEH`) dalam rentang hari dinas.
 * **READ-ONLY** (HIGH ALERT: hanya SELECT).
 *
 * Satu round-trip `UNION ALL` atas 7 sumber (allow-list `SUMBER_SQL`); tiap
 * bagian memakai index kolom waktunya (`TANGGAL` / `WAKTU_PEMERIKSAAN`) dan
 * di-join ke kunjungan → ruangan agar setiap input terikat lokasi. Tanpa kolom
 * teks klinis. Agregasi 31 hari (± 20 rb baris, ± 100 petugas) ± 200 ms.
 */

const PD = SIMGOS_DB.PENDAFTARAN;
const MS = SIMGOS_DB.MASTER;
const CAP = "/*+ MAX_EXECUTION_TIME(8000) */";

export type PetugasFilter = {
  /** Awal hari dinas pertama `YYYY-MM-DD 07:00:00` (inklusif). */
  sejak: string;
  /** Akhir hari dinas terakhir (eksklusif). */
  sampai: string;
  jenis?: number;
  /** Daftar jenis (kelompok) — dipakai hanya bila `jenis` kosong. */
  jenisIn?: readonly number[];
  ruangan?: string;
};

/** Konstanta KODE (bukan input pengguna) → literal SQL; ditolak bila bukan bilangan. */
function sqlNums(xs: readonly number[]): string {
  if (!xs.every(Number.isFinite)) throw new Error("sqlNums: nilai bukan bilangan");
  return xs.join(", ");
}

/** Nilai TTV di luar rentang fisiologis ekstrem (0/NULL = tidak diisi) — sama dengan `peringatanTtv`. */
const TTV_TAK_WAJAR = (SUMBER_SQL.tanda_vital.angka ?? [])
  .map((col, i) => {
    const w = TTV_RENTANG_WAJAR[i];
    return `(COALESCE(${col}, 0) <> 0 AND (${col} < ${sqlNums([w.min])} OR ${col} > ${sqlNums([w.max])}))`;
  })
  .join(" OR ");

/** Shift dari jam (`SHIFTS`; shift yang melintasi tengah malam = ELSE). */
const SHIFT_DARI_JAM = `CASE ${SHIFTS.filter((s) => s.start < s.end)
  .map((s) => `WHEN jam >= ${sqlNums([s.start])} AND jam < ${sqlNums([s.end])} THEN '${s.key}'`)
  .join(" ")} ELSE '${SHIFTS.find((s) => s.start > s.end)!.key}' END`;

const ANGKA_MAKS = 6;
const fmtWaktu = (expr: string) => `DATE_FORMAT(${expr}, '%Y-%m-%dT%H:%i:%s')`;

/**
 * SELECT satu sumber. `lengkap` menambah identitas & ringkasan record (untuk
 * profil satu petugas); tanpa itu hanya kolom agregasi.
 */
function bagianSumber(
  key: SumberKey,
  f: PetugasFilter,
  o: { oleh?: string; tarifIds: readonly number[]; lengkap: boolean },
): { sql: string; params: unknown[] } {
  const s = SUMBER_SQL[key];
  const w = s.waktu;
  const selParams: unknown[] = [];
  const whereParams: unknown[] = [f.sejak, f.sampai];
  const cond = [`${w} >= ?`, `${w} < ?`];
  if (o.oleh) {
    cond.push("t.OLEH = ?");
    whereParams.push(o.oleh);
  }

  let tarif = "0";
  if (key === "tindakan_medis" && o.tarifIds.length) {
    tarif = `(t.TINDAKAN IN (${o.tarifIds.map(() => "?").join(",")}))`;
    selParams.push(...o.tarifIds);
  }
  const cols = [
    "t.OLEH AS oleh",
    `'${SUMBER[key].kategori}' AS kat`,
    `${s.peran ?? "NULL"} AS peran`,
    "t.STATUS AS st",
    `DATE_FORMAT(${w} - INTERVAL ${sqlNums([HARI_DINAS_MULAI_JAM])} HOUR, '%Y-%m-%d') AS hd`,
    `HOUR(${w}) AS jam`,
    "k.NOMOR AS kj",
    "k.RUANGAN AS ruang",
    "r.JENIS_KUNJUNGAN AS jk",
    "pp.NORM AS norm",
    `${s.waktuInput ? `TIMESTAMPDIFF(MINUTE, ${w}, ${s.waktuInput})` : "NULL"} AS lagm`,
    `${tarif} AS tarif`,
    `${key === "tanda_vital" ? `(${TTV_TAK_WAJAR})` : "0"} AS anomali`,
  ];
  if (o.lengkap) {
    cols.push(
      `'${key}' AS sumber`,
      "CAST(t.ID AS CHAR) AS id",
      `${fmtWaktu(w)} AS waktu`,
      `${s.waktuInput ? fmtWaktu(s.waktuInput) : "NULL"} AS waktuInput`,
      `${s.teks ?? "NULL"} AS teks`,
      ...Array.from({ length: ANGKA_MAKS }, (_, i) => `${s.angka?.[i] ?? "NULL"} AS n${i}`),
    );
  }

  // Join master (nama tindakan) hanya bila ringkasan diminta.
  const join = o.lengkap ? (s.join ?? "") : "";
  // Sumber per-episode: leg klinis dihitung di tabel turunan (setelah filter rentang),
  // lalu di-join seperti sumber per-kunjungan. `t.*` aman: hanya Diagnosis (kolom kecil).
  const from =
    s.kunci === "KUNJUNGAN"
      ? `${s.tabel} t ${join}`
      : `(SELECT t.*, ${legKlinisSql(w)} AS KUNJUNGAN FROM ${s.tabel} t WHERE ${cond.join(" AND ")}) t ${join}`;
  const sql = `SELECT ${cols.join(", ")}
    FROM ${from}
    LEFT JOIN ${PD}.kunjungan k ON k.NOMOR = t.KUNJUNGAN
    LEFT JOIN ${MS}.ruangan r ON r.ID = k.RUANGAN
    LEFT JOIN ${PD}.pendaftaran pp ON pp.NOMOR = k.NOPEN
    ${s.kunci === "KUNJUNGAN" ? `WHERE ${cond.join(" AND ")}` : ""}`;
  return { sql, params: [...selParams, ...whereParams] };
}

function unionSumber(f: PetugasFilter, o: { oleh?: string; tarifIds: readonly number[]; lengkap: boolean }) {
  const parts = SUMBER_KEYS.map((key) => bagianSumber(key, f, o));
  return { sql: parts.map((p) => `(${p.sql})`).join("\nUNION ALL\n"), params: parts.flatMap((p) => p.params) };
}

/** Filter lokasi pada hasil union (kolom `jk` / `ruang`) + penginput valid. */
function lokasiWhere(f: PetugasFilter): { sql: string; params: unknown[] } {
  const cond = ["oleh IS NOT NULL", "oleh <> 0"];
  const params: unknown[] = [];
  if (f.jenis != null) {
    cond.push("jk = ?");
    params.push(f.jenis);
  } else if (f.jenisIn?.length) {
    cond.push(`jk IN (${f.jenisIn.map(() => "?").join(",")})`);
    params.push(...f.jenisIn);
  }
  if (f.ruangan) {
    cond.push("ruang LIKE ?");
    params.push(`${f.ruangan}%`);
  }
  return { sql: cond.join(" AND "), params };
}

/* ------------------------------------------------------ agregat per petugas */

export type PetugasAgregatRow = {
  oleh: string;
  asesmen: number;
  cppt: number;
  cpptKeperawatan: number;
  cpptDokter: number;
  ttv: number;
  ttvTerlambat: number;
  ttvTakWajar: number;
  diagnosis: number;
  tindakan: number;
  tarif: number;
  batal: number;
  hariAktif: number;
  pasien: number;
  riHariPasien: number;
  riShift: number;
  riVisite: number;
};

const KEP = sqlNums(CPPT_PERAN_KEPERAWATAN);
const DOK = sqlNums([CPPT_PERAN_DOKTER]);
const RI = sqlNums([JENIS_RAWAT_INAP]);

/**
 * Metrik mentah seluruh penginput dalam rentang (satu baris per `OLEH`).
 * "Aktif" = STATUS ≠ 0. Item tarif tidak masuk Tindakan & batal klinis.
 * Pasangan unik memakai `COUNT(DISTINCT a, b, …)` (baris ber-NULL diabaikan) —
 * bukan CONCAT: kolom SIMGOS latin1 + literal koneksi utf8mb4 = error 1270.
 */
export async function queryPetugasAgregat(f: PetugasFilter, tarifIds: readonly number[]): Promise<PetugasAgregatRow[]> {
  const u = unionSumber(f, { tarifIds, lengkap: false });
  const w = lokasiWhere(f);
  const aktif = (c: string) => `COALESCE(SUM(st <> 0 AND ${c}), 0)`;
  const sql = `SELECT ${CAP} oleh,
      ${aktif("kat = 'ASESMEN'")} AS asesmen,
      ${aktif("kat = 'CPPT'")} AS cppt,
      ${aktif(`kat = 'CPPT' AND peran IN (${KEP})`)} AS cpptKeperawatan,
      ${aktif(`kat = 'CPPT' AND peran = ${DOK}`)} AS cpptDokter,
      ${aktif("kat = 'TTV'")} AS ttv,
      ${aktif(`kat = 'TTV' AND lagm > ${sqlNums([TTV_TERLAMBAT_MENIT])}`)} AS ttvTerlambat,
      ${aktif("kat = 'TTV' AND anomali = 1")} AS ttvTakWajar,
      ${aktif("kat = 'DIAGNOSIS'")} AS diagnosis,
      ${aktif("kat = 'TINDAKAN' AND tarif = 0")} AS tindakan,
      ${aktif("tarif = 1")} AS tarif,
      COALESCE(SUM(st = 0 AND tarif = 0), 0) AS batal,
      COUNT(DISTINCT hd) AS hariAktif,
      COUNT(DISTINCT CASE WHEN st <> 0 THEN norm END) AS pasien,
      COUNT(DISTINCT CASE WHEN st <> 0 AND jk = ${RI} THEN kj END, hd) AS riHariPasien,
      COUNT(DISTINCT CASE WHEN st <> 0 AND jk = ${RI} AND kat = 'CPPT' AND peran IN (${KEP}) THEN kj END, hd,
        ${SHIFT_DARI_JAM}) AS riShift,
      COUNT(DISTINCT CASE WHEN st <> 0 AND jk = ${RI} AND kat = 'CPPT' AND peran = ${DOK} THEN kj END, hd) AS riVisite
    FROM (${u.sql}) x
    WHERE ${w.sql}
    GROUP BY oleh`;
  const rows = await getSimgos().$queryRawUnsafe<Record<string, unknown>[]>(sql, ...u.params, ...w.params);
  const n = (v: unknown) => Number(v ?? 0);
  return rows.map((r) => ({
    oleh: String(r.oleh),
    asesmen: n(r.asesmen),
    cppt: n(r.cppt),
    cpptKeperawatan: n(r.cpptKeperawatan),
    cpptDokter: n(r.cpptDokter),
    ttv: n(r.ttv),
    ttvTerlambat: n(r.ttvTerlambat),
    ttvTakWajar: n(r.ttvTakWajar),
    diagnosis: n(r.diagnosis),
    tindakan: n(r.tindakan),
    tarif: n(r.tarif),
    batal: n(r.batal),
    hariAktif: n(r.hariAktif),
    pasien: n(r.pasien),
    riHariPasien: n(r.riHariPasien),
    riShift: n(r.riShift),
    riVisite: n(r.riVisite),
  }));
}

/* ------------------------------------------------ record satu petugas (profil) */

/** Batas baris profil satu petugas (perawat terpadat 31 hari ± 2.000 termasuk tarif). */
export const PETUGAS_RECORD_CAP = 8000;

export type PetugasRecordRow = {
  sumber: SumberKey;
  kategori: KategoriKey;
  id: string;
  waktu: string;
  waktuInput: string | null;
  /** Hari dinas `YYYY-MM-DD`. */
  hariDinas: string;
  jam: number;
  kunjungan: string | null;
  status: number;
  peran: number | null;
  lagMenit: number | null;
  tarif: boolean;
  teks: string | null;
  angka: (number | null)[];
};

/** Semua input satu petugas dalam rentang (lokasi sama dengan papan peringkat), urut waktu. */
export async function queryPetugasRecords(
  f: PetugasFilter,
  oleh: string,
  tarifIds: readonly number[],
): Promise<PetugasRecordRow[]> {
  const u = unionSumber(f, { oleh, tarifIds, lengkap: true });
  const w = lokasiWhere(f);
  const sql = `SELECT ${CAP} * FROM (${u.sql}) x WHERE ${w.sql} ORDER BY waktu, sumber, id LIMIT ${PETUGAS_RECORD_CAP + 1}`;
  const rows = await getSimgos().$queryRawUnsafe<Record<string, unknown>[]>(sql, ...u.params, ...w.params);
  const num = (v: unknown) => (v == null ? null : Number(v));
  return rows.map((r) => ({
    sumber: r.sumber as SumberKey,
    kategori: r.kat as KategoriKey,
    id: String(r.id),
    waktu: String(r.waktu),
    waktuInput: (r.waktuInput as string | null) ?? null,
    hariDinas: String(r.hd),
    jam: Number(r.jam),
    kunjungan: r.kj == null ? null : String(r.kj),
    status: Number(r.st),
    peran: num(r.peran),
    lagMenit: num(r.lagm),
    tarif: Number(r.tarif) === 1,
    teks: typeof r.teks === "string" ? r.teks.trim() || null : null,
    angka: Array.from({ length: ANGKA_MAKS }, (_, i) => num(r[`n${i}`])),
  }));
}
