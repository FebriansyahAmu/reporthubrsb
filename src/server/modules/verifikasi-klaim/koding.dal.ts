import "server-only";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import type { JenisIcd } from "./verifikasi.constants";
import { CAP, FMT, num, perChunk, query, type Num } from "./verifikasi.dal";
import type { DxBaris, IcdInfo, PxBaris } from "./verifikasi.types";

/**
 * DAL Koding (Tahap 2) — **READ-ONLY** SIMGOS (HIGH ALERT: hanya SELECT).
 *
 *  - Baris diagnosa/prosedur per NOPEN: batch `IN (…)` berurutan (index NOPEN).
 *  - Master ICD INA-CBG (`master.mrconso`, SAB statis di bawah): hanya lookup per
 *    kode (index CODE) & pencarian berindeks (CODE LIKE prefiks / FULLTEXT STR).
 *    Memuat seluruh master (122 rb baris) butuh 6–9 dtk → sengaja TIDAK dilakukan.
 *  - Bukti perubahan: `logs.pengguna_akses_log` dipartisi per bulan menurut
 *    TANGGAL → selalu dibatasi `TANGGAL >= ?` (pemangkasan partisi) + index REF.
 *    Isi SEBELUM/SESUDAH (PHI) TIDAK diambil — hanya nama kolom yang berubah.
 *  - `aplikasi.pengguna`: hanya ID & NAMA (kolom sandi tak pernah dipilih).
 */

const MR = SIMGOS_DB.MEDICALRECORD;
const PD = SIMGOS_DB.PENDAFTARAN;
const LY = SIMGOS_DB.LAYANAN;
const MS = SIMGOS_DB.MASTER;
const LG = SIMGOS_DB.LOGS;
const AP = SIMGOS_DB.APLIKASI;

/** Edisi ICD untuk klaim INA-CBG (Indonesian Modification). */
const SAB: Record<JenisIcd, string> = { "10": "ICD_10_2010_IM", "9": "ICD_9CM_2010_IM" };

/** Objek log SIMGOS (`aplikasi.objek`): tabel diagnosa & prosedur. */
export const OBJEK_LOG = { diagnosa: "21003", prosedur: "21018" } as const;

/* ------------------------------------------------------------ baris koding */

export type KodingBaris = { diagnosa: DxBaris[]; prosedur: PxBaris[]; bedah: number };

type KodingRaw = {
  t: string;
  nopen: string;
  id: Num;
  kode: string | null;
  utama: Num;
  inacbg: Num;
  grouper: Num;
  teks: string | null;
};

/**
 * Diagnosa & prosedur aktif (urut ID = urut input) + jumlah tindakan berjenis
 * Prosedur Bedah (`master.tindakan.JENIS` 2, REF 74 — dasar `px-operasi`) per
 * NOPEN, dalam SATU query `UNION ALL` (tiap query lewat adapter ±150 ms, jadi
 * tiga bagian digabung). Kolom pembeda `t`: D diagnosa · P prosedur · B bedah.
 */
export async function queryKodingBaris(nopens: readonly string[]): Promise<Map<string, KodingBaris>> {
  const rows = await perChunk(nopens, (chunk, ph) =>
    query<KodingRaw>(
      `SELECT ${CAP} x.* FROM (
          SELECT 'D' AS t, NOPEN AS nopen, ID AS id, TRIM(KODE) AS kode, UTAMA AS utama, INACBG AS inacbg,
            INA_GROUPER AS grouper, LEFT(TRIM(DIAGNOSA), 250) AS teks
          FROM ${MR}.diagnosa WHERE STATUS = 1 AND NOPEN IN (${ph})
          UNION ALL
          SELECT 'P', NOPEN, ID, TRIM(KODE), NULL, INACBG, NULL, LEFT(TRIM(TINDAKAN), 250)
          FROM ${MR}.prosedur WHERE STATUS = 1 AND NOPEN IN (${ph})
          UNION ALL
          SELECT 'B', k.NOPEN, COUNT(*), NULL, NULL, NULL, NULL, NULL
          FROM ${PD}.kunjungan k
          JOIN ${LY}.tindakan_medis tm ON tm.KUNJUNGAN = k.NOMOR AND tm.STATUS = 1
          JOIN ${MS}.tindakan mt ON mt.ID = tm.TINDAKAN AND mt.JENIS = 2
          WHERE k.NOPEN IN (${ph}) AND k.STATUS <> 0
          GROUP BY k.NOPEN
        ) x ORDER BY x.nopen, x.t, x.id`,
      [...chunk, ...chunk, ...chunk],
    ),
  );
  const out = new Map<string, KodingBaris>();
  for (const r of rows) {
    const n = String(r.nopen);
    let x = out.get(n);
    if (!x) out.set(n, (x = { diagnosa: [], prosedur: [], bedah: 0 }));
    const kode = (r.kode ?? "").trim().toUpperCase();
    const teks = r.teks?.trim() || null;
    if (r.t === "D") {
      x.diagnosa.push({
        id: num(r.id),
        kode,
        utama: num(r.utama) === 1,
        inacbg: num(r.inacbg) === 1,
        grouper: num(r.grouper) === 1,
        teks,
      });
    } else if (r.t === "P") {
      x.prosedur.push({ id: num(r.id), kode, inacbg: num(r.inacbg) === 1, teks });
    } else {
      x.bedah = num(r.id);
    }
  }
  return out;
}

/* --------------------------------------------------------------- master ICD */

type IcdRaw = { kode: string; nama: string | null; valid: string | null; accpdx: string | null; asterisk: string | null };

const toIcd = (r: IcdRaw): IcdInfo => ({
  kode: String(r.kode).trim().toUpperCase(),
  nama: r.nama?.trim() || String(r.kode),
  valid: r.valid === "1",
  accpdx: r.accpdx === "Y",
  asterisk: r.asterisk === "1",
});

// Tiap kode tercatat 3× identik di mrconso (diverifikasi 1 Okt 2026) → GROUP BY CODE.
const KOLOM_ICD = `CODE AS kode, MIN(STR) AS nama, MAX(VALIDCODE) AS valid, MAX(ACCPDX) AS accpdx, MAX(ASTERISK) AS asterisk`;

/** Info ICD untuk kode-kode tertentu (index CODE; 200 kode ≈ 70 ms). */
export async function queryIcdKode(jenis: JenisIcd, kodes: readonly string[]): Promise<IcdInfo[]> {
  const rows = await perChunk(kodes, (chunk, ph) =>
    query<IcdRaw>(`SELECT ${CAP} ${KOLOM_ICD} FROM ${MS}.mrconso WHERE SAB = ? AND CODE IN (${ph}) GROUP BY CODE`, [
      SAB[jenis],
      ...chunk,
    ]),
  );
  return rows.map(toIcd);
}

/** Cari per awalan kode (index CODE, ±50 ms). `prefiks` hanya [A-Z0-9.]. */
export async function queryCariIcdKode(jenis: JenisIcd, prefiks: string, batas: number): Promise<IcdInfo[]> {
  const rows = await query<IcdRaw>(
    `SELECT ${CAP} ${KOLOM_ICD} FROM ${MS}.mrconso WHERE SAB = ? AND CODE LIKE ?
      GROUP BY CODE ORDER BY CODE LIMIT ${Math.trunc(batas)}`,
    [SAB[jenis], `${prefiks}%`],
  );
  return rows.map(toIcd);
}

/**
 * Cari per teks (index FULLTEXT `x_ftstr`, 55–225 ms). `ekspresi` = mode boolean
 * yang dirakit service dari token alfanumerik saja (mis. `+appendic* +acute*`).
 */
export async function queryCariIcdTeks(jenis: JenisIcd, ekspresi: string, batas: number): Promise<IcdInfo[]> {
  const rows = await query<IcdRaw>(
    `SELECT ${CAP} ${KOLOM_ICD} FROM ${MS}.mrconso
      WHERE SAB = ? AND MATCH(STR) AGAINST (? IN BOOLEAN MODE)
      GROUP BY CODE ORDER BY MAX(VALIDCODE) DESC, CHAR_LENGTH(MIN(STR)) LIMIT ${Math.trunc(batas)}`,
    [SAB[jenis], ekspresi],
  );
  return rows.map(toIcd);
}

/* ------------------------------------------------------ bukti perubahan */

/** Jam dinding SIMGOS sekarang ("YYYY-MM-DD HH:mm:ss") — batas bawah pencarian bukti. */
export async function queryWaktuSimgos(): Promise<string> {
  const [r] = await query<{ t: string }>(`SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS t`, []);
  return String(r.t);
}

export type BarisBukti = {
  tabel: "diagnosa" | "prosedur";
  id: number;
  kode: string | null;
  status: number;
  oleh: number | null;
  /** Jam dinding SIMGOS ISO lokal. */
  tanggal: string | null;
};

export type LogBukti = { tabel: "diagnosa" | "prosedur"; ref: string; oleh: number | null; pada: string; kolom: string[] };

/**
 * Jejak koding satu episode sejak `sejak` (jam dinding SIMGOS): semua baris
 * diagnosa/prosedur (termasuk yang dihapus-lunak) + log ubah (AKSI 'U') yang
 * menunjuk baris itu. SIMGOS tidak mencatat log pembuatan untuk kedua tabel ini
 * (30 hari: 0) → baris baru dilacak dari `TANGGAL`/`OLEH` barisnya.
 */
export async function queryJejakKoding(nopen: string, sejak: string): Promise<{ baris: BarisBukti[]; log: LogBukti[] }> {
  const baris: BarisBukti[] = [];
  for (const tabel of ["diagnosa", "prosedur"] as const) {
    const rows = await query<{ id: Num; kode: string | null; status: Num; oleh: Num; tanggal: string | null }>(
      `SELECT ${CAP} ID AS id, TRIM(KODE) AS kode, STATUS AS status, OLEH AS oleh, DATE_FORMAT(TANGGAL, ${FMT}) AS tanggal
        FROM ${MR}.${tabel} WHERE NOPEN = ? ORDER BY ID`,
      [nopen],
    );
    for (const r of rows) {
      baris.push({
        tabel,
        id: num(r.id),
        kode: r.kode ? r.kode.toUpperCase() : null,
        status: num(r.status),
        oleh: r.oleh == null ? null : num(r.oleh),
        tanggal: r.tanggal ?? null,
      });
    }
  }
  if (baris.length === 0) return { baris, log: [] };

  const log: LogBukti[] = [];
  for (const tabel of ["diagnosa", "prosedur"] as const) {
    const refs = baris.filter((b) => b.tabel === tabel).map((b) => String(b.id));
    if (refs.length === 0) continue;
    const rows = await query<{ ref: string; oleh: Num; pada: string; kolom: string | string[] | null }>(
      `SELECT ${CAP} l.REF AS ref, l.PENGGUNA AS oleh, DATE_FORMAT(l.TANGGAL, ${FMT}) AS pada,
          CASE WHEN JSON_VALID(l.SESUDAH) THEN JSON_KEYS(l.SESUDAH) END AS kolom
        FROM ${LG}.pengguna_akses_log l
        WHERE l.TANGGAL >= ? AND l.OBJEK = ? AND l.AKSI = 'U' AND l.REF IN (${refs.map(() => "?").join(",")})
        ORDER BY l.ID`,
      [sejak, OBJEK_LOG[tabel], ...refs],
    );
    for (const r of rows) {
      const kolom = typeof r.kolom === "string" ? (JSON.parse(r.kolom) as unknown) : r.kolom;
      log.push({
        tabel,
        ref: String(r.ref),
        oleh: r.oleh == null ? null : num(r.oleh),
        pada: r.pada,
        kolom: Array.isArray(kolom) ? kolom.map(String) : [],
      });
    }
  }
  return { baris, log };
}

/** Nama pengguna SIMGOS (ID → NAMA). Hanya dua kolom itu yang dipilih. */
export async function queryNamaPengguna(ids: readonly number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const rows = await query<{ id: Num; nama: string | null }>(
    `SELECT ${CAP} ID AS id, NAMA AS nama FROM ${AP}.pengguna WHERE ID IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  return new Map(rows.map((r) => [num(r.id), r.nama?.trim() || `Pengguna ${num(r.id)}`]));
}
