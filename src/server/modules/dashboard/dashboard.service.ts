import "server-only";
import {
  queryCensus,
  queryMeta,
  queryPeriodRows,
  queryRecentDaily,
  queryTodayByJenis,
} from "./dashboard.dal";
import {
  JENIS_BY_CODE,
  JENIS_META,
  PERIOD_LABEL,
  type CategoryDatum,
  type DashboardData,
  type HourDatum,
  type JenisKey,
  type PeriodKey,
  type RoomDatum,
  type SparkPoint,
  type TrendPoint,
} from "./dashboard.types";

// --- util tanggal (string 'YYYY-MM-DD', aritmetika di UTC → bebas TZ) ---
function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let cur = from; cur <= to; cur = addDays(cur, 1)) {
    out.push(cur);
    if (out.length > 400) break; // pengaman
  }
  return out;
}

/** Rentang tanggal tampilan (from/to/days) untuk sebuah periode, dari CURDATE DB. */
function periodRange(period: PeriodKey, today: string): { from: string; to: string; days: number } {
  if (period === "month") {
    const from = `${today.slice(0, 7)}-01`;
    return { from, to: today, days: dateRange(from, today).length };
  }
  const span = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return { from: addDays(today, -(span - 1)), to: today, days: span };
}

export async function getDashboard(period: PeriodKey): Promise<DashboardData> {
  const [meta, census, todayJenis, recent, rows] = await Promise.all([
    queryMeta(),
    queryCensus(),
    queryTodayByJenis(),
    queryRecentDaily(14),
    queryPeriodRows(period),
  ]);

  const today = meta.today || new Date().toISOString().slice(0, 10);
  const { from, to, days } = periodRange(period, today);

  // --- agregasi periode (satu lintasan) ---
  const jenisCount: Record<JenisKey, number> = { rj: 0, igd: 0, ri: 0 };
  const perDate = new Map<string, { rj: number; igd: number; ri: number }>();
  const rooms = new Map<string, RoomDatum>();
  const bayar = new Map<string, number>();
  const hours: number[] = Array(24).fill(0);
  let baru = 0;
  let lk = 0;
  let pr = 0;

  for (const r of rows) {
    const jk = JENIS_BY_CODE[Number(r.jenis)];
    if (!jk) continue;
    jenisCount[jk] += 1;
    const day = perDate.get(r.d) ?? { rj: 0, igd: 0, ri: 0 };
    day[jk] += 1;
    perDate.set(r.d, day);

    const roomKey = `${r.ruanganId}`;
    const room = rooms.get(roomKey) ?? { unit: r.unit?.trim() || r.ruanganId, jenis: jk, value: 0 };
    room.value += 1;
    rooms.set(roomKey, room);

    bayar.set(r.caraBayar, (bayar.get(r.caraBayar) ?? 0) + 1);
    hours[Number(r.h)] += 1;
    baru += Number(r.baru);
    const g = Number(r.jns);
    if (g === 1) lk += 1;
    else if (g === 2) pr += 1;
  }

  const total = rows.length;

  // trend kontinu (isi 0 untuk hari tanpa kunjungan)
  const trend: TrendPoint[] = dateRange(from, to).map((date) => {
    const d = perDate.get(date) ?? { rj: 0, igd: 0, ri: 0 };
    return { date, rj: d.rj, igd: d.igd, ri: d.ri, total: d.rj + d.igd + d.ri };
  });

  const byJenis = (Object.keys(JENIS_META) as JenisKey[]).map((key) => ({
    key,
    label: JENIS_META[key].label,
    value: jenisCount[key],
  }));

  const byCaraBayar: CategoryDatum[] = [...bayar.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const topRooms: RoomDatum[] = [...rooms.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const byHour: HourDatum[] = hours.map((value, hour) => ({ hour, value }));

  // --- kartu hari ini (14 hari kontinu) ---
  const recentMap = new Map(recent.map((x) => [x.d, Number(x.n)]));
  const spark: SparkPoint[] = dateRange(addDays(today, -13), today).map((date) => ({
    date,
    value: recentMap.get(date) ?? 0,
  }));
  const todayJenisMap = new Map(todayJenis.map((x) => [Number(x.jenis), Number(x.n)]));
  const todayTotal = [...todayJenisMap.values()].reduce((a, b) => a + b, 0);

  return {
    generatedAt: meta.generatedAt,
    today,
    period: { key: period, label: PERIOD_LABEL[period], from, to, days },
    todayCard: {
      total: todayTotal,
      rj: todayJenisMap.get(1) ?? 0,
      igd: todayJenisMap.get(2) ?? 0,
      ri: todayJenisMap.get(3) ?? 0,
      yesterday: recentMap.get(addDays(today, -1)) ?? 0,
      spark,
    },
    census,
    summary: { total, rj: jenisCount.rj, igd: jenisCount.igd, ri: jenisCount.ri, baru, lama: total - baru, lk, pr },
    trend,
    byJenis,
    byCaraBayar,
    topRooms,
    byHour,
  };
}
