"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle, Coins, FileStack, Layers, Pencil, Plus, ReceiptText, Scissors, Search, Trash2, TrendingDown,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { formatRupiah, formatRupiahRingkas } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  BULAN_LABEL,
  JENIS_KLAIM, JENIS_KLAIM_LABEL, JENIS_KLAIM_TONE,
  JENIS_LAYANAN, JENIS_LAYANAN_LABEL,
  KATEGORI_KLAIM, KATEGORI_KLAIM_LABEL,
  STATUS_KLAIM, STATUS_KLAIM_LABEL, STATUS_KLAIM_TONE,
  type JenisKlaim, type JenisLayanan, type KategoriKlaim, type StatusKlaim,
} from "@/server/modules/rekap-klaim/klaim.schema";
import { deleteKlaim, fetchKlaim, type KlaimItem, type KlaimQuery } from "./klaim.client";
import { KlaimFormModal, type KlaimDefaults } from "./KlaimFormModal";

type Perms = { create: boolean; update: boolean; delete: boolean };

const now = new Date();
const shortBulan = (m: number) => BULAN_LABEL[m - 1].slice(0, 3);
function fmtTgl(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return "—";
  return `${d} ${shortBulan(m)} ${y}`;
}

const opt = (placeholder: string, opts: SelectOption[]): SelectOption[] => [{ value: "", label: placeholder }, ...opts];

export function DataKlaimView({ perms }: { perms: Perms }) {
  const toast = useToast();

  const [tahun, setTahun] = useState("");
  const [bulan, setBulan] = useState("");
  const [jenisKlaim, setJenisKlaim] = useState("");
  const [jenisLayanan, setJenisLayanan] = useState("");
  const [kategori, setKategori] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounce(search, 300);

  const query: KlaimQuery = {
    tahun: tahun || undefined,
    bulan: bulan || undefined,
    jenisKlaim: (jenisKlaim || undefined) as JenisKlaim | undefined,
    jenisLayanan: (jenisLayanan || undefined) as JenisLayanan | undefined,
    kategori: (kategori || undefined) as KategoriKlaim | undefined,
    status: (status || undefined) as StatusKlaim | undefined,
    q: q || undefined,
  };
  const state = useAsyncData(() => fetchKlaim(query), [tahun, bulan, jenisKlaim, jenisLayanan, kategori, status, q]);
  const rows = useMemo(() => state.result?.data ?? [], [state.result]);
  const meta = state.result?.meta;

  // Ringkasan (dari hasil terfilter).
  const summary = useMemo(() => {
    let pending = 0, perhatian = 0, kasus = 0;
    for (const r of rows) {
      if (r.jenisKlaim === "PENDING") pending++;
      if (r.status === "EXPIRED" || r.status === "REJECTED" || (r.selisih != null && r.selisih !== 0)) perhatian++;
      if (r.jenisKlaim === "PENDING" || r.kategori === "RUJUKAN_AMBULANS") kasus += r.jumlahKasus ?? 0;
    }
    return { pending, perhatian, kasus };
  }, [rows]);

  // Default form (diingat dari entri terakhir → input beruntun cepat).
  const [defaults, setDefaults] = useState<KlaimDefaults>({
    jenisKlaim: "REGULER", jenisLayanan: "RITL", kategori: "INA_CBGS",
    bulanPelayanan: now.getMonth() + 1, tahunPelayanan: now.getFullYear(), status: "SUBMITTED",
  });

  const [modal, setModal] = useState<{ open: boolean; mode: "create" | "edit"; item: KlaimItem | null }>({
    open: false, mode: "create", item: null,
  });
  const [del, setDel] = useState<KlaimItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => setModal({ open: true, mode: "create", item: null });
  const openEdit = (item: KlaimItem) => setModal({ open: true, mode: "edit", item });
  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  function onSaved(saved: KlaimItem) {
    // Ingat periode & jenis terakhir agar entri berikutnya cepat.
    setDefaults({
      jenisKlaim: saved.jenisKlaim, jenisLayanan: saved.jenisLayanan, kategori: saved.kategori,
      bulanPelayanan: saved.bulanPelayanan, tahunPelayanan: saved.tahunPelayanan, status: saved.status,
    });
    state.reload();
  }

  async function confirmDelete() {
    if (!del) return;
    setDeleting(true);
    try {
      await deleteKlaim(del.id);
      toast.success("Klaim dihapus", `${JENIS_KLAIM_LABEL[del.jenisKlaim]} · ${shortBulan(del.bulanPelayanan)} ${del.tahunPelayanan}`);
      setDel(null);
      state.reload();
    } catch (e) {
      toast.error("Gagal menghapus", e instanceof Error ? e.message : undefined);
    } finally {
      setDeleting(false);
    }
  }

  const tahunOpts = (meta?.tahunTersedia ?? []).map((y) => ({ value: String(y), label: String(y) }));
  const hasFilter = !!(tahun || bulan || jenisKlaim || jenisLayanan || kategori || status || search);
  const resetFilter = () => { setTahun(""); setBulan(""); setJenisKlaim(""); setJenisLayanan(""); setKategori(""); setStatus(""); setSearch(""); };

  return (
    <div className="space-y-4">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={FileStack} tone="brand" label="Total Entri" value={meta ? String(meta.total) : "—"} sub={hasFilter ? "sesuai filter" : "semua"} />
        <Tile icon={Coins} tone="success" label="Total Diterima" value={meta ? formatRupiahRingkas(meta.totalNilai) : "—"} sub="masuk rekening" />
        <Tile icon={Layers} tone="warning" label="Klaim Pending" value={String(summary.pending)} sub={summary.kasus ? `${summary.kasus} kasus` : "entri"} />
        <Tile icon={AlertTriangle} tone={summary.perhatian ? "danger" : "neutral"} label="Perlu Perhatian" value={String(summary.perhatian)} sub="expired / selisih" highlight={summary.perhatian > 0} />
      </div>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[9rem] flex-1">
            <Label className="text-[11px]">Cari</Label>
            <InputWithIcon icon={<Search className="size-4" />} value={search} placeholder="Nomor klaim / BA / catatan…" onChange={(e) => setSearch(e.target.value)} />
          </div>
          <FilterSelect label="Tahun" value={tahun} onChange={setTahun} options={opt("Semua tahun", tahunOpts)} />
          <FilterSelect label="Bulan" value={bulan} onChange={setBulan} options={opt("Semua bulan", BULAN_LABEL.map((b, i) => ({ value: String(i + 1), label: b })))} />
          <FilterSelect label="Jenis" value={jenisKlaim} onChange={setJenisKlaim} options={opt("Semua jenis", JENIS_KLAIM.map((v) => ({ value: v, label: JENIS_KLAIM_LABEL[v] })))} />
          <FilterSelect label="Layanan" value={jenisLayanan} onChange={setJenisLayanan} options={opt("Semua layanan", JENIS_LAYANAN.map((v) => ({ value: v, label: v })))} />
          <FilterSelect label="Kategori" value={kategori} onChange={setKategori} options={opt("Semua kategori", KATEGORI_KLAIM.map((v) => ({ value: v, label: KATEGORI_KLAIM_LABEL[v] })))} />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={opt("Semua status", STATUS_KLAIM.map((v) => ({ value: v, label: STATUS_KLAIM_LABEL[v] })))} />
          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={resetFilter} className="mb-0.5">Reset</Button>
          )}
          <div className="ml-auto">
            {perms.create && (
              <Button size="sm" icon={<Plus className="size-4" />} onClick={openCreate}>Tambah Klaim</Button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabel */}
      <Card className="overflow-hidden p-0">
        {state.loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-md)]" />)}
          </div>
        ) : state.error ? (
          <ErrorState onRetry={state.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={hasFilter ? "Tidak ada klaim yang cocok" : "Belum ada data klaim"}
            description={hasFilter ? "Coba ubah / reset filter." : "Tambahkan entri klaim pertama untuk mulai merekap."}
            action={perms.create && !hasFilter ? <Button size="sm" icon={<Plus className="size-4" />} onClick={openCreate}>Tambah Klaim</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TH>Periode</TH>
                <TH>Jenis / Layanan</TH>
                <TH className="hidden lg:table-cell">Kategori</TH>
                <TH className="hidden md:table-cell">Nomor / BA</TH>
                <TH align="center" className="hidden sm:table-cell">Kasus</TH>
                <TH align="right">Diterima</TH>
                <TH className="hidden lg:table-cell">Masuk Rek.</TH>
                <TH>Status</TH>
                {(perms.update || perms.delete) && <TH align="right">Aksi</TH>}
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <span className="font-medium text-fg">{shortBulan(r.bulanPelayanan)} {r.tahunPelayanan}</span>
                    </TD>
                    <TD>
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={JENIS_KLAIM_TONE[r.jenisKlaim]} dot>{JENIS_KLAIM_LABEL[r.jenisKlaim]}</Badge>
                        <span className="text-[11px] font-medium text-fg-muted">{JENIS_LAYANAN_LABEL[r.jenisLayanan]}</span>
                      </div>
                    </TD>
                    <TD className="hidden lg:table-cell">
                      {r.kategori === "RUJUKAN_AMBULANS"
                        ? <Badge tone="accent">Rujukan Ambulans</Badge>
                        : <span className="text-sm text-fg-muted">INA-CBG&apos;s</span>}
                    </TD>
                    <TD className="hidden md:table-cell">
                      {r.nomorKlaim ? <span className="font-mono text-xs text-fg">{r.nomorKlaim}</span> : null}
                      {r.refBa ? <p className="font-mono text-[11px] text-fg-subtle">{r.refBa}</p> : null}
                      {!r.nomorKlaim && !r.refBa ? <span className="text-fg-subtle">—</span> : null}
                    </TD>
                    <TD align="center" className="hidden text-sm text-fg-muted tabular-nums sm:table-cell">{r.jumlahKasus ?? "—"}</TD>
                    <TD align="right">
                      <span className="text-sm font-semibold text-fg tabular-nums">{formatRupiah(r.jumlah)}</span>
                      <div className="mt-0.5 flex flex-wrap justify-end gap-1">
                        {r.selisih != null && r.selisih !== 0 && (
                          <Badge tone="warning" className="gap-1"><TrendingDown className="size-3" /> selisih {formatRupiahRingkas(Math.abs(r.selisih))}</Badge>
                        )}
                        {r.jumlahPotongan > 0 && (
                          <Badge tone="neutral" className="gap-1"><Scissors className="size-3" /> {r.jumlahPotongan} potongan</Badge>
                        )}
                      </div>
                    </TD>
                    <TD className="hidden text-sm text-fg-muted tabular-nums lg:table-cell">{fmtTgl(r.tglMasukRekening)}</TD>
                    <TD><Badge tone={STATUS_KLAIM_TONE[r.status]} dot>{STATUS_KLAIM_LABEL[r.status]}</Badge></TD>
                    {(perms.update || perms.delete) && (
                      <TD align="right">
                        <div className="flex justify-end gap-1">
                          {perms.update && (
                            <button type="button" onClick={() => openEdit(r)} title="Ubah" className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-brand-soft hover:text-brand">
                              <Pencil className="size-4" />
                            </button>
                          )}
                          {perms.delete && (
                            <button type="button" onClick={() => setDel(r)} title="Hapus" className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger">
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
          </div>
        )}
      </Card>

      {/* Form tambah/ubah */}
      <KlaimFormModal
        open={modal.open}
        mode={modal.mode}
        item={modal.item}
        defaults={defaults}
        onClose={closeModal}
        onSaved={(saved) => onSaved(saved)}
      />

      {/* Konfirmasi hapus */}
      <Modal
        open={!!del}
        onClose={deleting ? () => {} : () => setDel(null)}
        size="sm"
        icon={<span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-danger-soft text-danger"><Trash2 className="size-5" /></span>}
        title="Hapus entri klaim?"
        description="Tindakan ini permanen dan tercatat di audit trail."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDel(null)} disabled={deleting}>Batal</Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting}>Hapus</Button>
          </div>
        }
      >
        {del && (
          <div className="rounded-[var(--radius-md)] border border-border bg-surface-2/40 p-3 text-sm">
            <div className="flex items-center gap-2">
              <ReceiptText className="size-4 text-fg-subtle" />
              <span className="font-medium text-fg">{JENIS_KLAIM_LABEL[del.jenisKlaim]} · {JENIS_LAYANAN_LABEL[del.jenisLayanan]}</span>
            </div>
            <p className="mt-1 text-fg-muted">
              {shortBulan(del.bulanPelayanan)} {del.tahunPelayanan} · <span className="font-semibold text-fg tabular-nums">{formatRupiah(del.jumlah)}</span>
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* --------------------------------------------------------------- sub-komponen */

function Tile({
  icon: Icon, label, value, sub, tone, highlight,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  sub?: string;
  tone: "brand" | "success" | "warning" | "danger" | "neutral";
  highlight?: boolean;
}) {
  const toneBox: Record<string, string> = {
    brand: "bg-brand-soft text-brand", success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger", neutral: "bg-surface-2 text-fg-muted",
  };
  return (
    <Card className={cn("p-4", highlight && "ring-1 ring-danger/30")}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <div className={cn("flex size-8 items-center justify-center rounded-[var(--radius-md)]", toneBox[tone])}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight text-fg tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-fg-subtle">{sub}</p>}
    </Card>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
}) {
  return (
    <div className="min-w-[8.5rem]">
      <Label className="text-[11px]">{label}</Label>
      <Select value={value} onChange={onChange} options={options} />
    </div>
  );
}
