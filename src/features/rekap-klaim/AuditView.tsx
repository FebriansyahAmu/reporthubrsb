"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, ChevronLeft, ChevronRight, History, Pencil, Plus, ReceiptText, Scissors,
  Search, Trash2, Upload, User,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  BULAN_LABEL,
  JENIS_KLAIM_LABEL, JENIS_LAYANAN_LABEL, KATEGORI_KLAIM_LABEL,
  POTONGAN_JENIS_LABEL, STATUS_KLAIM_LABEL,
  type JenisKlaim, type JenisLayanan, type KategoriKlaim, type PotonganJenis, type StatusKlaim,
} from "@/server/modules/rekap-klaim/klaim.schema";
import { fetchKlaimAudit, type AuditActionType, type AuditItem, type AuditQuery, type FieldDiff } from "./audit.client";

type Tone = "success" | "brand" | "danger" | "accent" | "neutral";
const ACTION_META: Record<AuditActionType, { label: string; tone: Tone; icon: LucideIcon }> = {
  create: { label: "Dibuat", tone: "success", icon: Plus },
  update: { label: "Diubah", tone: "brand", icon: Pencil },
  delete: { label: "Dihapus", tone: "danger", icon: Trash2 },
  import: { label: "Impor", tone: "accent", icon: Upload },
  other: { label: "Lainnya", tone: "neutral", icon: History },
};
const ENTITY_LABEL: Record<string, string> = { klaim: "Klaim", potongan: "Potongan", lainnya: "Lainnya" };
const TONE_BOX: Record<Tone, string> = {
  success: "bg-success-soft text-success", brand: "bg-brand-soft text-brand",
  danger: "bg-danger-soft text-danger", accent: "bg-accent-soft text-accent", neutral: "bg-surface-2 text-fg-muted",
};

const FIELD_LABEL: Record<string, string> = {
  nomorKlaim: "Nomor Klaim", jenisKlaim: "Jenis", jenisLayanan: "Layanan", kategori: "Kategori",
  bulanPelayanan: "Bulan", tahunPelayanan: "Tahun", jumlah: "Jumlah Diterima", jumlahDiajukan: "Jumlah Diajukan",
  jumlahKasus: "Kasus", tglMasukRekening: "Tgl Masuk Rek.", status: "Status", refBa: "No. BA", catatan: "Catatan",
  jenis: "Jenis Potongan", cicilanKe: "Cicilan Ke", totalCicilan: "Total Cicilan", deskripsi: "Deskripsi", tglTerapkan: "Tgl Terapkan",
};

function fmtVal(field: string, v: string | number | boolean | null): string {
  if (v == null || v === "") return "—";
  const s = String(v);
  switch (field) {
    case "jumlah": case "jumlahDiajukan": return formatRupiah(Number(v));
    case "jenisKlaim": return JENIS_KLAIM_LABEL[s as JenisKlaim] ?? s;
    case "jenisLayanan": return JENIS_LAYANAN_LABEL[s as JenisLayanan] ?? s;
    case "kategori": return KATEGORI_KLAIM_LABEL[s as KategoriKlaim] ?? s;
    case "status": return STATUS_KLAIM_LABEL[s as StatusKlaim] ?? s;
    case "jenis": return POTONGAN_JENIS_LABEL[s as PotonganJenis] ?? s;
    case "bulanPelayanan": return BULAN_LABEL[Number(v) - 1] ?? s;
    default: return s;
  }
}

const opt = (placeholder: string, opts: SelectOption[]): SelectOption[] => [{ value: "", label: placeholder }, ...opts];
const today = new Date().toISOString().slice(0, 10);

export function AuditView() {
  const [entity, setEntity] = useState("");
  const [aksi, setAksi] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounce(search, 300);
  const [page, setPage] = useState(1);

  const reset1 = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  const query: AuditQuery = {
    page,
    entity: (entity || undefined) as AuditQuery["entity"],
    aksi: (aksi || undefined) as AuditQuery["aksi"],
    actor: actor || undefined,
    q: q || undefined,
    from: from || undefined,
    to: to || undefined,
  };
  const state = useAsyncData(() => fetchKlaimAudit(query), [page, entity, aksi, actor, q, from, to]);
  const rows = state.result?.data ?? [];
  const meta = state.result?.meta;

  const hasFilter = !!(entity || aksi || actor || from || to || search);
  const resetFilter = () => { setEntity(""); setAksi(""); setActor(""); setFrom(""); setTo(""); setSearch(""); setPage(1); };

  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;
  const actorOpts = (meta?.actorTersedia ?? []).map((a) => ({ value: a, label: a }));

  return (
    <div className="space-y-4">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={History} tone="neutral" label="Total Aktivitas" value={meta ? String(meta.counts.total) : "—"} />
        <Tile icon={Plus} tone="success" label="Dibuat" value={meta ? String(meta.counts.create) : "—"} />
        <Tile icon={Pencil} tone="brand" label="Diubah" value={meta ? String(meta.counts.update) : "—"} />
        <Tile icon={Trash2} tone="danger" label="Dihapus" value={meta ? String(meta.counts.delete) : "—"} />
      </div>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1">
            <Label className="text-[11px]">Cari</Label>
            <InputWithIcon icon={<Search className="size-4" />} value={search} placeholder="Pelaku / ID target / aksi…" onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <FilterSelect label="Entitas" value={entity} onChange={reset1(setEntity)} options={opt("Semua entitas", [{ value: "klaim", label: "Klaim" }, { value: "potongan", label: "Potongan" }])} />
          <FilterSelect label="Aksi" value={aksi} onChange={reset1(setAksi)} options={opt("Semua aksi", [{ value: "create", label: "Dibuat" }, { value: "update", label: "Diubah" }, { value: "delete", label: "Dihapus" }, { value: "import", label: "Impor" }])} />
          <FilterSelect label="Pelaku" value={actor} onChange={reset1(setActor)} options={opt("Semua pelaku", actorOpts)} />
          <div className="min-w-[8.5rem]">
            <Label className="text-[11px]">Dari</Label>
            <DatePicker value={from} onChange={reset1(setFrom)} max={to || today} placeholder="Awal" />
          </div>
          <div className="min-w-[8.5rem]">
            <Label className="text-[11px]">Sampai</Label>
            <DatePicker value={to} onChange={reset1(setTo)} min={from || undefined} max={today} placeholder="Akhir" />
          </div>
          {hasFilter && <Button variant="ghost" size="sm" onClick={resetFilter} className="mb-0.5">Reset</Button>}
        </div>
      </Card>

      {/* Daftar */}
      <Card className="p-0">
        {state.loading && !meta ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-[var(--radius-md)]" />)}
          </div>
        ) : state.error ? (
          <ErrorState onRetry={state.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={hasFilter ? "Tidak ada aktivitas yang cocok" : "Belum ada aktivitas"}
            description={hasFilter ? "Coba ubah / reset filter." : "Perubahan data klaim & potongan akan tercatat di sini."}
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((it) => <AuditRow key={it.id} item={it} />)}
          </ul>
        )}
      </Card>

      {/* Paginasi */}
      {meta && meta.total > 0 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs text-fg-muted">
            Halaman {meta.page} / {totalPages} · <span className="tabular-nums">{meta.total}</span> aktivitas
          </p>
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" icon={<ChevronLeft className="size-4" />} disabled={meta.page <= 1 || state.loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Sebelumnya</Button>
            <Button variant="secondary" size="sm" disabled={meta.page >= totalPages || state.loading} onClick={() => setPage((p) => p + 1)}>Berikutnya<ChevronRight className="size-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- sub-komponen */

function AuditRow({ item }: { item: AuditItem }) {
  const am = ACTION_META[item.actionType];
  const Icon = am.icon;
  const EntityIcon = item.entity === "potongan" ? Scissors : ReceiptText;
  return (
    <li className="flex gap-3 p-4">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]", TONE_BOX[am.tone])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={am.tone} dot>{am.label}</Badge>
          <Badge tone="neutral" className="gap-1"><EntityIcon className="size-3" /> {ENTITY_LABEL[item.entity]}</Badge>
          <span className="ml-auto text-[11px] text-fg-subtle tabular-nums">{formatDateTime(item.createdAt)}</span>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1"><User className="size-3" /> <span className="font-medium text-fg">{item.actorName ?? "—"}</span></span>
          {item.targetId && <span className="font-mono text-[11px] text-fg-subtle">#{item.targetId.slice(0, 10)}</span>}
          {item.klaimId && <span className="text-[11px] text-fg-subtle">klaim #{item.klaimId.slice(0, 8)}</span>}
        </p>

        {/* Detail perubahan */}
        {item.actionType === "update" && item.diffs.length > 0 ? (
          <DiffList diffs={item.diffs} />
        ) : (item.actionType === "create" || item.actionType === "delete") && item.data ? (
          <Snapshot data={item.data} />
        ) : item.diffs.length > 0 ? (
          <DiffList diffs={item.diffs} />
        ) : null}
      </div>
    </li>
  );
}

function DiffList({ diffs }: { diffs: FieldDiff[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {diffs.map((d) => (
        <li key={d.field} className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="min-w-[7rem] font-medium text-fg-muted">{FIELD_LABEL[d.field] ?? d.field}</span>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-fg-subtle line-through">{fmtVal(d.field, d.lama)}</span>
          <ArrowRight className="size-3 text-fg-subtle" />
          <span className="rounded bg-brand-soft px-1.5 py-0.5 font-medium text-brand">{fmtVal(d.field, d.baru)}</span>
        </li>
      ))}
    </ul>
  );
}

function Snapshot({ data }: { data: Record<string, string | number | boolean | null> }) {
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-surface-2/40 px-1.5 py-0.5 text-[11px]">
          <span className="text-fg-subtle">{FIELD_LABEL[k] ?? k}</span>
          <span className="font-medium text-fg">{fmtVal(k, v)}</span>
        </span>
      ))}
    </div>
  );
}

function Tile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: Tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <div className={cn("flex size-8 items-center justify-center rounded-[var(--radius-md)]", TONE_BOX[tone])}><Icon className="size-4" /></div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</p>
    </Card>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: SelectOption[] }) {
  return (
    <div className="min-w-[8.5rem]">
      <Label className="text-[11px]">{label}</Label>
      <Select value={value} onChange={onChange} options={options} />
    </div>
  );
}
