"use client";

import { downloadFromEndpoint } from "@/lib/download";
import type { JenisKlaim } from "@/server/modules/rekap-klaim/klaim.schema";

/** Tipe payload laporan (mirror `laporan.service.ts`). */
export type RekapCell = { ritl: number; rjtl: number; total: number };
export type RekapBulan = { bulan: number; entri: number; dana: number; kasus: number; potongan: number };
export type RekapTahunan = {
  tahun: number;
  inaCbgs: Record<JenisKlaim, RekapCell>;
  inaCbgsTotal: RekapCell;
  rujukan: { entri: number; kasus: number; dana: number };
  totalDana: number;
  totalPotongan: number;
  nilaiBersih: number;
  totalKasus: number;
  entri: number;
  belumCair: { count: number; nilai: number };
  perBulan: RekapBulan[];
};
export type PerbandinganRow = { key: string; label: string; perTahun: Record<number, number> };
export type Perbandingan = {
  tahun: number[];
  rows: PerbandinganRow[];
  totalDana: Record<number, number>;
  totalPotongan: Record<number, number>;
  nilaiBersih: Record<number, number>;
  totalKasus: Record<number, number>;
  entri: Record<number, number>;
};
export type PendingBulan = {
  tahun: number; bulan: number;
  riKasus: number; riBiaya: number;
  rjKasus: number; rjBiaya: number;
  kasus: number; biaya: number;
};
export type PendingReport = {
  perBulan: PendingBulan[];
  totals: { riKasus: number; riBiaya: number; rjKasus: number; rjBiaya: number; kasus: number; biaya: number };
};
export type RujukanBulan = { tahun: number; bulan: number; entri: number; kasus: number; biaya: number };
export type RujukanTahun = { tahun: number; entri: number; kasus: number; biaya: number };
export type RujukanReport = {
  perBulan: RujukanBulan[];
  perTahun: RujukanTahun[];
  totals: { entri: number; kasus: number; biaya: number };
};
export type LaporanData = {
  tahunTersedia: number[];
  tahun: number | null;
  tahunan: RekapTahunan | null;
  perbandingan: Perbandingan;
  pending: PendingReport;
  rujukan: RujukanReport;
};

/** `tahun` = "" (semua) | "2026" (spesifik) | undefined (default tahun terbaru). */
function tahunQuery(tahun: string | undefined): string {
  if (tahun === undefined) return "";
  return `?tahun=${tahun === "" ? "semua" : tahun}`;
}

export async function fetchLaporan(tahun?: string): Promise<LaporanData> {
  const res = await fetch(`/api/rekap-klaim/laporan${tahunQuery(tahun)}`);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Gagal memuat laporan.");
  return json.data as LaporanData;
}

export async function exportLaporan(tahun: string, format: "xlsx" | "pdf"): Promise<void> {
  const scope = tahun === "" ? "semua" : tahun;
  const url = `/api/rekap-klaim/laporan/export?tahun=${scope}&format=${format}`;
  await downloadFromEndpoint(url, `Rekap-Klaim-BPJS.${format}`);
}
