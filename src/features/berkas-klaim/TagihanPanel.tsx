"use client";

import { useState } from "react";
import { TagihanRincian } from "./TagihanRincian";
import { formatRupiah } from "@/lib/format";
import type { TagihanRingkas } from "@/server/modules/berkas-klaim/berkas-klaim.types";

/**
 * Blok "Total Tagihan" di header detail berkas. Menampilkan tagihan episode
 * (RI). Bila episode punya tagihan IGD asal (via SPRI), tampilkan opsi
 * **Gabungkan Tagihan IGD** — saat dicentang, total menjadi RI + IGD dan modal
 * rincian menarik data gabungan (`?igd=1`). Default: TIDAK digabung (opt-in).
 */
export function TagihanPanel({
  nopen,
  tagihan,
  igdTotal,
}: {
  nopen: string;
  tagihan: TagihanRingkas;
  /** Total tagihan IGD asal, atau null bila tak ada. */
  igdTotal: number | null;
}) {
  const [gabung, setGabung] = useState(false);
  const canGabung = tagihan.ada && igdTotal != null;
  const combined = canGabung && gabung;
  const shownTotal = combined ? tagihan.total + (igdTotal as number) : tagihan.total;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface-2/40 px-4 py-3">
      <div>
        <div className="text-xs text-fg-muted">
          Total Tagihan{combined ? " (RI + IGD)" : ""}
        </div>
        <div className="text-2xl font-bold text-fg tabular">
          {tagihan.ada ? formatRupiah(shownTotal) : "—"}
        </div>
        {!tagihan.ada && (
          <div className="mt-0.5 text-xs text-fg-subtle">Belum ada tagihan untuk episode ini</div>
        )}
        {combined && (
          <div className="mt-0.5 text-[11px] text-fg-subtle tabular">
            RI {formatRupiah(tagihan.total)} + IGD {formatRupiah(igdTotal as number)}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canGabung && (
          <label className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2">
            <input
              type="checkbox"
              checked={gabung}
              onChange={(e) => setGabung(e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            Gabungkan Tagihan IGD
            <span className="text-fg-subtle tabular">({formatRupiah(igdTotal as number)})</span>
          </label>
        )}
        {tagihan.ada && (
          <TagihanRincian
            key={combined ? "gabung" : "ri"}
            nopen={nopen}
            total={shownTotal}
            igd={combined}
          />
        )}
      </div>
    </div>
  );
}
