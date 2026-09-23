"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Pencil, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatRupiah, formatRupiahRingkas } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  BULAN_LABEL,
  JENIS_KLAIM_LABEL, JENIS_KLAIM_TONE,
  JENIS_LAYANAN_LABEL,
  type StatusKlaim,
} from "@/server/modules/rekap-klaim/klaim.schema";
import type { KlaimItem } from "./klaim.client";
import { fetchStatusOverview, type AlertEntry } from "./status.client";
import { StatusMenu } from "./StatusMenu";

type Tab = "lewat" | "mendekati" | "selisih" | "pending";
const shortBulan = (m: number) => BULAN_LABEL[m - 1].slice(0, 3);

export function StatusPanel({
  tahun, rev, canChange, onEdit, onChangeStatus,
}: {
  tahun?: string;
  rev: number;
  canChange: boolean;
  onEdit: (k: KlaimItem) => void;
  onChangeStatus: (id: string, s: StatusKlaim) => void | Promise<void>;
}) {
  const state = useAsyncData(() => fetchStatusOverview(tahun || undefined), [tahun, rev]);
  const ov = state.result;

  const [tab, setTab] = useState<Tab | null>(null);
  const [seedKey, setSeedKey] = useState<string | null>(null);
  // Auto-buka kategori paling penting saat data untuk tahun ini pertama datang.
  if (ov && seedKey !== (tahun ?? "")) {
    setSeedKey(tahun ?? "");
    setTab(
      ov.counts.lewatBatas > 0 ? "lewat"
        : ov.counts.mendekati > 0 ? "mendekati"
        : ov.counts.selisih > 0 ? "selisih"
        : ov.pendingPerBulan.length > 0 ? "pending" : null,
    );
  }

  if (state.loading && !ov) {
    return <Card className="p-4"><Skeleton className="h-24 w-full rounded-[var(--radius-md)]" /></Card>;
  }
  if (state.error || !ov) {
    return (
      <Card className="flex items-center justify-between p-4 text-sm">
        <span className="text-fg-muted">Gagal memuat status.</span>
        <button type="button" onClick={state.reload} className="font-medium text-brand hover:underline">Coba lagi</button>
      </Card>
    );
  }

  const bersih = ov.counts.lewatBatas === 0 && ov.counts.mendekati === 0 && ov.counts.selisih === 0;
  const list: AlertEntry[] =
    tab === "lewat" ? ov.alerts.lewatBatas
      : tab === "mendekati" ? ov.alerts.mendekati
      : tab === "selisih" ? ov.alerts.selisih : [];

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand"><CalendarClock className="size-4" /></span>
          <div>
            <h3 className="text-sm font-semibold text-fg">Status &amp; Tindak Lanjut</h3>
            <p className="text-[11px] text-fg-muted">
              {ov.belumCair.count} klaim belum cair · {formatRupiahRingkas(ov.belumCair.nilai)} · batas ±{ov.deadlineMonths} bln
            </p>
          </div>
        </div>
        {bersih && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success"><CheckCircle2 className="size-4" /> Tidak ada alert</span>
        )}
      </div>

      {/* Chip kategori */}
      <div className="flex flex-wrap gap-2">
        <Chip icon={AlertTriangle} tone="danger" label="Lewat Batas / Expired" count={ov.counts.lewatBatas} active={tab === "lewat"} onClick={() => setTab((t) => (t === "lewat" ? null : "lewat"))} />
        <Chip icon={Clock} tone="warning" label="Mendekati Batas" count={ov.counts.mendekati} active={tab === "mendekati"} onClick={() => setTab((t) => (t === "mendekati" ? null : "mendekati"))} />
        <Chip icon={TrendingDown} tone="accent" label="Selisih Bayar" count={ov.counts.selisih} active={tab === "selisih"} onClick={() => setTab((t) => (t === "selisih" ? null : "selisih"))} />
        <Chip icon={CalendarClock} tone="brand" label="Pending / Bulan" count={ov.pendingPerBulan.length} active={tab === "pending"} onClick={() => setTab((t) => (t === "pending" ? null : "pending"))} />
      </div>

      {/* Isi tab */}
      {tab === "pending" ? (
        <div className="mt-3">
          {ov.pendingPerBulan.length === 0 ? (
            <p className="px-1 py-3 text-center text-xs text-fg-muted">Tidak ada klaim belum cair.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {ov.pendingPerBulan.map((p) => (
                <li key={`${p.tahun}-${p.bulan}`} className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-surface-2/30 px-3 py-2 text-sm">
                  <span className="font-medium text-fg">{shortBulan(p.bulan)} {p.tahun}</span>
                  <span className="text-xs text-fg-muted">{p.count} entri · <span className="font-semibold text-fg tabular-nums">{formatRupiahRingkas(p.nilai)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : tab ? (
        <div className="mt-3">
          {list.length === 0 ? (
            <p className="px-1 py-3 text-center text-xs text-fg-muted">Tidak ada item pada kategori ini.</p>
          ) : (
            <ul className="space-y-1.5">
              {list.map((a) => (
                <li key={`${a.klaim.id}-${a.severity}`} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/30 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={JENIS_KLAIM_TONE[a.klaim.jenisKlaim]} dot>{JENIS_KLAIM_LABEL[a.klaim.jenisKlaim]}</Badge>
                      <span className="text-xs font-medium text-fg">{shortBulan(a.klaim.bulanPelayanan)} {a.klaim.tahunPelayanan}</span>
                      <span className="text-[11px] text-fg-muted">{JENIS_LAYANAN_LABEL[a.klaim.jenisLayanan]}</span>
                    </div>
                    <p className={cn("mt-0.5 text-[11px]", a.severity === "danger" ? "text-danger" : a.severity === "warning" ? "text-warning" : "text-accent")}>{a.reason}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-fg tabular-nums">{formatRupiah(a.klaim.jumlah)}</span>
                    <StatusMenu status={a.klaim.status} onSelect={(s) => onChangeStatus(a.klaim.id, s)} disabled={!canChange} />
                    <button type="button" onClick={() => onEdit(a.klaim)} title="Ubah" className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-brand-soft hover:text-brand"><Pencil className="size-3.5" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function Chip({
  icon: Icon, tone, label, count, active, onClick,
}: {
  icon: typeof Clock;
  tone: "danger" | "warning" | "accent" | "brand";
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const toneRing: Record<string, string> = {
    danger: "text-danger", warning: "text-warning", accent: "text-accent", brand: "text-brand",
  };
  const activeBg: Record<string, string> = {
    danger: "border-danger/40 bg-danger-soft/40", warning: "border-warning/40 bg-warning-soft/40",
    accent: "border-accent/40 bg-accent-soft/40", brand: "border-brand/40 bg-brand-soft/40",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        active ? activeBg[tone] : "border-border bg-surface hover:bg-surface-2",
        count > 0 ? "text-fg" : "text-fg-muted",
      )}
    >
      <Icon className={cn("size-4", count > 0 ? toneRing[tone] : "text-fg-subtle")} />
      {label}
      <span className={cn("min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums", count > 0 ? "bg-surface text-fg ring-1 ring-border" : "text-fg-subtle")}>{count}</span>
    </button>
  );
}
