import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import { RL32_JENIS_LAPORAN } from "./rl32.constants";
import type { BarisAgregat, KategoriRl32, SmfRef } from "./rl32.types";

const PEND = SIMGOS_DB.PENDAFTARAN;
const MASTER = SIMGOS_DB.MASTER;
const LAY = SIMGOS_DB.LAYANAN;
const APP = SIMGOS_DB.APLIKASI;
const INFO = SIMGOS_DB.INFORMASI;

/** Kelompok referensi SMF di `master.referensi`. */
const REF_SMF = 26;

/**
 * Batas waktu periode (semua sudah tervalidasi schema, di-bind `?`):
 * `dari`/`sampai` = TGLAWAL/TGLAKHIR SP (datetime), `awal` = DATE(TGLAWAL),
 * `awalBesok` = awal + 1 hari, `akhirBesok` = DATE(TGLAKHIR) + 1 hari,
 * `hpAkhirBesok` = min(DATE(TGLAKHIR), hari ini) + 1 hari (batas hari perawatan).
 */
export type BatasPeriode = {
  dari: string;
  sampai: string;
  awal: string;
  awalBesok: string;
  akhirBesok: string;
  hpAkhirBesok: string;
};

/**
 * Ruang rawat inap (SP: `r.JENIS_KUNJUNGAN=3 AND INSTR(r.DESKRIPSI,'IRNA')=0`) +
 * pendaftaran aktif + SMF DPJP kunjungan (`kunjungan.DPJP` → `master.dokter.NIP`
 * → `master.pegawai.SMF`; keduanya unik per NIP → tanpa hitung ganda).
 */
const JOIN_RI = `
      JOIN ${MASTER}.ruangan r
        ON r.ID = pk.RUANGAN AND r.JENIS_KUNJUNGAN = 3 AND INSTR(r.DESKRIPSI, 'IRNA') = 0
      JOIN ${PEND}.pendaftaran pp ON pp.NOMOR = pk.NOPEN AND pp.STATUS <> 0
      LEFT JOIN ${MASTER}.pasien p ON p.NORM = pp.NORM
      LEFT JOIN ${MASTER}.dokter dk ON dk.ID = pk.DPJP
      LEFT JOIN ${MASTER}.pegawai pgw ON pgw.NIP = dk.NIP`;

/** SMF DPJP kunjungan; -1 = tak diketahui (DPJP/pegawai tak ditemukan). */
const SMF = `COALESCE(pgw.SMF, -1)`;

/** Cacah kunjungan + L/P (SP: L = JENIS_KELAMIN 1, P = JENIS_KELAMIN ≠ 1). */
const CACAH = `COUNT(*) AS total, SUM(p.JENIS_KELAMIN = 1) AS lk, SUM(p.JENIS_KELAMIN <> 1) AS pr`;

/**
 * Agregat RL 3.2 per RUANGAN × SMF DPJP (format panjang: ruangan × smf × metrik),
 * port cabang UNION SP `LaporanRL32RuanganRevisi` dengan kunci `pk.RUANGAN` —
 * pemetaan ke jenis pelayanan dilakukan di aplikasi (lihat rl32.hitung). Dimensi
 * SMF hanya merinci; jumlah per ruangan sama persis dengan tanpa rincian.
 *
 * Penyesuaian yang disengaja terhadap SP:
 *  - join kosmetik `penjamin` / `tujuan_pasien` (LEFT, tak dipakai) dibuang —
 *    keduanya 1 baris per NOPEN sehingga hasil sama, tanpa risiko hitung ganda;
 *  - cabang DIPINDAHKAN SP tak dipakai SP sendiri (kolomnya = sisa
 *    keseimbangan), jadi tidak di-query;
 *  - hari perawatan dihitung langsung per kunjungan (jumlah tanggal t di
 *    periode dengan DATE(MASUK) ≤ t < DATE(KELUAR)) — identik dengan join SP
 *    ke `master.tanggal`, tetapi tidak ikut kosong pada tanggal yang hilang dari
 *    tabel itu (2023–2025 ada 114 tanggal hilang, mis. seluruh September 2025).
 */
export async function queryAgregatRuangan(b: BatasPeriode): Promise<BarisAgregat[]> {
  const bagian: [string, string[]][] = [
    // Pasien awal: masuk sebelum periode, belum keluar saat periode dimulai.
    [
      `SELECT pk.RUANGAN AS ruangan, ${SMF} AS smf, 'awal' AS metrik, ${CACAH}
      FROM ${PEND}.kunjungan pk ${JOIN_RI}
      WHERE pk.STATUS IN (1, 2) AND pk.MASUK < ? AND (pk.KELUAR >= ? OR pk.KELUAR IS NULL)
      GROUP BY pk.RUANGAN, smf`,
      [`${b.awal} 00:00:00`, `${b.awal} 00:00:00`],
    ],
    // Pasien masuk: kunjungan pertama (REF NULL) ke ruangan tujuan pendaftaran.
    [
      `SELECT pk.RUANGAN, ${SMF} AS smf, 'masuk', ${CACAH}
      FROM ${PEND}.kunjungan pk ${JOIN_RI}
      JOIN ${PEND}.tujuan_pasien tp ON tp.NOPEN = pp.NOMOR AND tp.RUANGAN = pk.RUANGAN
      WHERE pk.STATUS IN (1, 2) AND pk.REF IS NULL AND pk.MASUK BETWEEN ? AND ?
      GROUP BY pk.RUANGAN, smf`,
      [b.dari, b.sampai],
    ],
    // Pasien pindahan: kunjungan hasil mutasi dari ruangan lain.
    [
      `SELECT pk.RUANGAN, ${SMF} AS smf, 'pindahan', ${CACAH}
      FROM ${PEND}.kunjungan pk ${JOIN_RI}
      JOIN ${PEND}.mutasi pm ON pm.NOMOR = pk.REF
      JOIN ${PEND}.kunjungan asal ON asal.NOMOR = pm.KUNJUNGAN AND asal.RUANGAN <> pk.RUANGAN
      WHERE pk.STATUS IN (1, 2) AND pk.REF IS NOT NULL AND pk.MASUK BETWEEN ? AND ?
      GROUP BY pk.RUANGAN, smf`,
      [b.dari, b.sampai],
    ],
    // Pasien keluar (pasien_pulang pada saat kunjungan ditutup): hidup / mati < / ≥ 48 jam.
    [
      `SELECT pk.RUANGAN, ${SMF} AS smf,
             CASE
               WHEN lpp.CARA IN (6, 7) THEN
                 CASE
                   WHEN HOUR(TIMEDIFF(lpp.TANGGAL, pp.TANGGAL)) < 48 THEN 'matiKurang48'
                   WHEN HOUR(TIMEDIFF(lpp.TANGGAL, pp.TANGGAL)) >= 48 THEN 'matiLebih48'
                   ELSE 'matiTanpaDurasi'
                 END
               WHEN lpp.CARA NOT IN (6, 7) THEN 'hidup'
               ELSE 'keluarTanpaCara'
             END AS metrik,
             ${CACAH}
      FROM ${LAY}.pasien_pulang lpp
      JOIN ${PEND}.kunjungan pk ON pk.NOMOR = lpp.KUNJUNGAN AND pk.KELUAR = lpp.TANGGAL ${JOIN_RI}
      WHERE pk.STATUS IN (1, 2) AND pk.KELUAR BETWEEN ? AND ?
      GROUP BY pk.RUANGAN, smf, metrik`,
      [b.dari, b.sampai],
    ],
    // Lama dirawat: selisih tanggal kunjungan yang keluar pada periode.
    [
      `SELECT pk.RUANGAN, ${SMF} AS smf, 'lamaDirawat',
             SUM(DATEDIFF(pk.KELUAR, pk.MASUK)),
             SUM(IF(p.JENIS_KELAMIN = 1, DATEDIFF(pk.KELUAR, pk.MASUK), 0)),
             SUM(IF(p.JENIS_KELAMIN <> 1, DATEDIFF(pk.KELUAR, pk.MASUK), 0))
      FROM ${PEND}.kunjungan pk ${JOIN_RI}
      WHERE pk.STATUS IN (1, 2) AND pk.KELUAR BETWEEN ? AND ?
      GROUP BY pk.RUANGAN, smf`,
      [b.dari, b.sampai],
    ],
    // Pasien akhir: masuk s.d. akhir periode, belum keluar sampai akhir periode.
    [
      `SELECT pk.RUANGAN, ${SMF} AS smf, 'sisa', ${CACAH}
      FROM ${PEND}.kunjungan pk ${JOIN_RI}
      WHERE pk.STATUS IN (1, 2) AND pk.MASUK < ? AND (pk.KELUAR >= ? OR pk.KELUAR IS NULL)
      GROUP BY pk.RUANGAN, smf`,
      [`${b.akhirBesok} 00:00:00`, `${b.akhirBesok} 00:00:00`],
    ],
    // Hari perawatan per kelas (RL_KELAS 0 = kelas kamar tak terpetakan); bed
    // transit ('TRA') & kunjungan tanpa bed tidak dihitung (sama dgn SP).
    [
      `SELECT h.ruangan, h.smf, CONCAT('hp', h.kelas), SUM(h.hari),
             SUM(IF(h.jk = 1, h.hari, 0)), SUM(IF(h.jk <> 1, h.hari, 0))
      FROM (
        SELECT pk.RUANGAN AS ruangan, ${SMF} AS smf, COALESCE(kls.RL_KELAS, 0) AS kelas, p.JENIS_KELAMIN AS jk,
               GREATEST(0, DATEDIFF(
                 LEAST(COALESCE(DATE(pk.KELUAR), CAST(? AS DATE)), CAST(? AS DATE)),
                 GREATEST(DATE(pk.MASUK), CAST(? AS DATE)))) AS hari
        FROM ${PEND}.kunjungan pk
          LEFT JOIN ${MASTER}.ruang_kamar_tidur rkt ON rkt.ID = pk.RUANG_KAMAR_TIDUR
          LEFT JOIN ${MASTER}.ruang_kamar rk ON rk.ID = rkt.RUANG_KAMAR
          LEFT JOIN ${MASTER}.kelas_simrs_rl kls ON kls.KELAS = rk.KELAS ${JOIN_RI}
        WHERE pk.STATUS IN (1, 2) AND pk.MASUK < ? AND (pk.KELUAR >= ? OR pk.KELUAR IS NULL)
          AND INSTR(rkt.TEMPAT_TIDUR, 'TRA') = 0
      ) h
      GROUP BY h.ruangan, h.smf, h.kelas`,
      [b.hpAkhirBesok, b.hpAkhirBesok, b.awal, `${b.hpAkhirBesok} 00:00:00`, `${b.awalBesok} 00:00:00`],
    ],
  ];

  const sql = `
    SELECT x.ruangan AS ruangan, x.smf AS smf, x.metrik AS metrik,
           CAST(SUM(x.total) AS SIGNED) AS total,
           CAST(SUM(x.lk) AS SIGNED) AS lk,
           CAST(SUM(x.pr) AS SIGNED) AS pr
    FROM (
      ${bagian.map(([s]) => s).join("\n      UNION ALL\n      ")}
    ) x
    GROUP BY x.ruangan, x.smf, x.metrik`;
  const params = bagian.flatMap(([, p]) => p);

  type Num = bigint | number | null;
  type Row = { ruangan: string; smf: Num; metrik: string; total: Num; lk: Num; pr: Num };
  const rows = await getSimgos().$queryRawUnsafe<Row[]>(sql, ...params);
  return rows.map((r) => ({
    ruangan: String(r.ruangan),
    smf: Number(r.smf ?? -1),
    metrik: String(r.metrik),
    total: Number(r.total ?? 0),
    lk: Number(r.lk ?? 0),
    pr: Number(r.pr ?? 0),
  }));
}

/** Alokasi tempat tidur per ruangan pada satu tanggal (SP: `b.TANGGAL = DATE(TGLAWAL)`). */
export async function queryTempatTidur(tanggal: string): Promise<Map<string, number>> {
  const sql = `SELECT RUANGAN_ID AS ruangan, JUMLAH AS jumlah FROM ${INFO}.tempat_tidur WHERE TANGGAL = ?`;
  const rows = await getSimgos().$queryRawUnsafe<{ ruangan: string; jumlah: number | bigint | null }[]>(sql, tanggal);
  return new Map(rows.map((r) => [String(r.ruangan).trim(), Number(r.jumlah ?? 0)]));
}

export type RuanganRow = { id: string; nama: string; aktif: boolean };

/** Ruang rawat inap level ruangan (9 digit) yang ikut laporan (tanpa 'IRNA'). */
export async function queryRuanganRawatInap(): Promise<RuanganRow[]> {
  const sql = `
    SELECT ID AS id, DESKRIPSI AS nama, STATUS AS status
    FROM ${MASTER}.ruangan
    WHERE JENIS_KUNJUNGAN = 3 AND CHAR_LENGTH(ID) = 9 AND INSTR(DESKRIPSI, 'IRNA') = 0
    ORDER BY ID`;
  const rows = await getSimgos().$queryRawUnsafe<{ id: string; nama: string | null; status: number | null }[]>(sql);
  return rows.map((r) => ({ id: String(r.id).trim(), nama: (r.nama ?? "").trim(), aktif: Number(r.status) === 1 }));
}

/** Nama ruangan untuk ID di luar daftar rawat inap (mis. ruangan data lama). */
export async function queryNamaRuangan(ids: readonly string[]): Promise<Map<string, RuanganRow>> {
  if (ids.length === 0) return new Map();
  const sql = `
    SELECT ID AS id, DESKRIPSI AS nama, STATUS AS status
    FROM ${MASTER}.ruangan WHERE ID IN (${ids.map(() => "?").join(", ")})`;
  const rows = await getSimgos().$queryRawUnsafe<{ id: string; nama: string | null; status: number | null }[]>(sql, ...ids);
  return new Map(
    rows.map((r) => [String(r.id).trim(), { id: String(r.id).trim(), nama: (r.nama ?? "").trim(), aktif: Number(r.status) === 1 }]),
  );
}

/** Jenis pelayanan RL 3.2 (SIRS 6) dari `master.refrl` — urut ID seperti SP. */
export async function queryKategoriRl32(): Promise<KategoriRl32[]> {
  const sql = `
    SELECT rl.ID AS id, rl.KODE AS kode, rl.DESKRIPSI AS deskripsi
    FROM ${MASTER}.refrl rl
    JOIN ${MASTER}.jenis_laporan_detil j ON j.JENIS = rl.JENISRL AND j.ID = rl.IDJENISRL
    WHERE j.JENIS = ? AND j.ID = ?
    ORDER BY rl.ID`;
  const rows = await getSimgos().$queryRawUnsafe<{ id: number | bigint; kode: string | null; deskripsi: string | null }[]>(
    sql,
    RL32_JENIS_LAPORAN.jenis,
    RL32_JENIS_LAPORAN.id,
  );
  return rows.map((r) => ({ id: Number(r.id), kode: (r.kode ?? "").trim(), deskripsi: (r.deskripsi ?? "").trim() }));
}

/** Semua SMF (`master.referensi` JENIS 26). */
export async function querySmf(): Promise<SmfRef[]> {
  const sql = `SELECT ID AS id, DESKRIPSI AS nama FROM ${MASTER}.referensi WHERE JENIS = ? ORDER BY DESKRIPSI`;
  const rows = await getSimgos().$queryRawUnsafe<{ id: number | bigint; nama: string | null }[]>(sql, REF_SMF);
  return rows.map((r) => ({ id: Number(r.id), nama: (r.nama ?? "").trim() }));
}

/** Dokter aktif + SMF-nya (`master.dokter` → `master.pegawai`), untuk layar pemetaan SMF. */
export async function queryDokterSmf(): Promise<{ dpjp: number; nama: string; smf: number }[]> {
  const sql = `
    SELECT d.ID AS dpjp, pg.SMF AS smf,
           TRIM(CONCAT_WS(' ', NULLIF(pg.GELAR_DEPAN, ''), pg.NAMA, NULLIF(pg.GELAR_BELAKANG, ''))) AS nama
    FROM ${MASTER}.dokter d
    JOIN ${MASTER}.pegawai pg ON pg.NIP = d.NIP
    WHERE d.STATUS = 1 AND pg.SMF IS NOT NULL
    ORDER BY pg.NAMA`;
  const rows = await getSimgos().$queryRawUnsafe<{ dpjp: number | bigint; smf: number | bigint; nama: string | null }[]>(sql);
  return rows.map((r) => ({ dpjp: Number(r.dpjp), smf: Number(r.smf), nama: (r.nama ?? "").replace(/\s+/g, " ").trim() }));
}

/** Pemetaan SMF → jenis pelayanan bawaan SIMGOS (`master.rl32_smf_revisi`, dipakai SP versi SMF) — hanya saran. */
export async function querySaranSmf(): Promise<Map<number, number>> {
  const rows = await getSimgos().$queryRawUnsafe<{ id: number | bigint; rl: number | bigint | null }[]>(
    `SELECT ID AS id, RL31 AS rl FROM ${MASTER}.rl32_smf_revisi`,
  );
  return new Map(rows.filter((r) => r.rl != null).map((r) => [Number(r.id), Number(r.rl)]));
}

/** Identitas instansi (RS) untuk kop laporan. Null bila belum terkonfigurasi. */
export async function queryInstansiRl32(): Promise<Record<string, string | number | null> | null> {
  const sql = `
    SELECT p.KODE AS kodeRs, p.NAMA AS nama, p.WILAYAH AS kodeProp, w.DESKRIPSI AS kota
    FROM ${APP}.instansi ai, ${MASTER}.ppk p, ${MASTER}.wilayah w
    WHERE ai.PPK = p.ID AND p.WILAYAH = w.ID
    LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<Record<string, string | number | null>[]>(sql);
  return rows[0] ?? null;
}
