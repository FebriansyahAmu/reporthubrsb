"use client";

import { useState } from "react";
import { CalendarClock, History, Pencil, Wrench, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatDate, formatRupiah, toLocalDateInput } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  HASIL_LABEL, HASIL_PEMELIHARAAN, HASIL_TONE, JENIS_LABEL, JENIS_PEMELIHARAAN,
} from "@/server/modules/inventaris/pemeliharaan.schema";
import {
  createPemeliharaan, fetchRiwayat, updatePemeliharaan,
  type PemeliharaanPayload, type PemeliharaanRefs, type RiwayatRow,
} from "./pemeliharaan.client";

type FormState = {
  tanggal: string; jenis: string; hasil: string; kondisiSesudahId: string;
  petugas: string; biaya: string; jatuhTempoBerikutnya: string; catatan: string;
};

const digits = (s: string) => s.replace(/\D/g, "");
const group = (s: string) => (s ? Number(s).toLocaleString("id-ID") : "");

export function PemeliharaanModal({
  barang,
  refs,
  canCreate,
  canUpdate,
  onClose,
  onSaved,
}: {
  barang: { id: string; kodeBarang: string; nama: string };
  refs: PemeliharaanRefs;
  canCreate: boolean;
  canUpdate: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const fresh = (): FormState => ({
    tanggal: toLocalDateInput(new Date()), jenis: "RUTIN", hasil: "BAIK", kondisiSesudahId: "",
    petugas: "", biaya: "", jatuhTempoBerikutnya: "", catatan: "",
  });
  const [form, setForm] = useState<FormState>(fresh);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { result, loading, error, reload } = useAsyncData(() => fetchRiwayat(barang.id), [barang.id]);
  const riwayat = result?.riwayat ?? [];

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const jenisOpts: SelectOption[] = JENIS_PEMELIHARAAN.map((j) => ({ value: j, label: JENIS_LABEL[j] }));
  const hasilOpts: SelectOption[] = HASIL_PEMELIHARAAN.map((h) => ({ value: h, label: HASIL_LABEL[h] }));
  const kondisiOpts: SelectOption[] = [
    { value: "", label: "— Tidak mengubah kondisi —" },
    ...refs.kondisi.map((k) => ({ value: k.id, label: k.nama })),
  ];

  function startEdit(r: RiwayatRow) {
    setForm({
      tanggal: r.tanggal ?? toLocalDateInput(new Date()),
      jenis: r.jenis,
      hasil: r.hasil ?? "BAIK",
      kondisiSesudahId: r.kondisiSesudahId ?? "",
      petugas: r.petugas ?? "",
      biaya: r.biaya != null ? String(r.biaya) : "",
      jatuhTempoBerikutnya: r.jatuhTempoBerikutnya ?? "",
      catatan: r.catatan ?? "",
    });
    setEditingId(r.id);
  }
  function cancelEdit() {
    setForm(fresh());
    setEditingId(null);
  }

  async function submit() {
    if (!form.tanggal) return toast.error("Lengkapi data", "Tanggal kegiatan wajib diisi.");
    setSaving(true);
    try {
      const payload: PemeliharaanPayload = {
        tanggal: form.tanggal,
        jenis: form.jenis as PemeliharaanPayload["jenis"],
        hasil: form.hasil as PemeliharaanPayload["hasil"],
        kondisiSesudahId: form.kondisiSesudahId || undefined,
        petugas: form.petugas || undefined,
        biaya: form.biaya || undefined,
        jatuhTempoBerikutnya: form.jatuhTempoBerikutnya || undefined,
        catatan: form.catatan || undefined,
      };
      if (editingId) {
        await updatePemeliharaan(editingId, payload);
        toast.success("Tersimpan", "Catatan pemeliharaan diperbarui.");
      } else {
        await createPemeliharaan(barang.id, payload);
        toast.success("Tercatat", "Pemeliharaan berhasil dicatat.");
      }
      cancelEdit();
      reload();
      onSaved();
    } catch (e) {
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  const canEditForm = editingId ? canUpdate : canCreate;

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      size="lg"
      icon={
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
          <Wrench className="size-5" />
        </span>
      }
      title="Pemeliharaan Barang"
      description={`${barang.kodeBarang} · ${barang.nama}`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {editingId ? (
            <Button variant="ghost" size="sm" icon={<X className="size-4" />} onClick={cancelEdit} disabled={saving}>
              Batal ubah
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Tutup</Button>
            {canEditForm && (
              <Button size="sm" onClick={submit} loading={saving}>
                {editingId ? "Simpan Perubahan" : "Catat Pemeliharaan"}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Form catat / edit */}
        {canEditForm && (
          <div className={cn("rounded-[var(--radius-lg)] border p-4", editingId ? "border-warning/40 bg-warning-soft/20" : "border-border bg-surface-2/30")}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              {editingId ? "Ubah catatan" : "Catat pemeliharaan / pengecekan"}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="p-tgl">Tanggal <span className="text-danger">*</span></Label>
                <DatePicker id="p-tgl" value={form.tanggal} onChange={(v) => set("tanggal", v)} clearable={false} max={toLocalDateInput(new Date())} />
              </div>
              <div>
                <Label htmlFor="p-jenis">Jenis Kegiatan</Label>
                <Select id="p-jenis" value={form.jenis} onChange={(v) => set("jenis", v)} options={jenisOpts} />
              </div>
              <div>
                <Label htmlFor="p-hasil">Hasil</Label>
                <Select id="p-hasil" value={form.hasil} onChange={(v) => set("hasil", v)} options={hasilOpts} />
              </div>
              <div>
                <Label htmlFor="p-kondisi">Kondisi Setelah</Label>
                <Select id="p-kondisi" value={form.kondisiSesudahId} onChange={(v) => set("kondisiSesudahId", v)} options={kondisiOpts} />
              </div>
              <div>
                <Label htmlFor="p-petugas">Petugas</Label>
                <Input id="p-petugas" value={form.petugas} placeholder="Nama teknisi/petugas" onChange={(e) => set("petugas", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="p-biaya">Biaya</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">Rp</span>
                  <Input id="p-biaya" inputMode="numeric" value={group(form.biaya)} placeholder="0" onChange={(e) => set("biaya", digits(e.target.value))} className="pl-9 text-right tabular-nums" />
                </div>
              </div>
              <div>
                <Label htmlFor="p-due">Jadwal Berikutnya</Label>
                <DatePicker id="p-due" value={form.jatuhTempoBerikutnya} onChange={(v) => set("jatuhTempoBerikutnya", v)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="p-catatan">Catatan</Label>
                <textarea
                  id="p-catatan" rows={1} value={form.catatan} placeholder="Tindakan yang dilakukan / temuan…"
                  onChange={(e) => set("catatan", e.target.value)}
                  className="w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle transition-colors focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring/40"
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-fg-subtle">
              Mengisi &quot;Kondisi Setelah&quot; akan otomatis memperbarui kondisi fisik barang.
            </p>
          </div>
        )}

        {/* Riwayat */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <History className="size-4 text-fg-subtle" />
            <h4 className="text-sm font-semibold text-fg">Riwayat Pemeliharaan</h4>
            {!loading && <Badge tone="neutral">{riwayat.length}</Badge>}
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-[var(--radius-md)]" />)}
            </div>
          ) : error ? (
            <ErrorState onRetry={reload} />
          ) : riwayat.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface-2/30 px-4 py-6 text-center text-sm text-fg-muted">
              Belum ada riwayat. Catat pemeliharaan pertama di atas.
            </div>
          ) : (
            <ol className="space-y-2">
              {riwayat.map((r) => (
                <li
                  key={r.id}
                  className={cn(
                    "rounded-[var(--radius-md)] border px-3.5 py-3",
                    editingId === r.id ? "border-warning/50 bg-warning-soft/20" : "border-border bg-surface",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
                      <CalendarClock className="size-3.5 text-fg-subtle" />
                      {formatDate(r.tanggal)}
                    </span>
                    <Badge tone="brand">{JENIS_LABEL[r.jenis]}</Badge>
                    {r.hasil && <Badge tone={HASIL_TONE[r.hasil]} dot>{HASIL_LABEL[r.hasil]}</Badge>}
                    {r.kondisiSesudah && <span className="text-xs text-fg-muted">→ kondisi: {r.kondisiSesudah}</span>}
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        title="Ubah catatan ini"
                        className="ml-auto rounded-md p-1 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-brand"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                    {r.petugas && <span>Petugas: <span className="text-fg">{r.petugas}</span></span>}
                    {r.biaya != null && <span>Biaya: <span className="text-fg">{formatRupiah(r.biaya)}</span></span>}
                    {r.jatuhTempoBerikutnya && <span>Jadwal berikutnya: <span className="text-fg">{formatDate(r.jatuhTempoBerikutnya)}</span></span>}
                  </div>
                  {r.catatan && <p className="mt-1.5 whitespace-pre-wrap text-sm text-fg">{r.catatan}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Modal>
  );
}
