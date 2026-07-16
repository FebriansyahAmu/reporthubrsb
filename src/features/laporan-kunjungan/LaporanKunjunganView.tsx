"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Download,
  Loader,
  Printer,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { Input, InputWithIcon, Label, Select } from "@/components/ui/Field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { TableSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { StatCard } from "@/components/ui/StatCard";
import { BarList } from "@/components/ui/BarList";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useDebounce } from "@/lib/useDebounce";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatDate, toDateInput } from "@/lib/format";
import {
  CARA_BAYAR_LABEL,
  type CaraBayar,
  type KunjunganStatus,
} from "@/lib/types";
import { getLaporanKunjungan, UNITS } from "@/lib/mock/data";

const TODAY = new Date("2026-07-16");
const MONTH_AGO = new Date("2026-06-16");
const PAGE_SIZE = 10;

export function LaporanKunjunganView() {
  const [from, setFrom] = useState(toDateInput(MONTH_AGO));
  const [to, setTo] = useState(toDateInput(TODAY));
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<KunjunganStatus | "ALL">("ALL");
  const [unit, setUnit] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const search = useDebounce(searchInput, 350);

  const filter = useMemo(
    () => ({ from, to, search, status, unit, page, pageSize: PAGE_SIZE }),
    [from, to, search, status, unit, page],
  );

  const { result, loading, error, reload } = useAsyncData(
    () => getLaporanKunjungan(filter),
    [filter],
  );
  const summary = result?.summary ?? null;
  const detail = result?.detail ?? [];
  const meta = result?.meta ?? null;

  // Reset ke halaman 1 saat filter (selain page) berubah — pola render-phase.
  const filterKey = `${from}|${to}|${search}|${status}|${unit}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  function resetFilters() {
    setFrom(toDateInput(MONTH_AGO));
    setTo(toDateInput(TODAY));
    setSearchInput("");
    setStatus("ALL");
    setUnit("ALL");
    setPage(1);
  }

  function exportCsv() {
    const header = ["No. Kunjungan", "Nama Pasien", "No. RM", "Tanggal", "Unit", "Dokter", "Cara Bayar", "Status"];
    const rows = detail.map((k) => [
      k.nomorKunjungan, k.namaPasien, k.noRekamMedis, formatDate(k.tanggalKunjungan),
      k.unit, k.dokter ?? "-", CARA_BAYAR_LABEL[k.caraBayar], k.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-kunjungan-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const caraBayarTone = (cb: CaraBayar) => (cb === "BPJS" ? "brand" : "neutral");

  return (
    <div className="space-y-5">
      {/* Filter */}
      <Card className="no-print p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Label htmlFor="search">Cari pasien</Label>
            <InputWithIcon
              id="search"
              icon={<Search className="size-4" />}
              placeholder="Nama / No. RM"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="from">Tanggal awal</Label>
            <Input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to">Tanggal akhir</Label>
            <Input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Select id="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="ALL">Semua unit</option>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as KunjunganStatus | "ALL")}>
                <option value="ALL">Semua status</option>
                <option value="SELESAI">Selesai</option>
                <option value="DALAM_PROSES">Dalam Proses</option>
                <option value="BARU">Baru</option>
                <option value="BATAL">Batal</option>
              </Select>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={resetFilters}>
            Reset
          </Button>
          <Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={exportCsv} disabled={loading || !detail.length}>
            Export CSV
          </Button>
          <Button variant="primary" size="sm" icon={<Printer className="size-4" />} onClick={() => window.print()} disabled={loading}>
            Cetak
          </Button>
        </div>
      </Card>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Kunjungan" value={summary?.totalKunjungan ?? 0} icon={Users} tone="brand" loading={loading} />
        <StatCard label="Selesai" value={summary?.totalSelesai ?? 0} icon={CheckCircle2} tone="success" loading={loading} />
        <StatCard label="Dalam Proses" value={summary?.totalDalamProses ?? 0} icon={Loader} tone="accent" loading={loading} />
        <StatCard label="Batal" value={summary?.totalBatal ?? 0} icon={Ban} tone="danger" loading={loading} />
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Kunjungan per Cara Bayar" />
          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
              </div>
            ) : summary && summary.perCaraBayar.some((x) => x.jumlah > 0) ? (
              <BarList items={summary.perCaraBayar.map((x) => ({ label: CARA_BAYAR_LABEL[x.caraBayar], jumlah: x.jumlah }))} />
            ) : (
              <p className="py-6 text-center text-sm text-fg-muted">Tidak ada data.</p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Kunjungan per Unit" />
          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
              </div>
            ) : summary && summary.perUnit.length > 0 ? (
              <BarList items={summary.perUnit} />
            ) : (
              <p className="py-6 text-center text-sm text-fg-muted">Tidak ada data.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Detail */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Rincian Kunjungan"
          subtitle={meta ? `${meta.total} kunjungan pada periode terpilih` : undefined}
        />
        {loading ? (
          <TableSkeleton rows={PAGE_SIZE} cols={6} />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : detail.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <Table>
              <THead>
                <TH>No. Kunjungan</TH>
                <TH>Pasien</TH>
                <TH>Tanggal</TH>
                <TH>Unit</TH>
                <TH>Cara Bayar</TH>
                <TH>Status</TH>
              </THead>
              <TBody>
                {detail.map((k) => (
                  <TR key={k.id}>
                    <TD><span className="font-mono text-xs text-fg-muted">{k.nomorKunjungan}</span></TD>
                    <TD>
                      <div className="flex flex-col">
                        <span className="font-medium text-fg">{k.namaPasien}</span>
                        <span className="text-xs text-fg-muted tabular">RM {k.noRekamMedis}</span>
                      </div>
                    </TD>
                    <TD>{formatDate(k.tanggalKunjungan)}</TD>
                    <TD>{k.unit}</TD>
                    <TD><Badge tone={caraBayarTone(k.caraBayar)}>{CARA_BAYAR_LABEL[k.caraBayar]}</Badge></TD>
                    <TD><StatusBadge status={k.status} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {meta && <div className="no-print"><Pagination meta={meta} onPageChange={setPage} /></div>}
          </>
        )}
      </Card>
    </div>
  );
}
