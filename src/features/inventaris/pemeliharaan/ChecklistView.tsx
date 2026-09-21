"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle, CalendarClock, CalendarDays, CalendarRange, CheckCircle2, Circle,
  ClipboardCheck, DoorOpen, RotateCcw, Search,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, InputWithIcon, Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { FREKUENSI, FREKUENSI_LABEL, type Frekuensi } from "@/server/modules/inventaris/checklist.schema";
import {
  completeChecklist, fetchChecklist, fetchChecklistRefs, periksaBarang,
  type ChecklistOverview, type ChecklistRefs,
} from "./checklist.client";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";
const FREK_ICON: Record<Frekuensi, typeof CalendarDays> = {
  HARIAN: CalendarDays,
  MINGGUAN: CalendarRange,
  BULANAN: CalendarClock,
};
const FREK_KEY: Record<Frekuensi, "harian" | "mingguan" | "bulanan"> = {
  HARIAN: "harian",
  MINGGUAN: "mingguan",
  BULANAN: "bulanan",
};

export function ChecklistView({ canCreate }: { canCreate: boolean; canUpdate: boolean }) {
  const toast = useToast();
  const [ruanganId, setRuanganId] = useState("");
  const [frekuensi, setFrekuensi] = useState<Frekuensi>("HARIAN");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 250);
  const [rowBusy, setRowBusy] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);

  const refsState = useAsyncData<ChecklistRefs>(() => fetchChecklistRefs(), []);
  const refs = refsState.result;
  if (refs && !ruanganId && refs.ruangan[0]) setRuanganId(refs.ruangan[0].id);

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

  const ruanganOpts = useMemo<SelectOption[]>(
    () => (refs?.ruangan ?? []).map((r) => ({ value: r.id, label: `${r.kodePrefix} — ${r.nama}` })),
    [refs],
  );
  const kondisiOpts = useMemo<SelectOption[]>(
    () => [{ value: "", label: "— Pilih kondisi —" }, ...(refs?.kondisi ?? []).map((k) => ({ value: k.id, label: k.nama }))],
    [refs],
  );

  const visibleRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.kodeBarang.toLowerCase().includes(s) || r.nama.toLowerCase().includes(s) || (r.merk ?? "").toLowerCase().includes(s));
  }, [rows, search]);

  function statFor(f: Frekuensi) {
    if (f === frekuensi) return { done, total };
    return ov?.stats[FREK_KEY[f]] ?? { done: 0, total };
  }

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
    // optimistik
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
      patchRow(barangId, { checkedAt: st.checkedAt });
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
    if ((r.catatan ?? "") === catatan) return; // tak berubah
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

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Toolbar: ruangan + cari */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="cl-ruangan">Ruangan</Label>
            <div className="flex items-center gap-2">
              <DoorOpen className="size-4 shrink-0 text-fg-subtle" />
              <div className="min-w-0 flex-1">
                <Select id="cl-ruangan" value={ruanganId} onChange={setRuanganId} options={ruanganOpts} placeholder="Pilih ruangan…" />
              </div>
            </div>
          </div>
          <div className="w-full lg:w-72">
            <Label htmlFor="cl-cari">Cari barang</Label>
            <InputWithIcon id="cl-cari" icon={<Search className="size-4" />} placeholder="Kode / nama / merk" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Tab frekuensi */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {FREKUENSI.map((f) => {
          const Icon = FREK_ICON[f];
          const active = frekuensi === f;
          const st = statFor(f);
          const full = st.total > 0 && st.done === st.total;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFrekuensi(f)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-2.5 rounded-[var(--radius-lg)] border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                active ? "border-brand bg-brand-soft/40 ring-1 ring-brand/30" : "border-border bg-surface hover:border-brand/40 hover:shadow-sm",
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]", active ? "bg-brand text-white" : "bg-surface-2 text-fg-muted")}>
                <Icon className="size-4.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">{FREKUENSI_LABEL[f]}</p>
                <p className="text-xs tabular-nums text-fg-muted">
                  {st.done}/{st.total}{full && st.total > 0 ? " ✓" : ""}
                </p>
              </div>
            </button>
          );
        })}
      </div>

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

      {/* Daftar barang */}
      <Card className="overflow-hidden">
        {loading || refsState.loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : !ov || total === 0 ? (
          <EmptyState title="Belum ada barang" description="Ruangan ini belum memiliki unit barang di Master Barang. Tambahkan barang terlebih dahulu." />
        ) : visibleRows.length === 0 ? (
          <EmptyState title="Tidak ada hasil" description="Tidak ada barang yang cocok dengan pencarian." />
        ) : (
          <Table>
            <THead>
              <TH className="w-12">Cek</TH>
              <TH>Barang</TH>
              <TH className="hidden md:table-cell">Kondisi Kini</TH>
              <TH className="w-48">Status Kondisi</TH>
              <TH className="hidden xl:table-cell">Catatan</TH>
            </THead>
            <TBody>
              {visibleRows.map((r) => {
                const busy = rowBusy.has(r.barangId);
                return (
                  <TR key={r.barangId} className={cn(r.checked && "bg-success-soft/20")}>
                    <TD>
                      <button
                        type="button"
                        disabled={!canCreate || busy}
                        onClick={() => toggleRow(r.barangId)}
                        aria-pressed={r.checked}
                        title={r.checked ? "Batal periksa" : "Tandai diperiksa"}
                        className={cn("flex items-center justify-center rounded-md p-1 transition-colors", (!canCreate || busy) ? "cursor-default" : "hover:bg-surface-2")}
                      >
                        {r.checked ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-fg-subtle" />}
                      </button>
                    </TD>
                    <TD>
                      <p className="font-mono text-xs font-semibold text-brand">{r.kodeBarang}</p>
                      <p className="mt-0.5 font-medium text-fg">{r.nama}</p>
                      {r.merk && <p className="text-xs text-fg-subtle">{r.merk}</p>}
                    </TD>
                    <TD className="hidden md:table-cell">
                      {r.kondisiSaatIni ? (
                        <Badge tone={(r.kondisiSaatIni.tone as Tone) || "neutral"} dot>{r.kondisiSaatIni.nama}</Badge>
                      ) : (
                        <span className="text-xs text-fg-subtle">—</span>
                      )}
                    </TD>
                    <TD>
                      <Select
                        value={r.kondisiId ?? ""}
                        onChange={(v) => setKondisi(r.barangId, v)}
                        options={kondisiOpts}
                        disabled={!canCreate || busy}
                      />
                    </TD>
                    <TD className="hidden xl:table-cell">
                      <Input
                        defaultValue={r.catatan ?? ""}
                        placeholder="Catatan (opsional)"
                        disabled={!canCreate || busy}
                        onBlur={(e) => setCatatan(r.barangId, e.target.value.trim())}
                        className="text-sm"
                      />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-6 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3.5 w-48 rounded" />
          </div>
          <Skeleton className="h-8 w-40 rounded" />
        </div>
      ))}
    </div>
  );
}
