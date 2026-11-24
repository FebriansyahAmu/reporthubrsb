import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/**
 * DAL "Terbit saat pulang" — **READ-ONLY** SIMGOS (HIGH ALERT: hanya SELECT,
 * tanpa mengubah tabel/prosedur apa pun). Hanya `*.dal.ts` yang mengimpor `getSimgos`.
 *
 * Indeks (diverifikasi 24 Nov 2026): pasien_pulang.TANGGAL (tabel ± 1,3 rb baris),
 * kunjungan.MASUK (FORCE INDEX — tanpa itu optimizer memilih REF ± 5 rb baris),
 * jadwal_kontrol.KUNJUNGAN (UNIQUE), monitoring_rencana_kontrol.noSepAsalKontrol,
 * rencana_kontrol.nomor. Daftar `IN (…)` dipotong per 500, berurutan (satu koneksi).
 */

const MR = SIMGOS_DB.MEDICALRECORD;
const PD = SIMGOS_DB.PENDAFTARAN;
const LY = SIMGOS_DB.LAYANAN;
const MS = SIMGOS_DB.MASTER;
const BP = SIMGOS_DB.BPJS;
const CAP = "/*+ MAX_EXECUTION_TIME(10000) */";
const CHUNK = 500;

type Num = number | bigint | string | null;
const num = (v: Num): number | null => (v == null ? null : Number(v));
const teks = (v: string | null | undefined): string | null => v?.trim() || null;

function query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
  return getSimgos().$queryRawUnsafe<T[]>(sql, ...params);
}

async function perPotongan<T>(nilai: readonly string[], run: (chunk: string[], ph: string) => Promise<T[]>): Promise<T[]> {
  const unik = [...new Set(nilai.filter(Boolean))];
  const out: T[] = [];
  for (let i = 0; i < unik.length; i += CHUNK) {
    const chunk = unik.slice(i, i + CHUNK);
    out.push(...(await run(chunk, chunk.map(() => "?").join(","))));
  }
  return out;
}

export type EpisodeRow = {
  nopen: string;
  kunjungan: string;
  tanggal: string;
  jam: string | null;
  cara: number | null;
  dokterId: number | null;
  ruanganId: string | null;
  norm: string | null;
  nama: string | null;
  sep: string | null;
  /** RJ: ada rujukan keluar (SIMRS `rujukan_keluar` / VClaim `bpjs.rujukan`). */
  dirujuk: boolean;
  /** RJ: dilanjutkan rawat inap (SPRI dari kunjungan ini / leg RI di NOPEN sama). */
  lanjutRi: boolean;
};

type EpisodeMentah = Omit<EpisodeRow, "cara" | "dokterId" | "norm" | "dirujuk" | "lanjutRi"> & {
  cara: Num;
  dokterId: Num;
  norm: Num;
  dirujuk: Num;
  lanjutRi: Num;
};

const petakanEpisode = (r: EpisodeMentah): EpisodeRow => ({
  nopen: String(r.nopen).trim(),
  kunjungan: String(r.kunjungan).trim(),
  tanggal: r.tanggal,
  jam: r.jam,
  cara: num(r.cara),
  dokterId: num(r.dokterId),
  ruanganId: teks(r.ruanganId),
  norm: r.norm == null ? null : String(r.norm),
  nama: teks(r.nama),
  sep: teks(r.sep),
  dirujuk: Number(r.dirujuk ?? 0) === 1,
  lanjutRi: Number(r.lanjutRi ?? 0) === 1,
});

/** Penjamin TERBARU episode (pola baku modul lain) — hanya BPJS (JENIS 2). */
const JOIN_PENJAMIN = (nopen: string) =>
  `JOIN ${PD}.penjamin pj ON pj.ID = (SELECT MAX(pj2.ID) FROM ${PD}.penjamin pj2 WHERE pj2.NOPEN = ${nopen})`;

/**
 * Pasien BPJS PULANG dari rawat inap dengan tanggal pulang di [from, toEksklusif).
 * Satu baris aktif `pasien_pulang` per NOPEN; kunjungan pulang = leg ruangan RI.
 */
export async function queryPulangRawatInap(from: string, toEksklusif: string): Promise<EpisodeRow[]> {
  const rows = await query<EpisodeMentah>(
    `SELECT ${CAP} lpp.NOPEN AS nopen, lpp.KUNJUNGAN AS kunjungan,
       DATE_FORMAT(lpp.TANGGAL, '%Y-%m-%d') AS tanggal, TIME_FORMAT(lpp.TANGGAL, '%H:%i') AS jam,
       lpp.CARA AS cara, lpp.DOKTER AS dokterId, k.RUANGAN AS ruanganId, pp.NORM AS norm,
       ${MS}.getNamaLengkap(pp.NORM) AS nama, pj.NOMOR AS sep, 0 AS dirujuk, 0 AS lanjutRi
     FROM ${LY}.pasien_pulang lpp
     JOIN ${PD}.kunjungan k ON k.NOMOR = lpp.KUNJUNGAN
     JOIN ${MS}.ruangan r ON r.ID = k.RUANGAN AND r.JENIS_KUNJUNGAN = 3
     JOIN ${PD}.pendaftaran pp ON pp.NOMOR = lpp.NOPEN AND pp.STATUS IN (1, 2)
     ${JOIN_PENJAMIN("lpp.NOPEN")}
     WHERE lpp.STATUS = 1 AND lpp.TANGGAL >= ? AND lpp.TANGGAL < ? AND pj.JENIS = 2`,
    [from, toEksklusif],
  );
  return rows.map(petakanEpisode);
}

/**
 * Kunjungan BPJS poli rawat jalan (leg utama, bukan konsul `REF`) dengan tanggal
 * kunjungan di [from, toEksklusif) + penanda dirujuk / lanjut rawat inap.
 */
export async function queryKunjunganRawatJalan(from: string, toEksklusif: string): Promise<EpisodeRow[]> {
  const rows = await query<EpisodeMentah>(
    `SELECT ${CAP} k.NOPEN AS nopen, k.NOMOR AS kunjungan,
       DATE_FORMAT(k.MASUK, '%Y-%m-%d') AS tanggal, TIME_FORMAT(COALESCE(k.KELUAR, k.MASUK), '%H:%i') AS jam,
       NULL AS cara, k.DPJP AS dokterId, k.RUANGAN AS ruanganId, pp.NORM AS norm,
       ${MS}.getNamaLengkap(pp.NORM) AS nama, pj.NOMOR AS sep,
       (EXISTS (SELECT 1 FROM ${PD}.rujukan_keluar rk WHERE rk.NOPEN = k.NOPEN AND rk.STATUS = 1)
        OR EXISTS (SELECT 1 FROM ${BP}.rujukan bj WHERE pj.NOMOR <> '' AND bj.noSep = pj.NOMOR)) AS dirujuk,
       (EXISTS (SELECT 1 FROM ${MR}.perencanaan_rawat_inap p WHERE p.KUNJUNGAN = k.NOMOR AND p.STATUS = 1)
        OR EXISTS (SELECT 1 FROM ${PD}.kunjungan k3 JOIN ${MS}.ruangan r3 ON r3.ID = k3.RUANGAN AND r3.JENIS_KUNJUNGAN = 3
                   WHERE k3.NOPEN = k.NOPEN AND k3.STATUS IN (1, 2))) AS lanjutRi
     FROM ${PD}.kunjungan k FORCE INDEX (MASUK)
     JOIN ${MS}.ruangan r ON r.ID = k.RUANGAN AND r.JENIS = 5 AND r.JENIS_KUNJUNGAN = 1
     JOIN ${PD}.pendaftaran pp ON pp.NOMOR = k.NOPEN AND pp.STATUS IN (1, 2)
     ${JOIN_PENJAMIN("k.NOPEN")}
     WHERE k.MASUK >= ? AND k.MASUK < ? AND k.REF IS NULL AND k.STATUS IN (1, 2) AND pj.JENIS = 2`,
    [from, toEksklusif],
  );
  return rows.map(petakanEpisode);
}

export type CacheSuratRow = {
  noSurat: string;
  sep: string | null;
  tglTerbit: string | null;
  tglRencana: string | null;
  poli: string | null;
  kodeDokter: string | null;
  namaDokter: string | null;
};

type CacheMentah = CacheSuratRow;
const KOLOM_CACHE = `m.noSuratKontrol AS noSurat, m.noSepAsalKontrol AS sep,
  DATE_FORMAT(m.tglTerbitKontrol, '%Y-%m-%d') AS tglTerbit, DATE_FORMAT(m.tglRencanaKontrol, '%Y-%m-%d') AS tglRencana,
  m.poliTujuan AS poli, m.kodeDokter AS kodeDokter, m.namaDokter AS namaDokter`;
const petakanCache = (r: CacheMentah): CacheSuratRow => ({
  noSurat: r.noSurat.trim(),
  sep: teks(r.sep),
  // Tanggal nol / kosong = tak terbaca.
  tglTerbit: r.tglTerbit && !r.tglTerbit.startsWith("0000") ? r.tglTerbit : null,
  tglRencana: r.tglRencana && !r.tglRencana.startsWith("0000") ? r.tglRencana : null,
  poli: teks(r.poli),
  kodeDokter: teks(r.kodeDokter),
  namaDokter: teks(r.namaDokter),
});

/**
 * Cache SIMGOS `bpjs.monitoring_rencana_kontrol` (diisi plugin rencanaKontrol dari
 * respons VClaim) — Surat Kontrol (jnsKontrol 2) per SEP asal. Hanya DIBACA.
 */
export function queryCacheSuratPerSep(seps: readonly string[]): Promise<CacheSuratRow[]> {
  return perPotongan(seps, (chunk, ph) =>
    query<CacheMentah>(`SELECT ${CAP} ${KOLOM_CACHE} FROM ${BP}.monitoring_rencana_kontrol m WHERE m.jnsKontrol = '2' AND m.noSepAsalKontrol IN (${ph})`, chunk),
  ).then((rows) => rows.map(petakanCache));
}

/** Cache yang sama, per nomor surat (surat yang ditemukan lewat jadwal SIMRS / catatan lokal). */
export function queryCacheSuratPerNomor(nos: readonly string[]): Promise<CacheSuratRow[]> {
  return perPotongan(nos, (chunk, ph) =>
    query<CacheMentah>(`SELECT ${CAP} ${KOLOM_CACHE} FROM ${BP}.monitoring_rencana_kontrol m WHERE m.noSuratKontrol IN (${ph})`, chunk),
  ).then((rows) => rows.map(petakanCache));
}

export type JadwalKunjunganRow = { kunjungan: string; referensi: string | null; tanggal: string; jam: string | null; aktif: boolean };

/** `medicalrecord.jadwal_kontrol` per kunjungan asal (KUNJUNGAN UNIQUE → maks. 1 baris / kunjungan). */
export function queryJadwalPerKunjungan(kunjungan: readonly string[]): Promise<JadwalKunjunganRow[]> {
  return perPotongan(kunjungan, (chunk, ph) =>
    query<{ kunjungan: string; referensi: string | null; tanggal: string; jam: string | null; status: Num }>(
      `SELECT ${CAP} jk.KUNJUNGAN AS kunjungan, jk.NOMOR_REFERENSI AS referensi, DATE_FORMAT(jk.TANGGAL, '%Y-%m-%d') AS tanggal,
         TIME_FORMAT(jk.JAM, '%H:%i') AS jam, jk.STATUS AS status
       FROM ${MR}.jadwal_kontrol jk WHERE jk.KUNJUNGAN IN (${ph})`,
      chunk,
    ),
  ).then((rows) =>
    rows.map((r) => ({ kunjungan: String(r.kunjungan).trim(), referensi: teks(r.referensi), tanggal: r.tanggal, jam: r.jam, aktif: Number(r.status ?? 0) === 1 })),
  );
}

export type LokalSuratRow = { noSurat: string; sep: string | null; tglRencana: string | null; poli: string | null; kodeDokter: string | null; aktif: boolean };

type LokalMentah = { noSurat: string; sep: string | null; tglRencana: string | null; poli: string | null; kodeDokter: string | null; status: Num };
const KOLOM_LOKAL = `rk.noSurat AS noSurat, rk.nomor AS sep, DATE_FORMAT(rk.tglRencanaKontrol, '%Y-%m-%d') AS tglRencana,
  rk.poliKontrol AS poli, rk.kodeDokter AS kodeDokter, rk.status AS status`;
const petakanLokal = (r: LokalMentah): LokalSuratRow => ({
  noSurat: r.noSurat.trim(),
  sep: teks(r.sep),
  tglRencana: r.tglRencana,
  poli: teks(r.poli),
  kodeDokter: teks(r.kodeDokter),
  aktif: Number(r.status ?? 0) === 1,
});

/** Catatan penerbitan lokal SIMGOS (`bpjs.rencana_kontrol`, Surat Kontrol: nomor = SEP asal). */
export function queryLokalSuratPerSep(seps: readonly string[]): Promise<LokalSuratRow[]> {
  return perPotongan(seps, (chunk, ph) =>
    query<LokalMentah>(`SELECT ${CAP} ${KOLOM_LOKAL} FROM ${BP}.rencana_kontrol rk WHERE rk.jnsKontrol = 2 AND rk.nomor IN (${ph})`, chunk),
  ).then((rows) => rows.map(petakanLokal));
}

export function queryLokalSuratPerNomor(nos: readonly string[]): Promise<LokalSuratRow[]> {
  return perPotongan(nos, (chunk, ph) =>
    query<LokalMentah>(`SELECT ${CAP} ${KOLOM_LOKAL} FROM ${BP}.rencana_kontrol rk WHERE rk.noSurat IN (${ph})`, chunk),
  ).then((rows) => rows.map(petakanLokal));
}

/** Nama poli BPJS (`bpjs.poli`, ± 100 baris). */
export async function queryPoliBpjsNama(): Promise<{ kode: string; nama: string | null }[]> {
  const rows = await query<{ kode: string; nama: string | null }>(`SELECT ${CAP} kode, nama FROM ${BP}.poli`);
  return rows.map((r) => ({ kode: String(r.kode).trim(), nama: teks(r.nama) }));
}
