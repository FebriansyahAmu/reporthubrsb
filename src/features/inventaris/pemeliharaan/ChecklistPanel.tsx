"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Circle, ClipboardCheck, Download, RotateCcw, Search, UserCheck,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, InputWithIcon, Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { Stagger, StaggerItem } from "@/components/motion/Motion";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { downloadFromEndpoint } from "@/lib/download";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { FREKUENSI_LABEL, type Frekuensi } from "@/server/modules/inventaris/checklist.schema";
import { FrekuensiTabs } from "./FrekuensiTabs";
import {
  completeChecklist, exportChecklistUrl, fetchChecklist, periksaBarang,
  type ChecklistOverview, type ChecklistRefs,
} from "./checklist.client";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";

export function ChecklistPanel({
  ruanganId,
  frekuensi,
  setFrekuensi,
  refs,
  canCreate,
}: {
  ruanganId: string;
  frekuensi: Frekuensi;
  setFrekuensi: (f: Frekuensi) => void;
  refs: ChecklistRefs | null;
  canCreate: boolean;
}) {
  const toast = useToast();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 250);
  const [rowBusy, setRowBusy] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { result, loading, error, reload } = useAsyncData<ChecklistOverview | null>(
    () => (ruanganId ? fetchChecklist({ ruanganId, frekuensi }) : Promise.resolve(null)),
    [ruanganId, frekuensi],
  );

  // Salin overview ke state lokal untuk pembaruan optimistik.
  const [ov, setOv] = useState<ChecklistOverview | null>(null);
  const [ovRef, setOvRef] = useState<ChecklistOverview | null>(null);
  if (result && result !== ovRef) {
    setOvRef(result);
    setOv(result);
  }

  const rows = useMemo(() => ov?.rows ?? [], [ov]);
  const total = ov?.total ?? 0;
  const done = rows.filter((r) => r.checked).length;
  const selesai = ov?.selesai ?? false;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const kondisiOpts = useMemo<SelectOption[]>(
    () => [{ value: "", label: "— Pilih kondisi —" }, ...(refs?.kondisi ?? []).map((k) => ({ value: k.id, label: k.nama }))],
    [refs],
  );

  const stats = ov
    ? {
        HARIAN: frekuensi === "HARIAN" ? { done, total } : ov.stats.harian,
        MINGGUAN: frekuensi === "MINGGUAN" ? { done, total } : ov.stats.mingguan,
        BULANAN: frekuensi === "BULANAN" ? { done, total } : ov.stats.bulanan,
      }
    : undefined;

  const visibleRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.kodeBarang.toLowerCase().includes(s) || r.nama.toLowerCase().includes(s) || (r.merk ?? "").toLowerCase().includes(s));
  }, [rows, search]);

  function patchRow(barangId: string, patch: Partial<(typeof rows)[number]>) {
    setOv((o) => (o ? { ...o, rows: o.rows.map((r) => (r.barangId === barangId ? { ...r, ...patch } : r)) } : o));
  }
  const setBusy = (id: string, on: boolean) =>
    setRowBusy((b) => {
      const n = new Set(b);
      if (on) n.add(id); else n.delete(id);
      return n;
    });

  async function savePeriksa(barangId: string, next: { checked: boolean; kondisiId: string | null; catatan: string | null }) {
    if (!ruanganId) return;
    patchRow(barangId, {
      checked: next.checked,
      kondisiId: next.checked ? next.kondisiId : null,
      catatan: next.checked ? next.catatan : null,
      kondisiSaatIni: next.checked && next.kondisiId
        ? (refs?.kondisi.find((k) => k.id === next.kondisiId) ?? ov?.rows.find((r) => r.barangId === barangId)?.kondisiSaatIni ?? null)
        : ov?.rows.find((r) => r.barangId === barangId)?.kondisiSaatIni ?? null,
    });
    setBusy(barangId, true);
    try {
      const st = await periksaBarang({
        ruanganId, frekuensi, barangId,
        checked: next.checked,
        kondisiId: next.checked ? next.kondisiId ?? undefined : undefined,
        catatan: next.checked ? next.catatan ?? undefined : undefined,
      });
      patchRow(barangId, { checkedAt: st.checkedAt, checkedBy: next.checked ? ov?.rows.find((r) => r.barangId === barangId)?.checkedBy ?? null : null });
      setOv((o) => (o ? { ...o, selesai: st.selesai, selesaiAt: st.selesaiAt, selesaiBy: st.selesaiBy } : o));
      if (st.selesai && !selesai) toast.success("Checklist selesai", `Semua ${st.total} barang telah diperiksa.`);
    } catch (e) {
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
      reload();
    } finally {
      setBusy(barangId, false);
    }
  }

  function toggleRow(barangId: string) {
    const r = rows.find((x) => x.barangId === barangId);
    if (!r) return;
    savePeriksa(barangId, { checked: !r.checked, kondisiId: r.kondisiId, catatan: r.catatan });
  }
  function setKondisi(barangId: string, kondisiId: string) {
    const r = rows.find((x) => x.barangId === barangId);
    if (!r) return;
    savePeriksa(barangId, { checked: true, kondisiId: kondisiId || null, catatan: r.catatan });
  }
  function setCatatan(barangId: string, catatan: string) {
    const r = rows.find((x) => x.barangId === barangId);
    if (!r) return;
    if ((r.catatan ?? "") === catatan) return;
    savePeriksa(barangId, { checked: true, kondisiId: r.kondisiId, catatan: catatan || null });
  }

  async function doComplete(makeSelesai: boolean) {
    if (!ruanganId) return;
    setOv((o) =>
      o ? { ...o, selesai: makeSelesai, rows: o.rows.map((r) => ({ ...r, checked: makeSelesai, kondisiId: makeSelesai ? r.kondisiId : null })) } : o);
    setCompleting(true);
    try {
      const st = await completeChecklist({ ruanganId, frekuensi, selesai: makeSelesai });
      setOv((o) => (o ? { ...o, selesai: st.selesai, selesaiAt: st.selesaiAt, selesaiBy: st.selesaiBy } : o));
      if (makeSelesai) toast.success("Selesai", `${ov?.ruangan.nama ?? "Ruangan"} — checklist ${FREKUENSI_LABEL[frekuensi].toLowerCase()} ditandai selesai.`);
      else toast.info("Dibatalkan", "Checklist ditandai belum selesai.");
    } catch (e) {
      toast.error("Gagal", e instanceof Error ? e.message : undefined);
      reload();
    } finally {
      setCompleting(false);
    }
  }

  async function doExport() {
    if (!ruanganId) return;
    setExporting(true);
    try {
      await downloadFromEndpoint(exportChecklistUrl({ ruanganId, frekuensi, mode: "periode" }), `Checklist_${frekuensi}.xlsx`);
    } catch (e) {
      toast.error("Gagal mengekspor", e instanceof Error ? e.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <FrekuensiTabs value={frekuensi} onChange={setFrekuensi} stats={stats} />

      {/* Header periode + progress + aksi */}
      {ov && (
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="size-4 shrink-0 text-brand" />
                <h2 className="text-sm font-semibold text-fg">Checklist {FREKUENSI_LABEL[frekuensi]}</h2>
                {selesai ? <Badge tone="success" dot>Selesai</Badge> : <Badge tone="neutral" dot>Berjalan</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-fg-muted">
                {ov.periodeLabel}
                {selesai && ov.selesaiBy ? ` · oleh ${ov.selesaiBy}${ov.selesaiAt ? ` (${formatTime(ov.selesaiAt)})` : ""}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={doExport} loading={exporting} disabled={total === 0}>
                Ekspor
              </Button>
              {canCreate && total > 0 && (
                selesai ? (
                  <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => doComplete(false)} loading={completing}>
                    Batalkan selesai
                  </Button>
                ) : (
                  <Button size="sm" icon={<CheckCircle2 className="size-4" />} onClick={() => doComplete(true)} loading={completing}>
                    Tandai Semua Selesai
                  </Button>
                )
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-fg-muted">
              <span>{done} dari {total} barang diperiksa</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div className={cn("h-full rounded-full transition-all duration-500", selesai ? "bg-success" : "bg-brand")} style={{ width: `${pct}%` }} />
            </div>
          </div>
          {ov.terlewat && (
            <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>Checklist {FREKUENSI_LABEL[frekuensi].toLowerCase()} periode sebelumnya tidak diselesaikan.</span>
            </div>
          )}
        </Card>
      )}

      {/* Cari barang */}
      {ov && total > 0 && (
        <div className="w-full sm:max-w-xs">
          <Label htmlFor="cl-cari" className="sr-only">Cari barang</Label>
          <InputWithIcon id="cl-cari" icon={<Search className="size-4" />} placeholder="Cari kode / nama / merk" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
      )}

      {/* Kartu barang */}
      {loading ? (
        <CardsSkeleton />
      ) : error ? (
        <Card className="overflow-hidden"><ErrorState onRetry={reload} /></Card>
      ) : !ov || total === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState title="Belum ada barang" description="Ruangan ini belum memiliki unit barang di Master Barang. Tambahkan barang terlebih dahulu." />
        </Card>
      ) : visibleRows.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState title="Tidak ada hasil" description="Tidak ada barang yang cocok dengan pencarian." />
        </Card>
      ) : (
        <Stagger key={frekuensi} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleRows.map((r) => {
            const busy = rowBusy.has(r.barangId);
            return (
              <StaggerItem key={r.barangId}>
                <div
                  className={cn(
                    "flex h-full flex-col rounded-[var(--radius-lg)] border p-4 transition-all",
                    r.checked ? "border-success/40 bg-success-soft/25" : "border-border bg-surface hover:border-brand/40 hover:shadow-sm",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      disabled={!canCreate || busy}
                      onClick={() => toggleRow(r.barangId)}
                      aria-pressed={r.checked}
                      title={r.checked ? "Batal periksa" : "Tandai diperiksa"}
                      className={cn(
                        "-m-1 flex shrink-0 items-center justify-center rounded-full p-1 transition-transform",
                        (!canCreate || busy) ? "cursor-default opacity-70" : "hover:scale-110 active:scale-95",
                      )}
                    >
                      {r.checked ? <CheckCircle2 className="size-6 text-success" /> : <Circle className="size-6 text-fg-subtle" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-semibold text-brand">{r.kodeBarang}</p>
                      <p className="mt-0.5 font-medium leading-snug text-fg">{r.nama}</p>
                      {r.merk && <p className="truncate text-xs text-fg-subtle">{r.merk}</p>}
                    </div>
                    {r.kondisiSaatIni && (
                      <Badge tone={(r.kondisiSaatIni.tone as Tone) || "neutral"} dot className="shrink-0">
                        {r.kondisiSaatIni.nama}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    <div>
                      <Label className="mb-1 block text-[11px] font-medium text-fg-muted">Kondisi hasil periksa</Label>
                      <Select
                        value={r.kondisiId ?? ""}
                        onChange={(v) => setKondisi(r.barangId, v)}
                        options={kondisiOpts}
                        disabled={!canCreate || busy}
                      />
                    </div>
                    <Input
                      defaultValue={r.catatan ?? ""}
                      placeholder="Catatan (opsional)"
                      disabled={!canCreate || busy}
                      onBlur={(e) => setCatatan(r.barangId, e.target.value.trim())}
                      className="text-sm"
                    />
                  </div>

                  {r.checked && (
                    <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-success">
                      <UserCheck className="size-3.5 shrink-0" />
                      Diperiksa{r.checkedBy ? ` · ${r.checkedBy}` : ""}{r.checkedAt ? ` · ${formatTime(r.checkedAt)}` : ""}
                    </p>
                  )}
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="size-6 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3.5 w-36 rounded" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-9 w-full rounded" />
            <Skeleton className="h-9 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
