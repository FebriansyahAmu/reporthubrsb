"use client";

import type { InvDashboardData } from "@/server/modules/inventaris/dashboard.types";

export type { InvDashboardData };

export async function fetchInvDashboard(): Promise<InvDashboardData> {
  const res = await fetch("/api/inventaris/dashboard");
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: { message?: string } })?.error?.message || "Gagal memuat data");
  }
  return ((await res.json()) as { data: InvDashboardData }).data;
}

/** tone (design token) → warna chart. */
export const TONE_COLOR: Record<string, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  accent: "var(--accent)",
  brand: "var(--brand)",
  neutral: "var(--chart-axis)",
};
