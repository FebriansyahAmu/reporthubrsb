"use client";

import { downloadFromEndpoint } from "@/lib/download";

export type ImportRowResult = {
  baris: number;
  ref: string | null;
  status: "valid" | "error";
  label: string;
  jumlah: number | null;
  tahun: number | null;
  catatan: string[];
};
export type PerTahunImport = { tahun: number; inaCbgs: number; rujukan: number; entri: number };
export type BaselineCheck = { tahun: number; impor: number; baseline: number | null; cocok: boolean | null; selisih: number | null };
export type ImportRingkasan = {
  baris: number; valid: number; error: number;
  potonganBaris: number; potonganValid: number; potonganError: number;
  totalInaCbgs: number; totalRujukan: number;
};
export type ImportPreview = {
  mode: "preview";
  klaim: ImportRowResult[];
  potongan: ImportRowResult[];
  ringkasan: ImportRingkasan;
  perTahun: PerTahunImport[];
  baseline: BaselineCheck[];
};
export type ImportCommit = {
  mode: "commit";
  masuk: number; dilewati: number;
  potonganMasuk: number; potonganDilewati: number;
  perTahun: PerTahunImport[];
  baseline: BaselineCheck[];
};

async function post(file: File, mode: "preview" | "commit") {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("mode", mode);
  const res = await fetch("/api/rekap-klaim/import", { method: "POST", body: fd });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Gagal memproses berkas.");
  return json.data;
}

export const importPreview = (file: File): Promise<ImportPreview> => post(file, "preview");
export const importCommit = (file: File): Promise<ImportCommit> => post(file, "commit");

export async function downloadTemplate(): Promise<void> {
  await downloadFromEndpoint("/api/rekap-klaim/import/template", "Template-Import-Rekap-Klaim.xlsx");
}
