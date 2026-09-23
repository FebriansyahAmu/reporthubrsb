"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Scissors, Upload, XCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatRupiah, formatRupiahRingkas } from "@/lib/format";
import { downloadTemplate, importCommit, importPreview, type ImportPreview, type ImportRowResult } from "./import.client";

export function ImportKlaimModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  function reset() {
    setFile(null); setPreview(null); setLoading(false); setCommitting(false);
    if (inputRef.current) inputRef.current.value = "";
  }
  function handleClose() { if (loading || committing) return; reset(); onClose(); }

  async function onPick(f: File | null) {
    if (!f) return;
    setFile(f); setPreview(null); setLoading(true);
    try {
      setPreview(await importPreview(f));
    } catch (e) {
      toast.error("Berkas tidak dapat diproses", e instanceof Error ? e.message : undefined);
      reset();
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!file || !preview || preview.ringkasan.valid === 0) return;
    setCommitting(true);
    try {
      const res = await importCommit(file);
      const extra = res.potonganMasuk ? ` · ${res.potonganMasuk} potongan` : "";
      toast.success("Import selesai", `${res.masuk} klaim ditambahkan${extra}.`);
      onDone(); reset(); onClose();
    } catch (e) {
      toast.error("Import gagal", e instanceof Error ? e.message : undefined);
    } finally {
      setCommitting(false);
    }
  }

  async function onTemplate() {
    try { await downloadTemplate(); } catch (e) { toast.error("Gagal mengunduh template", e instanceof Error ? e.message : undefined); }
  }

  const r = preview?.ringkasan;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="xl"
      icon={<span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-success-soft text-success"><FileSpreadsheet className="size-5" /></span>}
      title="Import Klaim Historis dari Excel"
      description="Unggah data historis (.xlsx) sesuai template. Total per tahun dicek terhadap baseline PRD §7."
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button type="button" onClick={onTemplate} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand transition-colors hover:text-brand-hover">
            <Download className="size-4" /> Unduh template
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleClose} disabled={loading || committing}>Tutup</Button>
            <Button size="sm" onClick={commit} loading={committing} disabled={!preview || !r || r.valid === 0 || loading} icon={<Upload className="size-4" />}>
              {r && r.valid > 0 ? `Impor ${r.valid} klaim` : "Impor"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading || committing}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-border bg-surface-2/30 px-4 py-6 text-center transition-colors",
            "hover:border-brand/50 hover:bg-brand-soft/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-60",
          )}
        >
          {file ? (
            <>
              <FileSpreadsheet className="size-7 text-success" />
              <span className="text-sm font-medium text-fg">{file.name}</span>
              <span className="text-xs text-fg-muted">Klik untuk memilih berkas lain</span>
            </>
          ) : (
            <>
              <Upload className="size-7 text-fg-subtle" />
              <span className="text-sm font-medium text-fg">Pilih berkas Excel (.xlsx)</span>
              <span className="text-xs text-fg-muted">Sheet wajib: “Klaim”. Sheet “Potongan” opsional. Maks. 5 MB.</span>
            </>
          )}
        </button>
        <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />

        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-fg-muted">
            <Loader2 className="size-4 animate-spin" /> Memeriksa berkas…
          </div>
        )}

        {preview && r && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Baris" value={r.baris} tone="neutral" />
              <Stat label="Valid" value={r.valid} tone="success" icon={CheckCircle2} />
              <Stat label="Error" value={r.error} tone="danger" icon={XCircle} />
              <Stat label="Potongan valid" value={r.potonganValid} tone="brand" icon={Scissors} />
              <Stat label="Potongan error" value={r.potonganError} tone="warning" icon={AlertTriangle} />
            </div>

            {/* Cek baseline per tahun */}
            {preview.baseline.length > 0 && (
              <div className="rounded-[var(--radius-md)] border border-border">
                <div className="border-b border-border px-3 py-2 text-xs font-semibold text-fg-muted">Total INA-CBG&apos;s per tahun vs baseline PRD §7</div>
                <div className="divide-y divide-border">
                  {preview.baseline.map((b) => (
                    <div key={b.tahun} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="font-medium text-fg tabular-nums">{b.tahun}</span>
                      <span className="text-fg-muted tabular-nums">{formatRupiah(b.impor)}</span>
                      {b.baseline == null ? (
                        <Badge tone="neutral">tanpa baseline</Badge>
                      ) : b.cocok ? (
                        <Badge tone="success" dot>cocok baseline</Badge>
                      ) : (
                        <Badge tone="warning" className="gap-1"><AlertTriangle className="size-3" /> selisih {formatRupiahRingkas(Math.abs(b.selisih ?? 0))}</Badge>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-border px-3 py-2 text-[11px] text-fg-subtle">
                  Total INA-CBG&apos;s: <span className="font-medium text-fg">{formatRupiah(r.totalInaCbgs)}</span>
                  {r.totalRujukan > 0 && <> · Rujukan Ambulans: <span className="font-medium text-fg">{formatRupiah(r.totalRujukan)}</span></>}
                </div>
              </div>
            )}

            {r.valid === 0 && (
              <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Tidak ada baris klaim valid untuk diimpor. Perbaiki berkas lalu unggah ulang.
              </div>
            )}

            <RowsTable title="Klaim" rows={preview.klaim} />
            {preview.potongan.length > 0 && <RowsTable title="Potongan" rows={preview.potongan} />}

            <p className="text-[11px] text-fg-subtle">
              Hanya baris <span className="font-medium text-success">Valid</span> yang disimpan. Import menambah data (tidak menimpa) — jalankan sekali untuk menghindari duplikat.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

function RowsTable({ title, rows }: { title: string; rows: ImportRowResult[] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-fg-muted">{title} <span className="text-fg-subtle">({rows.length})</span></p>
      <div className="max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-surface-2">
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">
              <th className="w-14 px-3 py-2">Baris</th>
              <th className="w-20 px-3 py-2">Status</th>
              <th className="px-3 py-2">Ringkasan</th>
              <th className="px-3 py-2">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => (
              <tr key={it.baris} className="border-b border-border align-top last:border-0">
                <td className="px-3 py-2 text-xs tabular-nums text-fg-subtle">{it.baris}</td>
                <td className="px-3 py-2">
                  {it.status === "valid"
                    ? <Badge tone="success"><CheckCircle2 className="size-3" /> Valid</Badge>
                    : <Badge tone="danger"><XCircle className="size-3" /> Error</Badge>}
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-fg">{it.label}</p>
                  {it.jumlah != null && <p className="text-xs tabular-nums text-fg-subtle">{formatRupiah(it.jumlah)}{it.ref ? ` · ref ${it.ref}` : ""}</p>}
                </td>
                <td className="px-3 py-2 text-xs text-fg-muted">{it.catatan.length ? it.catatan.join("; ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value: number; tone: "neutral" | "brand" | "success" | "warning" | "danger"; icon?: typeof CheckCircle2 }) {
  const ring: Record<string, string> = {
    neutral: "border-border bg-surface-2/50 text-fg",
    brand: "border-brand/30 bg-brand-soft text-brand-soft-fg",
    success: "border-success/30 bg-success-soft text-success",
    warning: "border-warning/30 bg-warning-soft text-warning",
    danger: "border-danger/30 bg-danger-soft text-danger",
  };
  return (
    <div className={cn("rounded-[var(--radius-md)] border px-3 py-2", ring[tone])}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide opacity-80">
        {Icon && <Icon className="size-3.5" />} {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
