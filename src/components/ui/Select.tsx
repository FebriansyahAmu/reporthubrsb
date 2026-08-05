"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/Field";
import { PopoverPanel } from "@/components/ui/Popover";

export type SelectOption = { value: string; label: string };

const TRIGGER =
  "flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border " +
  "bg-surface px-3 text-sm text-fg transition-colors cursor-pointer " +
  "hover:border-border-strong focus-visible:outline-none focus-visible:border-brand " +
  "focus-visible:ring-2 focus-visible:ring-brand-ring/40 disabled:opacity-50 disabled:pointer-events-none";

function toOptions(options: SelectOption[] | string[]): SelectOption[] {
  return options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

/**
 * Dropdown ter-style (bukan <select> bawaan). Portal-anchored → tak terpotong
 * `overflow-hidden`. Navigasi keyboard: ↑/↓ pindah, Enter pilih, Esc tutup.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Pilih…",
  disabled,
  id,
  className,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[] | string[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  invalid?: boolean;
}) {
  const opts = useMemo(() => toOptions(options), [options]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const selected = opts.find((o) => o.value === value) ?? null;

  function openMenu() {
    if (disabled) return;
    const idx = opts.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  // Fokuskan daftar saat terbuka agar keyboard langsung aktif.
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  function onTriggerKey(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openMenu();
    }
  }
  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(opts.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(opts.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const o = opts[active];
      if (o) commit(o.value);
    }
  }
  function commit(v: string) {
    onChange(v);
    setOpen(false);
    anchorEl?.focus();
  }

  return (
    <>
      <button
        id={id}
        ref={setAnchorEl}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          TRIGGER,
          open && "border-brand ring-2 ring-brand-ring/40",
          invalid && "border-danger",
          className,
        )}
      >
        <span className={cn("truncate", !selected && "text-fg-subtle")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-fg-subtle" />
      </button>

      <PopoverPanel anchor={anchorEl} open={open} onClose={() => setOpen(false)}>
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKey}
          className="max-h-[16rem] min-w-[9rem] py-0.5 outline-none"
        >
          {opts.map((o, i) => {
            const isSel = o.value === value;
            const isActive = i === active;
            return (
              <li key={o.value || `opt-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => commit(o.value)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm transition-colors",
                    isActive ? "bg-surface-2" : "hover:bg-surface-2",
                    isSel ? "font-medium text-brand-soft-fg" : "text-fg",
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <Check className="size-4 shrink-0 text-brand" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverPanel>
    </>
  );
}

const OTHER = "__other__";

/**
 * Dropdown dengan opsi **"Lainnya…"** yang membuka input teks bebas. Nilai yang
 * disimpan = teks preset atau teks manual (bukan sentinel). Berguna mis. untuk
 * "Hubungan dgn Pasien".
 */
export function SelectOther({
  value,
  onChange,
  options,
  placeholder = "Pilih…",
  otherLabel = "Lainnya…",
  otherPlaceholder = "Ketik manual…",
  id,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  otherLabel?: string;
  otherPlaceholder?: string;
  id?: string;
  disabled?: boolean;
}) {
  const isPreset = options.includes(value);
  const [otherMode, setOtherMode] = useState(!!value && !isPreset);
  const showText = otherMode || (!!value && !isPreset);

  const selectOptions: SelectOption[] = [
    ...options.map((o) => ({ value: o, label: o })),
    { value: OTHER, label: otherLabel },
  ];

  return (
    <div className="space-y-2">
      <Select
        id={id}
        disabled={disabled}
        value={showText ? OTHER : value}
        placeholder={placeholder}
        options={selectOptions}
        onChange={(v) => {
          if (v === OTHER) {
            setOtherMode(true);
            if (isPreset || !value) onChange("");
          } else {
            setOtherMode(false);
            onChange(v);
          }
        }}
      />
      {showText && (
        <Input
          autoFocus
          value={value}
          placeholder={otherPlaceholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
