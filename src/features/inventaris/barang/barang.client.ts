"use client";

import type { StatusAset } from "@/server/modules/inventaris/barang.schema";

/* ---------------------------------------------------------------- tipe DTO */

export type RefMini = { id: string; nama: string };

export type BarangItem = {
  id: string;
  kodeBarang: string;
  register: number | null;
  nama: string;
  merk: string | null;
  nomorSeri: string | null;
  tahunPerolehan: number | null;
  tglPerolehan: string | null;
  harga: number | null;
  statusAset: StatusAset;
  keterangan: string | null;
  item: RefMini | null;
  kategori: RefMini | null;
  sumberAnggaran: (RefMini & { singkatan?: string | null }) | null;
  satuan: RefMini | null;
  kondisi: (RefMini & { kode: string; tone: string }) | null;
  ruangan: { id: string; kodePrefix: string; nama: string; pjNama: string | null; pjNip: string | null };
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BarangListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  totalNilai: number;
};

export type FormRefs = {
  satuan: { id: string; nama: string }[];
  kondisi: { id: string; nama: string; kode: string; tone: string }[];
  sumberAnggaran: { id: string; nama: string; singkatan: string }[];
  kategori: { id: string; nama: string }[];
  ruangan: { id: string; kodePrefix: string; nama: string; pjNama: string | null; pjNip: string | null }[];
  item: { id: string; nama: string }[];
};

export type BarangPayload = {
  kodeBarang?: string;
  nama: string;
  register?: string;
  merk?: string;
  nomorSeri?: string;
  kategoriId?: string;
  sumberAnggaranId?: string;
  satuanId?: string;
  kondisiId?: string;
  ruanganId: string;
  tahunPerolehan?: string;
  tglPerolehan?: string;
  harga?: string;
  statusAset: StatusAset;
  keterangan?: string;
};

export type BarangQueryParams = {
  search?: string;
  ruanganId?: string;
  kategoriId?: string;
  kondisiId?: string;
  status?: string;
  tahun?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export type ImportRowResult = {
  baris: number;
  kodeBarang: string | null;
  nama: string;
  ruangan: string | null;
  unit: number;
  status: "valid" | "duplikat" | "error";
  catatan: string[];
};
export type ImportRingkasan = {
  baris: number;
  unit: number;
  valid: number;
  duplikat: number;
  error: number;
  ruanganBaru: { nama: string; prefix: string }[];
  itemBaru: number;
};
export type ImportPreview = {
  mode: "preview";
  items: ImportRowResult[];
  ringkasan: ImportRingkasan;
};
export type ImportCommitResult = { mode: "commit"; masuk: number; dilewati: number; ruanganBaru: number; itemBaru: number };

export type BulkRowResult = {
  index: number;
  status: "ok" | "error";
  id?: string;
  kodeBarang?: string;
  nama?: string;
  message?: string;
};

/* --------------------------------------------------------------- fetch util */

const BASE = "/api/inventaris/barang";

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

function toQuery(params: BarangQueryParams): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && String(v).trim() !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function fetchBarang(params: BarangQueryParams): Promise<{ data: BarangItem[]; meta: BarangListMeta }> {
  const j = await jsonCall<BarangItem[]>(`${BASE}${toQuery(params)}`);
  return { data: j.data, meta: j.meta as BarangListMeta };
}

export async function fetchRefs(): Promise<FormRefs> {
  return (await jsonCall<FormRefs>(`${BASE}/refs`)).data;
}

export async function fetchNextKode(ruanganId: string): Promise<{ prefix: string; kode: string }> {
  return (await jsonCall<{ prefix: string; kode: string }>(`${BASE}/next-kode?ruanganId=${encodeURIComponent(ruanganId)}`)).data;
}

export async function createBarang(payload: BarangPayload): Promise<BarangItem> {
  return (await jsonCall<BarangItem>(BASE, "POST", payload)).data;
}
export async function updateBarang(id: string, payload: Omit<BarangPayload, "kodeBarang">): Promise<BarangItem> {
  return (await jsonCall<BarangItem>(`${BASE}/${id}`, "PATCH", payload)).data;
}
export async function deleteBarang(id: string): Promise<void> {
  await jsonCall<{ id: string }>(`${BASE}/${id}`, "DELETE");
}

async function importCall(file: File, mode: "preview" | "commit"): Promise<ImportPreview | ImportCommitResult> {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("mode", mode);
  const res = await fetch(`${BASE}/import`, { method: "POST", body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message;
    throw new Error(msg || "Gagal memproses berkas");
  }
  return (json as { data: ImportPreview | ImportCommitResult }).data;
}
export const importPreview = (file: File) => importCall(file, "preview") as Promise<ImportPreview>;
export const importCommit = (file: File) => importCall(file, "commit") as Promise<ImportCommitResult>;

export async function bulkCreateBarang(rows: BarangPayload[]): Promise<{ results: BulkRowResult[]; masuk: number }> {
  return (await jsonCall<{ results: BulkRowResult[]; masuk: number }>(`${BASE}/bulk`, "POST", { rows })).data;
}

/* ------------------------------------------------------------------ katalog */

export type KatalogItem = {
  id: string;
  nama: string;
  kategori: RefMini | null;
  satuan: RefMini | null;
  spesifikasi: string | null;
  aktif: boolean;
  jumlahUnit: number;
  totalNilai: number;
};
export type KatalogMeta = { page: number; pageSize: number; total: number; totalPages: number };
export type KatalogPayload = { nama: string; kategoriId?: string; satuanId?: string; spesifikasi?: string; aktif: boolean };

export async function fetchKatalog(params: { search?: string; page?: number; pageSize?: number }): Promise<{ data: KatalogItem[]; meta: KatalogMeta }> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && String(v).trim() !== "") sp.set(k, String(v));
  const q = sp.toString();
  const j = await jsonCall<KatalogItem[]>(`${BASE}/katalog${q ? `?${q}` : ""}`);
  return { data: j.data, meta: j.meta as KatalogMeta };
}
export const updateKatalog = (id: string, payload: KatalogPayload) =>
  jsonCall<{ id: string }>(`${BASE}/katalog/${id}`, "PATCH", payload).then((j) => j.data);
export const deleteKatalog = (id: string) => jsonCall<{ id: string }>(`${BASE}/katalog/${id}`, "DELETE").then((j) => j.data);
