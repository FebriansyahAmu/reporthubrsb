"use client";

import { useState } from "react";
import { Loader2, Receipt } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ErrorState } from "@/components/feedback/States";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import type { TagihanLengkap } from "@/server/modules/berkas-klaim/berkas-klaim.types";

/** Label ringkas jenis item rincian (1&3 tindakan, 2 konsultasi, 4 farmasi). */
const JENIS_LABEL: Record<number, string> = {
  1: "Tindakan",
  2: "Konsultasi",
  3: "Tindakan",
  4: "Farmasi",
};

/**
 * Tombol "Lihat Rincian" + modal yang memuat rincian tagihan (per-komponen &
 * per-item) secara lazy dari `/api/berkas-klaim/tagihan/[nopen]`.
 */
export function TagihanRincian({ nopen, total }: { nopen: string; total: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<TagihanLengkap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/berkas-klaim/tagihan/${nopen}`);
      if (!res.ok) throw new Error("gagal");
      const json = (await res.json()) as { data: TagihanLengkap };
      setData(json.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    setOpen(true);
    if (!data && !loading) void load();
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <Receipt className="size-4 text-fg-subtle" />
        Lihat Rincian
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="xl"
        title="Rincian Tagihan"
        description={`NOPEN ${nopen} · Total ${formatRupiah(total)}`}
        icon={
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand-soft-fg">
            <Receipt className="size-4.5" />
          </div>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-fg-muted">
            <Loader2 className="size-4 animate-spin" />
            Memuat rincian…
          </div>
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : data ? (
          data.ada ? (
            <RincianBody data={data} />
          ) : (
            <p className="py-12 text-center text-sm text-fg-muted">
              Belum ada tagihan untuk episode ini.
            </p>
          )
        ) : null}
      </Modal>
    </>
  );
}

function RincianBody({ data }: { data: TagihanLengkap }) {
  return (
    <div className="space-y-6">
      {/* Ringkasan per komponen biaya */}
      {data.kategori.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Ringkasan per Komponen
          </h3>
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-border">
            <dl className="divide-y divide-border">
              {data.kategori.map((k) => (
                <div key={k.key} className="flex items-center justify-between gap-4 px-3.5 py-2 text-sm">
                  <dt className="text-fg-muted">{k.label}</dt>
                  <dd className="font-medium text-fg tabular">{formatRupiah(k.nilai)}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 bg-surface-2/50 px-3.5 py-2.5 text-sm">
                <dt className="font-semibold text-fg">Total</dt>
                <dd className="text-base font-bold text-brand-soft-fg tabular">{formatRupiah(data.total)}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {/* Rincian item */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Rincian Item
          </h3>
          <span className="text-xs text-fg-muted tabular">{data.items.length} item</span>
        </div>
        <div className="max-h-[45vh] overflow-auto rounded-[var(--radius-md)] border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur">
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">
                <th className="px-3 py-2 font-semibold">Tanggal</th>
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Tarif</th>
                <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-fg-muted tabular">
                    {it.tanggal ? formatDate(it.tanggal) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-fg">{it.nama}</span>
                    <span className="ml-2 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-fg-subtle">
                      {JENIS_LABEL[it.jenis] ?? "Lain"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-fg-muted tabular">
                    {formatNumber(it.qty)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-fg-muted tabular">
                    {formatRupiah(it.tarif)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-fg tabular">
                    {formatRupiah(it.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-fg-subtle">
          Sumber: SIMGOS (read-only) · Total tervalidasi = jumlah seluruh subtotal item.
        </p>
      </section>
    </div>
  );
}
