"use client";

import type { StatusKlaim } from "@/server/modules/rekap-klaim/klaim.schema";
import type { KlaimItem } from "./klaim.client";

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

export async function fetchStatusOverview(tahun?: number | string): Promise<StatusOverview> {
  const qs = tahun ? `?tahun=${encodeURIComponent(String(tahun))}` : "";
  const res = await fetch(`/api/rekap-klaim/status${qs}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message;
    throw new Error(msg || "Terjadi kesalahan");
  }
  return (json as { data: StatusOverview }).data;
}
