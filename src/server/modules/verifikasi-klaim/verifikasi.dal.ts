import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import { BATAS } from "./verifikasi.constants";

/**
 * DAL Verifikasi Klaim — **READ-ONLY** SIMGOS (HIGH ALERT: hanya SELECT).
 * Konvensi layering: hanya `*.dal.ts` yang mengimpor `getSimgos`.
 *
 * Strategi anti-overload (PRD §7.2):
 *  - Episode: satu query per rentang TANGGAL PULANG (index `kunjungan.KELUAR`).
 *  - Fakta kelengkapan: query `GROUP BY NOPEN` dengan `IN (…)` per
 *    `BATAS.BATCH_NOPEN`, dijalankan BERURUTAN (bukan paralel) → maks satu
 *    koneksi SIMGOS per komputasi. Semua kolom filter terindeks (diverifikasi
 *    29 Sep 2026: NOPEN / KUNJUNGAN / PENDAFTARAN_RI_NOMOR / TINDAKAN_MEDIS_ID).
 *  - Setiap query diberi `MAX_EXECUTION_TIME`; tak ada kolom teks klinis diambil.
 *  - Nama tabel/kolom statis; nilai selalu di-bind `?`.
 */

const PD = SIMGOS_DB.PENDAFTARAN;
const MR = SIMGOS_DB.MEDICALRECORD;
const LY = SIMGOS_DB.LAYANAN;
const MS = SIMGOS_DB.MASTER;
const PB = SIMGOS_DB.PEMBAYARAN;
const BP = SIMGOS_DB.BPJS;
export const CAP = "/*+ MAX_EXECUTION_TIME(8000) */";
export const FMT = "'%Y-%m-%dT%H:%i:%s'";
/** Leg klinis: Rawat Jalan (1), IGD (2), Rawat Inap (3). */
const KLINIS = "r.JENIS_KUNJUNGAN IN (1, 2, 3)";

export type Num = number | bigint | string | null;
export const num = (v: Num): number => (v == null ? 0 : Number(v));

/** Jalankan `run` per potongan NOPEN secara BERURUTAN (sengaja — satu koneksi). */
export async function perChunk<T>(
  nopens: readonly string[],
  run: (chunk: string[], ph: string) => Promise<T[]>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < nopens.length; i += BATAS.BATCH_NOPEN) {
    const chunk = nopens.slice(i, i + BATAS.BATCH_NOPEN);
    out.push(...(await run(chunk, chunk.map(() => "?").join(","))));
  }
  return out;
}

export function query<T>(sql: string, params: readonly unknown[]): Promise<T[]> {
  return getSimgos().$queryRawUnsafe<T[]>(sql, ...params);
}

/* ------------------------------------------------------------------ episode */

export type EpisodeRow = {
  nopen: string;
  norm: string;
  nama: string;
  ri: boolean;
  igd: boolean;
  rj: boolean;
  /** Jumlah leg (termasuk penunjang) yang belum KELUAR. 0 = episode final. */
  terbuka: number;
  masuk: string | null;
  pulang: string | null;
  ruanganId: string | null;
  ruang: string | null;
  dpjpId: number | null;
  penjamin: number | null;
};

type EpisodeRaw = {
  nopen: string; norm: Num; nama: string | null; ri: Num; igd: Num; rj: Num; terbuka: Num;
  masuk: string | null; pulang: string | null; ruanganId: string | null; ruang: string | null;
  dpjpId: string | null; penjamin: Num;
};

const toEpisode = (r: EpisodeRaw): EpisodeRow => ({
  nopen: String(r.nopen),
  norm: String(r.norm ?? ""),
  nama: r.nama?.trim() || "-",
  ri: num(r.ri) > 0,
  igd: num(r.igd) > 0,
  rj: num(r.rj) > 0,
  terbuka: num(r.terbuka),
  masuk: r.masuk ?? null,
  pulang: r.pulang ?? null,
  ruanganId: r.ruanganId ? String(r.ruanganId) : null,
  ruang: r.ruang?.trim() || null,
  dpjpId: r.dpjpId ? Number(r.dpjpId) : null,
  penjamin: r.penjamin == null ? null : Number(r.penjamin),
});

/**
 * Agregat leg per NOPEN. `sumber` = klausa FROM awal (kandidat rentang / daftar
 * NOPEN), `having` = syarat tambahan. Leg = kunjungan ruang leaf (9 digit) tidak
 * batal; tanggal masuk/pulang & ruang/DPJP diambil dari leg KLINIS saja.
 */
function episodeSql(sumber: string, where: string, having: string): string {
  return `SELECT ${CAP} x.*, rr.DESKRIPSI AS ruang
    FROM (
      SELECT pp.NOMOR AS nopen, pp.NORM AS norm, ps.NAMA AS nama,
        MAX(r.JENIS_KUNJUNGAN = 3) AS ri, MAX(r.JENIS_KUNJUNGAN = 2) AS igd, MAX(r.JENIS_KUNJUNGAN = 1) AS rj,
        SUM(k.KELUAR IS NULL) AS terbuka,
        DATE_FORMAT(MIN(CASE WHEN ${KLINIS} THEN k.MASUK END), ${FMT}) AS masuk,
        DATE_FORMAT(MAX(CASE WHEN ${KLINIS} THEN k.KELUAR END), ${FMT}) AS pulang,
        SUBSTRING_INDEX(GROUP_CONCAT(CASE WHEN ${KLINIS} THEN k.RUANGAN END ORDER BY k.MASUK DESC), ',', 1) AS ruanganId,
        SUBSTRING_INDEX(GROUP_CONCAT(CASE WHEN ${KLINIS} AND k.DPJP > 0 THEN k.DPJP END ORDER BY k.MASUK DESC), ',', 1) AS dpjpId,
        (SELECT pj.JENIS FROM ${PD}.penjamin pj WHERE pj.NOPEN = pp.NOMOR ORDER BY pj.ID DESC LIMIT 1) AS penjamin
      FROM ${sumber}
      JOIN ${MS}.pasien ps ON ps.NORM = pp.NORM
      JOIN ${PD}.kunjungan k ON k.NOPEN = pp.NOMOR AND k.STATUS <> 0
      JOIN ${MS}.ruangan r ON r.ID = k.RUANGAN AND CHAR_LENGTH(r.ID) = 9
      WHERE pp.STATUS = 1${where}
      GROUP BY pp.NOMOR
      HAVING MAX(${KLINIS})${having}
      LIMIT ${BATAS.EPISODE_MAKS}
    ) x
    LEFT JOIN ${MS}.ruangan rr ON rr.ID = x.ruanganId`;
}

/**
 * Episode FINAL (semua leg sudah KELUAR) yang TANGGAL PULANG-nya (KELUAR leg
 * klinis terakhir) di `[from, toExclusive)`. Kandidat NOPEN diambil lewat index
 * `kunjungan.KELUAR` (31 hari ≈ 17 ms, 29 Sep 2026).
 */
export async function queryEpisodePulang(from: string, toExclusive: string): Promise<EpisodeRow[]> {
  const sumber = `(SELECT DISTINCT kx.NOPEN FROM ${PD}.kunjungan kx
        WHERE kx.KELUAR >= ? AND kx.KELUAR < ? AND kx.STATUS <> 0) c
      JOIN ${PD}.pendaftaran pp ON pp.NOMOR = c.NOPEN`;
  const having = ` AND SUM(k.KELUAR IS NULL) = 0
        AND MAX(CASE WHEN ${KLINIS} THEN k.KELUAR END) >= ?
        AND MAX(CASE WHEN ${KLINIS} THEN k.KELUAR END) < ?`;
  const rows = await query<EpisodeRaw>(episodeSql(sumber, "", having), [from, toExclusive, from, toExclusive]);
  return rows.map(toEpisode);
}

/** Episode by NOPEN (termasuk yang belum final — lihat `terbuka`). */
export async function queryEpisodeByNopens(nopens: readonly string[]): Promise<EpisodeRow[]> {
  const rows = await perChunk(nopens, (chunk, ph) =>
    query<EpisodeRaw>(episodeSql(`${PD}.pendaftaran pp`, ` AND pp.NOMOR IN (${ph})`, ""), chunk),
  );
  return rows.map(toEpisode);
}

/* ------------------------------------------------------ penggabungan IGD→RI */

/**
 * Episode non-RI yang ber-SPRI ke pendaftaran RI yang sah (NOPEN berbeda) →
 * klaimnya menyatu ke episode RI (PRD §4). Map NOPEN asal → NOPEN RI.
 * 30 hari: 185/185 SPRI tertaut berasal dari leg IGD, NOPEN selalu berbeda.
 */
export async function queryGabungKeRi(nopens: readonly string[]): Promise<Map<string, string>> {
  const rows = await perChunk(nopens, (chunk, ph) =>
    query<{ nopen: string; riNopen: string }>(
      `SELECT ${CAP} k.NOPEN AS nopen, MAX(s.PENDAFTARAN_RI_NOMOR) AS riNopen
        FROM ${PD}.kunjungan k
        JOIN ${MR}.perencanaan_rawat_inap s ON s.KUNJUNGAN = k.NOMOR AND s.STATUS = 1
        JOIN ${PD}.pendaftaran pri ON pri.NOMOR = s.PENDAFTARAN_RI_NOMOR AND pri.STATUS = 1
        WHERE k.NOPEN IN (${ph}) AND k.STATUS <> 0 AND s.PENDAFTARAN_RI_NOMOR <> k.NOPEN
        GROUP BY k.NOPEN`,
      chunk,
    ),
  );
  return new Map(rows.map((r) => [String(r.nopen), String(r.riNopen)]));
}

/* --------------------------------------------------------- fakta per NOPEN */

export type DiagnosaRingkas = { total: number; primer: number; tanpaKode: number };

/** Diagnosa aktif: total baris, kode primer BERBEDA, baris tanpa kode. */
export async function queryDiagnosaRingkas(nopens: readonly string[]): Promise<Map<string, DiagnosaRingkas>> {
  const rows = await perChunk(nopens, (chunk, ph) =>
    query<{ nopen: string; total: Num; primer: Num; tanpaKode: Num }>(
      `SELECT ${CAP} NOPEN AS nopen, COUNT(*) AS total,
          COUNT(DISTINCT CASE WHEN UTAMA = 1 THEN KODE END) AS primer,
          SUM(KODE IS NULL OR TRIM(KODE) = '') AS tanpaKode
        FROM ${MR}.diagnosa WHERE STATUS = 1 AND NOPEN IN (${ph}) GROUP BY NOPEN`,
      chunk,
    ),
  );
  return new Map(rows.map((r) => [String(r.nopen), { total: num(r.total), primer: num(r.primer), tanpaKode: num(r.tanpaKode) }]));
}

/** Jumlah baris per NOPEN pada tabel ber-kolom NOPEN (daftar tabel TERKUNCI). */
const TABEL_PER_NOPEN = {
  resume: `${MR}.resume WHERE STATUS = 1`,
  // STATUS 1 = belum final, 2 = final (4.025/4.030) — keduanya berarti terisi.
  triase: `${MR}.triage WHERE STATUS <> 0`,
} as const;

export async function queryJumlahPerNopen(
  tabel: keyof typeof TABEL_PER_NOPEN,
  nopens: readonly string[],
): Promise<Map<string, number>> {
  const rows = await perChunk(nopens, (chunk, ph) =>
    query<{ nopen: string; n: Num }>(
      `SELECT ${CAP} NOPEN AS nopen, COUNT(*) AS n FROM ${TABEL_PER_NOPEN[tabel]} AND NOPEN IN (${ph}) GROUP BY NOPEN`,
      chunk,
    ),
  );
  return new Map(rows.map((r) => [String(r.nopen), num(r.n)]));
}

export type CpptRingkas = { total: number; verifikasi: number; belumVerif: number };

/**
 * CPPT per episode (via leg kunjungan) + verifikasi DPJP. `belumVerif` = CPPT
 * yang ditulis setelah `BATAS_TANGGAL` verifikasi terakhir di leg-nya (leg tanpa
 * verifikasi → seluruh CPPT-nya). 30 hari leg RI: 127 tanpa verifikasi, 66
 * sebagian, 16 penuh.
 */
export async function queryCpptRingkas(nopens: readonly string[]): Promise<Map<string, CpptRingkas>> {
  const rows = await perChunk(nopens, (chunk, ph) =>
    query<{ nopen: string; total: Num; verifikasi: Num; belumVerif: Num }>(
      `SELECT ${CAP} x.NOPEN AS nopen, SUM(x.cp) AS total, SUM(x.vf) AS verifikasi, SUM(x.bv) AS belumVerif
        FROM (
          SELECT k.NOPEN,
            (SELECT COUNT(*) FROM ${MR}.cppt c WHERE c.KUNJUNGAN = k.NOMOR AND c.STATUS = 1) AS cp,
            (SELECT COUNT(*) FROM ${MR}.verifikasi_cppt v WHERE v.KUNJUNGAN = k.NOMOR AND v.STATUS = 1) AS vf,
            (SELECT COUNT(*) FROM ${MR}.cppt c WHERE c.KUNJUNGAN = k.NOMOR AND c.STATUS = 1
               AND c.TANGGAL > COALESCE((SELECT MAX(v.BATAS_TANGGAL) FROM ${MR}.verifikasi_cppt v
                                          WHERE v.KUNJUNGAN = k.NOMOR AND v.STATUS = 1), '1000-01-01')) AS bv
          FROM ${PD}.kunjungan k WHERE k.NOPEN IN (${ph}) AND k.STATUS <> 0
        ) x
        GROUP BY x.NOPEN`,
      chunk,
    ),
  );
  return new Map(
    rows.map((r) => [String(r.nopen), { total: num(r.total), verifikasi: num(r.verifikasi), belumVerif: num(r.belumVerif) }]),
  );
}

export type SpriRi = { n: number; asalIgdNopen: string | null };

/** SPRI yang menunjuk NOPEN (RI) + NOPEN leg IGD asalnya (bila dari IGD). */
export async function querySpriRi(nopens: readonly string[]): Promise<Map<string, SpriRi>> {
  const rows = await perChunk(nopens, (chunk, ph) =>
    query<{ nopen: string; n: Num; asalIgdNopen: string | null }>(
      `SELECT ${CAP} s.PENDAFTARAN_RI_NOMOR AS nopen, COUNT(*) AS n,
          MAX(CASE WHEN r.JENIS_KUNJUNGAN = 2 AND k.NOPEN <> s.PENDAFTARAN_RI_NOMOR THEN k.NOPEN END) AS asalIgdNopen
        FROM ${MR}.perencanaan_rawat_inap s
        LEFT JOIN ${PD}.kunjungan k ON k.NOMOR = s.KUNJUNGAN
        LEFT JOIN ${MS}.ruangan r ON r.ID = k.RUANGAN
        WHERE s.STATUS = 1 AND s.PENDAFTARAN_RI_NOMOR IN (${ph})
        GROUP BY s.PENDAFTARAN_RI_NOMOR`,
      chunk,
    ),
  );
  return new Map(rows.map((r) => [String(r.nopen), { n: num(r.n), asalIgdNopen: r.asalIgdNopen ? String(r.asalIgdNopen) : null }]));
}

export type PulangRingkas = { cara: number | null; keadaan: number | null };

/** Data pasien pulang terakhir (CARA REF 45, KEADAAN REF 46). */
export async function queryPasienPulang(nopens: readonly string[]): Promise<Map<string, PulangRingkas>> {
  const rows = await perChunk(nopens, (chunk, ph) =>
    query<{ nopen: string; cara: string | null; keadaan: string | null }>(
      `SELECT ${CAP} NOPEN AS nopen,
          SUBSTRING_INDEX(GROUP_CONCAT(CARA ORDER BY ID DESC), ',', 1) AS cara,
          SUBSTRING_INDEX(GROUP_CONCAT(KEADAAN ORDER BY ID DESC), ',', 1) AS keadaan
        FROM ${LY}.pasien_pulang WHERE STATUS = 1 AND NOPEN IN (${ph}) GROUP BY NOPEN`,
      chunk,
    ),
  );
  return new Map(
    rows.map((r) => [String(r.nopen), { cara: r.cara ? Number(r.cara) : null, keadaan: r.keadaan ? Number(r.keadaan) : null }]),
  );
}

export type PenunjangRingkas = { lab: number; labBelum: number; rad: number; radBelum: number };

/** Hasil penunjang: JENIS 8 = Lab, 7 = Rad (REF 74); STATUS_HASIL 3 = Final (REF 208). */
export async function queryPenunjang(nopens: readonly string[]): Promise<Map<string, PenunjangRingkas>> {
  const rows = await perChunk(nopens, (chunk, ph) =>
    query<{ nopen: string; lab: Num; labBelum: Num; rad: Num; radBelum: Num }>(
      `SELECT ${CAP} k.NOPEN AS nopen,
          SUM(s.JENIS = 8) AS lab, SUM(s.JENIS = 8 AND s.STATUS_HASIL <> 3) AS labBelum,
          SUM(s.JENIS = 7) AS rad, SUM(s.JENIS = 7 AND s.STATUS_HASIL <> 3) AS radBelum
        FROM ${LY}.status_hasil_pemeriksaan s
        JOIN ${LY}.tindakan_medis tm ON tm.ID = s.TINDAKAN_MEDIS_ID AND tm.STATUS = 1
        JOIN ${PD}.kunjungan k ON k.NOMOR = tm.KUNJUNGAN AND k.STATUS <> 0
        WHERE k.NOPEN IN (${ph})
        GROUP BY k.NOPEN`,
      chunk,
    ),
  );
  return new Map(
    rows.map((r) => [
      String(r.nopen),
      { lab: num(r.lab), labBelum: num(r.labBelum), rad: num(r.rad), radBelum: num(r.radBelum) },
    ]),
  );
}

/** NOPEN yang punya tagihan aktif (`pembayaran.tagihan.ID` = NOPEN). */
export async function queryTagihanAda(nopens: readonly string[]): Promise<Set<string>> {
  const rows = await perChunk(nopens, (chunk, ph) =>
    query<{ nopen: string }>(`SELECT ${CAP} ID AS nopen FROM ${PB}.tagihan WHERE STATUS = 1 AND ID IN (${ph})`, chunk),
  );
  return new Set(rows.map((r) => String(r.nopen)));
}

/* ------------------------------------------- sasaran tindak lanjut (V1) */

export type DokterRingkas = { nip: string; nama: string };

/**
 * NIP & nama DPJP (`master.dokter.NIP` → `master.pegawai`) — NIP dicocokkan
 * dengan `users.nip` sebagai sasaran notifikasi. 31/31 dokter aktif ber-NIP.
 */
export async function queryDokterNip(ids: readonly number[]): Promise<Map<number, DokterRingkas>> {
  if (ids.length === 0) return new Map();
  const rows = await query<{ id: Num; nip: string | null; gd: string | null; nama: string | null; gb: string | null }>(
    `SELECT ${CAP} d.ID AS id, d.NIP AS nip, pg.GELAR_DEPAN AS gd, pg.NAMA AS nama, pg.GELAR_BELAKANG AS gb
       FROM ${MS}.dokter d LEFT JOIN ${MS}.pegawai pg ON pg.NIP = d.NIP
      WHERE d.ID IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  const out = new Map<number, DokterRingkas>();
  for (const r of rows) {
    const nip = r.nip?.trim();
    if (!nip) continue;
    const nama = [r.gd?.trim(), r.nama?.trim()].filter(Boolean).join(" ");
    out.set(num(r.id), { nip, nama: `${nama || `NIP ${nip}`}${r.gb?.trim() ? `, ${r.gb.trim()}` : ""}` });
  }
  return out;
}

export type RuangRingkas = { id: string; nama: string };

/** Ruang IGD (leg JENIS_KUNJUNGAN 2 terakhir) per NOPEN — sasaran item triase/SPRI. */
export async function queryRuangIgd(nopens: readonly string[]): Promise<Map<string, RuangRingkas>> {
  const rows = await perChunk(nopens, (chunk, ph) =>
    query<{ nopen: string; id: string; nama: string | null }>(
      `SELECT ${CAP} x.nopen, x.id, r.DESKRIPSI AS nama FROM (
          SELECT k.NOPEN AS nopen,
            SUBSTRING_INDEX(GROUP_CONCAT(k.RUANGAN ORDER BY k.MASUK DESC), ',', 1) AS id
          FROM ${PD}.kunjungan k JOIN ${MS}.ruangan rr ON rr.ID = k.RUANGAN AND rr.JENIS_KUNJUNGAN = 2
          WHERE k.NOPEN IN (${ph}) AND k.STATUS <> 0
          GROUP BY k.NOPEN
        ) x LEFT JOIN ${MS}.ruangan r ON r.ID = x.id`,
      chunk,
    ),
  );
  return new Map(rows.map((r) => [String(r.nopen), { id: String(r.id), nama: r.nama?.trim() || String(r.id) }]));
}

/**
 * Unit pelayanan penunjang (ruang leaf aktif JENIS_KUNJUNGAN 4 = Laboratorium,
 * 5 = Radiologi). Hasil belum final tercatat di ruang PEMESAN, jadi item
 * penunjang ditujukan ke unit ini (bukan ruang episode).
 */
export async function queryUnitPenunjang(): Promise<{ lab: RuangRingkas | null; rad: RuangRingkas | null }> {
  const rows = await query<{ id: string; nama: string | null; jk: Num }>(
    `SELECT ${CAP} ID AS id, DESKRIPSI AS nama, JENIS_KUNJUNGAN AS jk FROM ${MS}.ruangan
      WHERE JENIS = 5 AND STATUS = 1 AND JENIS_KUNJUNGAN IN (4, 5) ORDER BY ID`,
    [],
  );
  const pertama = (jk: number) => {
    const r = rows.find((x) => num(x.jk) === jk);
    return r ? { id: String(r.id), nama: r.nama?.trim() || String(r.id) } : null;
  };
  return { lab: pertama(4), rad: pertama(5) };
}

export type SepKandidat = { nomor: string; jenisPelayanan: number; tanggal: string; jarak: number };

/**
 * Kandidat SEP per NOPEN (pola sama `querySepByNopen`): NORM → NIK → peserta →
 * `bpjs.kunjungan` dengan tglSEP ∈ [daftar−1, daftar+3]. Urut jarak terdekat;
 * pemilihan jenis pelayanan (RI=1 / RJ=2) dilakukan di service.
 */
export async function querySepKandidat(nopens: readonly string[]): Promise<Map<string, SepKandidat[]>> {
  const rows = await perChunk(nopens, (chunk, ph) =>
    query<{ nopen: string; nomor: string | null; jp: Num; tanggal: string; jarak: Num }>(
      `SELECT ${CAP} pp.NOMOR AS nopen, bk.noSEP AS nomor, bk.jenisPelayanan AS jp,
          DATE_FORMAT(bk.tglSEP, '%Y-%m-%d') AS tanggal, ABS(DATEDIFF(bk.tglSEP, pp.TANGGAL)) AS jarak
        FROM ${PD}.pendaftaran pp
        JOIN ${MS}.kartu_identitas_pasien ki ON ki.NORM = pp.NORM AND ki.JENIS = 1
        JOIN ${BP}.peserta pes ON pes.nik = ki.NOMOR
        JOIN ${BP}.kunjungan bk ON bk.noKartu = pes.noKartu AND bk.status = 1
        WHERE pp.NOMOR IN (${ph}) AND bk.tglSEP IS NOT NULL
          AND DATE(bk.tglSEP) BETWEEN DATE_SUB(DATE(pp.TANGGAL), INTERVAL 1 DAY)
                                  AND DATE_ADD(DATE(pp.TANGGAL), INTERVAL 3 DAY)
        ORDER BY pp.NOMOR, jarak ASC, bk.tglSEP DESC`,
      chunk,
    ),
  );
  const out = new Map<string, SepKandidat[]>();
  for (const r of rows) {
    const nomor = r.nomor?.trim();
    if (!nomor) continue;
    const key = String(r.nopen);
    const list = out.get(key) ?? [];
    list.push({ nomor, jenisPelayanan: num(r.jp), tanggal: r.tanggal, jarak: num(r.jarak) });
    out.set(key, list);
  }
  return out;
}
