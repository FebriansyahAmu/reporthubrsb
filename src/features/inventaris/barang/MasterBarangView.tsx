"use client";

import { useMemo, useState } from "react";
import {
  Boxes,
  Eye,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { downloadFromEndpoint } from "@/lib/download";
import { formatRupiah, formatRupiahRingkas } from "@/lib/format";
import { cn } from "@/lib/cn";
import { STATUS_ASET, STATUS_ASET_LABEL, STATUS_ASET_TONE } from "@/server/modules/inventaris/barang.schema";
import {
  deleteBarang as apiDeleteBarang,
  fetchBarang,
  fetchRefs,
  type BarangItem,
  type BarangListMeta,
  type FormRefs,
} from "./barang.client";
import { BarangFormModal } from "./BarangFormModal";
import { BarangDetailModal } from "./BarangDetailModal";
import { ImportBarangModal } from "./ImportBarangModal";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";
const PAGE_SIZE = 20;

export type BarangPerms = { create: boolean; update: boolean; delete: boolean };

export function MasterBarangView({ perms }: { perms: BarangPerms }) {
  const toast = useToast();

  // Filter state
  const [searchInput, setSearchInput] = useState("");
  const [ruanganId, setRuanganId] = useState("");
  const [kategoriId, setKategoriId] = useState("");
  const [kondisiId, setKondisiId] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("terbaru");
  const [page, setPage] = useState(1);
  const search = useDebounce(searchInput, 350);

  // Modals
  const [detailItem, setDetailItem] = useState<BarangItem | null>(null);
  const [formState, setFormState] = useState<{ mode: "create" | "edit"; item?: BarangItem } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<BarangItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Referensi (untuk filter & form)
  const refsState = useAsyncData<FormRefs>(() => fetchRefs(), []);
  const refs = refsState.result;

  // Reset halaman saat filter berubah
  const filterKey = `${search}|${ruanganId}|${kategoriId}|${kondisiId}|${status}|${sort}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const { result, loading, error, reload } = useAsyncData<{ data: BarangItem[]; meta: BarangListMeta }>(
    () => fetchBarang({ search, ruanganId, kategoriId, kondisiId, status, sort, page, pageSize: PAGE_SIZE }),
    [search, ruanganId, kategoriId, kondisiId, status, sort, page],
  );
  const items = result?.data ?? [];
  const meta = result?.meta ?? null;

  // Opsi filter
  const ruanganOpts = useMemo<SelectOption[]>(
    () => [{ value: "", label: "Semua ruangan" }, ...(refs?.ruangan ?? []).map((r) => ({ value: r.id, label: `${r.kodePrefix} — ${r.nama}` }))],
    [refs],
  );
  const kategoriOpts = useMemo<SelectOption[]>(
    () => [{ value: "", label: "Semua kategori" }, ...(refs?.kategori ?? []).map((k) => ({ value: k.id, label: k.nama }))],
    [refs],
  );
  const kondisiOpts = useMemo<SelectOption[]>(
    () => [{ value: "", label: "Semua kondisi" }, ...(refs?.kondisi ?? []).map((k) => ({ value: k.id, label: k.nama }))],
    [refs],
  );
  const statusOpts: SelectOption[] = [
    { value: "", label: "Semua status" },
    ...STATUS_ASET.map((s) => ({ value: s, label: STATUS_ASET_LABEL[s] })),
  ];
  const sortOpts: SelectOption[] = [
    { value: "terbaru", label: "Terbaru ditambah" },
    { value: "kode", label: "Kode barang (A–Z)" },
    { value: "nama", label: "Nama (A–Z)" },
    { value: "tahun", label: "Tahun terbaru" },
    { value: "harga", label: "Harga tertinggi" },
  ];

  const noRuangan = !!refs && refs.ruangan.length === 0;

  async function onExport() {
    setExporting(true);
    try {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries({ search, ruanganId, kategoriId, kondisiId, status, sort })) {
        if (v) sp.set(k, v);
      }
      const q = sp.toString();
      await downloadFromEndpoint(`/api/inventaris/barang/export${q ? `?${q}` : ""}`, "Master-Barang.xlsx");
      toast.success("Export dimulai", "Berkas Excel sedang diunduh.");
    } catch (e) {
      toast.error("Export gagal", e instanceof Error ? e.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await apiDeleteBarang(deleteItem.id);
      toast.success("Barang dihapus", `${deleteItem.kodeBarang} · ${deleteItem.nama}`);
      setDeleteItem(null);
      reload();
    } catch (e) {
      toast.error("Gagal menghapus", e instanceof Error ? e.message : undefined);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Ringkasan */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatTile icon={Boxes} tone="brand" label="Total unit (sesuai filter)" value={meta ? meta.total.toLocaleString("id-ID") : "—"} hint="unit aset tercatat" />
        <StatTile icon={Wallet} tone="success" label="Total nilai aset" value={meta ? formatRupiah(meta.totalNilai) : "—"} hint="akumulasi harga perolehan" />
      </div>

      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor="cari">Cari barang</Label>
              <InputWithIcon
                id="cari"
                icon={<Search className="size-4" />}
                placeholder="Kode / nama / merk / no. seri"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="md" icon={<FileSpreadsheet className="size-4" />} onClick={onExport} loading={exporting}>
                Export
              </Button>
              {perms.create && (
                <Button variant="secondary" size="md" icon={<Upload className="size-4" />} onClick={() => setImportOpen(true)}>
                  Import
                </Button>
              )}
              {perms.create && (
                <Button size="md" icon={<Plus className="size-4" />} onClick={() => setFormState({ mode: "create" })} disabled={noRuangan}>
                  Tambah Barang
                </Button>
              )}
            </div>
          </div>

          {/* Baris filter */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <FilterField label="Ruangan"><Select value={ruanganId} onChange={setRuanganId} options={ruanganOpts} /></FilterField>
            <FilterField label="Kategori"><Select value={kategoriId} onChange={setKategoriId} options={kategoriOpts} /></FilterField>
            <FilterField label="Kondisi"><Select value={kondisiId} onChange={setKondisiId} options={kondisiOpts} /></FilterField>
            <FilterField label="Status"><Select value={status} onChange={setStatus} options={statusOpts} /></FilterField>
            <FilterField label="Urutkan"><Select value={sort} onChange={setSort} options={sortOpts} /></FilterField>
          </div>
        </div>
      </Card>

      {noRuangan && (
        <div className="rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          Belum ada ruangan. Tambahkan ruangan (beserta kode prefix) di <span className="font-medium">Pengaturan</span> sebelum mencatat barang.
        </div>
      )}

      {/* Tabel */}
      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Belum ada barang"
            description="Tidak ada unit aset untuk filter ini. Tambah manual atau import dari Excel."
            action={
              perms.create && !noRuangan ? (
                <Button icon={<Plus className="size-4" />} onClick={() => setFormState({ mode: "create" })}>
                  Tambah Barang
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>Kode / Nama</TH>
              <TH className="hidden lg:table-cell">Ruangan</TH>
              <TH className="hidden md:table-cell">Kategori</TH>
              <TH>Kondisi</TH>
              <TH>Status</TH>
              <TH className="hidden xl:table-cell" align="center">Tahun</TH>
              <TH align="right">Harga</TH>
              <TH align="right">Aksi</TH>
            </THead>
            <TBody>
              {items.map((b) => (
                <TR key={b.id} className="cursor-pointer" onClick={() => setDetailItem(b)}>
                  <TD>
                    <p className="font-mono text-xs font-semibold text-brand">{b.kodeBarang}</p>
                    <p className="mt-0.5 font-medium text-fg">{b.nama}</p>
                    {b.merk && <p className="text-xs text-fg-subtle">{b.merk}</p>}
                  </TD>
                  <TD className="hidden text-sm text-fg-muted lg:table-cell">{b.ruangan.kodePrefix}</TD>
                  <TD className="hidden text-sm text-fg-muted md:table-cell">{b.kategori?.nama ?? "—"}</TD>
                  <TD>
                    {b.kondisi ? (
                      <Badge tone={(b.kondisi.tone as Tone) || "neutral"} dot>{b.kondisi.nama}</Badge>
                    ) : (
                      <span className="text-xs text-fg-subtle">—</span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_ASET_TONE[b.statusAset]} dot>{STATUS_ASET_LABEL[b.statusAset]}</Badge>
                  </TD>
                  <TD align="center" className="hidden text-sm text-fg-muted xl:table-cell">{b.tahunPerolehan ?? "—"}</TD>
                  <TD align="right" className="text-sm text-fg">
                    <span title={b.harga != null ? formatRupiah(b.harga) : undefined}>
                      {b.harga != null ? formatRupiahRingkas(b.harga) : "—"}
                    </span>
                  </TD>
                  <TD align="right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <IconBtn label="Detail" onClick={() => setDetailItem(b)}><Eye className="size-4" /></IconBtn>
                      {perms.update && (
                        <IconBtn label="Ubah" onClick={() => setFormState({ mode: "edit", item: b })}><Pencil className="size-4" /></IconBtn>
                      )}
                      {perms.delete && (
                        <IconBtn label="Hapus" danger onClick={() => setDeleteItem(b)}><Trash2 className="size-4" /></IconBtn>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {!loading && !error && meta && meta.total > 0 && <Pagination meta={meta} onPageChange={setPage} />}
      </Card>

      {/* Detail */}
      <BarangDetailModal
        open={!!detailItem}
        item={detailItem}
        canUpdate={perms.update}
        canDelete={perms.delete}
        onClose={() => setDetailItem(null)}
        onEdit={() => {
          const it = detailItem;
          setDetailItem(null);
          if (it) setFormState({ mode: "edit", item: it });
        }}
        onDelete={() => {
          const it = detailItem;
          setDetailItem(null);
          if (it) setDeleteItem(it);
        }}
      />

      {/* Form create/edit */}
      {formState && refs && (
        <BarangFormModal
          open
          mode={formState.mode}
          item={formState.item}
          refs={refs}
          onClose={() => setFormState(null)}
          onSaved={reload}
        />
      )}

      {/* Import */}
      <ImportBarangModal open={importOpen} onClose={() => setImportOpen(false)} onDone={reload} />

      {/* Konfirmasi hapus */}
      <Modal
        open={!!deleteItem}
        onClose={() => (deleting ? undefined : setDeleteItem(null))}
        size="sm"
        title="Hapus barang?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteItem(null)} disabled={deleting}>Batal</Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting}>Hapus</Button>
          </div>
        }
      >
        <p className="text-sm text-fg-muted">
          Unit <span className="font-mono font-semibold text-fg">{deleteItem?.kodeBarang}</span>{" "}
          (<span className="font-medium text-fg">{deleteItem?.nama}</span>) akan dihapus permanen beserta riwayat pemeliharaan & mutasinya. Tindakan ini tidak dapat dibatalkan.
        </p>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ atoms */

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: typeof Boxes;
  tone: "brand" | "success";
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]", tone === "brand" ? "bg-brand-soft text-brand" : "bg-success-soft text-success")}>
        <Icon className="size-5.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-fg-muted">{label}</p>
        <p className="truncate text-xl font-semibold text-fg tabular-nums">{value}</p>
        <p className="text-[11px] text-fg-subtle">{hint}</p>
      </div>
    </Card>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] border border-border text-fg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3.5 w-48 rounded" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}
