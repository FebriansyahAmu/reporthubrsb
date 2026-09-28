"use client";

import { useMemo, useState } from "react";
import { Ban, CalendarClock, History, Info, LayoutGrid, ListChecks, MapPin, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { cn } from "@/lib/cn";
import {
  JENIS_KUNJUNGAN,
  KATEGORI,
  KATEGORI_KEYS,
  STATUS_KUNJUNGAN_LABEL,
  SUMBER,
  type ShiftKey,
} from "@/server/modules/audit-rme/kunjungan.constants";
import {
  fetchKunjunganDetail,
  type KunjunganCard,
  type KunjunganDetail,
  type LogItem,
  type Petugas,
  type PetugasRekap,
} from "./audit.client";
import { AuditDetailModal } from "./AuditDetailModal";
import { KelengkapanMeter, MiniPip, fmtWaktu } from "./KunjunganCardView";
import { AvatarStack, MatriksShiftView } from "./MatriksShiftView";
import { KATEGORI_TONE, LOG_JENIS, RekamList, type SelFilter } from "./RekamList";

type Tab = "matriks" | "aktual" | "petugas" | "log";

/**
 * Jejak satu kunjungan (Fase 2 · K2) — panel samping dari Papan Kunjungan.
 * `nomor` null = tertutup. Diff log dibuka di modal di atas drawer; selama
 * modal terbuka, Escape hanya menutup modal.
 */
export function JejakKunjunganDrawer({ nomor, onClose }: { nomor: string | null; onClose: () => void }) {
  const [logId, setLogId] = useState<string | null>(null);
  // Satu fetch untuk header + isi; tiap buka drawer = data segar.
  const { result, loading, error, reload } = useAsyncData<KunjunganDetail | null>(
    () => (nomor ? fetchKunjunganDetail(nomor) : Promise.resolve(null)),
    [nomor],
  );
  // Abaikan hasil kunjungan sebelumnya selama data kunjungan baru dimuat.
  const d = result && result.card.nomor === nomor ? result : null;

  return (
    <>
      <Drawer
        open={!!nomor}
        onClose={onClose}
        title="Jejak kunjungan"
        size="lg"
        dismissible={!logId}
        header={d ? <Header k={d.card} /> : <HeaderSkeleton />}
      >
        {nomor &&
          (d ? (
            <JejakBody key={nomor} d={d} onOpenLog={setLogId} />
          ) : error && !loading ? (
            <div className="p-5"><ErrorState onRetry={reload} /></div>
          ) : (
            <BodySkeleton />
          ))}
      </Drawer>
      <AuditDetailModal logId={logId} onClose={() => setLogId(null)} />
    </>
  );
}

function HeaderSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-4 w-48 rounded" />
      <Skeleton className="h-3 w-64 rounded" />
    </div>
  );
}

function BodySkeleton() {
  return (
    <div className="space-y-3 p-5" aria-busy="true">
      <Skeleton className="h-9 w-80 rounded" />
      <div className="grid grid-cols-4 gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded" />)}</div>
      <Skeleton className="h-64 rounded" />
    </div>
  );
}

function Header({ k }: { k: KunjunganCard }) {
  const tone = (k.jenis.id != null ? JENIS_KUNJUNGAN[k.jenis.id]?.tone : undefined) ?? "neutral";
  const wajib = new Set(k.kelengkapan.wajib);
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={cn("text-base font-semibold text-fg", k.status === "BATAL" && "line-through decoration-danger/60")}>{k.pasien.nama ?? "Tanpa nama"}</h3>
        <Badge tone={tone} className="px-2">{k.jenis.label}</Badge>
        {k.status !== "SELESAI" && (
          <Badge tone={k.status === "BATAL" ? "danger" : "accent"} dot className="px-2">{STATUS_KUNJUNGAN_LABEL[k.status]}</Badge>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
        <span className="font-mono">RM {k.norm}</span>
        {k.pasien.jenisKelamin && <span>{k.pasien.jenisKelamin} · {k.pasien.umur ?? "?"} th</span>}
        <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{k.ruangan.nama}</span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3.5" />
          {fmtWaktu(k.masuk)} → {k.keluar ? fmtWaktu(k.keluar) : "sekarang"}
          {k.jenis.id === 3 && <> · {k.hariRawat} hari</>}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1" aria-label="Input per kategori">
          {KATEGORI_KEYS.map((key) => (
            <span key={key} className="flex flex-col items-center gap-0.5">
              <MiniPip kategori={key} stat={k.kategori[key]} wajib={wajib.has(key)} />
              <span className="text-[9px] font-semibold text-fg-subtle">{KATEGORI[key].short}</span>
            </span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-fg-muted"><UsersRound className="size-3.5" /> {k.petugas.total} petugas</span>
        <div className="ml-auto"><KelengkapanMeter wajib={k.kelengkapan.wajib} terpenuhi={k.kelengkapan.terpenuhi} persen={k.kelengkapan.persen} /></div>
      </div>
    </div>
  );
}

function JejakBody({ d, onOpenLog }: { d: KunjunganDetail; onOpenLog: (logId: string) => void }) {
  const isRi = d.card.jenis.id === 3 && !!d.matriks;
  const [tab, setTab] = useState<Tab>(isRi ? "matriks" : "aktual");
  const [sel, setSel] = useState<SelFilter>(null);

  const tabs = useMemo(() => {
    const t: { key: Tab; label: string; icon: typeof LayoutGrid; n?: number }[] = [];
    if (isRi) t.push({ key: "matriks", label: "Matriks 24 jam", icon: LayoutGrid });
    t.push({ key: "aktual", label: "Data aktual", icon: ListChecks, n: d.records.length });
    t.push({ key: "petugas", label: "Petugas", icon: UsersRound, n: d.petugasRekap.length });
    t.push({ key: "log", label: "Log", icon: History, n: d.logs.length });
    return t;
  }, [d, isRi]);

  function pilihSel(tanggal: string, shift?: ShiftKey) {
    const h = d.matriks?.hari.find((x) => x.tanggal === tanggal);
    setSel({ tanggal, shift, hariKe: h?.hariKe ?? 0 });
    setTab("aktual");
  }

  return (
    <div>
      <div role="tablist" aria-label="Bagian jejak kunjungan" className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-bg/95 px-5 pt-2 backdrop-blur">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
              tab === t.key ? "border-brand text-brand" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
            {t.n != null && <span className="rounded-full bg-surface-2 px-1.5 text-[10px] tabular text-fg-muted">{t.n}</span>}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "matriks" && d.matriks && <MatriksShiftView matriks={d.matriks} petugas={d.petugas} onPilih={pilihSel} />}
        {tab === "aktual" && <RekamList records={d.records} petugas={d.petugas} sel={sel} onClearSel={() => setSel(null)} onOpenLog={onOpenLog} />}
        {tab === "petugas" && <PetugasRekapList rekap={d.petugasRekap} petugas={d.petugas} />}
        {tab === "log" && <LogList logs={d.logs} petugas={d.petugas} terpotong={d.logTerpotong} onOpenLog={onOpenLog} />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- petugas */

function PetugasRekapList({ rekap, petugas }: { rekap: PetugasRekap[]; petugas: Record<string, Petugas> }) {
  const grup = useMemo(() => {
    const m = new Map<string, PetugasRekap[]>();
    for (const r of rekap) {
      const label = petugas[r.id]?.profesiLabel ?? "Tidak diketahui";
      m.set(label, [...(m.get(label) ?? []), r]);
    }
    return [...m.entries()];
  }, [rekap, petugas]);

  if (rekap.length === 0) return <p className="py-8 text-center text-sm text-fg-muted">Belum ada input pada kunjungan ini.</p>;

  return (
    <div className="space-y-4">
      {grup.map(([label, rows]) => (
        <section key={label}>
          <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-fg-muted uppercase">{label} · {rows.length}</h4>
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface">
            {rows.map((r) => {
              const p = petugas[r.id];
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <AvatarStack ids={[r.id]} petugas={petugas} max={1} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{p?.nama ?? `#${r.id}`}</p>
                    <p className="text-[11px] text-fg-muted">
                      {p?.login && <span className="font-mono">{p.login}</span>}
                      {r.pertama && <> · {fmtWaktu(r.pertama)} – {fmtWaktu(r.terakhir)}</>}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {KATEGORI_KEYS.filter((k) => r.perKategori[k] > 0).map((k) => (
                      <Badge key={k} tone={KATEGORI_TONE[k]} className="px-2 text-[10px]">
                        {KATEGORI[k].short} {r.perKategori[k]}
                      </Badge>
                    ))}
                    {r.batal > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-medium text-danger">
                        <Ban className="size-2.5" /> {r.batal} batal
                      </span>
                    )}
                  </div>
                  <span className="w-10 text-right text-sm font-semibold tabular text-fg" title="Input aktif">{r.total}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- log */

function LogList({
  logs,
  petugas,
  terpotong,
  onOpenLog,
}: {
  logs: LogItem[];
  petugas: Record<string, Petugas>;
  terpotong: boolean;
  onOpenLog: (logId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/50 px-3 py-2 text-[11px] text-fg-muted">
        <Info className="mt-px size-3.5 shrink-0" />
        Log SIMGOS hanya mencatat perubahan & pembatalan; penambahan data tidak lagi tercatat sistem sumber. Data aktual tetap sumber utama kepatuhan.
      </p>
      {logs.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-muted">Tidak ada log untuk record kunjungan ini.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface">
          {logs.map((l) => (
            <li key={l.logId}>
              <button
                type="button"
                onClick={() => onOpenLog(l.logId)}
                className="flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-none"
              >
                <span className="w-24 shrink-0 font-mono text-xs text-fg-muted">{fmtWaktu(l.ts)}</span>
                <Badge tone={LOG_JENIS[l.jenis].tone} className="px-2 text-[10px]">{LOG_JENIS[l.jenis].label}</Badge>
                <span className="text-sm text-fg">{SUMBER[l.sumber].label}</span>
                <span className="font-mono text-[11px] text-fg-subtle">#{l.ref}</span>
                <span className="ml-auto inline-flex items-center gap-2 text-xs text-fg">
                  {petugas[l.oleh]?.nama ?? `#${l.oleh}`}
                  <AvatarStack ids={[l.oleh]} petugas={petugas} max={1} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {terpotong && <p className="text-[11px] text-fg-muted">Log sangat banyak — hanya entri terbaru yang ditampilkan.</p>}
    </div>
  );
}
