"use client";

import { cn } from "@/lib/cn";
import { STATUS_DINILAI, STATUS_PULANG, type NadaPulang, type StatusPulang } from "@/server/modules/surat-kontrol/surat-kontrol.pulang.constants";
import type { EpisodePulang } from "@/server/modules/surat-kontrol/surat-kontrol.pulang.types";
import type { SeriBatang } from "./SebaranHarianChart";

/**
 * Kepingan visual bersama "Terbit saat pulang" (daftar & laci rincian).
 * Status SELALU tampil dengan label teks — warna hanya penanda tambahan.
 */

export const WARNA: Record<NadaPulang, { teks: string; lembut: string; isi: string; css: string }> = {
  danger: { teks: "text-danger", lembut: "bg-danger-soft", isi: "bg-danger", css: "var(--danger)" },
  warning: { teks: "text-warning", lembut: "bg-warning-soft", isi: "bg-warning", css: "var(--warning)" },
  brand: { teks: "text-brand", lembut: "bg-brand-soft", isi: "bg-brand", css: "var(--brand)" },
  success: { teks: "text-success", lembut: "bg-success-soft", isi: "bg-success", css: "var(--success)" },
  neutral: { teks: "text-fg-muted", lembut: "bg-surface-2", isi: "bg-fg-subtle", css: "var(--fg-subtle)" },
};

export const warnaStatus = (s: StatusPulang) => WARNA[STATUS_PULANG[s].nada];

/** Seri grafik harian: dari dasar batang (tepat) ke atas (belum terbit). */
export const SERI_PULANG: readonly SeriBatang<(typeof STATUS_DINILAI)[number]>[] = STATUS_DINILAI.map((k) => ({
  key: k,
  label: STATUS_PULANG[k].label,
  color: WARNA[STATUS_PULANG[k].nada].css,
}));

export const persenId = (p: number | null) => (p == null ? "—" : `${String(p).replace(".", ",")}%`);

/** Kalimat selisih terbit ↔ pulang yang dibaca manusia. */
export function teksSelisih(e: EpisodePulang): string {
  switch (e.status) {
    case "TEPAT":
      return "Hari yang sama";
    case "TERLAMBAT":
      return `${e.selisihHari} hari setelah pulang`;
    case "LEBIH_AWAL":
      return `${Math.abs(e.selisihHari ?? 0)} hari sebelum pulang`;
    case "BELUM_TERBIT":
      return e.hariSejakPulang === 0 ? "Pulang hari ini" : `${e.hariSejakPulang} hari sejak pulang`;
    case "TAK_TERVERIFIKASI":
      return "Tanggal terbit belum terbaca";
    case "TIDAK_WAJIB":
      return e.alasanTidakWajib ?? "Tidak wajib";
  }
}

const RENTANG_JEJAK = 3;
const posisi = (hari: number) => ((Math.max(-RENTANG_JEJAK, Math.min(RENTANG_JEJAK, hari)) + RENTANG_JEJAK) / (2 * RENTANG_JEJAK)) * 100;

/**
 * "Jejak terbit": garis hari −3 … +3 dengan hari pulang di tengah. Titik =
 * hari terbit; belum terbit = garis putus merah dari hari pulang sampai hari ini.
 * Dekoratif (aria-hidden) — maknanya selalu ada di teks sebelahnya.
 */
export function JejakTerbit({ e, className }: { e: EpisodePulang; className?: string }) {
  const w = warnaStatus(e.status);
  const lewat = (h: number) => Math.abs(h) > RENTANG_JEJAK;
  return (
    <span aria-hidden className={cn("relative block h-4 w-[88px] shrink-0", className)}>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border-strong" />
      {Array.from({ length: 2 * RENTANG_JEJAK + 1 }, (_, i) => (
        <span key={i} className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-border-strong" style={{ left: `${(i / (2 * RENTANG_JEJAK)) * 100}%` }} />
      ))}
      {/* Hari pulang */}
      <span className="absolute top-0 left-1/2 h-4 w-0.5 -translate-x-1/2 rounded-full bg-fg" />
      {e.status === "BELUM_TERBIT" && (
        <>
          <span
            className="absolute top-1/2 left-1/2 h-0 -translate-y-1/2 border-t-2 border-dashed border-danger"
            style={{ width: `${posisi(e.hariSejakPulang) - 50}%` }}
          />
          <span
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-danger bg-surface"
            style={{ left: `${posisi(e.hariSejakPulang)}%` }}
          />
          {lewat(e.hariSejakPulang) && <span className="absolute top-1/2 -right-2 -translate-y-1/2 text-[10px] leading-none font-bold text-danger">›</span>}
        </>
      )}
      {e.selisihHari !== null && (
        <>
          <span
            className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface", w.isi)}
            style={{ left: `${posisi(e.selisihHari)}%` }}
          />
          {lewat(e.selisihHari) && (
            <span className={cn("absolute top-1/2 -translate-y-1/2 text-[10px] leading-none font-bold", w.teks, e.selisihHari > 0 ? "-right-2" : "-left-2")}>
              {e.selisihHari > 0 ? "›" : "‹"}
            </span>
          )}
        </>
      )}
    </span>
  );
}

/** Lencana status (titik + label). */
export function LencanaStatus({ s, pendek = false, className }: { s: StatusPulang; pendek?: boolean; className?: string }) {
  const w = warnaStatus(s);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", w.lembut, w.teks, className)}>
      <span className={cn("size-1.5 rounded-full", w.isi)} aria-hidden />
      {pendek ? STATUS_PULANG[s].pendek : STATUS_PULANG[s].label}
    </span>
  );
}
