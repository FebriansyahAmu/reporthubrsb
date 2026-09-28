"use client";

import { useMemo, useState } from "react";
import { Ban, ChevronDown, Clock, History, PencilLine, TriangleAlert, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatLama } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { BadgeTone } from "@/server/modules/audit-rme/audit.constants";
import { hariDinasOf } from "@/server/modules/audit-rme/kepatuhan";
import {
  KATEGORI,
  KATEGORI_KEYS,
  SHIFTS,
  shiftOfHour,
  SUMBER,
  type KategoriKey,
  type ShiftKey,
} from "@/server/modules/audit-rme/kunjungan.constants";
import { fetchRekamIsi, type LogItem, type LogJenis, type Petugas, type RekamIsi, type RekamItem } from "./audit.client";
import { fmtWaktu } from "./KunjunganCardView";
import { AvatarStack } from "./MatriksShiftView";

export const KATEGORI_TONE: Record<KategoriKey, BadgeTone> = {
  ASESMEN: "brand",
  CPPT: "accent",
  TTV: "success",
  DIAGNOSIS: "warning",
  TINDAKAN: "neutral",
};

export const LOG_JENIS: Record<LogJenis, { label: string; tone: BadgeTone }> = {
  PENAMBAHAN: { label: "Penambahan", tone: "success" },
  PERUBAHAN: { label: "Perubahan", tone: "warning" },
  PEMBATALAN: { label: "Pembatalan", tone: "danger" },
};

/** Penyaring dari matriks: satu hari dinas (opsional satu shift). */
export type SelFilter = { tanggal: string; shift?: ShiftKey; hariKe: number } | null;

type Mode = "SEMUA" | "BATAL" | "MASALAH";

const tglFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const jam = (w: string | null) => (w ? w.slice(11, 16).replace(":", ".") : "—");
const bermasalah = (r: RekamItem) => r.batal || r.terlambatMenit != null || r.peringatan != null;

export function RekamList({
  records,
  petugas,
  sel,
  onClearSel,
  onOpenLog,
}: {
  records: RekamItem[];
  petugas: Record<string, Petugas>;
  sel: SelFilter;
  onClearSel: () => void;
  onOpenLog: (logId: string) => void;
}) {
  const [kategori, setKategori] = useState<KategoriKey | "SEMUA">("SEMUA");
  const [mode, setMode] = useState<Mode>("SEMUA");
  const [buka, setBuka] = useState<string | null>(null);

  // Record dalam jendela matriks terpilih (hari dinas + shift).
  const dalamSel = useMemo(() => {
    if (!sel) return records;
    return records.filter((r) => {
      if (!r.waktu || hariDinasOf(r.waktu) !== sel.tanggal) return false;
      return !sel.shift || shiftOfHour(Number(r.waktu.slice(11, 13))) === sel.shift;
    });
  }, [records, sel]);

  const hitung = useMemo(() => {
    const per = Object.fromEntries(KATEGORI_KEYS.map((k) => [k, 0])) as Record<KategoriKey, number>;
    for (const r of dalamSel) per[r.kategori]++;
    return { per, batal: dalamSel.filter((r) => r.batal).length, masalah: dalamSel.filter(bermasalah).length };
  }, [dalamSel]);

  const tampil = useMemo(
    () =>
      dalamSel.filter(
        (r) =>
          (kategori === "SEMUA" || r.kategori === kategori) &&
          (mode === "SEMUA" || (mode === "BATAL" ? r.batal : bermasalah(r))),
      ),
    [dalamSel, kategori, mode],
  );

  const grup = useMemo(() => {
    const out: { tanggal: string; rows: RekamItem[] }[] = [];
    for (const r of tampil) {
      const t = r.waktu?.slice(0, 10) ?? "—";
      const last = out[out.length - 1];
      if (last && last.tanggal === t) last.rows.push(r);
      else out.push({ tanggal: t, rows: [r] });
    }
    return out;
  }, [tampil]);

  return (
    <div className="space-y-3">
      {sel && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-brand/30 bg-brand-soft px-3 py-2 text-xs text-brand">
          <Clock className="size-3.5" />
          Menampilkan input H{sel.hariKe} ({tglFmt.format(new Date(`${sel.tanggal}T00:00:00Z`))})
          {sel.shift ? ` · shift ${SHIFTS.find((s) => s.key === sel.shift)?.label}` : " · seluruh hari dinas"}
          <button type="button" onClick={onClearSel} className="ml-auto inline-flex items-center gap-1 font-medium hover:underline" aria-label="Hapus penyaring matriks">
            <X className="size-3.5" /> Semua waktu
          </button>
        </div>
      )}

      {/* Penyaring */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={kategori === "SEMUA"} onClick={() => setKategori("SEMUA")} label="Semua" n={dalamSel.length} />
        {KATEGORI_KEYS.map((k) => (
          <Chip key={k} active={kategori === k} onClick={() => setKategori(k)} label={KATEGORI[k].label} n={hitung.per[k]} disabled={hitung.per[k] === 0} />
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Chip active={mode === "BATAL"} onClick={() => setMode(mode === "BATAL" ? "SEMUA" : "BATAL")} label="Batal" n={hitung.batal} tone="danger" disabled={hitung.batal === 0} />
        <Chip
          active={mode === "MASALAH"}
          onClick={() => setMode(mode === "MASALAH" ? "SEMUA" : "MASALAH")}
          label="Perlu perhatian"
          n={hitung.masalah}
          tone="warning"
          disabled={hitung.masalah === 0}
        />
      </div>

      {tampil.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-border py-8 text-center text-sm text-fg-muted">Tidak ada input pada penyaring ini.</p>
      ) : (
        grup.map((g) => (
          <section key={g.tanggal} aria-label={g.tanggal}>
            <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
              {g.tanggal === "—" ? "Tanpa waktu" : tglFmt.format(new Date(`${g.tanggal}T00:00:00Z`))} · {g.rows.length}
            </h4>
            <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface">
              {g.rows.map((r) => {
                const key = `${r.sumber}:${r.id}`;
                return (
                  <RekamRow
                    key={key}
                    r={r}
                    petugas={petugas}
                    open={buka === key}
                    onToggle={() => setBuka(buka === key ? null : key)}
                    onOpenLog={onOpenLog}
                  />
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function RekamRow({
  r,
  petugas,
  open,
  onToggle,
  onOpenLog,
}: {
  r: RekamItem;
  petugas: Record<string, Petugas>;
  open: boolean;
  onToggle: () => void;
  onOpenLog: (logId: string) => void;
}) {
  const p = r.oleh ? petugas[r.oleh] : undefined;
  const pembatal = r.batalOleh ? petugas[r.batalOleh.oleh] : undefined;
  return (
    <li className={cn(r.batal && "bg-danger-soft/25")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-none"
      >
        <span className="w-10 shrink-0 pt-0.5 font-mono text-xs text-fg-muted tabular">{jam(r.waktu)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={KATEGORI_TONE[r.kategori]} className="px-2 text-[10px]">{KATEGORI[r.kategori].short}</Badge>
            <span className={cn("text-sm font-medium text-fg", r.batal && "line-through decoration-danger/60")}>
              {SUMBER[r.sumber].label}
              {r.peran && <span className="font-normal text-fg-muted"> · {r.peran}</span>}
              {r.episode && <span className="font-normal text-fg-subtle"> · episode</span>}
            </span>
            {r.tarif && (
              <span
                className="rounded-full bg-surface-2 px-1.5 text-[10px] font-medium text-fg-muted ring-1 ring-border ring-inset"
                title={`Item tarif (${r.tarif}) — tidak dihitung sebagai Tindakan pada skor petugas`}
              >
                item tarif
              </span>
            )}
            {r.edit > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-warning-soft px-1.5 text-[10px] font-medium text-warning" title={`${r.edit} kali diubah (log)`}>
                <PencilLine className="size-2.5" /> {r.edit}×
              </span>
            )}
          </div>
          {r.ringkasan && <p className={cn("mt-0.5 truncate text-xs text-fg-muted", r.batal && "line-through")}>{r.ringkasan}</p>}
          {r.batal && (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-danger">
              <Ban className="size-3" />
              {r.batalOleh ? <>Dibatalkan oleh {pembatal?.nama ?? `#${r.batalOleh.oleh}`} · {fmtWaktu(r.batalOleh.ts)}</> : "Batal/dihapus (pelaku tidak tercatat di log)"}
            </p>
          )}
          {r.terlambatMenit != null && (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-warning">
              <Clock className="size-3" /> Diinput {formatLama(r.terlambatMenit)} setelah pemeriksaan ({fmtWaktu(r.waktuInput)})
            </p>
          )}
          {r.peringatan && (
            <p className="mt-1 flex items-start gap-1 text-[11px] font-medium text-danger">
              <TriangleAlert className="mt-px size-3 shrink-0" /> Nilai tak wajar: {r.peringatan}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="max-w-40 truncate text-xs text-fg">{p?.nama ?? (r.oleh ? `#${r.oleh}` : "—")}</p>
            <p className="text-[10px] text-fg-muted">{p?.profesiLabel ?? ""}</p>
          </div>
          {r.oleh && <AvatarStack ids={[r.oleh]} petugas={petugas} max={1} />}
          <ChevronDown className={cn("size-4 text-fg-subtle transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && <RekamDetail r={r} onOpenLog={onOpenLog} />}
    </li>
  );
}

function RekamDetail({ r, onOpenLog }: { r: RekamItem; onOpenLog: (logId: string) => void }) {
  const { result, loading, error, reload } = useAsyncData<RekamIsi>(() => fetchRekamIsi(r.sumber, r.id), [r.sumber, r.id]);

  return (
    <div className="border-t border-border bg-surface-2/40 px-3 py-3 sm:pl-16">
      {loading && !result ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-12 rounded" />
        </div>
      ) : error || !result ? (
        <ErrorState onRetry={reload} />
      ) : (
        <div className="space-y-3">
          {result.fields.length === 0 ? (
            <p className="text-xs text-fg-muted">Tidak ada isi tercatat pada record ini.</p>
          ) : (
            <dl className="grid gap-2">
              {result.fields.map((f) => (
                <div key={f.key} className="rounded-md bg-surface px-2.5 py-1.5">
                  <dt className="text-[10px] font-semibold tracking-wide text-fg-muted uppercase">{f.label}</dt>
                  <dd className="mt-0.5 max-h-40 overflow-y-auto text-xs whitespace-pre-wrap text-fg">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <LogMini logs={result.logs} petugas={result.petugas} onOpenLog={onOpenLog} />
          <p className="font-mono text-[10px] text-fg-subtle">{SUMBER[r.sumber].tabel} · ID {r.id}</p>
        </div>
      )}
    </div>
  );
}

function LogMini({ logs, petugas, onOpenLog }: { logs: LogItem[]; petugas: Record<string, Petugas>; onOpenLog: (logId: string) => void }) {
  return (
    <div>
      <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-fg"><History className="size-3.5" /> Riwayat log ({logs.length})</p>
      {logs.length === 0 ? (
        <p className="text-[11px] text-fg-muted">Tidak ada jejak di log SIMGOS untuk record ini (penambahan tidak lagi dicatat sistem sumber).</p>
      ) : (
        <ul className="space-y-1">
          {logs.map((l) => (
            <li key={l.logId}>
              <button
                type="button"
                onClick={() => onOpenLog(l.logId)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              >
                <Badge tone={LOG_JENIS[l.jenis].tone} className="px-1.5 text-[10px]">{LOG_JENIS[l.jenis].label}</Badge>
                <span className="text-fg">{petugas[l.oleh]?.nama ?? `#${l.oleh}`}</span>
                <span className="ml-auto font-mono text-fg-muted">{fmtWaktu(l.ts)}</span>
                <span className="font-medium text-brand">Lihat perubahan</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  n,
  tone,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  n: number;
  tone?: "danger" | "warning";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled && !active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40",
        active
          ? tone === "danger"
            ? "border-danger bg-danger text-white"
            : tone === "warning"
              ? "border-warning bg-warning text-white"
              : "border-brand bg-brand text-white"
          : "border-border bg-surface text-fg-muted hover:text-fg",
      )}
    >
      {label}
      <span className={cn("tabular", active ? "text-white/80" : "text-fg-subtle")}>{n}</span>
    </button>
  );
}
