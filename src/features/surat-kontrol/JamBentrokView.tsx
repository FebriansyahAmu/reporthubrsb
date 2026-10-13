"use client";

import { useState } from "react";
import { ChevronDown, Clock3 } from "lucide-react";
import { EmptyState } from "@/components/feedback/States";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { SlotBentrok, SuratKontrolBaris } from "@/server/modules/surat-kontrol/surat-kontrol.types";

/**
 * Jadwal SIMRS yang menumpuk pada dokter + tanggal + jam yang sama (bahan
 * perbaikan pembagian jam). Diurutkan dari slot terpadat; buka slot untuk
 * melihat pasiennya, klik pasien untuk membuka perbandingan.
 */
export function JamBentrokView({
  slot,
  semua,
  onPilih,
}: {
  slot: SlotBentrok[];
  semua: ReadonlyMap<string, SuratKontrolBaris>;
  onPilih: (key: string) => void;
}) {
  const [buka, setBuka] = useState<string | null>(null);
  if (slot.length === 0) {
    return <EmptyState title="Tidak ada jam bentrok" description="Tidak ada dua jadwal atau lebih pada dokter, tanggal & jam yang sama untuk rentang & saringan ini." />;
  }
  const maks = Math.max(...slot.map((s) => s.jumlah));
  const pasien = slot.reduce((a, s) => a + s.jumlah, 0);
  return (
    <div>
      <p className="border-b border-border px-4 py-3 text-xs text-fg-muted">
        <b className="tabular text-fg">{formatNumber(slot.length)}</b> slot jam berisi lebih dari satu pasien ·{" "}
        <b className="tabular text-fg">{formatNumber(pasien)}</b> jadwal terdampak. Jam sama untuk banyak pasien membuat antrean poli menumpuk di jam itu.
      </p>
      <ul className="divide-y divide-border">
        {slot.map((s) => {
          const id = `${s.tanggal}|${s.jam}|${s.dokter}|${s.ruangan}`;
          const terbuka = buka === id;
          return (
            <li key={id}>
              <button
                type="button"
                aria-expanded={terbuka}
                onClick={() => setBuka(terbuka ? null : id)}
                className="grid w-full grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring sm:grid-cols-[120px_minmax(0,1fr)_200px_auto]"
              >
                <span>
                  <span className="block text-xs font-semibold text-fg">{formatDate(s.tanggal)}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-fg-muted"><Clock3 className="size-3" />{s.jam.replace(":", ".")}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-fg">{s.dokter ?? "Dokter tidak diketahui"}</span>
                  <span className="block truncate text-[11px] text-fg-muted">{s.ruangan ?? "—"}</span>
                </span>
                <span className="hidden items-center gap-2 sm:flex" aria-hidden>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(s.jumlah / maks) * 100}%` }} />
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent tabular">{s.jumlah} pasien</span>
                  <ChevronDown className={cn("size-4 text-fg-subtle transition-transform", terbuka && "rotate-180")} />
                </span>
              </button>
              {terbuka && (
                <ul className="mx-4 mb-3 divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface-2/30">
                  {s.keys.map((k) => {
                    const b = semua.get(k);
                    return (
                      <li key={k}>
                        <button
                          type="button"
                          onClick={() => onPilih(k)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                        >
                          <span className="min-w-0 truncate text-fg">{b?.pasien ?? "Tanpa nama"}</span>
                          <span className="shrink-0 font-mono text-[10px] text-fg-subtle">{b?.noSurat ?? "tanpa surat BPJS"}</span>
                        </button>
                      </li>
                    );
                  })}
                  {s.jumlah > s.keys.length && (
                    <li className="px-3 py-1.5 text-[11px] text-fg-subtle">+{s.jumlah - s.keys.length} jadwal lain di luar saringan/jenis yang dipilih</li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
