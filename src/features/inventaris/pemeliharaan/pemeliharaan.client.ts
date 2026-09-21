"use client";

import type { StatusAset } from "@/server/modules/inventaris/barang.schema";
import type {
  DueStatus,
  HasilPemeliharaan,
  JenisPemeliharaan,
} from "@/server/modules/inventaris/pemeliharaan.schema";

export type PemeliharaanStats = { overdue: number; soon: number; scheduled: number; none: number; total: number };

export type PemeliharaanRow = {
  id: string;
  kodeBarang: string;
  nama: string;
  merk: string | null;
  statusAset: StatusAset;
  ruangan: { kodePrefix: string; nama: string };
  kondisi: { nama: string; tone: string } | null;
  terakhir: string | null;
  jatuhTempo: string | null;
  jumlah: number;
  status: DueStatus;
};

export type PemeliharaanListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  stats: PemeliharaanStats;
};

export type RiwayatRow = {
  id: string;
  tanggal: string | null;
  jenis: JenisPemeliharaan;
  hasil: HasilPemeliharaan | null;
  kondisiSesudahId: string | null;
  kondisiSesudah: string | null;
  petugas: string | null;
  biaya: number | null;
  catatan: string | null;
  jatuhTempoBerikutnya: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type PemeliharaanRefs = {
  kondisi: { id: string; nama: string; kode: string; tone: string }[];
  ruangan: { id: string; kodePrefix: string; nama: string }[];
};

export type PemeliharaanPayload = {
  tanggal: string;
  jenis: JenisPemeliharaan;
  hasil: HasilPemeliharaan;
  kondisiSesudahId?: string;
  petugas?: string;
  biaya?: string;
  catatan?: string;
  jatuhTempoBerikutnya?: string;
};

const BASE = "/api/inventaris/pemeliharaan";

async function jsonCall<T>(url: string, method = "GET", body?: unknown): Promise<{ data: T; meta?: unknown }> {
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
  return json as { data: T; meta?: unknown };
}

export async function fetchPemeliharaan(params: {
  search?: string;
  ruanganId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: PemeliharaanRow[]; meta: PemeliharaanListMeta }> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && String(v).trim() !== "") sp.set(k, String(v));
  const q = sp.toString();
  const j = await jsonCall<PemeliharaanRow[]>(`${BASE}${q ? `?${q}` : ""}`);
  return { data: j.data, meta: j.meta as PemeliharaanListMeta };
}

export const fetchPemeliharaanRefs = () => jsonCall<PemeliharaanRefs>(`${BASE}/refs`).then((j) => j.data);

export const fetchRiwayat = (barangId: string) =>
  jsonCall<{ barang: { id: string; kodeBarang: string; nama: string }; riwayat: RiwayatRow[] }>(`${BASE}/${barangId}`).then((j) => j.data);

export const createPemeliharaan = (barangId: string, payload: PemeliharaanPayload) =>
  jsonCall<RiwayatRow>(`${BASE}/${barangId}`, "POST", payload).then((j) => j.data);

export const updatePemeliharaan = (id: string, payload: PemeliharaanPayload) =>
  jsonCall<RiwayatRow>(`${BASE}/record/${id}`, "PATCH", payload).then((j) => j.data);
