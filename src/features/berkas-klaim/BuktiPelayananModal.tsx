"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Stethoscope, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import type {
  BuktiPelayananContext,
  BuktiPelayananForm,
  BuktiPelayananSaved,
  BuktiTindakanRow,
} from "@/server/modules/berkas-klaim/berkas-klaim.types";

const PENJAMIN = ["BPJS", "Umum", "Jaminan Lain"];

export type BuktiHeaderInfo = {
  norm: string;
  nama: string;
  kategori: string;
  ruang: string;
  /** "YYYY-MM-DD" default tanggal pelayanan. */
  tanggalDefault: string;
};

function emptyForm(
  tanggalDefault: string,
  tindakan: BuktiTindakanRow[],
  dpjp: string,
): BuktiPelayananForm {
  return {
    tanggalPelayanan: tanggalDefault,
    dpjp,
    penjamin: "BPJS",
    noSep: "",
    catatan: "",
    tindakan,
  };
}

export function BuktiPelayananModal({
  open,
  onClose,
  onSaved,
  nopen,
  header,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (saved: BuktiPelayananSaved) => void;
  nopen: string;
  header: BuktiHeaderInfo;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BuktiPelayananForm | null>(null);

  // Muat konteks (rekaman tersimpan / prefill tindakan SIMGOS) saat modal dibuka.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      setLoading(true);
      setError(null);
      setForm(null);
      try {
        const res = await fetch(`/api/berkas-klaim/bukti/${nopen}`);
        if (!res.ok) throw new Error("Gagal memuat data");
        const json = (await res.json()) as { data: BuktiPelayananContext };
        if (!alive) return;
        const ctx = json.data;
        setForm(
          ctx.saved
            ? ctx.saved.data
            : emptyForm(header.tanggalDefault, ctx.tindakanSimgos, ctx.dpjpSimgos),
        );
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, nopen, header.tanggalDefault]);

  function patch(p: Partial<BuktiPelayananForm>) {
    setForm((f) => (f ? { ...f, ...p } : f));
  }
  function patchRow(i: number, p: Partial<BuktiTindakanRow>) {
    setForm((f) =>
      f ? { ...f, tindakan: f.tindakan.map((r, idx) => (idx === i ? { ...r, ...p } : r)) } : f,
    );
  }
  function addRow() {
    setForm((f) =>
      f ? { ...f, tindakan: [...f.tindakan, { tanggal: "", nama: "", pelaksana: "", keterangan: "" }] } : f,
    );
  }
  function removeRow(i: number) {
    setForm((f) => (f ? { ...f, tindakan: f.tindakan.filter((_, idx) => idx !== i) } : f));
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      // Buang baris tindakan yang benar-benar kosong.
      const cleaned: BuktiPelayananForm = {
        ...form,
        tindakan: form.tindakan.filter(
          (r) => r.nama.trim() || r.pelaksana.trim() || r.keterangan.trim(),
        ),
      };
      const res = await fetch(`/api/berkas-klaim/bukti/${nopen}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: cleaned,
          header: {
            norm: header.norm,
            nama: header.nama,
            kategori: header.kategori,
            ruang: header.ruang,
          },
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      const json = (await res.json()) as { data: BuktiPelayananSaved };
      onSaved(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={false}
      size="xl"
      title="Bukti Pelayanan"
      description={`${header.nama} · No. RM ${header.norm}`}
      icon={
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand-soft-fg">
          <Stethoscope className="size-4.5" />
        </div>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || saving || !form}
            icon={
              saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />
            }
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      {loading ? (
        <FormSkeleton />
      ) : error && !form ? (
        <div className="py-8 text-center text-sm text-danger">{error}</div>
      ) : form ? (
        <div className="max-h-[72vh] space-y-5 overflow-y-auto pr-1">
          {/* Informasi umum */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tgl">Tanggal pelayanan</Label>
              <Input
                id="tgl"
                type="date"
                value={form.tanggalPelayanan}
                onChange={(e) => patch({ tanggalPelayanan: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="penjamin">Penjamin</Label>
              <select
                id="penjamin"
                value={form.penjamin}
                onChange={(e) => patch({ penjamin: e.target.value })}
                className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              >
                {PENJAMIN.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="dpjp">DPJP / Dokter</Label>
              <Input id="dpjp" value={form.dpjp} onChange={(e) => patch({ dpjp: e.target.value })} placeholder="Nama dokter penanggung jawab" />
            </div>
            <div>
              <Label htmlFor="sep">No. SEP (opsional)</Label>
              <Input id="sep" value={form.noSep} onChange={(e) => patch({ noSep: e.target.value })} placeholder="Nomor SEP BPJS" />
            </div>
          </div>

          {/* Daftar tindakan */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="mb-0">Tindakan / Pelayanan</Label>
              <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={addRow}>
                Tambah
              </Button>
            </div>

            {form.tindakan.length === 0 ? (
              <p className="rounded-[var(--radius-md)] border border-dashed border-border px-3 py-4 text-center text-xs text-fg-muted">
                Belum ada tindakan. Klik <span className="font-medium text-fg">Tambah</span> untuk menambahkan.
              </p>
            ) : (
              <ul className="space-y-2">
                {form.tindakan.map((row, i) => (
                  <li
                    key={i}
                    className="rounded-[var(--radius-md)] border border-border bg-surface-2/40 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-2 w-5 shrink-0 text-center text-xs font-medium text-fg-subtle tabular">
                        {i + 1}
                      </span>
                      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-12">
                        <input
                          value={row.nama}
                          onChange={(e) => patchRow(i, { nama: e.target.value })}
                          placeholder="Nama tindakan"
                          className="h-9 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring sm:col-span-5"
                        />
                        <input
                          type="date"
                          value={row.tanggal}
                          onChange={(e) => patchRow(i, { tanggal: e.target.value })}
                          className="h-9 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring sm:col-span-3"
                        />
                        <input
                          value={row.pelaksana}
                          onChange={(e) => patchRow(i, { pelaksana: e.target.value })}
                          placeholder="Pelaksana"
                          className="h-9 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring sm:col-span-4"
                        />
                        <input
                          value={row.keterangan}
                          onChange={(e) => patchRow(i, { keterangan: e.target.value })}
                          placeholder="Keterangan (opsional)"
                          className="h-9 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring sm:col-span-11"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        aria-label={`Hapus tindakan ${i + 1}`}
                        className="mt-1 shrink-0 rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Catatan */}
          <div>
            <Label htmlFor="catatan">Catatan</Label>
            <textarea
              id="catatan"
              rows={3}
              value={form.catatan}
              onChange={(e) => patch({ catatan: e.target.value })}
              placeholder="Catatan tambahan untuk bukti pelayanan…"
              className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            />
          </div>

          {error && (
            <p className={cn("rounded-[var(--radius-md)] bg-danger-soft px-3 py-2 text-xs text-danger")}>
              {error}
            </p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-10 w-full rounded" />
          </div>
        ))}
      </div>
      <Skeleton className="h-4 w-32 rounded" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded" />
      ))}
    </div>
  );
}
