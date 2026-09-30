"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import {
  STATUS_META,
  STATUS_VERIFIKASI,
  type StatusVerifikasi,
} from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import type { AntreanRingkasan } from "@/server/modules/verifikasi-klaim/verifikasi.types";
import { STATUS_UI } from "./status-ui";

/**
 * Pita tahap (pipeline) — enam status berurutan beserta jumlahnya; klik untuk
 * menyaring, klik lagi untuk melepas. Jumlah dihitung setelah filter dasar.
 */
export function PitaStatus({
  ringkasan,
  aktif,
  siapAktif,
  onPilih,
  onSiap,
}: {
  ringkasan: AntreanRingkasan | null;
  aktif: StatusVerifikasi | "";
  siapAktif: boolean;
  onPilih: (s: StatusVerifikasi | "") => void;
  onSiap: () => void;
}) {
  return (
    <ol aria-label="Tahap verifikasi" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {STATUS_VERIFIKASI.map((s, i) => {
        const { icon: Icon, tone } = STATUS_UI[s];
        const pilih = aktif === s;
        const n = ringkasan?.perStatus[s];
        return (
          <li key={s} className="relative">
            <button
              type="button"
              aria-pressed={pilih}
              onClick={() => onPilih(pilih ? "" : s)}
              className={cn(
                "flex h-full w-full flex-col rounded-[var(--radius-lg)] border bg-surface px-3 py-2.5 text-left shadow-xs transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                pilih ? "border-brand bg-brand-soft" : "border-border hover:bg-surface-2",
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                <Icon
                  className={cn("size-3.5", {
                    "text-fg-subtle": tone === "neutral",
                    "text-danger": tone === "danger",
                    "text-brand": tone === "brand",
                    "text-warning": tone === "warning",
                    "text-accent": tone === "accent",
                    "text-success": tone === "success",
                  })}
                  aria-hidden
                />
                {STATUS_META[s].label}
              </span>
              <span className="mt-1 text-xl font-semibold tabular text-fg">{n == null ? "—" : formatNumber(n)}</span>
              <span className="truncate text-[11px] text-fg-subtle">{STATUS_META[s].pemilik}</span>
            </button>
            {s === "TIDAK_LENGKAP" && (ringkasan?.siapPeriksaUlang ?? 0) > 0 && (
              <button
                type="button"
                aria-pressed={siapAktif}
                onClick={onSiap}
                className={cn(
                  "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-colors",
                  siapAktif ? "bg-success text-white ring-success" : "bg-success-soft text-success ring-success/30 hover:bg-success/15",
                )}
                title="Semua tindak lanjut selesai — siap diperiksa ulang"
              >
                {ringkasan!.siapPeriksaUlang} siap
              </button>
            )}
            {i < STATUS_VERIFIKASI.length - 1 && (
              <ChevronRight
                className="absolute -right-2.5 top-1/2 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-bg text-fg-subtle xl:block"
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
