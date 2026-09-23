"use client";

import { useState } from "react";
import {
  Ambulance, Clock, Coins, FileSpreadsheet, FileText,
  GitCompareArrows, Scissors, Table2, Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatRupiah, formatNumber, formatRupiahRingkas } from "@/lib/format";
import { cn } from "@/lib/cn";
import { BULAN_LABEL, JENIS_KLAIM, JENIS_KLAIM_LABEL } from "@/server/modules/rekap-klaim/klaim.schema";
import { exportLaporan, fetchLaporan, type LaporanData } from "./laporan.client";

type Tab = "tahunan" | "perbandingan" | "pending" | "rujukan";
const TABS: { key: Tab; label: string; icon: typeof Table2 }[] = [
  { key: "tahunan", label: "Rekap Tahunan", icon: Table2 },
  { key: "perbandingan", label: "Perbandingan", icon: GitCompareArrows },
  { key: "pending", label: "Klaim Pending", icon: Clock },
  { key: "rujukan", label: "Rujukan Ambulans", icon: Ambulance },
];

const periode = (tahun: number, bulan: number) => `${BULAN_LABEL[bulan - 1].slice(0, 3)} ${tahun}`;

export function LaporanView({ canPrint }: { canPrint: boolean }) {
  const toast = useToast();
  const [sel, setSel] = useState<string | null>(null); // null = default (tahun terbaru)
  const [tab, setTab] = useState<Tab>("tahunan");
  const [busy, setBusy] = useState<null | "xlsx" | "pdf">(null);

  const state = useAsyncData(
    () => fetchLaporan(sel === null ? undefined : sel === "semua" ? "" : sel),
    [sel],
  );
  const data = state.result;

  const selValue = sel ?? (data?.tahun != null ? String(data.tahun) : "semua");
  const exportScope = sel === "semua" ? "" : (sel ?? (data?.tahun != null ? String(data.tahun) : ""));

  const tahunOpts = [
    { value: "semua", label: "Semua tahun" },
    ...(data?.tahunTersedia ?? []).map((y) => ({ value: String(y), label: String(y) })),
  ];

  async function doExport(fmt: "xlsx" | "pdf") {
    setBusy(fmt);
    try {
      await exportLaporan(exportScope, fmt);
      toast.success("Export disiapkan", fmt === "pdf" ? "Dokumen PDF" : "Workbook Excel");
    } catch (e) {
      toast.error("Gagal export", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem]">
            <Label className="text-[11px]">Tahun pelayanan</Label>
            <Select value={selValue} onChange={setSel} options={tahunOpts} />
          </div>
          <p className="mb-1.5 text-xs text-fg-muted">
            {selValue === "semua"
              ? "Menampilkan gabungan seluruh tahun (rekap tahunan butuh 1 tahun terpilih)."
              : "Rekap, pending & rujukan mengikuti tahun terpilih; perbandingan selalu lintas tahun."}
          </p>
          {canPrint && (
            <div className="ml-auto flex items-end gap-2">
              <Button variant="secondary" size="sm" icon={<FileSpreadsheet className="size-4" />} loading={busy === "xlsx"} disabled={!!busy} onClick={() => doExport("xlsx")}>
                Excel
              </Button>
              <Button variant="secondary" size="sm" icon={<FileText className="size-4" />} loading={busy === "pdf"} disabled={!!busy} onClick={() => doExport("pdf")}>
                PDF
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                active ? "border-brand/40 bg-brand-soft text-brand" : "border-border bg-surface text-fg-muted hover:bg-surface-2",
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Konten */}
      {state.loading && !data ? (
        <Card className="p-4"><Skeleton className="h-64 w-full rounded-[var(--radius-md)]" /></Card>
      ) : state.error || !data ? (
        <Card className="p-0"><ErrorState onRetry={state.reload} /></Card>
      ) : tab === "tahunan" ? (
        <RekapTahunanTab data={data} />
      ) : tab === "perbandingan" ? (
        <PerbandinganTab data={data} />
      ) : tab === "pending" ? (
        <PendingTab data={data} />
      ) : (
        <RujukanTab data={data} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Rekap Tahunan */

function RekapTahunanTab({ data }: { data: LaporanData }) {
  const th = data.tahunan;
  if (!th) {
    return (
      <Card className="p-0">
        <EmptyState
          title="Pilih satu tahun"
          description="Rekap tahunan (matriks jenis × layanan) ditampilkan untuk satu tahun pelayanan. Ubah filter di atas dari “Semua tahun” ke tahun tertentu."
        />
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Coins} tone="brand" label="Total Dana" value={formatRupiah(th.totalDana)} sub={`${th.entri} entri · ${formatNumber(th.totalKasus)} kasus`} />
        <Tile icon={Wallet} tone="success" label="Nilai Bersih" value={formatRupiah(th.nilaiBersih)} sub="setelah potongan" />
        <Tile icon={Scissors} tone="warning" label="Total Potongan" value={formatRupiah(th.totalPotongan)} sub="AAK / kelebihan / cicilan" />
        <Tile icon={Clock} tone={th.belumCair.count ? "danger" : "neutral"} label="Belum Cair" value={String(th.belumCair.count)} sub={formatRupiahRingkas(th.belumCair.nilai)} highlight={th.belumCair.count > 0} />
      </div>

      <Card className="p-4">
        <p className="text-xs text-fg-muted">
          <span className="font-medium text-fg">INA-CBG&apos;s</span> {formatRupiah(th.inaCbgsTotal.total)}
          <span className="mx-2 text-border">|</span>
          <span className="font-medium text-fg">Rujukan Ambulans</span> {formatRupiah(th.rujukan.dana)} ({formatNumber(th.rujukan.kasus)} kasus · {th.rujukan.entri} entri)
        </p>
      </Card>

      {/* Matriks INA-CBG's */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">Rincian INA-CBG&apos;s per Jenis Klaim — {th.tahun}</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TH>Jenis Klaim</TH>
              <TH align="right">Rawat Inap (RITL)</TH>
              <TH align="right">Rawat Jalan (RJTL)</TH>
              <TH align="right">Total</TH>
            </THead>
            <TBody>
              {JENIS_KLAIM.map((j) => (
                <TR key={j}>
                  <TD><span className="font-medium text-fg">{JENIS_KLAIM_LABEL[j]}</span></TD>
                  <TD align="right"><Rp n={th.inaCbgs[j].ritl} /></TD>
                  <TD align="right"><Rp n={th.inaCbgs[j].rjtl} /></TD>
                  <TD align="right"><Rp n={th.inaCbgs[j].total} bold /></TD>
                </TR>
              ))}
              <TR className="bg-surface-2/50">
                <TD><span className="font-semibold text-fg">TOTAL INA-CBG&apos;s</span></TD>
                <TD align="right"><Rp n={th.inaCbgsTotal.ritl} bold /></TD>
                <TD align="right"><Rp n={th.inaCbgsTotal.rjtl} bold /></TD>
                <TD align="right"><Rp n={th.inaCbgsTotal.total} bold /></TD>
              </TR>
            </TBody>
          </Table>
        </div>
      </Card>

      {/* Per bulan */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">Rincian per Bulan Pelayanan — {th.tahun}</h3>
        </div>
        {th.perBulan.length === 0 ? (
          <EmptyState title="Belum ada data bulanan" description="Tidak ada entri klaim pada tahun ini." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TH>Bulan</TH>
                <TH align="right">Entri</TH>
                <TH align="right">Kasus</TH>
                <TH align="right">Dana</TH>
                <TH align="right">Potongan</TH>
              </THead>
              <TBody>
                {th.perBulan.map((b) => (
                  <TR key={b.bulan}>
                    <TD><span className="font-medium text-fg">{BULAN_LABEL[b.bulan - 1]}</span></TD>
                    <TD align="right" className="tabular-nums text-fg-muted">{b.entri}</TD>
                    <TD align="right" className="tabular-nums text-fg-muted">{formatNumber(b.kasus)}</TD>
                    <TD align="right"><Rp n={b.dana} /></TD>
                    <TD align="right">{b.potongan > 0 ? <span className="tabular-nums text-warning">−{formatRupiah(b.potongan)}</span> : <span className="text-fg-subtle">—</span>}</TD>
                  </TR>
                ))}
                <TR className="bg-surface-2/50">
                  <TD><span className="font-semibold text-fg">TOTAL</span></TD>
                  <TD align="right" className="font-semibold tabular-nums text-fg">{th.entri}</TD>
                  <TD align="right" className="font-semibold tabular-nums text-fg">{formatNumber(th.totalKasus)}</TD>
                  <TD align="right"><Rp n={th.inaCbgsTotal.total + th.rujukan.dana} bold /></TD>
                  <TD align="right"><span className="font-semibold tabular-nums text-warning">−{formatRupiah(th.totalPotongan)}</span></TD>
                </TR>
              </TBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- Perbandingan */

function PerbandinganTab({ data }: { data: LaporanData }) {
  const p = data.perbandingan;
  if (p.tahun.length === 0) {
    return <Card className="p-0"><EmptyState title="Belum ada data" description="Tambahkan entri klaim untuk membandingkan antar tahun." /></Card>;
  }
  const maxDana = Math.max(1, ...p.tahun.map((y) => p.totalDana[y]));
  return (
    <div className="space-y-4">
      {/* Tren total dana */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-fg">Tren Total Dana Klaim per Tahun</h3>
        <div className="space-y-2">
          {p.tahun.map((y) => (
            <div key={y} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-xs font-medium text-fg-muted tabular-nums">{y}</span>
              <div className="h-5 flex-1 overflow-hidden rounded-[var(--radius-sm)] bg-surface-2">
                <div className="h-full rounded-[var(--radius-sm)] bg-brand transition-all" style={{ width: `${Math.max(2, (p.totalDana[y] / maxDana) * 100)}%` }} />
              </div>
              <span className="w-28 shrink-0 text-right text-xs font-semibold text-fg tabular-nums">{formatRupiahRingkas(p.totalDana[y])}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">Perbandingan Dana Klaim Antar Tahun</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TH>Komponen</TH>
              {p.tahun.map((y) => <TH key={y} align="right">{y}</TH>)}
            </THead>
            <TBody>
              {p.rows.map((rw) => (
                <TR key={rw.key}>
                  <TD><span className="font-medium text-fg">{rw.label}</span></TD>
                  {p.tahun.map((y) => <TD key={y} align="right"><Rp n={rw.perTahun[y]} muted /></TD>)}
                </TR>
              ))}
              <TR className="bg-surface-2/50">
                <TD><span className="font-semibold text-fg">Total Dana</span></TD>
                {p.tahun.map((y) => <TD key={y} align="right"><Rp n={p.totalDana[y]} bold /></TD>)}
              </TR>
              <TR>
                <TD><span className="font-medium text-warning">Potongan</span></TD>
                {p.tahun.map((y) => <TD key={y} align="right">{p.totalPotongan[y] > 0 ? <span className="tabular-nums text-warning">−{formatRupiah(p.totalPotongan[y])}</span> : <span className="text-fg-subtle">—</span>}</TD>)}
              </TR>
              <TR className="bg-surface-2/50">
                <TD><span className="font-semibold text-fg">Nilai Bersih</span></TD>
                {p.tahun.map((y) => <TD key={y} align="right"><Rp n={p.nilaiBersih[y]} bold /></TD>)}
              </TR>
              <TR>
                <TD><span className="text-fg-muted">Total Kasus</span></TD>
                {p.tahun.map((y) => <TD key={y} align="right" className="tabular-nums text-fg-muted">{formatNumber(p.totalKasus[y])}</TD>)}
              </TR>
              <TR>
                <TD><span className="text-fg-muted">Jumlah Entri</span></TD>
                {p.tahun.map((y) => <TD key={y} align="right" className="tabular-nums text-fg-muted">{p.entri[y]}</TD>)}
              </TR>
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- Pending */

function PendingTab({ data }: { data: LaporanData }) {
  const pend = data.pending;
  if (pend.perBulan.length === 0) {
    return <Card className="p-0"><EmptyState title="Tidak ada klaim pending" description={data.tahun ? `Tidak ada klaim pending pada tahun ${data.tahun}.` : "Belum ada klaim berjenis Pending."} /></Card>;
  }
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">Klaim Pending — Rawat Inap vs Rawat Jalan{data.tahun ? ` (${data.tahun})` : ""}</h3>
        <p className="mt-0.5 text-[11px] text-fg-muted">Jumlah kasus & biaya per bulan pelayanan.</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TH>Periode</TH>
            <TH align="right">Kasus RI</TH>
            <TH align="right">Biaya RI</TH>
            <TH align="right">Kasus RJ</TH>
            <TH align="right">Biaya RJ</TH>
            <TH align="right">Total Kasus</TH>
            <TH align="right">Total Biaya</TH>
          </THead>
          <TBody>
            {pend.perBulan.map((e) => (
              <TR key={`${e.tahun}-${e.bulan}`}>
                <TD><span className="font-medium text-fg">{periode(e.tahun, e.bulan)}</span></TD>
                <TD align="right" className="tabular-nums text-fg-muted">{formatNumber(e.riKasus)}</TD>
                <TD align="right"><Rp n={e.riBiaya} muted /></TD>
                <TD align="right" className="tabular-nums text-fg-muted">{formatNumber(e.rjKasus)}</TD>
                <TD align="right"><Rp n={e.rjBiaya} muted /></TD>
                <TD align="right" className="font-medium tabular-nums text-fg">{formatNumber(e.kasus)}</TD>
                <TD align="right"><Rp n={e.biaya} /></TD>
              </TR>
            ))}
            <TR className="bg-surface-2/50">
              <TD><span className="font-semibold text-fg">TOTAL</span></TD>
              <TD align="right" className="font-semibold tabular-nums text-fg">{formatNumber(pend.totals.riKasus)}</TD>
              <TD align="right"><Rp n={pend.totals.riBiaya} bold /></TD>
              <TD align="right" className="font-semibold tabular-nums text-fg">{formatNumber(pend.totals.rjKasus)}</TD>
              <TD align="right"><Rp n={pend.totals.rjBiaya} bold /></TD>
              <TD align="right" className="font-semibold tabular-nums text-fg">{formatNumber(pend.totals.kasus)}</TD>
              <TD align="right"><Rp n={pend.totals.biaya} bold /></TD>
            </TR>
          </TBody>
        </Table>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- Rujukan */

function RujukanTab({ data }: { data: LaporanData }) {
  const ruj = data.rujukan;
  if (ruj.perBulan.length === 0) {
    return <Card className="p-0"><EmptyState title="Tidak ada klaim rujukan" description={data.tahun ? `Tidak ada klaim rujukan ambulans pada tahun ${data.tahun}.` : "Belum ada klaim kategori Rujukan Ambulans."} /></Card>;
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Tile icon={Ambulance} tone="accent" label="Total Biaya" value={formatRupiah(ruj.totals.biaya)} sub="rujukan ambulans" />
        <Tile icon={Coins} tone="brand" label="Total Kasus" value={formatNumber(ruj.totals.kasus)} sub={`${ruj.totals.entri} entri`} />
        <Tile icon={Table2} tone="neutral" label="Tahun" value={String(ruj.perTahun.length)} sub="periode tercatat" />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">Rujukan Ambulans per Bulan{data.tahun ? ` (${data.tahun})` : ""}</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TH>Periode</TH>
              <TH align="right">Entri</TH>
              <TH align="right">Kasus</TH>
              <TH align="right">Biaya</TH>
            </THead>
            <TBody>
              {ruj.perBulan.map((e) => (
                <TR key={`${e.tahun}-${e.bulan}`}>
                  <TD><span className="font-medium text-fg">{periode(e.tahun, e.bulan)}</span></TD>
                  <TD align="right" className="tabular-nums text-fg-muted">{e.entri}</TD>
                  <TD align="right" className="tabular-nums text-fg-muted">{formatNumber(e.kasus)}</TD>
                  <TD align="right"><Rp n={e.biaya} /></TD>
                </TR>
              ))}
              <TR className="bg-surface-2/50">
                <TD><span className="font-semibold text-fg">TOTAL</span></TD>
                <TD align="right" className="font-semibold tabular-nums text-fg">{ruj.totals.entri}</TD>
                <TD align="right" className="font-semibold tabular-nums text-fg">{formatNumber(ruj.totals.kasus)}</TD>
                <TD align="right"><Rp n={ruj.totals.biaya} bold /></TD>
              </TR>
            </TBody>
          </Table>
        </div>
      </Card>

      {ruj.perTahun.length > 1 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-fg">Rekap Rujukan per Tahun</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TH>Tahun</TH>
                <TH align="right">Entri</TH>
                <TH align="right">Kasus</TH>
                <TH align="right">Biaya</TH>
              </THead>
              <TBody>
                {ruj.perTahun.map((e) => (
                  <TR key={e.tahun}>
                    <TD><span className="font-medium text-fg">{e.tahun}</span></TD>
                    <TD align="right" className="tabular-nums text-fg-muted">{e.entri}</TD>
                    <TD align="right" className="tabular-nums text-fg-muted">{formatNumber(e.kasus)}</TD>
                    <TD align="right"><Rp n={e.biaya} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ sub-komponen */

function Rp({ n, bold, muted }: { n: number; bold?: boolean; muted?: boolean }) {
  return (
    <span className={cn("tabular-nums", bold ? "font-semibold text-fg" : muted ? "text-fg-muted" : "text-fg")}>
      {formatRupiah(n)}
    </span>
  );
}

function Tile({
  icon: Icon, label, value, sub, tone, highlight,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  sub?: string;
  tone: "brand" | "success" | "warning" | "danger" | "accent" | "neutral";
  highlight?: boolean;
}) {
  const toneBox: Record<string, string> = {
    brand: "bg-brand-soft text-brand", success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger",
    accent: "bg-accent-soft text-accent", neutral: "bg-surface-2 text-fg-muted",
  };
  return (
    <Card className={cn("p-4", highlight && "ring-1 ring-danger/30")}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <div className={cn("flex size-8 items-center justify-center rounded-[var(--radius-md)]", toneBox[tone])}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-lg font-semibold tracking-tight text-fg tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-fg-subtle">{sub}</p>}
    </Card>
  );
}
