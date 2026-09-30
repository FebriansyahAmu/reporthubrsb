"use client";

import { useEffect, useId, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { PopoverPanel } from "@/components/ui/Popover";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { useDebounce } from "@/lib/useDebounce";
import type { JenisIcd } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import type { IcdInfo } from "@/server/modules/verifikasi-klaim/verifikasi.types";

const INPUT =
  "h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface pl-9 pr-3 text-sm text-fg " +
  "placeholder:text-fg-subtle transition-colors hover:border-border-strong focus-visible:border-brand " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 disabled:opacity-50";

/** Penanda ringkas kode ICD (kategori/header, asterisk, tak boleh utama) — teks, bukan warna saja. */
export function TandaIcd({ info, jenis, className }: { info: IcdInfo | undefined; jenis: JenisIcd; className?: string }) {
  const tanda = !info
    ? [{ t: "tidak ada di master INA-CBG", tone: "danger" as const }]
    : [
        ...(!info.valid ? [{ t: "kode kategori", tone: "danger" as const }] : []),
        ...(jenis === "10" && info.asterisk ? [{ t: "asterisk (*)", tone: "warning" as const }] : []),
        ...(jenis === "10" && !info.accpdx && !info.asterisk ? [{ t: "tak boleh utama", tone: "warning" as const }] : []),
      ];
  if (tanda.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {tanda.map((x) => (
        <span
          key={x.t}
          className={cn(
            "rounded px-1.5 py-px text-[10px] font-medium",
            x.tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning",
          )}
        >
          {x.t}
        </span>
      ))}
    </span>
  );
}

/**
 * Pencari kode ICD INA-CBG (ICD-10 / ICD-9-CM edisi IM) — ketik kode ("K35.8",
 * "k358") atau nama bahasa Inggris ("appendicitis"). Hasil dari server
 * (`/api/berkas-klaim/koding/icd`, di-cache 24 jam). Keyboard: ↑/↓, Enter, Esc.
 */
export function IcdCombobox({
  jenis,
  onPilih,
  sudahAda,
  placeholder,
  disabled,
  label,
}: {
  jenis: JenisIcd;
  onPilih: (info: IcdInfo) => void;
  /** Kode yang sudah ada di usulan (ditandai, tak bisa dipilih lagi). */
  sudahAda: ReadonlySet<string>;
  placeholder: string;
  disabled?: boolean;
  label: string;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<IcdInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [galat, setGalat] = useState(false);
  const [aktif, setAktif] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLInputElement | null>(null);
  const term = useDebounce(q.trim(), 250);

  useEffect(() => {
    if (!open || term.length < 2) return;
    let batal = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronisasi status fetch
    setLoading(true);
    setGalat(false);
    apiGet<IcdInfo[]>(`/api/berkas-klaim/koding/icd?jenis=${jenis}&q=${encodeURIComponent(term)}`)
      .then((r) => {
        if (batal) return;
        setHits(r);
        setAktif(0);
      })
      .catch(() => {
        if (batal) return;
        setHits([]);
        setGalat(true);
      })
      .finally(() => {
        if (!batal) setLoading(false);
      });
    return () => {
      batal = true;
    };
  }, [term, open, jenis]);

  function pilih(h: IcdInfo) {
    if (sudahAda.has(h.kode)) return;
    onPilih(h);
    setQ("");
    setHits([]);
    setOpen(false);
    anchorEl?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setAktif((i) => Math.min(hits.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktif((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const h = hits[aktif];
      if (h && open) pilih(h);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const tampil = open && term.length >= 2;
  const listId = `${id}-hasil`;

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
        <input
          id={id}
          ref={setAnchorEl}
          role="combobox"
          aria-expanded={tampil}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={tampil && hits[aktif] ? `${listId}-${aktif}` : undefined}
          autoComplete="off"
          value={q}
          disabled={disabled}
          maxLength={60}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className={INPUT}
        />
      </div>
      <PopoverPanel anchor={anchorEl} open={tampil} onClose={() => setOpen(false)}>
        <ul id={listId} role="listbox" aria-label={label} className="max-h-72 min-w-[18rem] py-0.5">
          {loading && hits.length === 0 ? (
            <li className="flex items-center gap-2 px-2.5 py-3 text-sm text-fg-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Mencari di master INA-CBG…
            </li>
          ) : galat ? (
            <li className="px-2.5 py-3 text-sm text-danger">Pencarian gagal. Coba lagi.</li>
          ) : hits.length === 0 ? (
            <li className="px-2.5 py-3 text-sm text-fg-muted">
              Tak ada hasil. Ketik kode ({jenis === "10" ? "mis. K35.8" : "mis. 47.09"}) atau nama dalam bahasa Inggris.
            </li>
          ) : (
            hits.map((h, i) => {
              const ada = sudahAda.has(h.kode);
              return (
                <li
                  key={h.kode}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === aktif}
                  aria-disabled={ada}
                  onMouseEnter={() => setAktif(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pilih(h)}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left",
                    i === aktif ? "bg-surface-2" : "hover:bg-surface-2",
                    ada && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span className="w-16 shrink-0 font-mono text-[13px] font-semibold text-fg">{h.kode}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-fg">{h.nama}</span>
                    <TandaIcd info={h} jenis={jenis} className="mt-0.5" />
                  </span>
                  {ada ? (
                    <span className="shrink-0 text-[11px] text-fg-subtle">sudah ada</span>
                  ) : (
                    <Plus className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
                  )}
                </li>
              );
            })
          )}
        </ul>
      </PopoverPanel>
    </div>
  );
}
