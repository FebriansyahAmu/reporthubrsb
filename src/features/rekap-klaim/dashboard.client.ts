"use client";

import type { KlaimDashboardData } from "@/server/modules/rekap-klaim/dashboard.types";

export type { KlaimDashboardData };

export async function fetchKlaimDashboard(): Promise<KlaimDashboardData> {
  const res = await fetch("/api/rekap-klaim/dashboard");
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: { message?: string } })?.error?.message || "Gagal memuat dashboard.");
  }
  return ((await res.json()) as { data: KlaimDashboardData }).data;
}

/** tone (design token) → warna chart CVD-safe. */
export const TONE_COLOR: Record<string, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  accent: "var(--accent)",
  brand: "var(--brand)",
  neutral: "var(--chart-axis)",
};
