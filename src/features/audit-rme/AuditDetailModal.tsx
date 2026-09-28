"use client";

import { useState } from "react";
import { ArrowRight, Ban, Clock, Hash, Table2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { JENIS_LABEL, JENIS_TONE, type BadgeTone } from "@/server/modules/audit-rme/audit.constants";
import { fetchEventDetail, type DiffField, type DiffStatus, type EventDetail } from "./audit.client";

const STATUS_LABEL: Record<DiffStatus, string> = {
  added: "Ditambahkan",
  removed: "Dihapus",
  changed: "Diubah",
  unchanged: "Tetap",
};
const STATUS_TONE: Record<DiffStatus, BadgeTone> = {
  added: "success",
  removed: "danger",
  changed: "warning",
  unchanged: "neutral",
};

/** Detail satu baris log (diff SEBELUM→SESUDAH). `logId` null = tertutup. */
export function AuditDetailModal({ logId, onClose }: { logId: string | null; onClose: () => void }) {
  return (
    <Modal open={!!logId} onClose={onClose} title="Detail Aktivitas" description="Perubahan data terekam (read-only)" size="lg">
      {logId ? <DetailBody key={logId} logId={logId} /> : null}
    </Modal>
  );
}

function DetailBody({ logId }: { logId: string }) {
  const { result, loading, error, reload } = useAsyncData<EventDetail>(() => fetchEventDetail(logId), [logId]);
  const [showAll, setShowAll] = useState(false);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded" />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded" />)}
      </div>
    );
  }
  if (error || !result) return <ErrorState onRetry={reload} />;

  const d = result;
  const tone = JENIS_TONE[d.jenis];
  const nama = d.pengguna.nama || d.pengguna.login || `#${d.pengguna.id}`;
  const visible = showAll ? d.fields : d.fields.filter((f) => f.status !== "unchanged");

  return (
    <div className="space-y-4">
      {/* Meta */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface-2/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone} dot>{JENIS_LABEL[d.jenis]}</Badge>
          {d.softDelete && (
            <Badge tone="danger">
              <Ban className="mr-1 size-3" /> Nonaktif / pembatalan
            </Badge>
          )}
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand">
            <Table2 className="size-4" /> {d.objek.label}
          </span>
          <span className="font-mono text-xs text-fg-subtle">{d.objek.tabel}</span>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-fg-muted sm:grid-cols-2">
          <span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5" /> {nama}{d.pengguna.login ? ` · ${d.pengguna.login}` : ""}</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" /> {formatDateTime(d.ts)}</span>
          {d.ref && <span className="inline-flex items-center gap-1.5"><Hash className="size-3.5" /> Ref <span className="font-mono text-fg">{d.ref}</span></span>}
        </div>
      </div>

      {/* Diff */}
      {d.isCreate ? (
        <div className="rounded-[var(--radius-md)] border border-success/30 bg-success-soft/30 px-3 py-3 text-sm text-fg">
          Record baru ditambahkan{d.ref ? <> dengan referensi <span className="font-mono">{d.ref}</span></> : null}.
          {!d.hasSnapshot && <span className="mt-1 block text-xs text-fg-muted">Sistem sumber tidak menyimpan rincian nilai untuk aktivitas penambahan.</span>}
        </div>
      ) : d.fields.length === 0 ? (
        <p className="py-3 text-center text-sm text-fg-subtle">Tidak ada rincian perubahan tercatat.</p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-fg-muted">
              {d.changedCount} field berubah{d.fields.length > d.changedCount ? ` · ${d.fields.length - d.changedCount} tetap` : ""}
            </p>
            {d.fields.length > d.changedCount && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-xs font-medium text-brand transition-colors hover:underline focus-visible:outline-none"
              >
                {showAll ? "Sembunyikan yang tetap" : "Tampilkan semua field"}
              </button>
            )}
          </div>
          {d.changedCount === 0 && !showAll ? (
            <p className="py-2 text-center text-sm text-fg-subtle">Tidak ada nilai yang berubah.</p>
          ) : (
            <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-0.5">
              {visible.map((f) => <FieldDiff key={f.key} f={f} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FieldDiff({ f }: { f: DiffField }) {
  return (
    <li className="rounded-[var(--radius-md)] border border-border p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-fg">{f.label}</span>
        <Badge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</Badge>
      </div>
      {f.status === "unchanged" ? (
        <ValueBlock tone="neutral" value={f.after ?? f.before} />
      ) : (
        <div className="space-y-1">
          {f.before != null && <ValueBlock tone="danger" label="Sebelum" value={f.before} />}
          {f.status === "changed" && (
            <div className="flex justify-center py-0.5 text-fg-subtle"><ArrowRight className="size-3.5 rotate-90" /></div>
          )}
          {f.after != null && <ValueBlock tone="success" label="Sesudah" value={f.after} />}
        </div>
      )}
    </li>
  );
}

function ValueBlock({ tone, label, value }: { tone: "danger" | "success" | "neutral"; label?: string; value: string | null }) {
  const bg =
    tone === "danger" ? "bg-danger-soft/40" : tone === "success" ? "bg-success-soft/40" : "bg-surface-2/60";
  return (
    <div className={cn("rounded px-2 py-1.5 text-xs", bg)}>
      {label && <span className="mr-1.5 font-medium text-fg-subtle">{label}</span>}
      <span className="whitespace-pre-wrap break-words text-fg">{value && value.length ? value : "—"}</span>
    </div>
  );
}
