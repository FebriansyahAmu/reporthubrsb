"use client";

import type { StatusAset } from "@/server/modules/inventaris/barang.schema";

export type KirRuanganSummary = {
  id: string;
  kodePrefix: string;
  nama: string;
  pjNama: string | null;
  pjNip: string | null;
  aktif: boolean;
  jumlah: number;
  totalNilai: number;
};

export type KirBarang = {
  kodeBarang: string;
  register: number | null;
  nama: string;
  merk: string | null;
  nomorSeri: string | null;
  tahunPerolehan: number | null;
  kondisi: string | null;
  statusAset: StatusAset;
  harga: number | null;
  keterangan: string | null;
};

export type KirData = {
  ruangan: { id: string; kodePrefix: string; nama: string; pjNama: string | null; pjNip: string | null; aktif: boolean };
  barang: KirBarang[];
  totalNilai: number;
};

async function jsonGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message;
    throw new Error(msg || "Terjadi kesalahan");
  }
  return (json as { data: T }).data;
}

export const fetchKirRuangan = () => jsonGet<KirRuanganSummary[]>("/api/inventaris/kir");
export const fetchKirData = (ruanganId: string) => jsonGet<KirData>(`/api/inventaris/kir/${ruanganId}`);
