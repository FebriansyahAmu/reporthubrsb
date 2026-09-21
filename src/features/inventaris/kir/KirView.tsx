"use client";

import { useState } from "react";
import { Boxes, DoorOpen, MapPin, Plus, Printer, Stamp, User, Wallet, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Label } from "@/components/ui/Field";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/lib/useAsyncData";
import { downloadFromEndpoint } from "@/lib/download";
import { formatRupiah, formatRupiahRingkas } from "@/lib/format";
import { cn } from "@/lib/cn";
import { STATUS_ASET_LABEL, STATUS_ASET_TONE } from "@/server/modules/inventaris/barang.schema";
import { fetchKirData, fetchKirRuangan, type KirData, type KirRuanganSummary } from "./kir.client";

type Signer = { atas: string; jabatan: string; name: string; nip: string };

const DEFAULT_PLACE = "Sumber Rejo";
const JABATAN_PRESET = [
  "Direktur RSUD Boltim",
  "Penanggung Jawab Ruangan",
  "Kepala Ruangan",
  "Pengurus / Penyimpan Barang",
  "Kuasa Pengguna Barang",
  "Kepala Bagian Umum",
];
const ATAS_PRESET = ["Mengetahui,", "Menyetujui,", "Dibuat oleh,"];

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
/** Tanggal panjang hari ini (WITA) — sama seperti yang tercetak di PDF. */
function longTodayWita(): string {
  const w = new Date(Date.now() + 8 * 3600 * 1000);
  return `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}`;
}

function defaultSigners(data: KirData): Signer[] {
  return [
    { atas: "", jabatan: "Pengurus / Penyimpan Barang", name: "", nip: "" },
    { atas: "Mengetahui,", jabatan: "Penanggung Jawab Ruangan", name: data.ruangan.pjNama ?? "", nip: data.ruangan.pjNip ?? "" },
  ];
}

export function KirView({ canPrint }: { canPrint: boolean }) {
  const toast = useToast();
  const listState = useAsyncData<KirRuanganSummary[]>(() => fetchKirRuangan(), []);
  const list = listState.result ?? [];

  const [selectedId, setSelectedId] = useState("");
  if (selectedId === "" && list.length > 0) {
    const def = list.find((r) => r.jumlah > 0) ?? list[0];
    setSelectedId(def.id);
  }

  const dataState = useAsyncData<KirData | null>(
    () => (selectedId ? fetchKirData(selectedId) : Promise.resolve(null)),
    [selectedId],
  );
  const data = dataState.result;

  // Penanda tangan + tempat (bisa diedit); di-seed ulang saat ganti ruangan.
  const [place, setPlace] = useState(DEFAULT_PLACE);
  const [signers, setSigners] = useState<Signer[]>([]);
  const [signKey, setSignKey] = useState("");
  if (data && data.ruangan.id === selectedId && signKey !== selectedId) {
    setSignKey(selectedId);
    setSigners(defaultSigners(data));
  }

  const setSigner = (i: number, patch: Partial<Signer>) =>
    setSigners((xs) => xs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addSigner = () => setSigners((xs) => (xs.length >= 3 ? xs : [...xs, { atas: "", jabatan: "", name: "", nip: "" }]));
  const removeSigner = (i: number) => setSigners((xs) => (xs.length <= 1 ? xs : xs.filter((_, idx) => idx !== i)));
  const fillPj = (i: number) => data && setSigner(i, { name: data.ruangan.pjNama ?? "", nip: data.ruangan.pjNip ?? "" });

  const [exporting, setExporting] = useState(false);
  async function onPrint() {
    if (!selectedId || !data) return;
    setExporting(true);
    try {
      const columns = signers.map((s) => ({
        caption: [s.atas.trim(), s.jabatan.trim()].filter(Boolean).join("\n"),
        name: s.name.trim() || undefined,
        nip: s.nip.trim(),
      }));
      const sig = { place: place.trim() || undefined, columns };
      const q = `?sig=${encodeURIComponent(JSON.stringify(sig))}`;
      await downloadFromEndpoint(`/api/inventaris/kir/${selectedId}/pdf${q}`, `KIR_${data.ruangan.kodePrefix}.pdf`);
      toast.success("Menyiapkan PDF", "Kartu Inventaris Ruangan sedang diunduh.");
    } catch (e) {
      toast.error("Gagal mencetak", e instanceof Error ? e.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* Pemilih ruangan */}
      <Card className="overflow-hidden p-0 lg:sticky lg:top-4 lg:self-start">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">Pilih Ruangan</h3>
          <p className="text-xs text-fg-muted">{listState.loading ? "Memuat…" : `${list.length} ruangan`}</p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-2">
          {listState.loading ? (
            <div className="space-y-2 p-1">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-[var(--radius-md)]" />)}
            </div>
          ) : listState.error ? (
            <ErrorState onRetry={listState.reload} />
          ) : list.length === 0 ? (
            <EmptyState title="Belum ada ruangan" description="Tambahkan ruangan di Pengaturan lebih dulu." />
          ) : (
            <ul className="space-y-1.5">
              {list.map((r) => {
                const active = r.id === selectedId;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        "w-full rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                        active ? "border-brand/50 bg-brand-soft/40" : "border-border bg-surface hover:bg-surface-2",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold", active ? "bg-brand text-brand-fg" : "bg-surface-2 text-fg-muted")}>
                          {r.kodePrefix}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{r.nama}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-fg-muted">
                        <span className="inline-flex items-center gap-1"><Boxes className="size-3" /> {r.jumlah} unit</span>
                        <span className="inline-flex items-center gap-1"><Wallet className="size-3" /> {formatRupiahRingkas(r.totalNilai)}</span>
                      </div>
                      {!r.pjNama && (
                        <p className="mt-1 text-[10px] font-medium text-warning">PJ belum ditetapkan</p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* Pratinjau + editor tanda tangan */}
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold text-fg">Pratinjau Kartu Inventaris Ruangan</h3>
              <p className="text-xs text-fg-muted">Cetak PDF resmi ber-kop, logo & tanda tangan.</p>
            </div>
            <Button
              size="sm"
              icon={<Printer className="size-4" />}
              onClick={onPrint}
              loading={exporting}
              disabled={!canPrint || !data || dataState.loading}
            >
              Cetak PDF
            </Button>
          </div>

          {dataState.loading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-6 w-72 rounded" />
              <Skeleton className="h-4 w-56 rounded" />
              <Skeleton className="mt-4 h-40 w-full rounded" />
            </div>
          ) : dataState.error ? (
            <ErrorState onRetry={dataState.reload} />
          ) : !data ? (
            <EmptyState title="Pilih ruangan" description="Pilih ruangan di kiri untuk melihat kartu inventarisnya." />
          ) : (
            <KirPreview data={data} signers={signers} place={place} />
          )}
        </Card>

        {data && (
          <SignerEditor
            place={place}
            onPlace={setPlace}
            signers={signers}
            onSet={setSigner}
            onAdd={addSigner}
            onRemove={removeSigner}
            onFillPj={fillPj}
            pjAvailable={!!data.ruangan.pjNama}
          />
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- pratinjau */

function KirPreview({ data, signers, place }: { data: KirData; signers: Signer[]; place: string }) {
  const { ruangan, barang, totalNilai } = data;
  const dateLabel = `${place.trim() || DEFAULT_PLACE}, ${longTodayWita()}`;
  const last = signers.length - 1;
  return (
    <div className="p-5">
      {/* Kop + logo */}
      <div className="border-b border-border pb-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/logoboltim.png" alt="Logo RSUD Bolaang Mongondow Timur" className="mx-auto mb-2 h-14 w-auto" />
        <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Rumah Sakit Umum Daerah Bolaang Mongondow Timur</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-fg">KARTU INVENTARIS RUANGAN (KIR)</h2>
      </div>

      {/* Info ruangan + PJ */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoRow icon={DoorOpen} label="Ruangan" value={`${ruangan.nama} (${ruangan.kodePrefix})`} />
        <InfoRow
          icon={User}
          label="Penanggung Jawab"
          value={ruangan.pjNama ? `${ruangan.pjNama}${ruangan.pjNip ? ` · NIP ${ruangan.pjNip}` : ""}` : "Belum ditetapkan"}
          warn={!ruangan.pjNama}
        />
      </div>

      {/* Ringkas */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-soft-fg">
          <Boxes className="size-3.5" /> {barang.length} unit
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
          <Wallet className="size-3.5" /> {formatRupiah(totalNilai)}
        </span>
      </div>

      {/* Tabel aset */}
      <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-border">
        {barang.length === 0 ? (
          <EmptyState title="Belum ada aset" description="Ruangan ini belum memiliki barang tercatat." />
        ) : (
          <Table>
            <THead>
              <TH className="w-10 text-center">No</TH>
              <TH>Kode / Nama</TH>
              <TH className="hidden md:table-cell">Kondisi</TH>
              <TH>Status</TH>
              <TH className="hidden sm:table-cell" align="center">Tahun</TH>
              <TH align="right">Harga</TH>
            </THead>
            <TBody>
              {barang.map((b, i) => (
                <TR key={b.kodeBarang}>
                  <TD align="center" className="text-xs text-fg-subtle tabular-nums">{i + 1}</TD>
                  <TD>
                    <p className="font-mono text-xs font-semibold text-brand">{b.kodeBarang}</p>
                    <p className="text-sm text-fg">{b.nama}</p>
                    {b.merk && <p className="text-xs text-fg-subtle">{b.merk}</p>}
                  </TD>
                  <TD className="hidden text-sm text-fg-muted md:table-cell">{b.kondisi ?? "—"}</TD>
                  <TD><Badge tone={STATUS_ASET_TONE[b.statusAset]} dot>{STATUS_ASET_LABEL[b.statusAset]}</Badge></TD>
                  <TD align="center" className="hidden text-sm text-fg-muted sm:table-cell">{b.tahunPerolehan ?? "—"}</TD>
                  <TD align="right" className="text-sm text-fg">{b.harga != null ? formatRupiah(b.harga) : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {/* Pratinjau tanda tangan (mengikuti editor) */}
      <div className={cn(
        "mt-6 grid grid-cols-1 gap-6 border-t border-dashed border-border pt-5",
        signers.length >= 2 && "sm:grid-cols-2",
        signers.length >= 3 && "lg:grid-cols-3",
      )}>
        {signers.map((s, i) => (
          <div key={i} className="text-center text-sm">
            <div className="mb-1 h-5 text-xs text-fg-muted">{i === last ? dateLabel : ""}</div>
            <div className="min-h-[2.75rem] leading-snug">
              {s.atas.trim() && <p className="text-fg">{s.atas}</p>}
              <p className="text-fg">{s.jabatan.trim() || "( jabatan )"}</p>
            </div>
            <div className="h-12" />
            <p className="font-semibold text-fg">{s.name.trim() ? `( ${s.name} )` : "( .............................. )"}</p>
            <p className="text-xs text-fg-muted">NIP. {s.nip.trim() || "............................"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- editor */

function SignerEditor({
  place, onPlace, signers, onSet, onAdd, onRemove, onFillPj, pjAvailable,
}: {
  place: string;
  onPlace: (v: string) => void;
  signers: Signer[];
  onSet: (i: number, patch: Partial<Signer>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onFillPj: (i: number) => void;
  pjAvailable: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
            <Stamp className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-fg">Penanda Tangan</h3>
            <p className="text-xs text-fg-muted">Atur tempat, baris atas (mis. &quot;Mengetahui,&quot;), jabatan, nama &amp; NIP tiap kolom.</p>
          </div>
        </div>
        {signers.length < 3 && (
          <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={onAdd}>Tambah</Button>
        )}
      </div>

      {/* Tempat (tanggal otomatis hari ini) */}
      <div className="mb-3 max-w-xs">
        <Label htmlFor="kir-place">Tempat</Label>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input id="kir-place" value={place} placeholder={DEFAULT_PLACE} onChange={(e) => onPlace(e.target.value)} className="pl-9" />
        </div>
        <p className="mt-1 text-[11px] text-fg-subtle">Dicetak sbg &quot;{place.trim() || DEFAULT_PLACE}, {longTodayWita()}&quot; di atas kolom paling kanan.</p>
      </div>

      <div className={cn("grid grid-cols-1 gap-3", signers.length >= 2 && "sm:grid-cols-2", signers.length >= 3 && "lg:grid-cols-3")}>
        {signers.map((s, i) => (
          <div key={i} className="rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Kolom {i + 1}</span>
              {signers.length > 1 && (
                <button type="button" onClick={() => onRemove(i)} title="Hapus kolom" className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <Label htmlFor={`atas-${i}`}>Baris atas (opsional)</Label>
                <Input id={`atas-${i}`} value={s.atas} placeholder="mis. Mengetahui," onChange={(e) => onSet(i, { atas: e.target.value })} />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {ATAS_PRESET.map((p) => (
                    <Chip key={p} label={p} onClick={() => onSet(i, { atas: p })} />
                  ))}
                  <Chip label="kosong" onClick={() => onSet(i, { atas: "" })} />
                </div>
              </div>
              <div>
                <Label htmlFor={`jab-${i}`}>Jabatan</Label>
                <Input id={`jab-${i}`} value={s.jabatan} placeholder="mis. Direktur RSUD Boltim" onChange={(e) => onSet(i, { jabatan: e.target.value })} />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {JABATAN_PRESET.map((p) => (
                    <Chip key={p} label={p} onClick={() => onSet(i, { jabatan: p })} />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`nm-${i}`}>Nama</Label>
                  <Input id={`nm-${i}`} value={s.name} placeholder="Nama lengkap" onChange={(e) => onSet(i, { name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor={`nip-${i}`}>NIP</Label>
                  <Input id={`nip-${i}`} value={s.nip} placeholder="NIP (opsional)" onChange={(e) => onSet(i, { nip: e.target.value })} />
                </div>
              </div>
              {pjAvailable && (
                <button type="button" onClick={() => onFillPj(i)} className="text-[11px] font-medium text-brand hover:underline">
                  Isi nama/NIP dari PJ ruangan
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border px-2 py-0.5 text-[11px] text-fg-muted transition-colors hover:border-brand/40 hover:text-brand"
    >
      {label}
    </button>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: typeof DoorOpen;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface-2/40 px-3 py-2.5">
      <Icon className={cn("mt-0.5 size-4 shrink-0", warn ? "text-warning" : "text-brand")} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
        <p className={cn("text-sm", warn ? "font-medium text-warning" : "text-fg")}>{value}</p>
      </div>
    </div>
  );
}
