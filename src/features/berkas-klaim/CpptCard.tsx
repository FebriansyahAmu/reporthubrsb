"use client";

import { useState } from "react";
import { ClipboardList, Printer } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

/**
 * Kartu dokumen CPPT dengan opsi **gabung CPPT IGD**. Hanya dipakai untuk episode
 * Rawat Inap yang punya CPPT IGD asal (via SPRI). Saat dicentang, tombol Cetak
 * membuka viewer dengan `?igd=1` → server menarik CPPT IGD + RI lalu MENGGABUNG
 * jadi satu PDF (IGD dulu, kronologis). Default: tercentang (perilaku yang diminta).
 */
export function CpptCard({ nopen, keterangan }: { nopen: string; keterangan: string }) {
  const [withIgd, setWithIgd] = useState(true);
  const href = `/print/simgos/cppt/${nopen}${withIgd ? "?igd=1" : ""}`;

  return (
    <div className="flex flex-col rounded-[var(--radius-lg)] border border-success/40 bg-success-soft p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-success/15 text-success">
            <ClipboardList className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg">CPPT</p>
            <p className="truncate text-xs text-fg-muted">{keterangan}</p>
          </div>
        </div>
        <Badge tone="success" dot>
          Tersedia
        </Badge>
      </div>

      {/* Opsi: sertakan CPPT IGD (digabung 1 file) */}
      <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border border-border bg-surface/60 px-3 py-2 text-[13px]">
        <input
          type="checkbox"
          checked={withIgd}
          onChange={(e) => setWithIgd(e.target.checked)}
          className="mt-0.5 size-4 accent-[var(--brand)]"
        />
        <span className="text-fg">
          Sertakan CPPT IGD{" "}
          <span className="text-fg-muted">(digabung dalam satu file)</span>
        </span>
      </label>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-brand bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <Printer className="size-4" />
        Cetak{withIgd ? " (RI + IGD)" : ""}
      </a>
    </div>
  );
}
