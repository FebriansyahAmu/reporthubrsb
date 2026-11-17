"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { PopoverPanel } from "@/components/ui/Popover";
import { lipat, pecah, saring, tampilOpsi } from "./combobox-saring";

export type { ComboboxGroup, ComboboxOption } from "./combobox-saring";
import type { ComboboxGroup, ComboboxOption } from "./combobox-saring";

/** Batas opsi yang dirender sekaligus; sisanya disaring dengan mengetik. */
const MAKS_TAMPIL = 300;

/** Sorot bagian teks yang cocok dengan kata kunci. */
function Sorot({ teks, kata }: { teks: string; kata: string[] }) {
  if (kata.length === 0) return <>{teks}</>;
  const lt = lipat(teks);
  if (lt.length !== teks.length) return <>{teks}</>;
  const tanda = new Array<boolean>(teks.length).fill(false);
  for (const k of kata) {
    let from = 0;
    for (;;) {
      const at = lt.indexOf(k, from);
      if (at < 0) break;
      for (let i = at; i < at + k.length; i++) tanda[i] = true;
      from = at + k.length;
    }
  }
  const bagian: { s: string; on: boolean }[] = [];
  for (let i = 0; i < teks.length; i++) {
    const last = bagian.at(-1);
    if (last && last.on === tanda[i]) last.s += teks[i];
    else bagian.push({ s: teks[i], on: tanda[i] });
  }
  return (
    <>
      {bagian.map((b, i) =>
        b.on ? (
          <mark key={i} className="rounded-[2px] bg-brand-soft px-px text-brand-soft-fg">
            {b.s}
          </mark>
        ) : (
          <Fragment key={i}>{b.s}</Fragment>
        ),
      )}
    </>
  );
}

const normGroups = (o: ComboboxOption[] | ComboboxGroup[]): ComboboxGroup[] =>
  o.length > 0 && "options" in o[0] ? (o as ComboboxGroup[]) : [{ label: "", options: o as ComboboxOption[] }];

/**
 * Combobox: dropdown yang **bisa diketik** dengan saran otomatis (pola ARIA
 * combobox + listbox). Fokus tetap di input; ↑/↓ pindah, Enter pilih, Esc batal.
 * Kelompok opsi opsional (mis. "Ruangan saya" lalu "Ruangan lain"). Daftar di
 * portal → tak terpotong `overflow-hidden`. Nilai = `value` opsi ("" = kosong).
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Pilih…",
  emptyText = "Tidak ada yang cocok.",
  id,
  disabled,
  clearable = true,
  icon,
  size = "md",
  invalid,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ComboboxOption[] | ComboboxGroup[];
  placeholder?: string;
  emptyText?: string;
  id?: string;
  disabled?: boolean;
  clearable?: boolean;
  icon?: ReactNode;
  size?: "sm" | "md";
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const groups = useMemo(() => normGroups(options), [options]);
  const selected = useMemo(() => {
    for (const g of groups) for (const o of g.options) if (o.value === value) return o;
    return null;
  }, [groups, value]);

  const [open, setOpen] = useState(false);
  /** null = tidak sedang mengetik (input menampilkan opsi terpilih). */
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uid = useId();
  const listId = `${uid}-list`;
  const optId = (i: number) => `${uid}-opt-${i}`;

  const hasil = useMemo(() => saring(groups, query ?? ""), [groups, query]);
  const flat = useMemo(() => hasil.flatMap((g) => g.options).slice(0, MAKS_TAMPIL), [hasil]);
  /** Kelompok siap render dengan indeks datar tiap opsi (untuk keyboard & aria). */
  const baris = useMemo(() => {
    let i = 0;
    return hasil.map((g) => ({
      label: g.label,
      items: g.options.map((o) => ({ o, i: i++ })).filter((x) => x.i < MAKS_TAMPIL),
    }));
  }, [hasil]);
  const kata = useMemo(() => pecah(query ?? ""), [query]);
  const aktif = Math.min(active, flat.length - 1);
  const tampil = query ?? (selected ? tampilOpsi(selected) : "");

  // Opsi aktif selalu terlihat saat navigasi keyboard.
  useEffect(() => {
    if (!open || aktif < 0) return;
    document.getElementById(`${uid}-opt-${aktif}`)?.scrollIntoView({ block: "nearest" });
  }, [aktif, open, uid]);

  function bukaMenu() {
    if (disabled || open) return;
    const i = flat.findIndex((o) => o.value === value);
    setActive(Math.max(0, i));
    setOpen(true);
    // Teks pilihan terseleksi → ketikan berikutnya langsung menggantinya (bukan menyambung).
    if (query === null) inputRef.current?.select();
  }
  function tutup() {
    setOpen(false);
    setQuery(null);
  }
  function pilih(o: ComboboxOption) {
    onChange(o.value);
    tutup();
  }
  function ketik(v: string) {
    setQuery(v);
    setActive(0);
    if (!open) setOpen(true);
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return bukaMenu();
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive(Math.max(0, Math.min(flat.length - 1, aktif + d)));
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const o = flat[aktif];
      if (o) pilih(o);
    } else if (e.key === "Escape") {
      if (query !== null) {
        e.preventDefault();
        tutup();
      }
    } else if (e.key === "Tab") {
      if (open) tutup();
    }
  }

  const h = size === "sm" ? "h-9" : "h-10";

  return (
    <>
      <div ref={setAnchorEl} className={cn("relative", className)}>
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle [&>svg]:size-4">
            {icon}
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && aktif >= 0 ? optId(aktif) : undefined}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={tampil}
          placeholder={placeholder}
          onChange={(e) => ketik(e.target.value)}
          onClick={bukaMenu}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={onKey}
          className={cn(
            h,
            "w-full truncate rounded-[var(--radius-md)] border border-border bg-surface text-sm text-fg transition-colors",
            "placeholder:text-fg-subtle hover:border-border-strong focus-visible:border-brand focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-brand-ring/40 disabled:pointer-events-none disabled:opacity-50",
            icon ? "pl-9" : "pl-3",
            clearable && value ? "pr-14" : "pr-8",
            open && "border-brand ring-2 ring-brand-ring/40",
            invalid && "border-danger",
          )}
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
          {clearable && value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Hapus pilihan"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange("");
                setQuery(null);
                inputRef.current?.focus();
              }}
              className="rounded-[var(--radius-sm)] p-1 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-label={open ? "Tutup daftar" : "Buka daftar"}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (open) return tutup();
              inputRef.current?.focus();
              bukaMenu();
            }}
            className="rounded-[var(--radius-sm)] p-1 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ChevronsUpDown className="size-4" />
          </button>
        </div>
      </div>

      <PopoverPanel anchor={anchorEl} open={open} onClose={tutup} className="p-0">
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          onMouseDown={(e) => e.preventDefault()}
          className="max-h-72 min-w-[14rem] overflow-y-auto p-1 outline-none"
        >
          {flat.length === 0 ? (
            <li role="presentation" className="px-2.5 py-6 text-center text-sm text-fg-muted">
              {emptyText}
            </li>
          ) : (
            baris.map((g, gi) => (
              <Fragment key={`g-${gi}`}>
                {g.label && (
                  <li
                    role="presentation"
                    className={cn(
                      "px-2 pb-1 pt-2 text-[11px] font-medium text-fg-subtle",
                      gi > 0 && "mt-1 border-t border-border pt-2.5",
                    )}
                  >
                    {g.label}
                  </li>
                )}
                {g.items.map(({ o, i }) => {
                  const isSel = o.value === value;
                  return (
                    <li
                      key={`${gi}-${o.value}`}
                      id={optId(i)}
                      role="option"
                      aria-selected={isSel}
                      onMouseMove={() => i !== aktif && setActive(i)}
                      onClick={() => pilih(o)}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm",
                        i === aktif ? "bg-surface-2 text-fg" : "text-fg",
                      )}
                    >
                      {o.badge && (
                        <span className="w-[4.5rem] shrink-0 truncate font-mono text-[11px] font-semibold text-fg-muted">
                          <Sorot teks={o.badge} kata={kata} />
                        </span>
                      )}
                      <span className={cn("min-w-0 flex-1 truncate", isSel && "font-medium")}>
                        <Sorot teks={o.label} kata={kata} />
                      </span>
                      {o.hint && <span className="shrink-0 text-[11px] text-fg-subtle">{o.hint}</span>}
                      <Check className={cn("size-3.5 shrink-0 text-brand", !isSel && "invisible")} />
                    </li>
                  );
                })}
              </Fragment>
            ))
          )}
        </ul>
      </PopoverPanel>
    </>
  );
}
