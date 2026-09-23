"use client";

import type { PotonganJenis } from "@/server/modules/rekap-klaim/klaim.schema";

export type PotonganItem = {
  id: string;
  klaimId: string;
  jenis: PotonganJenis;
  jumlah: number;
  cicilanKe: number | null;
  totalCicilan: number | null;
  refBa: string | null;
  deskripsi: string | null;
  tglTerapkan: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type PotonganListMeta = {
  total: number;
  totalPotongan: number;
  klaim: {
    id: string;
    jumlah: number;
    bulanPelayanan: number;
    tahunPelayanan: number;
    jenisKlaim: string;
    jenisLayanan: string;
  };
};

export type PotonganPayload = {
  klaimId: string;
  jenis: PotonganJenis;
  jumlah: number | string;
  cicilanKe?: number | string;
  totalCicilan?: number | string;
  refBa?: string;
  deskripsi?: string;
  tglTerapkan?: string;
};

const BASE = "/api/rekap-klaim/potongan";

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

export async function fetchPotongan(klaimId: string): Promise<{ data: PotonganItem[]; meta: PotonganListMeta }> {
  const j = await jsonCall<PotonganItem[]>(`${BASE}?klaimId=${encodeURIComponent(klaimId)}`);
  return { data: j.data, meta: j.meta as PotonganListMeta };
}

export const createPotongan = (payload: PotonganPayload) =>
  jsonCall<PotonganItem>(BASE, "POST", payload).then((j) => j.data);

export const updatePotongan = (id: string, payload: Omit<PotonganPayload, "klaimId">) =>
  jsonCall<PotonganItem>(`${BASE}/${id}`, "PATCH", payload).then((j) => j.data);

export const deletePotongan = (id: string) =>
  jsonCall<{ id: string }>(`${BASE}/${id}`, "DELETE").then((j) => j.data);
