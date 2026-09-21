"use client";

import { useState } from "react";
import { Package, Plus } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { PopoverPanel } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";

/**
 * Field "Nama/Jenis Barang" dengan autocomplete katalog. Pilih item yang ada
 * (nama konsisten) atau ketik baru → item dibuat otomatis saat simpan.
 */
export function NamaBarangField({
  id,
  value,
  onChange,
  items,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  items: { id: string; nama: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);

  const q = value.trim().toLowerCase();
  const matches = (q ? items.filter((i) => i.nama.toLowerCase().includes(q)) : items).slice(0, 8);
  const exact = !!q && items.some((i) => i.nama.trim().toLowerCase() === q);
  const showNew = !!q && !exact;

  return (
    <div ref={setAnchorEl} className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      <PopoverPanel anchor={anchorEl} open={open && (matches.length > 0 || showNew)} onClose={() => setOpen(false)}>
        <ul className="max-h-60 min-w-[14rem] overflow-auto py-0.5">
          {matches.map((i) => {
            const isExact = i.nama.trim().toLowerCase() === q;
            return (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(i.nama);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-2",
                    isExact ? "font-medium text-brand-soft-fg" : "text-fg",
                  )}
                >
                  <Package className="size-4 shrink-0 text-fg-subtle" />
                  <span className="truncate">{i.nama}</span>
                </button>
              </li>
            );
          })}
          {showNew && (
            <li className={cn(matches.length > 0 && "mt-0.5 border-t border-border pt-0.5")}>
              <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-fg-muted">
                <Plus className="size-3.5 shrink-0 text-success" />
                <span>
                  Item baru <span className="font-medium text-fg">{value.trim()}</span> akan dibuat di katalog
                </span>
              </div>
            </li>
          )}
        </ul>
      </PopoverPanel>
    </div>
  );
}
