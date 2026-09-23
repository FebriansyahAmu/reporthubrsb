"use client";

import type {
  JenisKlaim,
  JenisLayanan,
  KategoriKlaim,
  StatusKlaim,
} from "@/server/modules/rekap-klaim/klaim.schema";

export type KlaimItem = {
  id: string;
  nomorKlaim: string | null;
  jenisKlaim: JenisKlaim;
  jenisLayanan: JenisLayanan;
  kategori: KategoriKlaim;
  bulanPelayanan: number;
  tahunPelayanan: number;
  jumlah: number;
  jumlahDiajukan: number | null;
  selisih: number | null;
  jumlahKasus: number | null;
  tglMasukRekening: string | null;
  status: StatusKlaim;
  refBa: string | null;
  catatan: string | null;
  jumlahPotongan: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KlaimListMeta = {
  total: number;
  totalNilai: number;
  tahunTersedia: number[];
};

export type KlaimPayload = {
  nomorKlaim?: string;
  jenisKlaim: JenisKlaim;
  jenisLayanan: JenisLayanan;
  kategori: KategoriKlaim;
  bulanPelayanan: number;
  tahunPelayanan: number;
  jumlah: number | string;
  jumlahDiajukan?: number | string;
  jumlahKasus?: number | string;
  tglMasukRekening?: string;
  status: StatusKlaim;
  refBa?: string;
  catatan?: string;
};

export type KlaimQuery = {
  tahun?: number | string;
  bulan?: number | string;
  jenisKlaim?: JenisKlaim;
  jenisLayanan?: JenisLayanan;
  kategori?: KategoriKlaim;
  status?: StatusKlaim;
  q?: string;
};

const BASE = "/api/rekap-klaim/klaim";

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

function toQuery(params: KlaimQuery): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && String(v).trim() !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function fetchKlaim(query: KlaimQuery): Promise<{ data: KlaimItem[]; meta: KlaimListMeta }> {
  const j = await jsonCall<KlaimItem[]>(`${BASE}${toQuery(query)}`);
  return { data: j.data, meta: j.meta as KlaimListMeta };
}

export const createKlaim = (payload: KlaimPayload) =>
  jsonCall<KlaimItem>(BASE, "POST", payload).then((j) => j.data);

export const updateKlaim = (id: string, payload: KlaimPayload) =>
  jsonCall<KlaimItem>(`${BASE}/${id}`, "PATCH", payload).then((j) => j.data);

/** Ubah cepat status saja (PATCH parsial). */
export const updateKlaimStatus = (id: string, status: KlaimItem["status"]) =>
  jsonCall<KlaimItem>(`${BASE}/${id}`, "PATCH", { status }).then((j) => j.data);

export const deleteKlaim = (id: string) =>
  jsonCall<{ id: string }>(`${BASE}/${id}`, "DELETE").then((j) => j.data);
