"use client";

import { useState } from "react";
import { ChevronRight, Layers } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  KELOMPOK_JENIS,
  KELOMPOK_LABEL,
  type KelompokJenis,
} from "@/server/modules/audit-rme/kunjungan.constants";
import type { JenisNode, RuanganTree } from "./audit.client";

/**
 * Pilihan lokasi: seluruh, kelompok klinis (RJ/IGD/RI), satu jenis kunjungan,
 * atau prefiks ruangan (bangsal 7 / ruang 9 digit).
 */
export type LokasiSel = { kelompok?: KelompokJenis; jenis?: number; ruangan?: string };

export const LOKASI_DEFAULT: LokasiSel = { kelompok: "KLINIS" };

const jenisKey = (j: JenisNode) => String(j.jenis ?? "x");
const KLINIS_IDS = KELOMPOK_JENIS.KLINIS as readonly number[];

/** Jumlah kunjungan kelompok klinis dari pohon (tanpa query tambahan). */
function klinisCount(tree: RuanganTree | null) {
  const nodes = tree?.jenis.filter((j) => j.jenis != null && KLINIS_IDS.includes(j.jenis)) ?? [];
  return { total: nodes.reduce((s, j) => s + j.total, 0), aktif: nodes.reduce((s, j) => s + j.aktif, 0) };
}

const isSel = (a: LokasiSel, b: LokasiSel) => a.kelompok === b.kelompok && a.jenis === b.jenis && a.ruangan === b.ruangan;

/**
 * Rail kiri (desktop): pohon Jenis kunjungan → Bangsal → Ruang dengan jumlah
 * kunjungan & jumlah yang sedang dilayani. Bangsal dengan satu ruang tidak
 * dipecah lagi agar rail tetap ringkas.
 */
export function RuanganRail({
  tree,
  loading,
  sel,
  onSelect,
}: {
  tree: RuanganTree | null;
  loading: boolean;
  sel: LokasiSel;
  onSelect: (s: LokasiSel) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(sel.jenis != null ? [String(sel.jenis)] : ["3"]));
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const klinis = klinisCount(tree);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Layers className="size-4 text-fg-muted" />
        <h2 className="text-sm font-semibold text-fg">Jenis & Ruangan</h2>
      </div>
      {!tree && loading ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-md" />)}
        </div>
      ) : (
        <nav aria-label="Filter jenis & ruangan" className={cn("p-2 transition-opacity", loading && "opacity-60")}>
          <RailRow label="Semua kunjungan" total={tree?.total ?? 0} aktif={tree?.aktif ?? 0} active={isSel(sel, {})} onClick={() => onSelect({})} strong />
          <RailRow
            label={`${KELOMPOK_LABEL.KLINIS} (RI · IGD · RJ)`}
            total={klinis.total}
            aktif={klinis.aktif}
            active={isSel(sel, LOKASI_DEFAULT)}
            onClick={() => onSelect(LOKASI_DEFAULT)}
            strong
          />
          <div className="mx-2 my-1.5 border-t border-border" aria-hidden />
          {tree?.jenis.map((j) => {
            const key = jenisKey(j);
            const expanded = open.has(key);
            const jenisActive = sel.jenis === j.jenis && !sel.ruangan;
            return (
              <div key={key} className="mt-1">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-label={expanded ? `Tutup ${j.label}` : `Buka ${j.label}`}
                    aria-expanded={expanded}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                  >
                    <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <RailRow
                      label={j.label}
                      total={j.total}
                      aktif={j.aktif}
                      active={jenisActive}
                      strong
                      onClick={() => {
                        onSelect(j.jenis != null ? { jenis: j.jenis } : {});
                        if (!expanded) toggle(key);
                      }}
                    />
                  </div>
                </div>
                {expanded && (
                  <div className="ml-7 border-l border-border pl-1.5">
                    {j.grup.map((g) => (
                      <div key={g.id}>
                        <RailRow
                          label={g.nama}
                          total={g.total}
                          aktif={g.aktif}
                          active={sel.ruangan === g.id}
                          onClick={() => onSelect({ jenis: j.jenis ?? undefined, ruangan: g.id })}
                        />
                        {g.ruang.length > 1 &&
                          g.ruang.map((r) => (
                            <div key={r.id} className="ml-3">
                              <RailRow
                                label={r.nama}
                                total={r.total}
                                aktif={r.aktif}
                                active={sel.ruangan === r.id}
                                small
                                onClick={() => onSelect({ jenis: j.jenis ?? undefined, ruangan: r.id })}
                              />
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {tree && tree.jenis.length === 0 && <p className="px-3 py-6 text-center text-xs text-fg-muted">Tidak ada kunjungan.</p>}
        </nav>
      )}
    </Card>
  );
}

function RailRow({
  label,
  total,
  aktif,
  active,
  onClick,
  strong,
  small,
}: {
  label: string;
  total: number;
  aktif: number;
  active: boolean;
  onClick: () => void;
  strong?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      title={`${label} — ${total} kunjungan${aktif ? `, ${aktif} sedang dilayani` : ""}`}
      className={cn(
        "flex w-full items-start gap-2 rounded-md px-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        small ? "py-1 text-[11px]" : "py-1.5 text-[13px]",
        active ? "bg-brand-soft text-brand" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
        strong && !active && "text-fg",
        strong && "font-medium",
      )}
    >
      <span className="min-w-0 flex-1 leading-snug wrap-break-word">{label}</span>
      {aktif > 0 && (
        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-accent" aria-label={`${aktif} sedang dilayani`}>
          <span className="size-1.5 rounded-full bg-accent" />
          {aktif}
        </span>
      )}
      <span className={cn("mt-px tabular text-xs", active ? "font-semibold text-brand" : "text-fg-subtle")}>{formatNumber(total)}</span>
    </button>
  );
}

/** Versi mobile: baris chip jenis kunjungan, lalu chip bangsal/ruang dari jenis terpilih. */
export function RuanganChips({ tree, sel, onSelect }: { tree: RuanganTree | null; sel: LokasiSel; onSelect: (s: LokasiSel) => void }) {
  if (!tree) return null;
  const jenisSel = tree.jenis.find((j) => j.jenis === sel.jenis);
  const lokasi = jenisSel
    ? jenisSel.grup.flatMap((g) => (g.ruang.length > 1 ? [{ id: g.id, nama: g.nama, total: g.total }, ...g.ruang] : [{ id: g.id, nama: g.nama, total: g.total }]))
    : [];
  return (
    <div className="space-y-2">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Chip label="Semua" n={tree.total} active={isSel(sel, {})} onClick={() => onSelect({})} />
        <Chip label="Klinis" n={klinisCount(tree).total} active={isSel(sel, LOKASI_DEFAULT)} onClick={() => onSelect(LOKASI_DEFAULT)} />
        {tree.jenis.map((j) => (
          <Chip key={jenisKey(j)} label={j.short} n={j.total} active={sel.jenis === j.jenis && !sel.ruangan} onClick={() => onSelect(j.jenis != null ? { jenis: j.jenis } : {})} />
        ))}
      </div>
      {lokasi.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {lokasi.map((l) => (
            <Chip key={l.id} label={l.nama} n={l.total} active={sel.ruangan === l.id} onClick={() => onSelect({ jenis: sel.jenis, ruangan: l.id })} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ label, n, active, onClick }: { label: string; n: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-brand bg-brand text-white" : "border-border bg-surface text-fg-muted hover:text-fg",
      )}
    >
      <span className="max-w-40 truncate">{label}</span>
      <span className={cn("tabular", active ? "text-white/80" : "text-fg-subtle")}>{n}</span>
    </button>
  );
}
