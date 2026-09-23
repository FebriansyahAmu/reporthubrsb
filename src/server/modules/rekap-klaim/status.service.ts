import "server-only";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import { serializeKlaim, withCount, type KlaimItem } from "./klaim.service";
import { STATUS_KLAIM, type StatusKlaim } from "./klaim.schema";

/**
 * Status tracking & alert (F-03). Batas pengajuan klaim BPJS ≈ 6 bulan sejak
 * bulan pelayanan; "mendekati batas" = ≤ 30 hari menuju jatuh tempo. Klaim
 * "belum cair" = status SUBMITTED / APPROVED / PARTIAL (belum RECEIVED/REJECTED/EXPIRED).
 */
const DEADLINE_MONTHS = 6;
const WARN_DAYS = 30;
const BELUM_CAIR: StatusKlaim[] = ["SUBMITTED", "APPROVED", "PARTIAL"];

export type AlertSeverity = "danger" | "warning" | "accent";
export type AlertEntry = { klaim: KlaimItem; reason: string; daysToDeadline: number | null; severity: AlertSeverity };

export type StatusOverview = {
  alerts: { lewatBatas: AlertEntry[]; mendekati: AlertEntry[]; selisih: AlertEntry[] };
  counts: { lewatBatas: number; mendekati: number; selisih: number };
  pendingPerBulan: { tahun: number; bulan: number; count: number; nilai: number }[];
  statusCount: Record<StatusKlaim, number>;
  belumCair: { count: number; nilai: number };
  deadlineMonths: number;
  warnDays: number;
};

/** Jatuh tempo pengajuan = hari terakhir bulan (bulanPelayanan + DEADLINE_MONTHS). */
function deadlineOf(tahun: number, bulan: number): Date {
  return new Date(Date.UTC(tahun, bulan - 1 + DEADLINE_MONTHS + 1, 0));
}
function todayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}
const rp = (n: number) => n.toLocaleString("id-ID");

export async function getStatusOverview(tahun?: number): Promise<StatusOverview> {
  const db = getAppDb();
  const where: Prisma.KlaimKlaimWhereInput = tahun ? { tahunPelayanan: tahun } : {};
  const rows = await db.klaimKlaim.findMany({
    where,
    include: withCount,
    take: 5000,
    orderBy: [{ tahunPelayanan: "desc" }, { bulanPelayanan: "desc" }],
  });
  const items = rows.map(serializeKlaim);
  const today = todayUtc();

  const lewatBatas: AlertEntry[] = [];
  const mendekati: AlertEntry[] = [];
  const selisih: AlertEntry[] = [];
  const statusCount = Object.fromEntries(STATUS_KLAIM.map((s) => [s, 0])) as Record<StatusKlaim, number>;
  const pendMap = new Map<string, { tahun: number; bulan: number; count: number; nilai: number }>();
  let bcCount = 0, bcNilai = 0;

  for (const k of items) {
    statusCount[k.status]++;

    if (k.jumlahDiajukan != null && k.selisih != null && k.selisih !== 0) {
      selisih.push({ klaim: k, reason: `Selisih Rp ${rp(Math.abs(k.selisih))} (diajukan vs diterima)`, daysToDeadline: null, severity: "accent" });
    }
    if (k.status === "EXPIRED") {
      lewatBatas.push({ klaim: k, reason: "Klaim kedaluwarsa (EXPIRED)", daysToDeadline: null, severity: "danger" });
    }

    if (BELUM_CAIR.includes(k.status)) {
      const nilai = k.jumlahDiajukan ?? k.jumlah;
      bcCount++; bcNilai += nilai;
      const key = `${k.tahunPelayanan}-${k.bulanPelayanan}`;
      const cur = pendMap.get(key) ?? { tahun: k.tahunPelayanan, bulan: k.bulanPelayanan, count: 0, nilai: 0 };
      cur.count++; cur.nilai += nilai; pendMap.set(key, cur);

      const dl = deadlineOf(k.tahunPelayanan, k.bulanPelayanan);
      const days = Math.round((dl.getTime() - today.getTime()) / 86_400_000);
      if (days < 0) {
        lewatBatas.push({ klaim: k, reason: `Lewat batas ${Math.abs(days)} hari (jatuh tempo ${dl.toISOString().slice(0, 10)})`, daysToDeadline: days, severity: "danger" });
      } else if (days <= WARN_DAYS) {
        mendekati.push({ klaim: k, reason: `Mendekati batas — ${days} hari lagi`, daysToDeadline: days, severity: "warning" });
      }
    }
  }

  lewatBatas.sort((a, b) => (a.daysToDeadline ?? 0) - (b.daysToDeadline ?? 0));
  mendekati.sort((a, b) => (a.daysToDeadline ?? 0) - (b.daysToDeadline ?? 0));
  const pendingPerBulan = [...pendMap.values()].sort((a, b) => b.tahun - a.tahun || b.bulan - a.bulan);

  return {
    alerts: { lewatBatas, mendekati, selisih },
    counts: { lewatBatas: lewatBatas.length, mendekati: mendekati.length, selisih: selisih.length },
    pendingPerBulan,
    statusCount,
    belumCair: { count: bcCount, nilai: bcNilai },
    deadlineMonths: DEADLINE_MONTHS,
    warnDays: WARN_DAYS,
  };
}
