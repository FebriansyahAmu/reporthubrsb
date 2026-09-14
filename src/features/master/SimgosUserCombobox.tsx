"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { PopoverPanel } from "@/components/ui/Popover";
import { useDebounce } from "@/lib/useDebounce";
import { searchSimgosUsers, type SimgosPenggunaHit } from "@/features/master/master.client";

const INPUT =
  "h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface text-sm text-fg " +
  "transition-colors hover:border-border-strong focus-visible:border-brand focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-brand-ring/40";

/**
 * Combobox pencari akun SIMGOS (`aplikasi.pengguna`). Ketik nama / LOGIN / NIP →
 * saran dari `/api/master/pengguna/simgos` → pilih (mengisi LOGIN + nama + NIP).
 * Nilai tampil = LOGIN terpilih.
 */
export function SimgosUserCombobox({
  value,
  onPick,
  onClear,
}: {
  /** LOGIN SIMGOS terpilih (untuk ditampilkan). */
  value: string;
  onPick: (hit: SimgosPenggunaHit) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<SimgosPenggunaHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLInputElement | null>(null);
  const debounced = useDebounce(query, 300);

  useEffect(() => {
    if (!open) return;
    const term = debounced.trim();
    if (term.length < 2) return;
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronisasi loading fetch
    setLoading(true);
    searchSimgosUsers(term)
      .then((r) => {
        if (!cancel) setHits(r);
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

  function pick(h: SimgosPenggunaHit) {
    setQuery(h.login);
    setOpen(false);
    onPick(h);
  }
  function clear() {
    setQuery("");
    setHits([]);
    setOpen(false);
    onClear();
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <input
          ref={setAnchorEl}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Cari nama / LOGIN / NIP akun SIMGOS…"
          autoComplete="off"
          className={`${INPUT} pl-9 pr-9`}
        />
        {query && (
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

      <PopoverPanel anchor={anchorEl} open={open && debounced.trim().length >= 2} onClose={() => setOpen(false)}>
        <ul className="max-h-64 min-w-[18rem] py-0.5">
          {loading ? (
            <li className="flex items-center gap-2 px-2.5 py-3 text-sm text-fg-muted">
              <Loader2 className="size-4 animate-spin" /> Mencari…
            </li>
          ) : hits.length === 0 ? (
            <li className="px-2.5 py-3 text-sm text-fg-muted">Tak ada akun SIMGOS cocok.</li>
          ) : (
            hits.map((h) => (
              <li key={`${h.login}-${h.nip}`}>
                <button
                  type="button"
                  onClick={() => pick(h)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="text-sm text-fg">{h.nama || h.login}</span>
                  <span className="font-mono text-[11px] text-fg-subtle">
                    LOGIN {h.login}
                    {h.nip ? ` · NIP ${h.nip}` : ""}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverPanel>
    </div>
  );
}
