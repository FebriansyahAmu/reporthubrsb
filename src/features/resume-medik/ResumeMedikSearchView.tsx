"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Printer, RotateCcw, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, InputWithIcon, Label, Select } from "@/components/ui/Field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useDebounce } from "@/lib/useDebounce";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatDate, formatTime, toDateInput } from "@/lib/format";
import { getKunjunganList, UNITS } from "@/lib/mock/data";

const TODAY = new Date("2026-07-16");
const MONTH_AGO = new Date("2026-06-16");
const PAGE_SIZE = 10;

export function ResumeMedikSearchView() {
  const [from, setFrom] = useState(toDateInput(MONTH_AGO));
  const [to, setTo] = useState(toDateInput(TODAY));
  const [searchInput, setSearchInput] = useState("");
  const [unit, setUnit] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const search = useDebounce(searchInput, 350);

  // onlySelesai: aturan bisnis — resume medik hanya untuk kunjungan selesai.
  const filter = useMemo(
    () => ({ from, to, search, unit, page, pageSize: PAGE_SIZE, onlySelesai: true }),
    [from, to, search, unit, page],
  );

  const { result, loading, error, reload } = useAsyncData(
    () => getKunjunganList(filter),
    [filter],
  );
  const data = result?.data ?? [];
  const meta = result?.meta ?? null;

  // Reset ke halaman 1 saat filter (selain page) berubah — pola render-phase.
  const filterKey = `${from}|${to}|${search}|${unit}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  function resetFilters() {
    setFrom(toDateInput(MONTH_AGO));
    setTo(toDateInput(TODAY));
    setSearchInput("");
    setUnit("ALL");
    setPage(1);
  }

  return (
    <div className="space-y-5">
      {/* Info aturan */}
      <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-border bg-brand-soft/50 px-4 py-3">
        <FileText className="mt-0.5 size-4 shrink-0 text-brand" />
        <p className="text-sm text-fg-muted">
          Resume medik hanya tersedia untuk kunjungan berstatus{" "}
          <span className="font-medium text-fg">Selesai</span>. Daftar di bawah sudah
          difilter otomatis.
        </p>
      </div>

      {/* Filter */}
      <Card className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Label htmlFor="search">Cari pasien</Label>
            <InputWithIcon
              id="search"
              icon={<Search className="size-4" />}
              placeholder="Nama / No. RM / No. kunjungan"
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
          <div>
            <Label htmlFor="unit">Unit</Label>
            <Select id="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="ALL">Semua unit</option>
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={resetFilters}>
            Reset filter
          </Button>
        </div>
      </Card>

      {/* Tabel */}
      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={PAGE_SIZE} cols={6} />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : data.length === 0 ? (
          <EmptyState description="Tidak ada kunjungan selesai pada rentang ini. Coba ubah filter." />
        ) : (
          <>
            <Table>
              <THead>
                <TH>No. Kunjungan</TH>
                <TH>Pasien</TH>
                <TH>Tanggal</TH>
                <TH>Unit</TH>
                <TH>Dokter</TH>
                <TH align="right">Aksi</TH>
              </THead>
              <TBody>
                {data.map((k) => (
                  <TR key={k.id}>
                    <TD><span className="font-mono text-xs text-fg-muted">{k.nomorKunjungan}</span></TD>
                    <TD>
                      <div className="flex flex-col">
                        <span className="font-medium text-fg">{k.namaPasien}</span>
                        <span className="text-xs text-fg-muted tabular">RM {k.noRekamMedis}</span>
                      </div>
                    </TD>
                    <TD>
                      <div className="flex flex-col">
                        <span>{formatDate(k.tanggalKunjungan)}</span>
                        <span className="text-xs text-fg-muted tabular">{formatTime(k.tanggalKunjungan)}</span>
                      </div>
                    </TD>
                    <TD>{k.unit}</TD>
                    <TD>{k.dokter ?? <span className="text-fg-subtle">—</span>}</TD>
                    <TD align="right">
                      <Link
                        href={`/print/resume-medik/${k.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                      >
                        <Printer className="size-4 text-fg-muted" />
                        Resume
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {meta && <Pagination meta={meta} onPageChange={setPage} />}
          </>
        )}
      </Card>
    </div>
  );
}
