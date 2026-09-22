"use client";

import { useEffect, useRef, useState } from "react";
import { Landmark, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  BULAN_LABEL,
  JENIS_KLAIM, JENIS_KLAIM_LABEL,
  JENIS_LAYANAN,
  KATEGORI_KLAIM, KATEGORI_KLAIM_LABEL,
  STATUS_KLAIM, STATUS_KLAIM_LABEL,
  type JenisKlaim, type JenisLayanan, type KategoriKlaim, type StatusKlaim,
} from "@/server/modules/rekap-klaim/klaim.schema";
import { createKlaim, updateKlaim, type KlaimItem, type KlaimPayload } from "./klaim.client";

export type KlaimDefaults = {
  jenisKlaim: JenisKlaim;
  jenisLayanan: JenisLayanan;
  kategori: KategoriKlaim;
  bulanPelayanan: number;
  tahunPelayanan: number;
  status: StatusKlaim;
};

type FormState = {
  nomorKlaim: string;
  jenisKlaim: JenisKlaim;
  jenisLayanan: JenisLayanan;
  kategori: KategoriKlaim;
  bulanPelayanan: string;
  tahunPelayanan: string;
  jumlah: string;
  jumlahDiajukan: string;
  jumlahKasus: string;
  tglMasukRekening: string;
  status: StatusKlaim;
  refBa: string;
  catatan: string;
};

const digits = (s: string) => s.replace(/\D/g, "");
const groupID = (s: string) => (s ? Number(s).toLocaleString("id-ID") : "");

function fromDefaults(d: KlaimDefaults): FormState {
  return {
    nomorKlaim: "", jenisKlaim: d.jenisKlaim, jenisLayanan: d.jenisLayanan, kategori: d.kategori,
    bulanPelayanan: String(d.bulanPelayanan), tahunPelayanan: String(d.tahunPelayanan),
    jumlah: "", jumlahDiajukan: "", jumlahKasus: "", tglMasukRekening: "",
    status: d.status, refBa: "", catatan: "",
  };
}
function fromItem(k: KlaimItem): FormState {
  return {
    nomorKlaim: k.nomorKlaim ?? "",
    jenisKlaim: k.jenisKlaim, jenisLayanan: k.jenisLayanan, kategori: k.kategori,
    bulanPelayanan: String(k.bulanPelayanan), tahunPelayanan: String(k.tahunPelayanan),
    jumlah: String(k.jumlah), jumlahDiajukan: k.jumlahDiajukan != null ? String(k.jumlahDiajukan) : "",
    jumlahKasus: k.jumlahKasus != null ? String(k.jumlahKasus) : "",
    tglMasukRekening: k.tglMasukRekening ?? "",
    status: k.status, refBa: k.refBa ?? "", catatan: k.catatan ?? "",
  };
}

const bulanOpts: SelectOption[] = BULAN_LABEL.map((b, i) => ({ value: String(i + 1), label: b }));
const statusOpts: SelectOption[] = STATUS_KLAIM.map((s) => ({ value: s, label: STATUS_KLAIM_LABEL[s] }));

export function KlaimFormModal({
  open,
  mode,
  item,
  defaults,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  item?: KlaimItem | null;
  defaults: KlaimDefaults;
  onClose: () => void;
  onSaved: (saved: KlaimItem, keepOpen: boolean) => void;
}) {
  const toast = useToast();
  const isEdit = mode === "edit";
  const [form, setForm] = useState<FormState>(() => fromDefaults(defaults));
  const [saving, setSaving] = useState(false);
  const jumlahRef = useRef<HTMLInputElement>(null);

  // Seed saat modal terbuka (fase render, bukan effect).
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setForm(isEdit && item ? fromItem(item) : fromDefaults(defaults));
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  // Autofokus kolom Jumlah saat modal terbuka (efek, bukan fase render).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => jumlahRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  function buildPayload(): KlaimPayload | null {
    const tahun = Number(form.tahunPelayanan);
    if (!Number.isFinite(tahun) || tahun < 2015) {
      toast.error("Lengkapi data", "Tahun pelayanan tidak valid.");
      return null;
    }
    if (!form.jumlah) {
      toast.error("Lengkapi data", "Jumlah (Rp) wajib diisi.");
      jumlahRef.current?.focus();
      return null;
    }
    return {
      nomorKlaim: form.nomorKlaim.trim() || undefined,
      jenisKlaim: form.jenisKlaim,
      jenisLayanan: form.jenisLayanan,
      kategori: form.kategori,
      bulanPelayanan: Number(form.bulanPelayanan),
      tahunPelayanan: tahun,
      jumlah: form.jumlah,
      jumlahDiajukan: form.jumlahDiajukan || undefined,
      jumlahKasus: form.jumlahKasus || undefined,
      tglMasukRekening: form.tglMasukRekening || undefined,
      status: form.status,
      refBa: form.refBa.trim() || undefined,
      catatan: form.catatan.trim() || undefined,
    };
  }

  async function submit(addAnother: boolean) {
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    try {
      if (isEdit && item) {
        const saved = await updateKlaim(item.id, payload);
        toast.success("Tersimpan", "Klaim berhasil diperbarui.");
        onSaved(saved, false);
        onClose();
      } else {
        const saved = await createKlaim(payload);
        toast.success("Klaim ditambahkan", `${JENIS_KLAIM_LABEL[saved.jenisKlaim]} · ${BULAN_LABEL[saved.bulanPelayanan - 1]} ${saved.tahunPelayanan}`);
        onSaved(saved, addAnother);
        if (addAnother) {
          // Reset hanya nilai/rincian; pertahankan periode & jenis untuk entri beruntun.
          setForm((f) => ({ ...f, nomorKlaim: "", jumlah: "", jumlahDiajukan: "", jumlahKasus: "", tglMasukRekening: "", refBa: "", catatan: "" }));
          setTimeout(() => jumlahRef.current?.focus(), 40);
        } else {
          onClose();
        }
      }
    } catch (e) {
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      size="xl"
      icon={
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
          <Landmark className="size-5" />
        </span>
      }
      title={isEdit ? "Ubah Klaim" : "Tambah Klaim"}
      description={isEdit ? "Perbarui data entri klaim." : "Catat satu entri klaim. Enter = simpan & tambah lagi untuk input beruntun."}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <p className="hidden text-[11px] text-fg-subtle sm:block">
            {isEdit ? "" : "Tip: tekan Enter di kolom Jumlah untuk simpan & tambah lagi."}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Batal</Button>
            {!isEdit && (
              <Button variant="secondary" size="sm" onClick={() => submit(true)} loading={saving} icon={<Plus className="size-4" />}>
                Simpan &amp; Tambah Lagi
              </Button>
            )}
            <Button size="sm" onClick={() => submit(false)} loading={saving}>
              {isEdit ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Jenis / layanan / kategori — segmented cepat */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Segmented
            label="Jenis Klaim"
            value={form.jenisKlaim}
            onChange={(v) => set("jenisKlaim", v)}
            options={JENIS_KLAIM.map((v) => ({ value: v, label: JENIS_KLAIM_LABEL[v] }))}
          />
          <Segmented
            label="Jenis Layanan"
            value={form.jenisLayanan}
            onChange={(v) => set("jenisLayanan", v)}
            options={JENIS_LAYANAN.map((v) => ({ value: v, label: v === "RITL" ? "Rawat Inap" : "Rawat Jalan" }))}
          />
          <Segmented
            label="Kategori"
            value={form.kategori}
            onChange={(v) => set("kategori", v)}
            options={KATEGORI_KLAIM.map((v) => ({ value: v, label: KATEGORI_KLAIM_LABEL[v] }))}
          />
        </div>

        <div className="border-t border-border" />

        {/* Periode + jumlah */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="k-bulan">Bulan Pelayanan</Label>
            <Select id="k-bulan" value={form.bulanPelayanan} onChange={(v) => set("bulanPelayanan", v)} options={bulanOpts} />
          </div>
          <div>
            <Label htmlFor="k-tahun">Tahun Pelayanan <span className="text-danger">*</span></Label>
            <Input id="k-tahun" inputMode="numeric" maxLength={4} value={form.tahunPelayanan}
              onChange={(e) => set("tahunPelayanan", digits(e.target.value).slice(0, 4))} placeholder="mis. 2026" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="k-jumlah">Jumlah Diterima (Rp) <span className="text-danger">*</span></Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">Rp</span>
              <Input
                ref={jumlahRef}
                id="k-jumlah"
                inputMode="numeric"
                value={groupID(form.jumlah)}
                placeholder="0"
                onChange={(e) => set("jumlah", digits(e.target.value))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(!isEdit); } }}
                className="pl-9 text-right text-base font-semibold tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Rincian tambahan */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="k-diajukan">Jumlah Diajukan (Rp)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">Rp</span>
              <Input id="k-diajukan" inputMode="numeric" value={groupID(form.jumlahDiajukan)} placeholder="opsional — utk selisih"
                onChange={(e) => set("jumlahDiajukan", digits(e.target.value))} className="pl-9 text-right tabular-nums" />
            </div>
          </div>
          <div>
            <Label htmlFor="k-kasus">Jumlah Kasus</Label>
            <Input id="k-kasus" inputMode="numeric" value={form.jumlahKasus} placeholder="opsional"
              onChange={(e) => set("jumlahKasus", digits(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="k-status">Status</Label>
            <Select id="k-status" value={form.status} onChange={(v) => set("status", v as StatusKlaim)} options={statusOpts} />
          </div>
          <div>
            <Label htmlFor="k-tgl">Tgl Masuk Rekening</Label>
            <DatePicker id="k-tgl" value={form.tglMasukRekening} onChange={(v) => set("tglMasukRekening", v)} max={new Date().toISOString().slice(0, 10)} />
          </div>
        </div>

        {/* Referensi */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="k-nomor">Nomor Klaim</Label>
            <Input id="k-nomor" value={form.nomorKlaim} placeholder="opsional" onChange={(e) => set("nomorKlaim", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="k-ba">No. BA Kesepakatan</Label>
            <Input id="k-ba" value={form.refBa} placeholder="mis. 445/RSUD.01/077/II/2026" onChange={(e) => set("refBa", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="k-catatan">Keterangan</Label>
            <textarea
              id="k-catatan"
              rows={2}
              value={form.catatan}
              placeholder="Catatan tambahan (opsional)…"
              onChange={(e) => set("catatan", e.target.value)}
              className="w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle transition-colors focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring/40"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------ segmented pill input */

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={active}
              className={cn(
                "rounded-[var(--radius-md)] border px-3 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                active
                  ? "border-brand bg-brand-soft text-brand-soft-fg"
                  : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
