import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import { AWALAN_GRAVID, AWALAN_NEONATAL, KODE_STROKE, RL35_JENIS_LAPORAN } from "./rl35.constants";
import type { BarisAgregat, HariKunjungan, KategoriRl35, RuanganRow } from "./rl35.types";

const PEND = SIMGOS_DB.PENDAFTARAN;
const MASTER = SIMGOS_DB.MASTER;
const MR = SIMGOS_DB.MEDICALRECORD;
const APP = SIMGOS_DB.APLIKASI;

/** Batas waktu eksekusi di server DB (MySQL 8) — laporan tak boleh menyandera koneksi. */
const CAP = "/*+ MAX_EXECUTION_TIME(15000) */";

/** Kode diagnosis dari konstanta (bukan masukan pengguna) — tetap dipagari pola agar aman disisipkan. */
const kodeAman = (k: string) => {
  if (!/^[A-Z][0-9.]{0,6}$/.test(k)) throw new Error(`Kode ICD tidak valid: ${k}`);
  return k;
};

/** Episode punya diagnosis klinis (bukan hasil grouper) yang cocok — sama dengan subquery CEK_* SP. */
const adaDiagnosis = (kondisi: string) =>
  `EXISTS (SELECT 1 FROM ${MR}.diagnosa a WHERE a.NOPEN = tk.NOPEN AND a.INA_GROUPER = 0 AND a.\`STATUS\` = 1 AND (${kondisi}))`;
const DX_STROKE = adaDiagnosis(`a.KODE IN (${KODE_STROKE.map((k) => `'${kodeAman(k)}'`).join(", ")})`);
const DX_NEONATAL = adaDiagnosis(AWALAN_NEONATAL.map((k) => `a.KODE LIKE '${kodeAman(k)}%'`).join(" OR "));
const DX_GRAVID = adaDiagnosis(AWALAN_GRAVID.map((k) => `a.KODE LIKE '${kodeAman(k)}%'`).join(" OR "));

/**
 * Kunjungan poliklinik & IGD pada periode — filter SP `LaporanRL35Revisi`:
 * ruangan pelayanan (`JENIS = 5`) berjenis 1/2, `kunjungan.MASUK` dalam periode,
 * pendaftaran & kunjungan berstatus 1/2, dan (cabang rawat jalan SP) pendaftaran
 * punya `tujuan_pasien`. `FORCE INDEX (MASUK)`: biaya sebanding panjang periode.
 */
const kunjungan = (o: { pasien?: boolean; hanyaPoliklinik?: boolean } = {}) => `
    FROM ${PEND}.kunjungan tk FORCE INDEX (MASUK)
    JOIN ${MASTER}.ruangan jkr ON jkr.ID = tk.RUANGAN AND jkr.JENIS = 5 AND jkr.JENIS_KUNJUNGAN IN (${o.hanyaPoliklinik ? "1" : "1, 2"})
    JOIN ${PEND}.pendaftaran pd ON pd.NOMOR = tk.NOPEN AND pd.\`STATUS\` IN (1, 2)${
      o.pasien ? `\n    JOIN ${MASTER}.pasien p ON p.NORM = pd.NORM` : ""
    }
    WHERE tk.MASUK BETWEEN ? AND ? AND tk.\`STATUS\` IN (1, 2)
      AND (jkr.JENIS_KUNJUNGAN = 2 OR EXISTS (SELECT 1 FROM ${PEND}.tujuan_pasien tps WHERE tps.NOPEN = pd.NOMOR))`;

/**
 * Agregat RL 3.5 per ruangan × jenis kelamin × domisili × bendera diagnosis.
 * Satu kunjungan = satu pasangan (pendaftaran, ruangan): SP menghitung sekali
 * per pendaftaran dengan ruangan sembarang (`GROUP BY pd.NOMOR`), di sini
 * pendaftaran yang mengunjungi dua poliklinik terhitung di keduanya.
 *
 * Domisili (penyesuaian yang disengaja): kabupaten alamat pasien
 * (`LEFT(master.pasien.WILAYAH, 4)`) dibanding kabupaten RS — SP memakai
 * wilayah faskes perujuk sehingga pasien tanpa surat rujukan aktif selalu
 * "luar kota". Join kosmetik SP (penjamin, ikatan kerja sama, kartu asuransi)
 * dibuang. Hanya tanggal & kode kabupaten yang di-bind; tak ada nilai pengguna
 * di-inline.
 */
export async function queryAgregatRl35(dari: string, sampai: string, kodeKab: string): Promise<BarisAgregat[]> {
  const sql = `
    SELECT ${CAP} x.ruangan, x.jk, x.dom, x.stroke, x.neonatal, x.gravid, COUNT(*) AS n
    FROM (
      SELECT tk.RUANGAN AS ruangan,
             MAX(CASE WHEN p.JENIS_KELAMIN = 1 THEN 1 WHEN p.JENIS_KELAMIN IS NULL THEN 0 ELSE 2 END) AS jk,
             MAX(CASE
                   WHEN p.WILAYAH IS NULL OR TRIM(p.WILAYAH) = '' THEN 2
                   WHEN LEFT(TRIM(p.WILAYAH), 4) = ? THEN 1
                   ELSE 0
                 END) AS dom,
             ${DX_STROKE} AS stroke,
             ${DX_NEONATAL} AS neonatal,
             ${DX_GRAVID} AS gravid
      ${kunjungan({ pasien: true })}
      GROUP BY tk.NOPEN, tk.RUANGAN
    ) x
    GROUP BY x.ruangan, x.jk, x.dom, x.stroke, x.neonatal, x.gravid`;

  type Num = bigint | number | null;
  type Row = { ruangan: string; jk: Num; dom: Num; stroke: Num; neonatal: Num; gravid: Num; n: Num };
  const rows = await getSimgos().$queryRawUnsafe<Row[]>(sql, kodeKab, dari, sampai);
  return rows.map((r) => ({
    ruangan: String(r.ruangan).trim(),
    jk: Number(r.jk ?? 0),
    dom: Number(r.dom ?? 2),
    stroke: Number(r.stroke) === 1,
    neonatal: Number(r.neonatal) === 1,
    gravid: Number(r.gravid) === 1,
    n: Number(r.n ?? 0),
  }));
}

/** Tanggal berkunjungan poliklinik + ruangan yang melayani (≤ 366 baris) — dasar baris 66 & 77. */
export async function queryHariPoliklinik(dari: string, sampai: string): Promise<HariKunjungan[]> {
  const sql = `
    SELECT ${CAP} DATE_FORMAT(DATE(tk.MASUK), '%Y-%m-%d') AS tanggal, GROUP_CONCAT(DISTINCT tk.RUANGAN) AS ruangan
    ${kunjungan({ hanyaPoliklinik: true })}
    GROUP BY DATE(tk.MASUK)
    ORDER BY DATE(tk.MASUK)`;
  const rows = await getSimgos().$queryRawUnsafe<{ tanggal: string; ruangan: string | null }[]>(sql, dari, sampai);
  return rows.map((r) => ({
    tanggal: String(r.tanggal),
    ruangan: String(r.ruangan ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  }));
}

/** Poliklinik & ruang IGD (SP: `JENIS = 5 AND JENIS_KUNJUNGAN IN (1, 2)`), termasuk yang nonaktif. */
export async function queryRuanganRl35(): Promise<RuanganRow[]> {
  const sql = `
    SELECT ID AS id, DESKRIPSI AS nama, JENIS_KUNJUNGAN AS jk, STATUS AS status
    FROM ${MASTER}.ruangan
    WHERE JENIS = 5 AND JENIS_KUNJUNGAN IN (1, 2)
    ORDER BY JENIS_KUNJUNGAN, DESKRIPSI`;
  const rows = await getSimgos().$queryRawUnsafe<
    { id: string; nama: string | null; jk: number | bigint; status: number | bigint | null }[]
  >(sql);
  return rows.map((r) => ({
    id: String(r.id).trim(),
    nama: (r.nama ?? "").trim(),
    jenisKunjungan: Number(r.jk),
    aktif: Number(r.status) === 1,
  }));
}

/** Jenis kegiatan RL 3.5 (SIRS 6) dari `master.refrl` — urut ID seperti SP. */
export async function queryKategoriRl35(): Promise<KategoriRl35[]> {
  const sql = `
    SELECT rl.ID AS id, rl.KODE AS kode, rl.DESKRIPSI AS deskripsi
    FROM ${MASTER}.refrl rl
    JOIN ${MASTER}.jenis_laporan_detil j ON j.JENIS = rl.JENISRL AND j.ID = rl.IDJENISRL
    WHERE j.JENIS = ? AND j.ID = ?
    ORDER BY rl.ID`;
  const rows = await getSimgos().$queryRawUnsafe<{ id: number | bigint; kode: string | null; deskripsi: string | null }[]>(
    sql,
    RL35_JENIS_LAPORAN.jenis,
    RL35_JENIS_LAPORAN.id,
  );
  return rows.map((r) => ({ id: Number(r.id), kode: (r.kode ?? "").trim(), deskripsi: (r.deskripsi ?? "").trim() }));
}

/** Identitas instansi (RS) — kop laporan & kabupaten acuan dalam/luar. Null bila belum terkonfigurasi. */
export async function queryInstansiRl35(): Promise<Record<string, string | number | null> | null> {
  const sql = `
    SELECT p.KODE AS kodeRs, p.NAMA AS nama, p.WILAYAH AS kodeWilayah, w.DESKRIPSI AS kota
    FROM ${APP}.instansi ai
    JOIN ${MASTER}.ppk p ON p.ID = ai.PPK
    LEFT JOIN ${MASTER}.wilayah w ON w.ID = p.WILAYAH
    LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<Record<string, string | number | null>[]>(sql);
  return rows[0] ?? null;
}
