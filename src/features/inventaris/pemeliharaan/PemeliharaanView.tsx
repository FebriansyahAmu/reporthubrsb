"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle, CalendarCheck2, CalendarClock, CalendarX2, CircleSlash, Search, Wrench,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { DUE_LABEL, DUE_TONE, type DueStatus } from "@/server/modules/inventaris/pemeliharaan.schema";
import {
  fetchPemeliharaan, fetchPemeliharaanRefs,
  type PemeliharaanListMeta, type PemeliharaanRefs, type PemeliharaanRow,
} from "./pemeliharaan.client";
import { PemeliharaanModal } from "./PemeliharaanModal";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";
const PAGE_SIZE = 20;

const TILES: { key: DueStatus; label: string; icon: typeof CalendarX2; tone: "danger" | "warning" | "success" | "neutral" }[] = [
  { key: "overdue", label: "Jatuh tempo", icon: CalendarX2, tone: "danger" },
  { key: "soon", label: "Segera (≤30 hari)", icon: CalendarClock, tone: "warning" },
  { key: "scheduled", label: "Terjadwal", icon: CalendarCheck2, tone: "success" },
  { key: "none", label: "Belum dijadwalkan", icon: CircleSlash, tone: "neutral" },
];

export function PemeliharaanView({ canCreate, canUpdate }: { canCreate: boolean; canUpdate: boolean }) {
  const [searchInput, setSearchInput] = useState("");
  const [ruanganId, setRuanganId] = useState("");
  const [status, setStatus] = useState<DueStatus | "">("");
  const [page, setPage] = useState(1);
  const search = useDebounce(searchInput, 350);

  const [modalBarang, setModalBarang] = useState<PemeliharaanRow | null>(null);

  const refsState = useAsyncData<PemeliharaanRefs>(() => fetchPemeliharaanRefs(), []);
  const refs = refsState.result;

  const filterKey = `${search}|${ruanganId}|${status}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const { result, loading, error, reload } = useAsyncData<{ data: PemeliharaanRow[]; meta: PemeliharaanListMeta }>(
    () => fetchPemeliharaan({ search, ruanganId, status, page, pageSize: PAGE_SIZE }),
    [search, ruanganId, status, page],
  );
  const items = result?.data ?? [];
  const meta = result?.meta ?? null;
  const stats = meta?.stats;

  const ruanganOpts = useMemo<SelectOption[]>(
    () => [{ value: "", label: "Semua ruangan" }, ...(refs?.ruangan ?? []).map((r) => ({ value: r.id, label: `${r.kodePrefix} — ${r.nama}` }))],
    [refs],
  );

  return (
    <div className="space-y-4">
      {/* KPI tiles (juga sebagai filter status) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => {
          const Icon = t.icon;
          const active = status === t.key;
          const value = stats ? stats[t.key] : null;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatus((s) => (s === t.key ? "" : t.key))}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-lg)] border bg-surface p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                active ? "border-brand ring-1 ring-brand/30" : "border-border hover:border-brand/40 hover:shadow-sm",
              )}
              aria-pressed={active}
            >
              <span className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
                t.tone === "danger" && "bg-danger-soft text-danger",
                t.tone === "warning" && "bg-warning-soft text-warning",
                t.tone === "success" && "bg-success-soft text-success",
                t.tone === "neutral" && "bg-surface-2 text-fg-muted",
              )}>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-semibold text-fg tabular-nums">{value ?? "—"}</p>
                <p className="truncate text-xs text-fg-muted">{t.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Peringatan jatuh tempo */}
      {stats && stats.overdue > 0 && (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">{stats.overdue} barang</span> telah melewati jadwal pemeliharaan.
            {stats.soon > 0 && <> {stats.soon} lagi akan jatuh tempo dalam 30 hari.</>} Segera tindak lanjuti.
          </span>
        </div>
      )}

      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="cari">Cari barang</Label>
            <InputWithIcon id="cari" icon={<Search className="size-4" />} placeholder="Kode / nama / merk" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <div className="w-full sm:w-64">
            <Label>Ruangan</Label>
            <Select value={ruanganId} onChange={setRuanganId} options={ruanganOpts} />
          </div>
          {status && (
            <Button variant="secondary" size="md" onClick={() => setStatus("")}>
              Hapus filter: {DUE_LABEL[status]}
            </Button>
          )}
        </div>
      </Card>

      {/* Tabel */}
      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState title="Tidak ada barang" description="Tidak ada unit untuk filter ini." />
        ) : (
          <Table>
            <THead>
              <TH>Kode / Nama</TH>
              <TH className="hidden lg:table-cell">Ruangan</TH>
              <TH className="hidden md:table-cell">Kondisi</TH>
              <TH className="hidden sm:table-cell">Terakhir</TH>
              <TH>Jatuh Tempo</TH>
              <TH align="right">Aksi</TH>
            </THead>
            <TBody>
              {items.map((b) => (
                <TR key={b.id} className="cursor-pointer" onClick={() => setModalBarang(b)}>
                  <TD>
                    <p className="font-mono text-xs font-semibold text-brand">{b.kodeBarang}</p>
                    <p className="mt-0.5 font-medium text-fg">{b.nama}</p>
                    {b.merk && <p className="text-xs text-fg-subtle">{b.merk}</p>}
                  </TD>
                  <TD className="hidden text-sm text-fg-muted lg:table-cell">{b.ruangan.kodePrefix}</TD>
                  <TD className="hidden md:table-cell">
                    {b.kondisi ? <Badge tone={(b.kondisi.tone as Tone) || "neutral"} dot>{b.kondisi.nama}</Badge> : <span className="text-xs text-fg-subtle">—</span>}
                  </TD>
                  <TD className="hidden text-sm text-fg-muted sm:table-cell">
                    {b.terakhir ? formatDate(b.terakhir) : <span className="text-fg-subtle">Belum pernah</span>}
                  </TD>
                  <TD>
                    <div className="flex flex-col items-start gap-0.5">
                      <Badge tone={DUE_TONE[b.status]} dot>{DUE_LABEL[b.status]}</Badge>
                      {b.jatuhTempo && <span className="text-[11px] text-fg-subtle">{formatDate(b.jatuhTempo)}</span>}
                    </div>
                  </TD>
                  <TD align="right">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button variant="secondary" size="sm" icon={<Wrench className="size-3.5" />} onClick={() => setModalBarang(b)}>
                        {canCreate ? "Catat" : "Riwayat"}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {!loading && !error && meta && meta.total > 0 && <Pagination meta={meta} onPageChange={setPage} />}
      </Card>

      {modalBarang && refs && (
        <PemeliharaanModal
          key={modalBarang.id}
          barang={{ id: modalBarang.id, kodeBarang: modalBarang.kodeBarang, nama: modalBarang.nama }}
          refs={refs}
          canCreate={canCreate}
          canUpdate={canUpdate}
          onClose={() => setModalBarang(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3.5 w-48 rounded" />
          </div>
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}
