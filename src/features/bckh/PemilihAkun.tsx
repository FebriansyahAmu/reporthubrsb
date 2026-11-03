"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, UserRoundX } from "lucide-react";
import { PopoverPanel } from "@/components/ui/Popover";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { AkunPenyetuju } from "@/server/modules/bckh/bckh.types";
import { AvatarBckh } from "./ui";

/** Akun berwenang menandatangani (dimuat saat `aktif`); null = memuat, [] = gagal/kosong. */
export function usePenyetuju(aktif: boolean): AkunPenyetuju[] | null {
  const [akun, setAkun] = useState<AkunPenyetuju[] | null>(null);
  useEffect(() => {
    if (!aktif) return;
    const ac = new AbortController();
    apiGet<AkunPenyetuju[]>("/api/bckh/penyetuju", { signal: ac.signal })
      .then(setAkun)
      .catch(() => !ac.signal.aborted && setAkun([]));
    return () => ac.abort();
  }, [aktif]);
  return akun;
}

/**
 * Pemilih AKUN penanda tangan (atasan langsung / direktur "Mengetahui") dari daftar
 * akun berwenang (`/api/bckh/penyetuju`). Cari nama/jabatan/NIP; panah ↑↓ + Enter.
 * `kecuali` = akun yang tak boleh dipilih (diri sendiri).
 */
export function PemilihAkun({
  label,
  akun,
  nilai,
  onPilih,
  kecuali,
  bantuan,
  kosong = "Belum dipilih",
}: {
  label: string;
  /** null = masih dimuat. */
  akun: AkunPenyetuju[] | null;
  nilai: string | null;
  onPilih: (a: AkunPenyetuju | null) => void;
  kecuali?: string;
  bantuan?: React.ReactNode;
  kosong?: string;
}) {
  const id = useId();
  const [buka, setBuka] = useState(false);
  const [cari, setCari] = useState("");
  const [sorot, setSorot] = useState(0);
  const [jangkar, setJangkar] = useState<HTMLButtonElement | null>(null);
  const terpilih = akun?.find((a) => a.id === nilai) ?? null;

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (akun ?? []).filter((a) => a.id !== kecuali && (!q || `${a.nama} ${a.namaTtd} ${a.username} ${a.jabatan} ${a.nip}`.toLowerCase().includes(q)));
  }, [akun, cari, kecuali]);

  const pilih = (a: AkunPenyetuju | null) => {
    onPilih(a);
    setBuka(false);
    setCari("");
  };

  return (
    <div>
      <p id={`${id}-l`} className="mb-1.5 text-xs font-medium text-fg-muted">
        {label}
      </p>
      <button
        ref={setJangkar}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={buka}
        aria-labelledby={`${id}-l`}
        disabled={!akun}
        onClick={() => {
          setBuka((b) => !b);
          setSorot(0);
        }}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-left transition-colors",
          "hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-60",
          buka && "border-brand ring-2 ring-brand-ring/30",
        )}
      >
        {terpilih ? (
          <>
            <AvatarBckh userId={terpilih.id} versi={terpilih.avatar} className="size-8 shrink-0 border border-border" label="" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-fg">{terpilih.nama}</span>
              <span className="block truncate text-xs text-fg-muted">{[terpilih.jabatan, terpilih.nip && `NIP ${terpilih.nip}`].filter(Boolean).join(" · ") || terpilih.username}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-sm text-fg-subtle">{!akun ? "Memuat akun…" : nilai ? "Akun tidak lagi berwenang — pilih ulang" : kosong}</span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 text-fg-subtle" aria-hidden />
      </button>
      {bantuan && <div className="mt-1.5 text-[11px] leading-relaxed text-fg-subtle">{bantuan}</div>}

      <PopoverPanel anchor={jangkar} open={buka} onClose={() => setBuka(false)} className="w-[min(26rem,calc(100vw-1rem))] p-0">
        <div className="sticky top-0 border-b border-border bg-surface p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <input
              autoFocus
              value={cari}
              onChange={(e) => {
                setCari(e.target.value);
                setSorot(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSorot((s) => Math.min(s + 1, daftar.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSorot((s) => Math.max(s - 1, 0));
                } else if (e.key === "Enter" && daftar[sorot]) {
                  e.preventDefault();
                  pilih(daftar[sorot]);
                }
              }}
              placeholder="Cari nama, jabatan, NIP…"
              aria-label="Cari akun"
              className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface pl-8 pr-2 text-sm text-fg focus-visible:border-brand focus-visible:outline-none"
            />
          </div>
        </div>
        <ul role="listbox" aria-labelledby={`${id}-l`} className="max-h-72 overflow-y-auto p-1">
          {daftar.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-fg-muted">
              {akun?.length ? "Tidak ada akun yang cocok." : "Belum ada akun berwenang. Admin perlu memberi peran hak \"Pegawai & Persetujuan\" (ubah)."}
            </li>
          ) : (
            daftar.map((a, i) => (
              <li key={a.id} role="option" aria-selected={a.id === nilai}>
                <button
                  type="button"
                  onMouseEnter={() => setSorot(i)}
                  onClick={() => pilih(a)}
                  className={cn("flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-2.5 py-2 text-left", i === sorot ? "bg-surface-2" : "hover:bg-surface-2")}
                >
                  <AvatarBckh userId={a.id} versi={a.avatar} className="size-8 shrink-0 border border-border" label="" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{a.nama}</span>
                    <span className="block truncate text-xs text-fg-muted">{[a.jabatan, a.nip && `NIP ${a.nip}`].filter(Boolean).join(" · ") || a.username}</span>
                  </span>
                  {a.id === nilai && <Check className="size-4 shrink-0 text-brand" aria-hidden />}
                </button>
              </li>
            ))
          )}
        </ul>
        {nilai && (
          <div className="border-t border-border p-1">
            <button
              type="button"
              onClick={() => pilih(null)}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              <UserRoundX className="size-4" aria-hidden />
              Lepas pilihan
            </button>
          </div>
        )}
      </PopoverPanel>
    </div>
  );
}
