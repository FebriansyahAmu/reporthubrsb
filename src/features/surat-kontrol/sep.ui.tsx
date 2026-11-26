"use client";

import { cn } from "@/lib/cn";
import { STATUS_SEP, STATUS_SEP_GRAFIK, type StatusSep } from "@/server/modules/surat-kontrol/surat-kontrol.sep.constants";
import { WARNA } from "./pulang.ui";
import type { SeriBatang } from "./SebaranHarianChart";

/**
 * Kepingan visual "Kontrol = SEP" (daftar & laci rincian). Status SELALU tampil
 * dengan label teks — warna hanya penanda tambahan.
 */

export const warnaStatusSep = (s: StatusSep) => WARNA[STATUS_SEP[s].nada];

/** Seri grafik harian: dari dasar batang (sebelum SEP) ke atas (bersama SEP, lalu belum dipakai). */
export const SERI_SEP: readonly SeriBatang<(typeof STATUS_SEP_GRAFIK)[number]>[] = STATUS_SEP_GRAFIK.map((k) => ({
  key: k,
  label: STATUS_SEP[k].label,
  color: WARNA[STATUS_SEP[k].nada].css,
}));

export function LencanaStatusSep({ s, pendek = false, className }: { s: StatusSep; pendek?: boolean; className?: string }) {
  const w = warnaStatusSep(s);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", w.lembut, w.teks, className)}>
      <span className={cn("size-1.5 rounded-full", w.isi)} aria-hidden />
      {pendek ? STATUS_SEP[s].pendek : STATUS_SEP[s].label}
    </span>
  );
}

const RENTANG = 3;
const posisi = (hari: number) => ((Math.max(-RENTANG, Math.min(RENTANG, hari)) + RENTANG) / (2 * RENTANG)) * 100;

/**
 * "Jejak entri": garis hari −3 … +3 dengan hari SEP di tengah; titik = hari
 * surat dientri di BPJS (di luar rentang → panah di tepi). Dekoratif
 * (aria-hidden) — maknanya selalu ada di teks sebelahnya.
 */
export function JejakEntri({ selisih, status, className }: { selisih: number | null; status: StatusSep; className?: string }) {
  if (selisih === null) return null;
  const w = warnaStatusSep(status);
  const lewat = Math.abs(selisih) > RENTANG;
  return (
    <span aria-hidden className={cn("relative block h-4 w-[88px] shrink-0", className)}>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border-strong" />
      {Array.from({ length: 2 * RENTANG + 1 }, (_, i) => (
        <span key={i} className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-border-strong" style={{ left: `${(i / (2 * RENTANG)) * 100}%` }} />
      ))}
      {/* Hari SEP */}
      <span className="absolute top-0 left-1/2 h-4 w-0.5 -translate-x-1/2 rounded-full bg-fg" />
      <span className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface", w.isi)} style={{ left: `${posisi(selisih)}%` }} />
      {lewat && (
        <span className={cn("absolute top-1/2 -translate-y-1/2 text-[10px] leading-none font-bold", w.teks, selisih > 0 ? "-right-2" : "-left-2")}>
          {selisih > 0 ? "›" : "‹"}
        </span>
      )}
    </span>
  );
}
