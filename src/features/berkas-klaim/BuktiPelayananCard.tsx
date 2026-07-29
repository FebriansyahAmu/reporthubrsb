"use client";

import { useState } from "react";
import { FileCheck, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { BuktiPelayananModal, type BuktiHeaderInfo } from "./BuktiPelayananModal";

/**
 * Kartu "Bukti Pelayanan" (interaktif) di halaman detail berkas. Hijau bila sudah
 * diisi, merah bila belum. Tombol membuka modal form (non-dismissible).
 */
export function BuktiPelayananCard({
  nopen,
  initialSaved,
  header,
}: {
  nopen: string;
  initialSaved: boolean;
  header: BuktiHeaderInfo;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [open, setOpen] = useState(false);

  const tint = saved ? "border-success/40 bg-success-soft" : "border-danger/40 bg-danger-soft";
  const iconTone = saved ? "bg-success/15 text-success" : "bg-danger/15 text-danger";

  return (
    <div className={cn("flex flex-col rounded-[var(--radius-lg)] border p-4 shadow-xs", tint)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]", iconTone)}>
            <FileCheck className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg">Bukti Pelayanan</p>
            <p className="truncate text-xs text-fg-muted">
              {saved ? "Sudah diisi" : "Belum diisi — isi sendiri"}
            </p>
          </div>
        </div>
        <Badge tone={saved ? "success" : "danger"} dot>
          {saved ? "Tersedia" : "Belum ada"}
        </Badge>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-brand bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <Pencil className="size-4" />
        {saved ? "Lihat / Edit" : "Isi Bukti Pelayanan"}
      </button>

      <BuktiPelayananModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setSaved(true);
          setOpen(false);
        }}
        nopen={nopen}
        header={header}
      />
    </div>
  );
}
