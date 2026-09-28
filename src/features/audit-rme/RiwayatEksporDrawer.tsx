"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, ShieldCheck } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { NumberedPagination } from "@/components/ui/NumberedPagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatNumber } from "@/lib/format";
import { fetchRiwayatEkspor, type RiwayatEksporItem, type RiwayatEksporPage } from "./audit.client";
import { fmtWaktu } from "./KunjunganCardView";

const ukuranTeks = (b: number | null) => (b == null ? null : b < 1024 * 1024 ? `${formatNumber(Math.max(1, Math.round(b / 1024)))} KB` : `${formatNumber(Math.round((b / 1048576) * 10) / 10)} MB`);

/**
 * Riwayat ekspor (meta-audit K5): siapa mengunduh laporan apa, kapan, dengan
 * cakupan apa — dari `audit_log` aplikasi. Kode ekspor sama dengan yang
 * tercetak di dokumen, sehingga berkas cetak dapat ditelusuri balik.
 */
export function RiwayatEksporDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const { result, loading, error, reload } = useAsyncData<RiwayatEksporPage | null>(
    () => (open ? fetchRiwayatEkspor(page) : Promise.resolve(null)),
    [open, page],
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Riwayat ekspor"
      size="lg"
      header={
        <div>
          <h3 className="flex items-center gap-1.5 text-base font-semibold text-fg">
            <ShieldCheck className="size-4 text-brand" /> Riwayat ekspor
          </h3>
          <p className="mt-0.5 text-xs text-fg-muted">
            Setiap berkas Excel/PDF dari modul ini tercatat: siapa, kapan, dan cakupannya. Nomor ekspor sama dengan yang tercetak di dokumen.
          </p>
        </div>
      }
    >
      {error && !loading ? (
        <div className="p-5"><ErrorState onRetry={reload} /></div>
      ) : !result ? (
        <div className="space-y-2 p-5" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded" />)}
        </div>
      ) : result.total === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-fg-muted">Belum ada ekspor yang tercatat.</p>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : undefined}>
          <ul className="divide-y divide-border">
            {result.items.map((it) => <Baris key={it.id} it={it} />)}
          </ul>
          <div className="flex flex-col items-center justify-between gap-2 border-t border-border px-5 py-3 sm:flex-row">
            <p className="text-xs text-fg-muted"><b className="tabular text-fg">{formatNumber(result.total)}</b> ekspor tercatat</p>
            <NumberedPagination page={result.page} totalPages={result.totalPages} onPageChange={setPage} />
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Baris({ it }: { it: RiwayatEksporItem }) {
  const Icon = it.format === "pdf" ? FileText : FileSpreadsheet;
  const detail = [it.oleh ?? "—", fmtWaktu(it.waktu), it.jumlah != null ? `${formatNumber(it.jumlah)} baris` : null, ukuranTeks(it.ukuran), it.ip]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand" aria-hidden>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-fg">{it.laporanLabel}</span>
          <span className="text-[10px] font-semibold text-fg-subtle uppercase">{it.format ?? "—"}</span>
          {it.kode && <span className="ml-auto font-mono text-[11px] text-fg-muted">{it.kode}</span>}
        </span>
        {it.ringkasan && <span className="block truncate text-xs text-fg-muted" title={it.ringkasan}>{it.ringkasan}</span>}
        <span className="block text-[11px] text-fg-subtle">{detail}</span>
      </span>
    </li>
  );
}
