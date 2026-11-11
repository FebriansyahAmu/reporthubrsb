"use client";

import { cn } from "@/lib/cn";

export type SegmentItem<T extends string> = {
  value: T;
  label: string;
  /** Label pendek di layar sempit (< sm). */
  labelSingkat?: string;
  /** Angka kecil di samping label (mis. jumlah data per pilihan). */
  jumlah?: number;
};

/**
 * Kontrol segmen (gaya tab lembut) untuk filter yang langsung berlaku. Setiap
 * segmen = tombol toggle (`aria-pressed`) di dalam grup berlabel. `penuh` =
 * selebar wadah di layar sempit (sisa ruang dibagi menurut panjang isi),
 * menyusut ke isi di ≥ sm. `jumlahPonsel={false}` menyembunyikan angka < sm
 * agar label tak terpotong saat segmen banyak.
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  label,
  penuh = false,
  jumlahPonsel = true,
  className,
}: {
  items: readonly SegmentItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  penuh?: boolean;
  jumlahPonsel?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        // Label tak pernah dipotong: bila tetap tak muat, grup digulir di dalam wadahnya (bukan halaman).
        "items-center gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 shadow-xs",
        penuh ? "flex w-full sm:inline-flex sm:w-auto" : "inline-flex max-w-full",
        className,
      )}
    >
      {items.map((it) => {
        const aktif = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            aria-pressed={aktif}
            onClick={() => onChange(it.value)}
            className={cn(
              // px-1.5 di layar sempit: 5 segmen ber-angka tetap muat di 360 px dengan Geist (lebih lebar dari Figtree).
              "inline-flex h-9 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1.5 text-[13px] font-medium transition-colors sm:h-8 sm:gap-1.5 sm:px-3",
              penuh && "flex-auto sm:flex-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring",
              aktif
                ? "bg-brand-soft text-brand-soft-fg ring-1 ring-inset ring-brand/15"
                : "text-fg-muted hover:bg-surface-2/60 hover:text-fg",
            )}
          >
            {it.labelSingkat ? (
              <>
                <span className="sm:hidden">{it.labelSingkat}</span>
                <span className="hidden sm:inline">{it.label}</span>
              </>
            ) : (
              <span>{it.label}</span>
            )}
            {it.jumlah !== undefined && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 text-[11px] font-semibold leading-[1.125rem] tabular",
                  aktif ? "bg-surface text-brand-soft-fg" : "bg-surface-2 text-fg-subtle",
                  !jumlahPonsel && "max-sm:hidden",
                )}
              >
                {it.jumlah}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
