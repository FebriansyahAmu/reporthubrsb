/**
 * Tipe bersama modul Dashboard (dipakai server DAL/service & komponen client).
 * File murni tipe/konstanta — TANPA `server-only` — aman diimpor client.
 */
export type PeriodKey = "7d" | "30d" | "90d" | "month";

export type JenisKey = "rj" | "igd" | "ri";

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  "7d": "7 hari terakhir",
  "30d": "30 hari terakhir",
  "90d": "90 hari terakhir",
  month: "Bulan ini",
};

export const JENIS_META: Record<JenisKey, { label: string; short: string }> = {
  rj: { label: "Rawat Jalan", short: "RJ" },
  igd: { label: "IGD", short: "IGD" },
  ri: { label: "Rawat Inap", short: "RI" },
};

/** Kode SIMGOS `JENIS_KUNJUNGAN` → kunci internal. */
export const JENIS_BY_CODE: Record<number, JenisKey> = { 1: "rj", 2: "igd", 3: "ri" };

export type TrendPoint = { date: string; rj: number; igd: number; ri: number; total: number };
export type CategoryDatum = { label: string; value: number };
export type RoomDatum = { unit: string; jenis: JenisKey; value: number };
export type HourDatum = { hour: number; value: number };
export type SparkPoint = { date: string; value: number };

export type DashboardSummary = {
  total: number;
  rj: number;
  igd: number;
  ri: number;
  baru: number;
  lama: number;
  lk: number;
  pr: number;
};

export type DashboardData = {
  /** Waktu data diambil (jam server RS, 'YYYY-MM-DD HH:mm'). */
  generatedAt: string;
  /** Tanggal DB (CURDATE) 'YYYY-MM-DD'. */
  today: string;
  period: { key: PeriodKey; label: string; from: string; to: string; days: number };
  todayCard: {
    total: number;
    rj: number;
    igd: number;
    ri: number;
    /** Total kunjungan kemarin (untuk delta). */
    yesterday: number;
    /** 14 hari terakhir (kontinu) untuk sparkline. */
    spark: SparkPoint[];
  };
  /** Pasien sedang dirawat (bed RI terisi — KELUAR kosong). */
  census: number;
  summary: DashboardSummary;
  trend: TrendPoint[];
  byJenis: { key: JenisKey; label: string; value: number }[];
  byCaraBayar: CategoryDatum[];
  topRooms: RoomDatum[];
  byHour: HourDatum[];
};
