"use client";

import { useState } from "react";
import { Boxes, DoorOpen, Printer, User, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/lib/useAsyncData";
import { downloadFromEndpoint } from "@/lib/download";
import { formatRupiah, formatRupiahRingkas } from "@/lib/format";
import { cn } from "@/lib/cn";
import { STATUS_ASET_LABEL, STATUS_ASET_TONE } from "@/server/modules/inventaris/barang.schema";
import { fetchKirData, fetchKirRuangan, type KirData, type KirRuanganSummary } from "./kir.client";

export function KirView({ canPrint }: { canPrint: boolean }) {
  const toast = useToast();
  const listState = useAsyncData<KirRuanganSummary[]>(() => fetchKirRuangan(), []);
  const list = listState.result ?? [];

  const [selectedId, setSelectedId] = useState("");
  // Auto-pilih ruangan pertama yang punya aset (fase render, konvergen).
  if (selectedId === "" && list.length > 0) {
    const def = list.find((r) => r.jumlah > 0) ?? list[0];
    setSelectedId(def.id);
  }

  const dataState = useAsyncData<KirData | null>(
    () => (selectedId ? fetchKirData(selectedId) : Promise.resolve(null)),
    [selectedId],
  );
  const data = dataState.result;

  const [exporting, setExporting] = useState(false);
  async function onPrint() {
    if (!selectedId || !data) return;
    setExporting(true);
    try {
      await downloadFromEndpoint(`/api/inventaris/kir/${selectedId}/pdf`, `KIR_${data.ruangan.kodePrefix}.pdf`);
      toast.success("Menyiapkan PDF", "Kartu Inventaris Ruangan sedang diunduh.");
    } catch (e) {
      toast.error("Gagal mencetak", e instanceof Error ? e.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* Pemilih ruangan */}
      <Card className="overflow-hidden p-0 lg:sticky lg:top-4 lg:self-start">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">Pilih Ruangan</h3>
          <p className="text-xs text-fg-muted">{listState.loading ? "Memuat…" : `${list.length} ruangan`}</p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-2">
          {listState.loading ? (
            <div className="space-y-2 p-1">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-[var(--radius-md)]" />)}
            </div>
          ) : listState.error ? (
            <ErrorState onRetry={listState.reload} />
          ) : list.length === 0 ? (
            <EmptyState title="Belum ada ruangan" description="Tambahkan ruangan di Pengaturan lebih dulu." />
          ) : (
            <ul className="space-y-1.5">
              {list.map((r) => {
                const active = r.id === selectedId;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        "w-full rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                        active ? "border-brand/50 bg-brand-soft/40" : "border-border bg-surface hover:bg-surface-2",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold", active ? "bg-brand text-brand-fg" : "bg-surface-2 text-fg-muted")}>
                          {r.kodePrefix}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{r.nama}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-fg-muted">
                        <span className="inline-flex items-center gap-1"><Boxes className="size-3" /> {r.jumlah} unit</span>
                        <span className="inline-flex items-center gap-1"><Wallet className="size-3" /> {formatRupiahRingkas(r.totalNilai)}</span>
                      </div>
                      {!r.pjNama && (
                        <p className="mt-1 text-[10px] font-medium text-warning">PJ belum ditetapkan</p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* Pratinjau KIR */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-fg">Pratinjau Kartu Inventaris Ruangan</h3>
            <p className="text-xs text-fg-muted">Cetak PDF resmi ber-tanda tangan penanggung jawab.</p>
          </div>
          <Button
            size="sm"
            icon={<Printer className="size-4" />}
            onClick={onPrint}
            loading={exporting}
            disabled={!canPrint || !data || dataState.loading}
          >
            Cetak PDF
          </Button>
        </div>

        {dataState.loading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-6 w-72 rounded" />
            <Skeleton className="h-4 w-56 rounded" />
            <Skeleton className="mt-4 h-40 w-full rounded" />
          </div>
        ) : dataState.error ? (
          <ErrorState onRetry={dataState.reload} />
        ) : !data ? (
          <EmptyState title="Pilih ruangan" description="Pilih ruangan di kiri untuk melihat kartu inventarisnya." />
        ) : (
          <KirPreview data={data} />
        )}
      </Card>
    </div>
  );
}

function KirPreview({ data }: { data: KirData }) {
  const { ruangan, barang, totalNilai } = data;
  return (
    <div className="p-5">
      {/* Kop */}
      <div className="border-b border-border pb-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Rumah Sakit Umum Daerah Bolaang Mongondow Timur</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-fg">KARTU INVENTARIS RUANGAN (KIR)</h2>
      </div>

      {/* Info ruangan + PJ */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoRow icon={DoorOpen} label="Ruangan" value={`${ruangan.nama} (${ruangan.kodePrefix})`} />
        <InfoRow
          icon={User}
          label="Penanggung Jawab"
          value={ruangan.pjNama ? `${ruangan.pjNama}${ruangan.pjNip ? ` · NIP ${ruangan.pjNip}` : ""}` : "Belum ditetapkan"}
          warn={!ruangan.pjNama}
        />
      </div>

      {/* Ringkas */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-soft-fg">
          <Boxes className="size-3.5" /> {barang.length} unit
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
          <Wallet className="size-3.5" /> {formatRupiah(totalNilai)}
        </span>
      </div>

      {/* Tabel aset */}
      <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-border">
        {barang.length === 0 ? (
          <EmptyState title="Belum ada aset" description="Ruangan ini belum memiliki barang tercatat." />
        ) : (
          <Table>
            <THead>
              <TH className="w-10 text-center">No</TH>
              <TH>Kode / Nama</TH>
              <TH className="hidden md:table-cell">Kondisi</TH>
              <TH>Status</TH>
              <TH className="hidden sm:table-cell" align="center">Tahun</TH>
              <TH align="right">Harga</TH>
            </THead>
            <TBody>
              {barang.map((b, i) => (
                <TR key={b.kodeBarang}>
                  <TD align="center" className="text-xs text-fg-subtle tabular-nums">{i + 1}</TD>
                  <TD>
                    <p className="font-mono text-xs font-semibold text-brand">{b.kodeBarang}</p>
                    <p className="text-sm text-fg">{b.nama}</p>
                    {b.merk && <p className="text-xs text-fg-subtle">{b.merk}</p>}
                  </TD>
                  <TD className="hidden text-sm text-fg-muted md:table-cell">{b.kondisi ?? "—"}</TD>
                  <TD><Badge tone={STATUS_ASET_TONE[b.statusAset]} dot>{STATUS_ASET_LABEL[b.statusAset]}</Badge></TD>
                  <TD align="center" className="hidden text-sm text-fg-muted sm:table-cell">{b.tahunPerolehan ?? "—"}</TD>
                  <TD align="right" className="text-sm text-fg">{b.harga != null ? formatRupiah(b.harga) : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {/* Pratinjau tanda tangan */}
      <div className="mt-6 grid grid-cols-1 gap-6 border-t border-dashed border-border pt-5 sm:grid-cols-2">
        <SignPreview caption="Mengetahui," sub="Pengurus / Penyimpan Barang" />
        <SignPreview caption="Penanggung Jawab Ruangan" name={ruangan.pjNama} nip={ruangan.pjNip} />
      </div>
      <p className="mt-3 text-center text-[11px] text-fg-subtle">
        Tanda tangan & tanggal akan tercetak otomatis pada PDF resmi.
      </p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: typeof DoorOpen;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface-2/40 px-3 py-2.5">
      <Icon className={cn("mt-0.5 size-4 shrink-0", warn ? "text-warning" : "text-brand")} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
        <p className={cn("text-sm", warn ? "font-medium text-warning" : "text-fg")}>{value}</p>
      </div>
    </div>
  );
}

function SignPreview({ caption, sub, name, nip }: { caption: string; sub?: string; name?: string | null; nip?: string | null }) {
  return (
    <div className="text-center text-sm">
      <p className="text-fg">{caption}</p>
      {sub && <p className="text-fg-muted">{sub}</p>}
      <div className="h-14" />
      <p className="font-semibold text-fg">{name ? `( ${name} )` : "( .............................. )"}</p>
      <p className="text-xs text-fg-muted">NIP. {nip || "............................"}</p>
    </div>
  );
}
