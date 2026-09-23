"use client";

import { useState } from "react";
import { AlertTriangle, Check, Pencil, Plus, Scissors, Trash2, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  BULAN_LABEL,
  JENIS_KLAIM_LABEL,
  POTONGAN_JENIS, POTONGAN_JENIS_LABEL,
  type JenisKlaim, type PotonganJenis,
} from "@/server/modules/rekap-klaim/klaim.schema";
import type { KlaimItem } from "./klaim.client";
import {
  createPotongan, deletePotongan, fetchPotongan, updatePotongan, type PotonganItem,
} from "./potongan.client";

type Perms = { create: boolean; update: boolean; delete: boolean };

const digits = (s: string) => s.replace(/\D/g, "");
const groupID = (s: string) => (s ? Number(s).toLocaleString("id-ID") : "");
const shortBulan = (m: number) => BULAN_LABEL[m - 1].slice(0, 3);

const POTONGAN_TONE: Record<PotonganJenis, "warning" | "danger" | "accent" | "brand" | "neutral"> = {
  AAK: "warning",
  KELEBIHAN_BAYAR: "danger",
  VPK: "accent",
  POTONGAN_BERKALA: "brand",
  PENGEMBALIAN: "neutral",
};

const jenisOpts: SelectOption[] = POTONGAN_JENIS.map((v) => ({ value: v, label: POTONGAN_JENIS_LABEL[v] }));

type PForm = {
  jenis: PotonganJenis;
  jumlah: string;
  cicilanKe: string;
  totalCicilan: string;
  refBa: string;
  tglTerapkan: string;
  deskripsi: string;
};
const emptyForm: PForm = { jenis: "POTONGAN_BERKALA", jumlah: "", cicilanKe: "", totalCicilan: "", refBa: "", tglTerapkan: "", deskripsi: "" };

export function PotonganModal({
  open, klaim, perms, onClose, onChanged,
}: {
  open: boolean;
  klaim: KlaimItem | null;
  perms: Perms;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const state = useAsyncData(
    () => (klaim ? fetchPotongan(klaim.id) : Promise.resolve(null)),
    [klaim?.id, open],
  );
  const rows = state.result?.data ?? [];
  const meta = state.result?.meta;

  const [form, setForm] = useState<PForm>(emptyForm);
  const [editing, setEditing] = useState<PotonganItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Reset form saat modal dibuka (fase render).
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) { setWasOpen(true); setForm(emptyForm); setEditing(null); setConfirmDel(null); }
  else if (!open && wasOpen) { setWasOpen(false); }

  const set = <K extends keyof PForm>(k: K, v: PForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const netto = meta ? meta.klaim.jumlah - meta.totalPotongan : 0;
  const cicilanBelumLunas = rows.filter((r) => r.jenis === "POTONGAN_BERKALA" && r.cicilanKe != null && r.totalCicilan != null && r.cicilanKe < r.totalCicilan);

  function startEdit(p: PotonganItem) {
    setEditing(p);
    setForm({
      jenis: p.jenis,
      jumlah: String(p.jumlah),
      cicilanKe: p.cicilanKe != null ? String(p.cicilanKe) : "",
      totalCicilan: p.totalCicilan != null ? String(p.totalCicilan) : "",
      refBa: p.refBa ?? "",
      tglTerapkan: p.tglTerapkan ?? "",
      deskripsi: p.deskripsi ?? "",
    });
  }
  function cancelEdit() { setEditing(null); setForm(emptyForm); }

  async function submit() {
    if (!klaim) return;
    if (!form.jumlah) { toast.error("Lengkapi data", "Jumlah potongan (Rp) wajib diisi."); return; }
    setSaving(true);
    try {
      const body = {
        jenis: form.jenis,
        jumlah: form.jumlah,
        cicilanKe: form.jenis === "POTONGAN_BERKALA" ? (form.cicilanKe || undefined) : undefined,
        totalCicilan: form.jenis === "POTONGAN_BERKALA" ? (form.totalCicilan || undefined) : undefined,
        refBa: form.refBa.trim() || undefined,
        tglTerapkan: form.tglTerapkan || undefined,
        deskripsi: form.deskripsi.trim() || undefined,
      };
      if (editing) {
        await updatePotongan(editing.id, body);
        toast.success("Tersimpan", "Potongan diperbarui.");
      } else {
        await createPotongan({ klaimId: klaim.id, ...body });
        toast.success("Potongan ditambahkan", POTONGAN_JENIS_LABEL[form.jenis]);
      }
      setForm(emptyForm); setEditing(null);
      state.reload();
      onChanged();
    } catch (e) {
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(id: string) {
    setSaving(true);
    try {
      await deletePotongan(id);
      toast.success("Potongan dihapus");
      setConfirmDel(null);
      if (editing?.id === id) cancelEdit();
      state.reload();
      onChanged();
    } catch (e) {
      toast.error("Gagal menghapus", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  const canMutate = perms.create || perms.update;

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      size="lg"
      icon={<span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand"><Scissors className="size-5" /></span>}
      title="Potongan & Adjustment"
      description={klaim ? `${JENIS_KLAIM_LABEL[klaim.jenisKlaim as JenisKlaim]} · ${shortBulan(klaim.bulanPelayanan)} ${klaim.tahunPelayanan}` : undefined}
      footer={<div className="flex justify-end"><Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Tutup</Button></div>}
    >
      <div className="space-y-4">
        {/* Ringkas nilai */}
        {meta && (
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Diterima" value={formatRupiah(meta.klaim.jumlah)} />
            <MiniStat label="Total Potongan" value={formatRupiah(meta.totalPotongan)} tone={meta.totalPotongan > 0 ? "danger" : "neutral"} />
            <MiniStat label="Nilai Bersih" value={formatRupiah(netto)} tone="success" strong />
          </div>
        )}

        {/* Alert cicilan belum lunas */}
        {cicilanBelumLunas.length > 0 && (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft/50 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              {cicilanBelumLunas.length} potongan bertahap belum lunas:{" "}
              {cicilanBelumLunas.map((r) => `Ke-${r.cicilanKe}/${r.totalCicilan}`).join(", ")}.
            </span>
          </div>
        )}

        {/* Daftar potongan */}
        <div>
          <p className="mb-2 text-xs font-semibold text-fg-muted">Daftar Potongan {meta ? `(${meta.total})` : ""}</p>
          {state.loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-[var(--radius-md)]" />)}</div>
          ) : state.error ? (
            <ErrorState onRetry={state.reload} />
          ) : rows.length === 0 ? (
            <EmptyState title="Belum ada potongan" description="Tambahkan potongan/adjustment di bawah bila ada." />
          ) : (
            <ul className="space-y-2">
              {rows.map((p) => {
                const sisa = p.cicilanKe != null && p.totalCicilan != null ? p.totalCicilan - p.cicilanKe : null;
                return (
                  <li key={p.id} className="rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={POTONGAN_TONE[p.jenis]} dot>{POTONGAN_JENIS_LABEL[p.jenis]}</Badge>
                          {p.cicilanKe != null && p.totalCicilan != null && (
                            <Badge tone={sisa && sisa > 0 ? "warning" : "success"}>
                              Ke-{p.cicilanKe}/{p.totalCicilan}{sisa && sisa > 0 ? ` · sisa ${sisa}` : " · lunas"}
                            </Badge>
                          )}
                          {p.tglTerapkan && <span className="text-[11px] text-fg-subtle">{fmtTgl(p.tglTerapkan)}</span>}
                        </div>
                        {(p.refBa || p.deskripsi) && (
                          <p className="mt-1 truncate text-xs text-fg-muted">
                            {p.refBa ? <span className="font-mono">{p.refBa}</span> : null}{p.refBa && p.deskripsi ? " · " : ""}{p.deskripsi}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-danger tabular-nums">−{formatRupiah(p.jumlah)}</span>
                        {canMutate && confirmDel !== p.id && (
                          <div className="flex gap-0.5">
                            {perms.update && (
                              <button type="button" onClick={() => startEdit(p)} title="Ubah" className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-brand-soft hover:text-brand"><Pencil className="size-3.5" /></button>
                            )}
                            {perms.delete && (
                              <button type="button" onClick={() => setConfirmDel(p.id)} title="Hapus" className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger"><Trash2 className="size-3.5" /></button>
                            )}
                          </div>
                        )}
                        {confirmDel === p.id && (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => doDelete(p.id)} disabled={saving} className="rounded-md bg-danger px-2 py-1 text-[11px] font-medium text-white hover:opacity-90">Hapus</button>
                            <button type="button" onClick={() => setConfirmDel(null)} className="rounded-md p-1 text-fg-subtle hover:bg-surface-2"><X className="size-3.5" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Form tambah / ubah */}
        {canMutate && (
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-fg">{editing ? "Ubah Potongan" : "Tambah Potongan"}</p>
              {editing && <button type="button" onClick={cancelEdit} className="text-[11px] font-medium text-fg-muted hover:text-fg">Batal ubah</button>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="p-jenis">Jenis Potongan</Label>
                <Select id="p-jenis" value={form.jenis} onChange={(v) => set("jenis", v as PotonganJenis)} options={jenisOpts} />
              </div>
              <div>
                <Label htmlFor="p-jumlah">Jumlah (Rp) <span className="text-danger">*</span></Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">Rp</span>
                  <Input id="p-jumlah" inputMode="numeric" value={groupID(form.jumlah)} placeholder="0"
                    onChange={(e) => set("jumlah", digits(e.target.value))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
                    className="pl-9 text-right font-semibold tabular-nums" />
                </div>
              </div>
              <div>
                <Label htmlFor="p-tgl">Tgl Diterapkan</Label>
                <DatePicker id="p-tgl" value={form.tglTerapkan} onChange={(v) => set("tglTerapkan", v)} max={new Date().toISOString().slice(0, 10)} />
              </div>
              {form.jenis === "POTONGAN_BERKALA" && (
                <>
                  <div>
                    <Label htmlFor="p-ke">Cicilan Ke-</Label>
                    <Input id="p-ke" inputMode="numeric" value={form.cicilanKe} placeholder="mis. 1" onChange={(e) => set("cicilanKe", digits(e.target.value))} />
                  </div>
                  <div>
                    <Label htmlFor="p-total">Dari Total Cicilan</Label>
                    <Input id="p-total" inputMode="numeric" value={form.totalCicilan} placeholder="mis. 3" onChange={(e) => set("totalCicilan", digits(e.target.value))} />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="p-ba">No. BA Kesepakatan</Label>
                <Input id="p-ba" value={form.refBa} placeholder="opsional" onChange={(e) => set("refBa", e.target.value)} />
              </div>
              <div className={cn(form.jenis === "POTONGAN_BERKALA" ? "sm:col-span-2" : "")}>
                <Label htmlFor="p-desk">Keterangan</Label>
                <Input id="p-desk" value={form.deskripsi} placeholder="opsional" onChange={(e) => set("deskripsi", e.target.value)} />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={submit} loading={saving} icon={editing ? <Check className="size-4" /> : <Plus className="size-4" />}>
                {editing ? "Simpan Perubahan" : "Tambah Potongan"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function fmtTgl(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return iso;
  return `${d} ${shortBulan(m)} ${y}`;
}

function MiniStat({ label, value, tone = "neutral", strong }: { label: string; value: string; tone?: "neutral" | "danger" | "success"; strong?: boolean }) {
  const color = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-fg";
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface-2/40 px-3 py-2">
      <p className="text-[11px] text-fg-subtle">{label}</p>
      <p className={cn("mt-0.5 tabular-nums", strong ? "text-base font-bold" : "text-sm font-semibold", color)}>{value}</p>
    </div>
  );
}
