"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Copy,
  DoorOpen,
  Download,
  FileSpreadsheet,
  Layers,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { downloadFromEndpoint } from "@/lib/download";
import { importCommit, importPreview, type ImportPreview, type ImportRowResult } from "./barang.client";

const STATUS_META: Record<ImportRowResult["status"], { tone: "success" | "warning" | "danger"; label: string; icon: typeof CheckCircle2 }> = {
  valid: { tone: "success", label: "Valid", icon: CheckCircle2 },
  duplikat: { tone: "warning", label: "Duplikat", icon: Copy },
  error: { tone: "danger", label: "Error", icon: XCircle },
};

export function ImportBarangModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setLoading(false);
    setCommitting(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose() {
    if (loading || committing) return;
    reset();
    onClose();
  }

  async function onPick(f: File | null) {
    if (!f) return;
    setFile(f);
    setPreview(null);
    setLoading(true);
    try {
      const p = await importPreview(f);
      setPreview(p);
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
      const extra = [res.ruanganBaru ? `${res.ruanganBaru} ruangan baru` : "", res.itemBaru ? `${res.itemBaru} item katalog` : ""].filter(Boolean).join(" · ");
      toast.success("Import selesai", `${res.masuk} unit ditambahkan${extra ? ` (${extra})` : ""}.`);
      onDone();
      reset();
      onClose();
    } catch (e) {
      toast.error("Import gagal", e instanceof Error ? e.message : undefined);
    } finally {
      setCommitting(false);
    }
  }

  async function onTemplate() {
    try {
      await downloadFromEndpoint("/api/inventaris/barang/import/template", "Template-Import-Barang.xlsx");
    } catch (e) {
      toast.error("Gagal mengunduh template", e instanceof Error ? e.message : undefined);
    }
  }

  const r = preview?.ringkasan;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="xl"
      icon={
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-success-soft text-success">
          <FileSpreadsheet className="size-5" />
        </span>
      }
      title="Import Barang dari Excel"
      description="Unggah data existing (.xlsx). Baris duplikat & error otomatis dilewati."
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={onTemplate}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand transition-colors hover:text-brand-hover"
          >
            <Download className="size-4" /> Unduh template
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleClose} disabled={loading || committing}>
              Tutup
            </Button>
            <Button
              size="sm"
              onClick={commit}
              loading={committing}
              disabled={!preview || !r || r.valid === 0 || loading}
              icon={<Upload className="size-4" />}
            >
              {r && r.valid > 0 ? `Impor ${r.unit} unit` : "Impor"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Dropzone / pemilih file */}
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
              <span className="text-xs text-fg-muted">Kolom wajib: Nama Barang & Ruangan. Maks. 5 MB.</span>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />

        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-fg-muted">
            <Loader2 className="size-4 animate-spin" /> Memeriksa berkas…
          </div>
        )}

        {preview && r && (
          <>
            {/* Ringkasan */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Baris" value={r.baris} tone="neutral" />
              <Stat label="Unit dibuat" value={r.unit} tone="brand" icon={Boxes} />
              <Stat label="Valid" value={r.valid} tone="success" icon={CheckCircle2} />
              <Stat label="Duplikat" value={r.duplikat} tone="warning" icon={Copy} />
              <Stat label="Error" value={r.error} tone="danger" icon={XCircle} />
            </div>

            {/* Ruangan & item baru */}
            {(r.ruanganBaru.length > 0 || r.itemBaru > 0) && (
              <div className="flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-brand/25 bg-brand-soft/30 px-3 py-2 text-xs text-fg">
                {r.ruanganBaru.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <DoorOpen className="mt-0.5 size-3.5 shrink-0 text-brand" />
                    <span>
                      <span className="font-medium">{r.ruanganBaru.length} ruangan baru</span> akan dibuat otomatis:{" "}
                      {r.ruanganBaru.map((x) => `${x.nama} (${x.prefix})`).join(", ")}
                    </span>
                  </div>
                )}
                {r.itemBaru > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Layers className="size-3.5 shrink-0 text-brand" />
                    <span><span className="font-medium">{r.itemBaru} item katalog baru</span> akan dibuat dari nama barang.</span>
                  </div>
                )}
              </div>
            )}

            {r.valid === 0 && (
              <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Tidak ada baris valid untuk diimpor. Perbaiki berkas lalu unggah ulang.
              </div>
            )}

            {/* Daftar baris */}
            <div className="max-h-72 overflow-y-auto rounded-[var(--radius-md)] border border-border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-surface-2">
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">
                    <th className="px-3 py-2 w-14">Baris</th>
                    <th className="px-3 py-2 w-24">Status</th>
                    <th className="px-3 py-2">Barang</th>
                    <th className="px-3 py-2">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((it) => {
                    const m = STATUS_META[it.status];
                    const Icon = m.icon;
                    return (
                      <tr key={it.baris} className="border-b border-border last:border-0 align-top">
                        <td className="px-3 py-2 text-xs text-fg-subtle tabular-nums">{it.baris}</td>
                        <td className="px-3 py-2">
                          <Badge tone={m.tone}>
                            <Icon className="size-3" /> {m.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-fg">
                            {it.nama}
                            {it.unit > 1 && <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand-soft-fg">× {it.unit}</span>}
                          </p>
                          <p className="text-xs text-fg-subtle">
                            {it.kodeBarang ? <span className="font-mono">{it.kodeBarang}</span> : "kode otomatis"}
                            {it.ruangan ? ` · ${it.ruangan}` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-xs text-fg-muted">
                          {it.catatan.length ? it.catatan.join(" ") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-fg-subtle">
              Hanya baris <span className="font-medium text-success">Valid</span> yang akan disimpan. Baris duplikat/error dilewati tanpa mengubah data lama.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

function Stat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "neutral" | "brand" | "success" | "warning" | "danger";
  icon?: typeof CheckCircle2;
}) {
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
