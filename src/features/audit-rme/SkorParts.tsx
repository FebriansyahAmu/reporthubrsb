"use client";

import { Award, CircleDot, ThumbsUp, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { bandLabel, type BandKey, type KomponenKey } from "@/server/modules/audit-rme/skor";
import type { PetugasSkorItem } from "./audit.client";
import { initialsOf, profesiTone } from "./MatriksShiftView";

/** Pita skor = status (ikon + label, tidak hanya warna). */
export const BAND_STYLE: Record<BandKey, { icon: typeof Award; text: string; soft: string; solid: string }> = {
  TELADAN: { icon: Award, text: "text-success", soft: "bg-success-soft ring-success/25", solid: "bg-success" },
  BAIK: { icon: ThumbsUp, text: "text-brand", soft: "bg-brand-soft ring-brand/20", solid: "bg-brand" },
  CUKUP: { icon: CircleDot, text: "text-warning", soft: "bg-warning-soft ring-warning/25", solid: "bg-warning" },
  PEMBINAAN: { icon: TriangleAlert, text: "text-danger", soft: "bg-danger-soft ring-danger/25", solid: "bg-danger" },
};

/** Skor + pita. `lg` untuk header profil. */
export function SkorPill({ skor, band, size = "md" }: { skor: number | null; band: BandKey | null; size?: "sm" | "md" | "lg" }) {
  if (skor == null || !band) {
    return <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-fg-muted ring-1 ring-border ring-inset">Belum dinilai</span>;
  }
  const s = BAND_STYLE[band];
  const Icon = s.icon;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset", s.soft, size === "lg" ? "px-3 py-1" : "px-2 py-0.5")}
      title={`Skor ${skor} — ${bandLabel(band)}`}
    >
      <span className={cn("font-semibold tabular text-fg", size === "lg" ? "text-xl" : size === "md" ? "text-sm" : "text-xs")}>{skor}</span>
      <Icon className={cn(s.text, size === "lg" ? "size-4" : "size-3")} aria-hidden />
      <span className={cn("font-medium", s.text, size === "lg" ? "text-sm" : "text-[10px]")}>{bandLabel(band)}</span>
    </span>
  );
}

/** Batang 0–100 satu warna (besaran), angka tetap di teks terpisah. */
export function SkorBar({ skor, className }: { skor: number | null; className?: string }) {
  return (
    <span className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-chart-track", className)} aria-hidden>
      {skor != null && <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(2, skor)}%` }} />}
    </span>
  );
}

export function PetugasAvatar({ nama, profesi, size = "md" }: { nama: string | null; profesi: number | null; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        profesiTone(profesi),
        size === "lg" ? "size-12 text-base" : "size-8 text-[11px]",
      )}
      aria-hidden
    >
      {initialsOf(nama)}
    </span>
  );
}

const desimal = (n: number | null) => (n == null ? "—" : formatNumber(n));

/** Besaran mentah komponen, format ringkas untuk tabel. */
export function nilaiRingkas(key: KomponenKey, it: PetugasSkorItem): string {
  const k = it.komponen[key];
  switch (key) {
    case "aktivitas":
      return k.nilai == null ? "—" : `${desimal(k.nilai)}/hari`;
    case "kontribusiRi":
      return k.nilai == null ? "—" : `${desimal(k.nilai)}/hari`;
    case "ketepatanTtv":
      return it.ttv === 0 ? "—" : `${formatNumber(it.ttv - it.ttvTerlambat)}/${formatNumber(it.ttv)}`;
    case "integritas":
      return it.batal === 0 ? "0 batal" : `${formatNumber(it.batal)} batal`;
  }
}
