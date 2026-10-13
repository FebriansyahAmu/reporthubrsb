"use client";

import { apiGet } from "@/lib/api-client";
import { downloadFromEndpoint } from "@/lib/download";
// Hanya tipe (dihapus saat kompilasi) — tidak menarik kode server-only ke klien.
import type { FilterTampilan } from "@/server/modules/surat-kontrol/surat-kontrol.filter";
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
