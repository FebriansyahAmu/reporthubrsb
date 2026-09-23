"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PopoverPanel } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";
import {
  STATUS_KLAIM, STATUS_KLAIM_LABEL, STATUS_KLAIM_TONE, type StatusKlaim,
} from "@/server/modules/rekap-klaim/klaim.schema";

/** Badge status yang bisa diklik untuk mengubah status dengan cepat (popover). */
export function StatusMenu({
  status, onSelect, disabled,
}: {
  status: StatusKlaim;
  onSelect: (s: StatusKlaim) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  if (disabled) {
    return <Badge tone={STATUS_KLAIM_TONE[status]} dot>{STATUS_KLAIM_LABEL[status]}</Badge>;
  }
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Ubah status"
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <Badge tone={STATUS_KLAIM_TONE[status]} dot className="cursor-pointer hover:brightness-95">
          {STATUS_KLAIM_LABEL[status]}
          <ChevronDown className="size-3 opacity-60" />
        </Badge>
      </button>
      <PopoverPanel anchor={anchor} open={open} onClose={() => setOpen(false)} align="end" matchWidth={false} className="min-w-[11rem]">
        <ul className="py-0.5">
          {STATUS_KLAIM.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => { setOpen(false); if (s !== status) onSelect(s); }}
                className={cn("flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-colors hover:bg-surface-2")}
              >
                <Badge tone={STATUS_KLAIM_TONE[s]} dot>{STATUS_KLAIM_LABEL[s]}</Badge>
                {s === status && <Check className="size-4 text-brand" />}
              </button>
            </li>
          ))}
        </ul>
      </PopoverPanel>
    </>
  );
}
