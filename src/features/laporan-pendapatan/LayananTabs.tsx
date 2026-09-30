"use client";

import { cn } from "@/lib/cn";
import { formatRupiah, formatRupiahRingkas } from "@/lib/format";
import { CAKUPAN_KEYS, infoCakupan, type CakupanKey } from "@/server/modules/pendapatan-unit/pendapatan.constants";
import type { RingkasLayanan } from "@/server/modules/pendapatan-unit/pendapatan.types";

/**
 * Pemilih cakupan layanan. Tiap tombol menampilkan total layanan itu (filter
 * status & cara bayar berlaku) sehingga perbandingan antar-layanan langsung
 * terbaca; "Semua" = jumlah seluruh layanan.
 */
export function LayananTabs({
  value,
  onChange,
  perLayanan,
}: {
  value: CakupanKey;
  onChange: (key: CakupanKey) => void;
  /** Null = belum ada data (nominal ditampilkan "—"). */
  perLayanan: readonly RingkasLayanan[] | null;
}) {
  const totalPer = new Map<CakupanKey, number>(perLayanan?.map((l) => [l.key, l.total]) ?? []);
  if (perLayanan) totalPer.set("semua", perLayanan.reduce((a, l) => a + l.total, 0));

  return (
    <div role="group" aria-label="Layanan" className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-2 sm:grid sm:min-w-0 sm:grid-cols-4 xl:grid-cols-8">
        {CAKUPAN_KEYS.map((key) => {
          const info = infoCakupan(key);
          const aktif = value === key;
          const nilai = totalPer.get(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={aktif}
              onClick={() => onChange(key)}
              title={nilai == null ? info.label : `${info.label}: ${formatRupiah(nilai)} (sesuai filter status & cara bayar)`}
              className={cn(
                "min-w-[7.5rem] rounded-[var(--radius-lg)] border px-3 py-2 text-left transition-colors sm:min-w-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                aktif ? "border-brand bg-brand-soft shadow-xs" : "border-border bg-surface hover:bg-surface-2",
                key === "semua" && !aktif && "border-dashed",
              )}
            >
              <span className={cn("block truncate text-[13px] font-semibold", aktif ? "text-brand-soft-fg" : "text-fg")}>
                {info.singkat}
              </span>
              <span className={cn("block truncate text-[11px] tabular", aktif ? "text-brand-soft-fg/80" : "text-fg-muted")}>
                {nilai == null ? "—" : formatRupiahRingkas(nilai)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
