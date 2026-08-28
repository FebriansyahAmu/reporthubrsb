import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import type { PeriodKey } from "./dashboard.types";

const PEND = SIMGOS_DB.PENDAFTARAN;
const MASTER = SIMGOS_DB.MASTER;

/**
 * Backbone read-only kunjungan per-EPISODE (satu baris per pendaftaran).
 * Identik dengan porting `LaporanPengunjungPerpasien` (tervalidasi: total per
 * jenis persis sama dengan Laporan Pengunjung) — `tk` = kunjungan masuk utama
 * (REF IS NULL) di ruangan tujuan; `jkr.JENIS_KUNJUNGAN` = 1 RJ / 2 IGD / 3 RI.
 *
 * `dateClause` SELALU dibangun dari ekspresi SQL tetap berbasis CURDATE()
 * (dipetakan dari enum periode) — bukan input user, jadi aman di-inline.
 */
function baseRows(dateClause: string): string {
  return `
    SELECT DATE_FORMAT(tk.MASUK,'%Y-%m-%d') d, HOUR(tk.MASUK) h, jkr.JENIS_KUNJUNGAN jenis,
           jkr.ID ruanganId, jkr.DESKRIPSI unit,
           COALESCE(NULLIF(TRIM(ref.DESKRIPSI),''),'(Tidak tercatat)') caraBayar,
           p.JENIS_KELAMIN jns, IF(DATE(p.TANGGAL)=DATE(tk.MASUK),1,0) baru
    FROM ${MASTER}.pasien p
    , ${PEND}.pendaftaran pd
      LEFT JOIN ${PEND}.penjamin pj ON pd.NOMOR = pj.NOPEN
      LEFT JOIN ${MASTER}.referensi ref ON pj.JENIS = ref.ID AND ref.JENIS = 10
    , ${PEND}.tujuan_pasien tp
    , ${PEND}.kunjungan tk
    , ${MASTER}.ruangan jkr
    WHERE p.NORM = pd.NORM AND pd.NOMOR = tp.NOPEN AND pd.NOMOR = tk.NOPEN AND tp.RUANGAN = tk.RUANGAN
      AND pd.\`STATUS\` IN (1,2) AND tk.REF IS NULL
      AND tk.RUANGAN = jkr.ID AND jkr.JENIS = 5 AND tk.\`STATUS\` IN (1,2)
      AND jkr.JENIS_KUNJUNGAN IN (1,2,3)
      AND ${dateClause}
    GROUP BY pd.NOMOR`;
}

/** Klausa tanggal per periode (berbasis CURDATE server DB — jam operasional RS). */
export const DATE_CLAUSE: Record<PeriodKey, string> = {
  "7d": "tk.MASUK >= CURDATE() - INTERVAL 6 DAY AND tk.MASUK < CURDATE() + INTERVAL 1 DAY",
  "30d": "tk.MASUK >= CURDATE() - INTERVAL 29 DAY AND tk.MASUK < CURDATE() + INTERVAL 1 DAY",
  "90d": "tk.MASUK >= CURDATE() - INTERVAL 89 DAY AND tk.MASUK < CURDATE() + INTERVAL 1 DAY",
  month:
    "tk.MASUK >= DATE_FORMAT(CURDATE(),'%Y-%m-01') AND tk.MASUK < DATE_FORMAT(CURDATE(),'%Y-%m-01') + INTERVAL 1 MONTH",
};

export type PeriodRawRow = {
  d: string;
  h: number | bigint;
  jenis: number | bigint;
  ruanganId: string;
  unit: string | null;
  caraBayar: string;
  jns: number | bigint;
  baru: number | bigint;
};

/** Semua baris (per-episode) untuk sebuah periode → diagregasi di service (JS). */
export async function queryPeriodRows(period: PeriodKey): Promise<PeriodRawRow[]> {
  return getSimgos().$queryRawUnsafe<PeriodRawRow[]>(baseRows(DATE_CLAUSE[period]));
}

/** Jam server DB (untuk stempel & sumbu tanggal). */
export async function queryMeta(): Promise<{ generatedAt: string; today: string }> {
  const rows = await getSimgos().$queryRawUnsafe<{ generatedAt: string; today: string }[]>(
    "SELECT DATE_FORMAT(NOW(),'%Y-%m-%d %H:%i') generatedAt, DATE_FORMAT(CURDATE(),'%Y-%m-%d') today",
  );
  return rows[0] ?? { generatedAt: "", today: "" };
}

/**
 * Sensus RI: jumlah bed rawat inap yang SEDANG terisi (kunjungan di ruangan
 * JENIS_KUNJUNGAN=3 dengan KELUAR kosong). Dihitung independen dari backbone
 * per-episode agar pasien yang masuk via IGD lalu naik ranap ikut terhitung.
 */
export async function queryCensus(): Promise<number> {
  const rows = await getSimgos().$queryRawUnsafe<{ n: number | bigint }[]>(`
    SELECT COUNT(*) n
    FROM ${PEND}.kunjungan tk
    JOIN ${MASTER}.ruangan jkr ON tk.RUANGAN = jkr.ID AND jkr.JENIS = 5 AND jkr.JENIS_KUNJUNGAN = 3
    JOIN ${PEND}.pendaftaran pd ON pd.NOMOR = tk.NOPEN AND pd.\`STATUS\` IN (1,2)
    WHERE tk.KELUAR IS NULL AND tk.\`STATUS\` IN (1,2)
      AND tk.MASUK >= CURDATE() - INTERVAL 365 DAY`);
  return Number(rows[0]?.n ?? 0);
}

/** Kunjungan hari ini per jenis (RJ/IGD/RI). */
export async function queryTodayByJenis(): Promise<{ jenis: number | bigint; n: number | bigint }[]> {
  return getSimgos().$queryRawUnsafe(`
    SELECT b.jenis, COUNT(*) n FROM (
      ${baseRows("tk.MASUK >= CURDATE() AND tk.MASUK < CURDATE() + INTERVAL 1 DAY")}
    ) b GROUP BY b.jenis`);
}

/** Total kunjungan harian `days` hari terakhir (untuk sparkline + delta). */
export async function queryRecentDaily(days: number): Promise<{ d: string; n: number | bigint }[]> {
  const n = Math.max(1, Math.trunc(days)) - 1;
  return getSimgos().$queryRawUnsafe(`
    SELECT DATE_FORMAT(x.masuk,'%Y-%m-%d') d, COUNT(*) n FROM (
      SELECT tk.MASUK masuk
      FROM ${MASTER}.pasien p, ${PEND}.pendaftaran pd, ${PEND}.tujuan_pasien tp,
           ${PEND}.kunjungan tk, ${MASTER}.ruangan jkr
      WHERE p.NORM = pd.NORM AND pd.NOMOR = tp.NOPEN AND pd.NOMOR = tk.NOPEN AND tp.RUANGAN = tk.RUANGAN
        AND pd.\`STATUS\` IN (1,2) AND tk.REF IS NULL AND tk.RUANGAN = jkr.ID AND jkr.JENIS = 5
        AND tk.\`STATUS\` IN (1,2) AND jkr.JENIS_KUNJUNGAN IN (1,2,3)
        AND tk.MASUK >= CURDATE() - INTERVAL ${n} DAY AND tk.MASUK < CURDATE() + INTERVAL 1 DAY
      GROUP BY pd.NOMOR
    ) x GROUP BY d ORDER BY d`);
}
