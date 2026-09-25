"use client";

import type { StatusAset } from "@/server/modules/inventaris/barang.schema";
import type { Frekuensi } from "@/server/modules/inventaris/checklist.schema";

export type { Frekuensi };

export type ChecklistBarangRow = {
  barangId: string;
  kodeBarang: string;
  nama: string;
  merk: string | null;
  statusAset: StatusAset;
  kondisiSaatIni: { id: string; nama: string; tone: string } | null;
  checked: boolean;
  kondisiId: string | null;
  catatan: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
};

export type ChecklistStats = {
  harian: { done: number; total: number };
  mingguan: { done: number; total: number };
  bulanan: { done: number; total: number };
};

export type ChecklistOverview = {
  ruangan: { id: string; kodePrefix: string; nama: string };
  frekuensi: Frekuensi;
  periodeKey: string;
  periodeLabel: string;
  selesai: boolean;
  selesaiAt: string | null;
  selesaiBy: string | null;
  terlewat: boolean;
  total: number;
  done: number;
  rows: ChecklistBarangRow[];
  stats: ChecklistStats;
};

export type PeriksaState = {
  barangId: string | null;
  checked: boolean;
  kondisiId: string | null;
  catatan: string | null;
  checkedAt: string | null;
  done: number;
  total: number;
  selesai: boolean;
  selesaiAt: string | null;
  selesaiBy: string | null;
};

export type ChecklistRefs = {
  ruangan: { id: string; kodePrefix: string; nama: string }[];
  kondisi: { id: string; nama: string; kode: string; tone: string }[];
};

export type RiwayatRun = {
  id: string;
  periodeKey: string;
  periodeLabel: string;
  selesai: boolean;
  selesaiAt: string | null;
  selesaiBy: string | null;
  done: number;
  total: number;
  current: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RiwayatOverview = {
  ruangan: { id: string; kodePrefix: string; nama: string };
  frekuensi: Frekuensi;
  total: number;
  runs: RiwayatRun[];
};

export type RunDetailRow = {
  barangId: string;
  kodeBarang: string;
  nama: string;
  merk: string | null;
  checked: boolean;
  kondisi: { nama: string; tone: string } | null;
  catatan: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
};

export type RunDetail = {
  id: string | null;
  ruangan: { id: string; kodePrefix: string; nama: string };
  frekuensi: Frekuensi;
  periodeKey: string;
  periodeLabel: string;
  selesai: boolean;
  selesaiAt: string | null;
  selesaiBy: string | null;
  catatan: string | null;
  done: number;
  total: number;
  rows: RunDetailRow[];
};

const BASE = "/api/inventaris/pemeliharaan/checklist";

async function jsonCall<T>(url: string, method = "GET", body?: unknown): Promise<{ data: T }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message;
    throw new Error(msg || "Terjadi kesalahan");
  }
  return json as { data: T };
}

export const fetchChecklist = (params: { ruanganId: string; frekuensi: string }) => {
  const sp = new URLSearchParams({ ruanganId: params.ruanganId, frekuensi: params.frekuensi });
  return jsonCall<ChecklistOverview>(`${BASE}?${sp.toString()}`).then((j) => j.data);
};

export const fetchChecklistRefs = () => jsonCall<ChecklistRefs>(`${BASE}/refs`).then((j) => j.data);

export const periksaBarang = (payload: {
  ruanganId: string; frekuensi: string; barangId: string; checked: boolean; kondisiId?: string; catatan?: string;
}) => jsonCall<PeriksaState>(`${BASE}/periksa`, "POST", payload).then((j) => j.data);

export const completeChecklist = (payload: { ruanganId: string; frekuensi: string; selesai: boolean; catatan?: string }) =>
  jsonCall<PeriksaState>(`${BASE}/complete`, "POST", payload).then((j) => j.data);

export const fetchRiwayat = (params: { ruanganId: string; frekuensi: string; limit?: number }) => {
  const sp = new URLSearchParams({ ruanganId: params.ruanganId, frekuensi: params.frekuensi });
  if (params.limit) sp.set("limit", String(params.limit));
  return jsonCall<RiwayatOverview>(`${BASE}/riwayat?${sp.toString()}`).then((j) => j.data);
};

export const fetchRunDetail = (runId: string) =>
  jsonCall<RunDetail>(`${BASE}/riwayat/${encodeURIComponent(runId)}`).then((j) => j.data);

/** URL ekspor .xlsx (dipakai downloadFromEndpoint). */
export function exportChecklistUrl(params: {
  ruanganId: string;
  frekuensi: string;
  mode: "periode" | "riwayat";
  periodeKey?: string;
}): string {
  const sp = new URLSearchParams({ ruanganId: params.ruanganId, frekuensi: params.frekuensi, mode: params.mode });
  if (params.periodeKey) sp.set("periodeKey", params.periodeKey);
  return `${BASE}/export?${sp.toString()}`;
}
