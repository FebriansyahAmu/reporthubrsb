"use client";

import { useMemo, useState } from "react";
import { Hash, Package, RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { STATUS_ASET, STATUS_ASET_LABEL } from "@/server/modules/inventaris/barang.schema";
import {
  createBarang,
  fetchNextKode,
  hapusFotoBarang,
  unggahFotoBarang,
  updateBarang,
  type BarangItem,
  type BarangPayload,
  type FormRefs,
} from "./barang.client";
import { NamaBarangField } from "./NamaBarangField";
import { FOTO_KOSONG, FotoBarangField, PETUNJUK_FOTO, fotoDariItem, type FotoNilai } from "./FotoBarangField";

type FormState = {
  kodeBarang: string;
  nama: string;
  register: string;
  merk: string;
  nomorSeri: string;
  kategoriId: string;
  sumberAnggaranId: string;
  satuanId: string;
  kondisiId: string;
  ruanganId: string;
  tahunPerolehan: string;
  tglPerolehan: string;
  harga: string;
  statusAset: string;
  keterangan: string;
};

const empty: FormState = {
  kodeBarang: "", nama: "", register: "", merk: "", nomorSeri: "",
  kategoriId: "", sumberAnggaranId: "", satuanId: "", kondisiId: "",
  ruanganId: "", tahunPerolehan: "", tglPerolehan: "", harga: "",
  statusAset: "AKTIF", keterangan: "",
};

const fromItem = (b: BarangItem): FormState => ({
  kodeBarang: b.kodeBarang,
  nama: b.nama,
  register: b.register != null ? String(b.register) : "",
  merk: b.merk ?? "",
  nomorSeri: b.nomorSeri ?? "",
  kategoriId: b.kategori?.id ?? "",
  sumberAnggaranId: b.sumberAnggaran?.id ?? "",
  satuanId: b.satuan?.id ?? "",
  kondisiId: b.kondisi?.id ?? "",
  ruanganId: b.ruangan.id,
  tahunPerolehan: b.tahunPerolehan != null ? String(b.tahunPerolehan) : "",
  tglPerolehan: b.tglPerolehan ?? "",
  harga: b.harga != null ? String(b.harga) : "",
  statusAset: b.statusAset,
  keterangan: b.keterangan ?? "",
});

const digits = (s: string) => s.replace(/\D/g, "");
const groupID = (s: string) => (s ? Number(s).toLocaleString("id-ID") : "");

const optional = (opts: SelectOption[], placeholder: string): SelectOption[] => [
  { value: "", label: placeholder },
  ...opts,
];

export function BarangFormModal({
  open,
  mode,
  item,
  refs,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  item?: BarangItem | null;
  refs: FormRefs;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(empty);
  const [manualKode, setManualKode] = useState(false);
  const [kodePreview, setKodePreview] = useState("");
  const [loadingKode, setLoadingKode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tahap, setTahap] = useState<"data" | "foto">("data");
  const [registerAuto, setRegisterAuto] = useState(false);
  const [foto, setFoto] = useState<FotoNilai>(FOTO_KOSONG);

  const isEdit = mode === "edit";

  // Reset form saat modal berpindah tertutup → terbuka (fase render, bukan effect).
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setForm(isEdit && item ? fromItem(item) : empty);
    setFoto(isEdit ? fotoDariItem(item) : FOTO_KOSONG);
    setManualKode(false);
    setKodePreview("");
    setRegisterAuto(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Ambil preview kode otomatis untuk sebuah ruangan (event-driven, tanpa effect).
  function refreshKode(rid: string) {
    if (isEdit || manualKode || !rid) {
      setKodePreview("");
      return;
    }
    setLoadingKode(true);
    fetchNextKode(rid)
      .then((r) => setKodePreview(r.kode))
      .catch(() => setKodePreview(""))
      .finally(() => setLoadingKode(false));
  }

  function onRuanganChange(rid: string) {
    set("ruanganId", rid);
    // Saat tambah: kode preview + Register otomatis (urutan berikutnya di ruangan ini).
    if (isEdit || !rid) {
      setKodePreview("");
      return;
    }
    setLoadingKode(true);
    fetchNextKode(rid)
      .then((r) => {
        if (!manualKode) setKodePreview(r.kode);
        set("register", String(r.register));
        setRegisterAuto(true);
      })
      .catch(() => setKodePreview(""))
      .finally(() => setLoadingKode(false));
  }

  function toggleManualKode() {
    setManualKode((m) => {
      const next = !m;
      if (next) setKodePreview("");
      else refreshKode(form.ruanganId); // kembali ke otomatis → segarkan
      return next;
    });
  }

  const ruanganOpts = useMemo<SelectOption[]>(
    () => refs.ruangan.map((r) => ({ value: r.id, label: r.nama })),
    [refs.ruangan],
  );
  const kategoriOpts = useMemo<SelectOption[]>(() => refs.kategori.map((k) => ({ value: k.id, label: k.nama })), [refs.kategori]);
  const kondisiOpts = useMemo<SelectOption[]>(() => refs.kondisi.map((k) => ({ value: k.id, label: k.nama })), [refs.kondisi]);
  const sumberOpts = useMemo<SelectOption[]>(
    () => refs.sumberAnggaran.map((s) => ({ value: s.id, label: `${s.singkatan} — ${s.nama}` })),
    [refs.sumberAnggaran],
  );
  const satuanOpts = useMemo<SelectOption[]>(() => refs.satuan.map((s) => ({ value: s.id, label: s.nama })), [refs.satuan]);
  const statusOpts: SelectOption[] = STATUS_ASET.map((s) => ({ value: s, label: STATUS_ASET_LABEL[s] }));

  async function submit() {
    if (!form.nama.trim()) return toast.error("Lengkapi data", "Nama barang wajib diisi.");
    if (!form.ruanganId) return toast.error("Lengkapi data", "Ruangan wajib dipilih.");
    if (isEdit && !item) return;

    setSaving(true);
    setTahap("data");
    try {
      const base: Omit<BarangPayload, "kodeBarang"> = {
        nama: form.nama.trim(),
        register: form.register || undefined,
        merk: form.merk || undefined,
        nomorSeri: form.nomorSeri || undefined,
        kategoriId: form.kategoriId || undefined,
        sumberAnggaranId: form.sumberAnggaranId || undefined,
        satuanId: form.satuanId || undefined,
        kondisiId: form.kondisiId || undefined,
        ruanganId: form.ruanganId,
        tahunPerolehan: form.tahunPerolehan || undefined,
        tglPerolehan: form.tglPerolehan || undefined,
        harga: form.harga || undefined,
        statusAset: form.statusAset as BarangPayload["statusAset"],
        keterangan: form.keterangan || undefined,
      };
      // Data dulu, foto sesudahnya (unit harus ada sebelum fotonya). Bila foto
      // gagal, data tetap tersimpan → beri tahu, foto bisa ditambah dari detail.
      let saved: BarangItem;
      if (isEdit && item) {
        saved = await updateBarang(item.id, base);
      } else {
        const payload: BarangPayload = { ...base };
        if (manualKode && form.kodeBarang.trim()) payload.kodeBarang = form.kodeBarang.trim();
        saved = await createBarang(payload);
      }
      const label = isEdit ? `${saved.nama} berhasil diperbarui.` : `${saved.kodeBarang} · ${saved.nama}`;
      let galatFoto: string | null = null;
      try {
        if (foto.jenis === "baru") {
          setTahap("foto");
          await unggahFotoBarang(saved.id, foto.siap.foto, foto.siap.thumb);
        } else if (foto.jenis === "kosong" && isEdit && item?.foto) {
          setTahap("foto");
          await hapusFotoBarang(saved.id);
        }
      } catch (e) {
        galatFoto = e instanceof Error ? e.message : "Foto gagal disimpan.";
      }
      if (galatFoto) {
        toast.warning(isEdit ? "Data tersimpan, foto gagal" : `Barang ditambahkan, foto gagal`, `${label} ${galatFoto} Coba lagi dari detail barang.`);
      } else {
        toast.success(isEdit ? "Tersimpan" : "Barang ditambahkan", label);
      }
      onSaved();
      onClose();
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
          <Package className="size-5" />
        </span>
      }
      title={isEdit ? "Ubah Barang" : "Tambah Barang"}
      description={isEdit ? "Perbarui data unit aset. Kode barang bersifat permanen." : "Catat satu unit aset baru. Kode dibuat otomatis dari ruangan."}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button size="sm" onClick={submit} loading={saving}>
            {saving ? (tahap === "foto" ? "Mengunggah foto…" : "Menyimpan…") : isEdit ? "Simpan Perubahan" : "Simpan Barang"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6">
        {/* Foto barang */}
        <aside className="lg:self-start">
          <div className="mb-1.5 flex items-baseline justify-between">
            <Label className="mb-0">Foto Barang</Label>
            <span className="text-[11px] text-fg-subtle">opsional</span>
          </div>
          <FotoBarangField
            value={foto}
            onChange={setFoto}
            judul={form.nama.trim() || "Barang baru"}
            tempelGlobal
            sibuk={saving && tahap === "foto" ? "Mengunggah foto…" : null}
            className="aspect-video sm:aspect-2/1 lg:aspect-square"
          />
          <p className="mt-2 text-[11px] leading-relaxed text-fg-subtle">{PETUNJUK_FOTO}</p>
        </aside>

        <div className="min-w-0 space-y-5">
          {/* Blok identitas */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <Label htmlFor="f-ruangan">
                Ruangan / Lokasi <span className="text-danger">*</span>
              </Label>
              <Select
                id="f-ruangan"
                value={form.ruanganId}
                onChange={onRuanganChange}
                options={ruanganOpts}
                placeholder="Pilih ruangan…"
              />
            </div>

            {/* Kode barang */}
            <div className="lg:col-span-2">
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="mb-0" htmlFor="f-kode">Kode Barang</Label>
                {!isEdit && (
                  <button
                    type="button"
                    onClick={toggleManualKode}
                    className="text-[11px] font-medium text-brand transition-colors hover:text-brand-hover"
                  >
                    {manualKode ? "Pakai kode otomatis" : "Isi kode manual"}
                  </button>
                )}
              </div>
              {isEdit ? (
                <div className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/50 px-3 font-mono text-sm font-semibold text-fg">
                  <Hash className="size-4 text-fg-subtle" />
                  {form.kodeBarang}
                  <span className="ml-auto text-[11px] font-sans font-normal text-fg-subtle">permanen</span>
                </div>
              ) : manualKode ? (
                <Input
                  id="f-kode"
                  value={form.kodeBarang}
                  placeholder="mis. ICU-001"
                  onChange={(e) => set("kodeBarang", e.target.value.toUpperCase())}
                  className="font-mono"
                />
              ) : (
                <div className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-brand/40 bg-brand-soft/30 px-3 font-mono text-sm font-semibold text-brand">
                  {loadingKode ? (
                    <><RefreshCw className="size-4 animate-spin" /> Menyiapkan kode…</>
                  ) : kodePreview ? (
                    <><Hash className="size-4" /> {kodePreview}
                      <span className="ml-auto font-sans text-[11px] font-normal text-fg-subtle">otomatis</span></>
                  ) : (
                    <span className="font-sans font-normal text-fg-subtle">Pilih ruangan dulu untuk membuat kode</span>
                  )}
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="f-nama">
                Nama / Jenis Barang <span className="text-danger">*</span>
              </Label>
              <NamaBarangField
                id="f-nama"
                value={form.nama}
                onChange={(v) => set("nama", v)}
                items={refs.item}
                placeholder="mis. Tempat Tidur Pasien Elektrik"
              />
              <p className="mt-1 text-[11px] text-fg-subtle">Pilih dari katalog agar nama konsisten, atau ketik baru.</p>
            </div>
            <div>
              <Label htmlFor="f-register">Register</Label>
              <Input
                id="f-register"
                inputMode="numeric"
                value={form.register}
                placeholder="mis. 1"
                onChange={(e) => { set("register", digits(e.target.value)); setRegisterAuto(false); }}
              />
              {!isEdit && registerAuto && form.register && (
                <p className="mt-1 text-[11px] text-fg-subtle">Otomatis: urutan ke-{form.register} di ruangan ini (bisa diubah).</p>
              )}
            </div>

            <div>
              <Label htmlFor="f-merk">Merk / Tipe</Label>
              <Input id="f-merk" value={form.merk} placeholder="mis. Paramount PA-2000" onChange={(e) => set("merk", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="f-seri">No. Seri</Label>
              <Input id="f-seri" value={form.nomorSeri} placeholder="mis. SN-2023-0012" onChange={(e) => set("nomorSeri", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="f-kategori">Kategori</Label>
              <Select id="f-kategori" value={form.kategoriId} onChange={(v) => set("kategoriId", v)} options={optional(kategoriOpts, "— Tanpa kategori —")} />
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Blok kondisi & perolehan */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="f-kondisi">Kondisi Fisik</Label>
              <Select id="f-kondisi" value={form.kondisiId} onChange={(v) => set("kondisiId", v)} options={optional(kondisiOpts, "— Belum dinilai —")} />
            </div>
            <div>
              <Label htmlFor="f-status">Status Aset</Label>
              <Select id="f-status" value={form.statusAset} onChange={(v) => set("statusAset", v)} options={statusOpts} />
            </div>
            <div>
              <Label htmlFor="f-satuan">Satuan</Label>
              <Select id="f-satuan" value={form.satuanId} onChange={(v) => set("satuanId", v)} options={optional(satuanOpts, "— Tanpa satuan —")} />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <Label htmlFor="f-sumber">Sumber Anggaran</Label>
              <Select id="f-sumber" value={form.sumberAnggaranId} onChange={(v) => set("sumberAnggaranId", v)} options={optional(sumberOpts, "— Tanpa sumber —")} />
            </div>
            <div>
              <Label htmlFor="f-tahun">Tahun Perolehan</Label>
              <Input id="f-tahun" inputMode="numeric" maxLength={4} value={form.tahunPerolehan} placeholder="mis. 2023" onChange={(e) => set("tahunPerolehan", digits(e.target.value).slice(0, 4))} />
            </div>
            <div>
              <Label htmlFor="f-tgl">Tanggal Perolehan</Label>
              <DatePicker id="f-tgl" value={form.tglPerolehan} onChange={(v) => set("tglPerolehan", v)} max={new Date().toISOString().slice(0, 10)} />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <Label htmlFor="f-harga">Harga Perolehan</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">Rp</span>
                <Input
                  id="f-harga"
                  inputMode="numeric"
                  value={groupID(form.harga)}
                  placeholder="0"
                  onChange={(e) => set("harga", digits(e.target.value))}
                  className={cn("pl-9 text-right tabular-nums")}
                />
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <Label htmlFor="f-ket">Keterangan</Label>
              <textarea
                id="f-ket"
                rows={2}
                value={form.keterangan}
                placeholder="Catatan tambahan (opsional)…"
                onChange={(e) => set("keterangan", e.target.value)}
                className="w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle transition-colors focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring/40"
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
