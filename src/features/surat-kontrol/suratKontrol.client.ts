"use client";

import { apiGet } from "@/lib/api-client";
import { downloadFromEndpoint } from "@/lib/download";
// Hanya tipe (dihapus saat kompilasi) — tidak menarik kode server-only ke klien.
import type { FilterTampilan } from "@/server/modules/surat-kontrol/surat-kontrol.filter";
import type { FilterPulang } from "@/server/modules/surat-kontrol/surat-kontrol.pulang";
import type { AuditTerbitPulang } from "@/server/modules/surat-kontrol/surat-kontrol.pulang.types";
import type { FilterSep } from "@/server/modules/surat-kontrol/surat-kontrol.sep";
import type { AuditKontrolSep } from "@/server/modules/surat-kontrol/surat-kontrol.sep.types";
import type { AuditSuratKontrol } from "@/server/modules/surat-kontrol/surat-kontrol.types";

export type JenisPilihan = "2" | "1" | "semua";
export type Rentang = { from: string; to: string; jenis: JenisPilihan };

const qs = (o: Record<string, string | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) sp.set(k, v);
  return sp.toString();
};

export function fetchAuditSuratKontrol(r: Rentang, opts?: { segar?: boolean; signal?: AbortSignal }): Promise<AuditSuratKontrol> {
  return apiGet<AuditSuratKontrol>(
    `/api/audit-rme/surat-kontrol?${qs({ from: r.from, to: r.to, jenis: r.jenis, segar: opts?.segar ? "1" : undefined })}`,
    { signal: opts?.signal },
  );
}

/** Unduh Excel dengan filter yang sama seperti layar. Mengembalikan kode ekspor. */
export async function unduhEksporSuratKontrol(r: Rentang, f: FilterTampilan): Promise<string | null> {
  const url = `/api/audit-rme/surat-kontrol/ekspor?${qs({
    from: r.from,
    to: r.to,
    jenis: r.jenis,
    status: f.status,
    temuan: f.temuan,
    poli: f.poli,
    tanggal: f.tanggal,
    q: f.q?.trim() || undefined,
  })}`;
  const { headers } = await downloadFromEndpoint(url, `audit-surat-kontrol_${r.from}_${r.to}.xlsx`);
  return headers.get("X-Ekspor-Kode");
}

export type RentangPulang = { from: string; to: string };

export function fetchTerbitPulang(r: RentangPulang, opts?: { segar?: boolean; signal?: AbortSignal }): Promise<AuditTerbitPulang> {
  return apiGet<AuditTerbitPulang>(
    `/api/audit-rme/surat-kontrol/pulang?${qs({ from: r.from, to: r.to, segar: opts?.segar ? "1" : undefined })}`,
    { signal: opts?.signal },
  );
}

/** Unduh Excel "Terbit saat pulang" dengan filter layar. Mengembalikan kode ekspor. */
export async function unduhEksporTerbitPulang(r: RentangPulang, f: FilterPulang): Promise<string | null> {
  const url = `/api/audit-rme/surat-kontrol/pulang/ekspor?${qs({
    from: r.from,
    to: r.to,
    layanan: f.layanan,
    status: f.status,
    ruangan: f.ruangan,
    tanggal: f.tanggal,
    q: f.q?.trim() || undefined,
  })}`;
  const { headers } = await downloadFromEndpoint(url, `terbit-surat-kontrol-saat-pulang_${r.from}_${r.to}.xlsx`);
  return headers.get("X-Ekspor-Kode");
}

export function fetchKontrolSep(r: RentangPulang, opts?: { segar?: boolean; signal?: AbortSignal }): Promise<AuditKontrolSep> {
  return apiGet<AuditKontrolSep>(
    `/api/audit-rme/surat-kontrol/sep?${qs({ from: r.from, to: r.to, segar: opts?.segar ? "1" : undefined })}`,
    { signal: opts?.signal },
  );
}

/** Unduh Excel "Kontrol = SEP" dengan filter layar. Mengembalikan kode ekspor. */
export async function unduhEksporKontrolSep(r: RentangPulang, f: FilterSep): Promise<string | null> {
  const url = `/api/audit-rme/surat-kontrol/sep/ekspor?${qs({
    from: r.from,
    to: r.to,
    spri: f.spri ? "1" : undefined,
    jenis: f.spri && f.jenis ? String(f.jenis) : undefined,
    status: f.status,
    ruangan: f.ruangan,
    tanggal: f.tanggal,
    q: f.q?.trim() || undefined,
  })}`;
  const { headers } = await downloadFromEndpoint(url, `surat-kontrol-sama-sep_${r.from}_${r.to}.xlsx`);
  return headers.get("X-Ekspor-Kode");
}
