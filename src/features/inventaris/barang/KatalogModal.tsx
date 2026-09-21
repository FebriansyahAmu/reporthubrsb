"use client";

import { useState } from "react";
import { Boxes, Layers, Package, Pencil, Search, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InputWithIcon, Input, Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { formatRupiah } from "@/lib/format";
import {
  deleteKatalog as apiDelete,
  fetchKatalog,
  updateKatalog as apiUpdate,
  type FormRefs,
  type KatalogItem,
  type KatalogMeta,
} from "./barang.client";

const PAGE_SIZE = 20;

const optional = (opts: SelectOption[], ph: string): SelectOption[] => [{ value: "", label: ph }, ...opts];

export function KatalogModal({
  refs,
  canManage,
  canDelete,
  onClose,
  onChanged,
}: {
  refs: FormRefs;
  canManage: boolean;
  canDelete: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(searchInput, 350);

  const key = `${search}`;
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    setPage(1);
  }

  const { result, loading, error, reload } = useAsyncData<{ data: KatalogItem[]; meta: KatalogMeta }>(
    () => fetchKatalog({ search, page, pageSize: PAGE_SIZE }),
    [search, page],
  );
  const items = result?.data ?? [];
  const meta = result?.meta ?? null;

  // Edit
  const [editing, setEditing] = useState<KatalogItem | null>(null);
  const [nama, setNama] = useState("");
  const [kategoriId, setKategoriId] = useState("");
  const [satuanId, setSatuanId] = useState("");
  const [spesifikasi, setSpesifikasi] = useState("");
  const [aktif, setAktif] = useState(true);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<KatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const kategoriOpts = optional(refs.kategori.map((k) => ({ value: k.id, label: k.nama })), "— Tanpa kategori —");
  const satuanOpts = optional(refs.satuan.map((s) => ({ value: s.id, label: s.nama })), "— Tanpa satuan —");

  function openEdit(it: KatalogItem) {
    setEditing(it);
    setNama(it.nama);
    setKategoriId(it.kategori?.id ?? "");
    setSatuanId(it.satuan?.id ?? "");
    setSpesifikasi(it.spesifikasi ?? "");
    setAktif(it.aktif);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!nama.trim()) return toast.error("Lengkapi data", "Nama item wajib diisi.");
    setSaving(true);
    try {
      await apiUpdate(editing.id, { nama: nama.trim(), kategoriId: kategoriId || undefined, satuanId: satuanId || undefined, spesifikasi: spesifikasi || undefined, aktif });
      toast.success("Tersimpan", "Item katalog diperbarui.");
      setEditing(null);
      reload();
      onChanged();
    } catch (e) {
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await apiDelete(delTarget.id);
      toast.success("Terhapus", `Item "${delTarget.nama}" dihapus.`);
      setDelTarget(null);
      reload();
    } catch (e) {
      toast.error("Gagal menghapus", e instanceof Error ? e.message : undefined);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
          <Layers className="size-5" />
        </span>
      }
      title="Katalog Barang"
      description="Jenis barang (nama baku). Merawat katalog membuat penamaan konsisten & agregasi akurat."
      footer={<div className="flex justify-end"><Button variant="secondary" size="sm" onClick={onClose}>Tutup</Button></div>}
    >
      <div className="space-y-3">
        <InputWithIcon icon={<Search className="size-4" />} placeholder="Cari jenis barang…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />

        <div className="overflow-hidden rounded-[var(--radius-md)] border border-border">
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-4 flex-1 rounded" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState onRetry={reload} />
          ) : items.length === 0 ? (
            <EmptyState title="Belum ada item" description="Katalog terisi otomatis saat menambah/import barang." />
          ) : (
            <Table>
              <THead>
                <TH>Jenis Barang</TH>
                <TH className="hidden sm:table-cell">Kategori</TH>
                <TH align="center">Unit</TH>
                <TH className="hidden md:table-cell" align="right">Nilai</TH>
                {canManage && <TH align="right">Aksi</TH>}
              </THead>
              <TBody>
                {items.map((it) => (
                  <TR key={it.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <Package className="size-4 shrink-0 text-fg-subtle" />
                        <div className="min-w-0">
                          <p className="font-medium text-fg">{it.nama}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-fg-subtle sm:hidden">{it.kategori?.nama ?? "—"}</span>
                            {!it.aktif && <Badge tone="neutral">Nonaktif</Badge>}
                          </div>
                        </div>
                      </div>
                    </TD>
                    <TD className="hidden text-sm text-fg-muted sm:table-cell">{it.kategori?.nama ?? "—"}</TD>
                    <TD align="center">
                      <span className="inline-flex items-center gap-1 text-sm text-fg"><Boxes className="size-3.5 text-fg-subtle" /> {it.jumlahUnit}</span>
                    </TD>
                    <TD align="right" className="hidden text-sm text-fg-muted md:table-cell">{formatRupiah(it.totalNilai)}</TD>
                    {canManage && (
                      <TD align="right">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" aria-label="Ubah" title="Ubah" onClick={() => openEdit(it)} className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-brand">
                            <Pencil className="size-4" />
                          </button>
                          {canDelete && (
                            <button type="button" aria-label="Hapus" title="Hapus" onClick={() => setDelTarget(it)} className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger">
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          {!loading && !error && meta && meta.total > 0 && <Pagination meta={meta} onPageChange={setPage} />}
        </div>
      </div>

      {/* Edit item */}
      <Modal
        open={!!editing}
        onClose={() => (saving ? undefined : setEditing(null))}
        size="md"
        title="Ubah Item Katalog"
        description="Mengubah nama akan menyeragamkan seluruh unit yang tertaut."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(null)} disabled={saving}>Batal</Button>
            <Button size="sm" onClick={saveEdit} loading={saving}>Simpan</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="k-nama">Nama Baku <span className="text-danger">*</span></Label>
            <Input id="k-nama" value={nama} onChange={(e) => setNama(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="k-kategori">Kategori</Label>
            <Select id="k-kategori" value={kategoriId} onChange={setKategoriId} options={kategoriOpts} />
          </div>
          <div>
            <Label htmlFor="k-satuan">Satuan Default</Label>
            <Select id="k-satuan" value={satuanId} onChange={setSatuanId} options={satuanOpts} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="k-spec">Spesifikasi</Label>
            <textarea id="k-spec" rows={2} value={spesifikasi} onChange={(e) => setSpesifikasi(e.target.value)} placeholder="Spesifikasi standar (opsional)…" className="w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle transition-colors focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring/40" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={aktif} onChange={setAktif} tone="success" label="Aktif" />
            <span className="text-sm text-fg-muted">{aktif ? "Aktif" : "Nonaktif"}</span>
          </div>
        </div>
      </Modal>

      {/* Konfirmasi hapus */}
      <Modal
        open={!!delTarget}
        onClose={() => (deleting ? undefined : setDelTarget(null))}
        size="sm"
        title="Hapus item katalog?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDelTarget(null)} disabled={deleting}>Batal</Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting}>Hapus</Button>
          </div>
        }
      >
        <p className="text-sm text-fg-muted">
          Item <span className="font-semibold text-fg">{delTarget?.nama}</span> akan dihapus. Jika masih dipakai unit barang, penghapusan ditolak — nonaktifkan saja.
        </p>
      </Modal>
    </Modal>
  );
}
