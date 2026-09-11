"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { PopoverPanel } from "@/components/ui/Popover";
import { Label } from "@/components/ui/Field";
import { useDebounce } from "@/lib/useDebounce";
import type { Pejabat, PegawaiHit } from "@/server/modules/master/ruangan/ruangan-pejabat.types";

const INPUT =
  "h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface text-sm text-fg " +
  "transition-colors hover:border-border-strong focus-visible:border-brand focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-brand-ring/40";

/**
 * Combobox pencari pegawai SIMGOS untuk menetapkan pejabat. Ketik nama → saran
 * dari `/api/master/ruangan/pegawai` → pilih (auto-isi nama+NIP), atau ketik
 * manual (nama + NIP bisa diisi sendiri). Nilai = `Pejabat | null`.
 */
export function PegawaiCombobox({
  label,
  value,
  onChange,
  hint,
  placeholder = "Cari nama pegawai…",
}: {
  label: string;
  value: Pejabat | null;
  onChange: (v: Pejabat | null) => void;
  hint?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value?.nama ?? "");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<PegawaiHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLInputElement | null>(null);
  const debounced = useDebounce(query, 300);
  const nip = value?.nip ?? "";

  useEffect(() => {
    if (!open) return;
    const term = debounced.trim();
    // Popover di-gate pada panjang >= 2, jadi tak perlu bersihkan sinkron di sini.
    if (term.length < 2) return;
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronisasi loading fetch
    setLoading(true);
    fetch(`/api/master/ruangan/pegawai?q=${encodeURIComponent(term)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch"))))
      .then((j: { data: PegawaiHit[] }) => {
        if (!cancel) setHits(j.data ?? []);
      })
      .catch(() => {
        if (!cancel) setHits([]);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [debounced, open]);

  function emit(nama: string, n: string) {
    onChange(nama.trim() || n.trim() ? { nama, nip: n } : null);
  }
  function onName(v: string) {
    setQuery(v);
    setOpen(true);
    emit(v, nip);
  }
  function pick(h: PegawaiHit) {
    setQuery(h.nama);
    onChange({ nama: h.nama, nip: h.nip });
    setOpen(false);
  }
  function clear() {
    setQuery("");
    setHits([]);
    setOpen(false);
    onChange(null);
  }

  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <input
          ref={setAnchorEl}
          value={query}
          onChange={(e) => onName(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`${INPUT} pl-9 pr-9`}
        />
        {(query || nip) && (
          <button
            type="button"
            onClick={clear}
            aria-label="Kosongkan"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <input
        value={nip}
        onChange={(e) => emit(query, e.target.value)}
        placeholder="NIP (otomatis dari pilihan / isi manual)"
        className={`${INPUT.replace("h-10", "h-9")} mt-2 px-3 text-[13px] text-fg-muted tabular`}
      />

      {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}

      <PopoverPanel
        anchor={anchorEl}
        open={open && debounced.trim().length >= 2}
        onClose={() => setOpen(false)}
      >
        <ul className="max-h-64 min-w-[16rem] py-0.5">
          {loading ? (
            <li className="flex items-center gap-2 px-2.5 py-3 text-sm text-fg-muted">
              <Loader2 className="size-4 animate-spin" /> Mencari…
            </li>
          ) : hits.length === 0 ? (
            <li className="px-2.5 py-3 text-sm text-fg-muted">
              Tak ada hasil. Ketik nama lalu isi NIP manual bila perlu.
            </li>
          ) : (
            hits.map((h) => (
              <li key={`${h.nip}-${h.nama}`}>
                <button
                  type="button"
                  onClick={() => pick(h)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="text-sm text-fg">{h.nama}</span>
                  {h.nip && <span className="font-mono text-[11px] text-fg-subtle">NIP {h.nip}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverPanel>
    </div>
  );
}
