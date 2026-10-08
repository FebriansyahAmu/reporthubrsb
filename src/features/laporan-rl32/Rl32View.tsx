"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BedDouble,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  FileSpreadsheet,
  FileText,
  LogIn,
  LogOut,
  RefreshCw,
  Route,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Label } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { useAsyncData } from "@/lib/useAsyncData";
import { downloadFromEndpoint } from "@/lib/download";
import { formatJam, formatNumber, tanggalHariIniWita } from "@/lib/format";
import { MONTHS_ID } from "@/server/modules/rl41/rl41.constants";
import type { BagianRuangan, NilaiRl32, Rl32Result, RuanganRl32 } from "@/server/modules/rl32/rl32.types";
import { PemetaanRl32Drawer } from "./PemetaanRl32Drawer";
import { TabelRl32 } from "./TabelRl32";

type BarisTabRuangan = { kunci: string; r: RuanganRl32; nilai: NilaiRl32; bagian?: BagianRuangan };

/** "PERAWATAN INTERNA KELAS 3 (DPJP Saraf)" — sumbangan ruangan ke satu jenis pelayanan. */
const labelSumber = (x: { nama: string; smf: string[] | null }) => (x.smf ? `${x.nama} (DPJP ${x.smf.join(", ")})` : x.nama);

/* ------------------------------------------------------------------ periode */

type Bulan = { tahun: number; bulan: number }; // bulan 1..12

const p2 = (n: number) => String(n).padStart(2, "0");
const geser = (b: Bulan, n: number): Bulan => {
  const i = b.tahun * 12 + (b.bulan - 1) + n;
  return { tahun: Math.floor(i / 12), bulan: (i % 12) + 1 };
};
const sama = (a: Bulan, b: Bulan) => a.tahun === b.tahun && a.bulan === b.bulan;
const rentang = (b: Bulan) => {
  const akhir = new Date(Date.UTC(b.tahun, b.bulan, 0)).getUTCDate();
  return { from: `${b.tahun}-${p2(b.bulan)}-01`, to: `${b.tahun}-${p2(b.bulan)}-${p2(akhir)}` };
};

/** Data SIMGOS tersedia sejak 2023 (RL 3.2 bulanan). */
const TAHUN_AWAL = 2023;

const OPSI_BULAN = MONTHS_ID.map((m, i) => ({ value: String(i + 1), label: m }));

/* -------------------------------------------------------------------- view */

export function Rl32View({ bolehLihatPeta, bolehUbahPeta }: { bolehLihatPeta: boolean; bolehUbahPeta: boolean }) {
  const kini = useMemo<Bulan>(() => {
    const h = tanggalHariIniWita();
    return { tahun: Number(h.slice(0, 4)), bulan: Number(h.slice(5, 7)) };
  }, []);
  const [periode, setPeriode] = useState<Bulan>(() => geser(kini, -1));
  const [tab, setTab] = useState<"jenis" | "ruangan">("jenis");
  const [lp, setLp] = useState(false);
  const [semuaBaris, setSemuaBaris] = useState(false);
  const [petaBuka, setPetaBuka] = useState(false);
  const [exporting, setExporting] = useState<"" | "xlsx" | "pdf">("");
  const [exportError, setExportError] = useState<string | null>(null);

  const { from, to } = rentang(periode);
  const { result, loading, error, reload } = useAsyncData<Rl32Result>(
    () => apiGet<Rl32Result>(`/api/laporan/rl32?${new URLSearchParams({ from, to })}`),
    [from, to],
  );

  const opsiTahun = useMemo(
    () => Array.from({ length: kini.tahun - TAHUN_AWAL + 1 }, (_, i) => String(kini.tahun - i)),
    [kini.tahun],
  );
  const bulanBerjalan = sama(periode, kini);
  const bisaMaju = !sama(periode, kini);

  const total = result?.total ?? null;
  // Ada pasien/TT di ruangan mana pun (termasuk yang belum dipetakan)?
  const adaData = !!result && result.ruangan.some((r) => r.aktivitas);
  const semuaBelum = !!result && result.ruangan.length > 0 && result.ruangan.every((r) => r.status === "belum");

  const barisJenis = useMemo(
    () =>
      (result?.baris ?? []).filter(
        (b) => semuaBaris || b.ruangan.length > 0 || b.nilai.masuk.total + b.nilai.awal.total + b.nilai.hariPerawatan.total > 0,
      ),
    [result, semuaBaris],
  );
  // Ruangan + (bila dipisah menurut DPJP) rinciannya per jenis pelayanan.
  const barisRuangan = useMemo<BarisTabRuangan[]>(
    () =>
      (result?.ruangan ?? [])
        .filter((r) => r.aktivitas || r.status !== "belum")
        .flatMap((r) => [
          { kunci: r.id, r, nilai: r.nilai },
          ...r.bagian.map((b) => ({ kunci: `${r.id}:${b.kategori.id}`, r, nilai: b.nilai, bagian: b })),
        ]),
    [result],
  );

  async function unduh(format: "xlsx" | "pdf") {
    setExporting(format);
    setExportError(null);
    try {
      const p = new URLSearchParams({ from, to, format });
      await downloadFromEndpoint(`/api/laporan/rl32/export?${p}`, `RL-3.2.${format}`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Gagal mengekspor data.");
    } finally {
      setExporting("");
    }
  }

  const bisaEkspor = !loading && !error && !!result;

  return (
    <div className="space-y-5">
      {/* Bilah status & aksi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Clock className="size-4" aria-hidden />
          {result ? <span className="tabular">Diperbarui pukul {formatJam(result.updatedAt)}</span> : <span>Memuat…</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bolehLihatPeta && (
            <Button variant="secondary" size="sm" icon={<Route className="size-4" />} onClick={() => setPetaBuka(true)}>
              Pemetaan ruangan
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={cn("size-4", loading && "animate-spin")} />}
            onClick={() => reload()}
          >
            Muat ulang
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileText className="size-4" />}
            loading={exporting === "pdf"}
            disabled={!bisaEkspor || exporting !== ""}
            onClick={() => unduh("pdf")}
          >
            Unduh PDF
          </Button>
          <Button
            size="sm"
            icon={<FileSpreadsheet className="size-4" />}
            loading={exporting === "xlsx"}
            disabled={!bisaEkspor || exporting !== ""}
            onClick={() => unduh("xlsx")}
          >
            Unduh Excel
          </Button>
        </div>
      </div>

      {exportError && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {exportError}
        </div>
      )}

      {/* Periode & tampilan */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <Label htmlFor="rl32-bulan">Bulan laporan</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPeriode((b) => geser(b, -1))}
                disabled={periode.tahun === TAHUN_AWAL && periode.bulan === 1}
                aria-label="Bulan sebelumnya"
                className="flex size-10 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="w-36">
                <Select
                  id="rl32-bulan"
                  value={String(periode.bulan)}
                  options={OPSI_BULAN}
                  onChange={(v) => setPeriode((b) => ({ ...b, bulan: Number(v) }))}
                />
              </div>
              <div className="w-24">
                <Select
                  value={String(periode.tahun)}
                  options={opsiTahun}
                  onChange={(v) => setPeriode((b) => ({ ...b, tahun: Number(v) }))}
                />
              </div>
              <button
                type="button"
                onClick={() => setPeriode((b) => geser(b, 1))}
                disabled={!bisaMaju}
                aria-label="Bulan berikutnya"
                className="flex size-10 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pb-2">
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <Switch checked={lp} onChange={setLp} label="Rincian laki-laki dan perempuan" />
              Rincian L / P
            </label>
            {tab === "jenis" && (
              <label className="flex items-center gap-2 text-sm text-fg-muted">
                <Switch checked={semuaBaris} onChange={setSemuaBaris} label="Tampilkan semua jenis pelayanan" />
                Semua jenis pelayanan
              </label>
            )}
          </div>
        </div>
        {bulanBerjalan && (
          <p className="mt-3 text-xs text-fg-subtle">
            Bulan berjalan — pasien akhir bulan dan hari perawatan dihitung sampai hari ini.
          </p>
        )}
      </Card>

      {/* Peringatan pemetaan */}
      {result && (semuaBelum || result.belumDipetakan.length > 0) && (
        <PeringatanPemetaan
          semuaBelum={semuaBelum}
          ruangan={result.belumDipetakan}
          bolehLihat={bolehLihatPeta}
          onAtur={() => setPetaBuka(true)}
        />
      )}

      {/* Ringkasan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          icon={LogIn}
          label="Pasien masuk"
          nilai={total?.masuk.total}
          hint={total ? `L ${formatNumber(total.masuk.lk)} · P ${formatNumber(total.masuk.pr)} · pindahan ${formatNumber(total.pindahan.total)}` : ""}
          loading={loading}
        />
        <Tile
          icon={LogOut}
          label="Pasien keluar"
          nilai={total ? total.hidup.total + total.mati.total : undefined}
          hint={total ? `${formatNumber(total.mati.total)} meninggal (${formatNumber(total.matiKurang48.total)} < 48 jam)` : ""}
          loading={loading}
        />
        <Tile
          icon={BedDouble}
          label="Hari perawatan"
          nilai={total?.hariPerawatan.total}
          hint={
            total
              ? `Lama dirawat ${formatNumber(total.lamaDirawat.total)} hari · TT ${total.tempatTidur == null ? "—" : formatNumber(total.tempatTidur)}`
              : ""
          }
          loading={loading}
        />
        <Tile
          icon={DoorOpen}
          label={bulanBerjalan ? "Pasien dirawat saat ini" : "Pasien akhir bulan"}
          nilai={total?.sisa.total}
          hint={total ? `Awal bulan ${formatNumber(total.awal.total)}` : ""}
          loading={loading}
        />
      </div>

      {/* Tab */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <div role="tablist" aria-label="Pengelompokan" className="flex gap-1">
          <TabBtn aktif={tab === "jenis"} onClick={() => setTab("jenis")}>
            Per jenis pelayanan
          </TabBtn>
          <TabBtn aktif={tab === "ruangan"} onClick={() => setTab("ruangan")}>
            Per ruangan
          </TabBtn>
        </div>
        {result && <p className="pb-2 text-xs text-fg-subtle">{result.judulPeriode}</p>}
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <TableSkeleton />
        ) : error || !result ? (
          <ErrorState onRetry={reload} />
        ) : tab === "jenis" ? (
          barisJenis.length === 0 ? (
            <EmptyState
              title={adaData ? "Belum ada jenis pelayanan terisi" : "Tidak ada pasien rawat inap"}
              description={
                adaData
                  ? "Pasien ada, tetapi ruangannya belum dipetakan ke jenis pelayanan."
                  : "Tidak ada pasien rawat inap pada bulan ini. Pilih bulan lain."
              }
            />
          ) : (
            <TabelRl32
              lp={lp}
              baris={barisJenis}
              kunci={(b) => String(b.id)}
              nilai={(b) => b.nilai}
              kepala="Jenis pelayanan"
              sel={(b) => (
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">
                    <span className="mr-1.5 tabular text-fg-subtle">{b.kode}.</span>
                    {b.deskripsi}
                  </p>
                  {b.ruangan.length > 0 && (
                    <p className="truncate text-[11px] text-fg-subtle" title={b.ruangan.map(labelSumber).join(", ")}>
                      {b.ruangan.map(labelSumber).join(", ")}
                    </p>
                  )}
                </div>
              )}
              total={result.total}
              labelTotal="Total"
            />
          )
        ) : barisRuangan.length === 0 ? (
          <EmptyState title="Belum ada ruang rawat inap" description="Daftar ruang rawat inap SIMGOS kosong." />
        ) : (
          <TabelRl32
            lp={lp}
            baris={barisRuangan}
            kunci={(x) => x.kunci}
            nilai={(x) => x.nilai}
            kepala="Ruangan"
            sel={({ r, bagian }) =>
              bagian ? (
                <p className="truncate pl-4 text-xs text-fg-muted">
                  <span aria-hidden>↳ </span>
                  {bagian.kategori.kode}. {bagian.kategori.deskripsi}
                  <span className="text-fg-subtle">
                    {bagian.smf.length ? ` · DPJP ${bagian.smf.map((s) => s.nama).join(", ")}` : " · alokasi TT"}
                  </span>
                </p>
              ) : (
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{r.nama}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-subtle">
                    <span className="font-mono">{r.id}</span>
                    {r.status === "terpetakan" && r.kategori ? (
                      <Badge tone="brand" className="px-2 py-0 text-[11px]">
                        {r.kategori.kode}. {r.kategori.deskripsi}
                      </Badge>
                    ) : r.status === "dikecualikan" ? (
                      <Badge className="px-2 py-0 text-[11px]">Tidak dilaporkan</Badge>
                    ) : (
                      <Badge tone="warning" dot className="px-2 py-0 text-[11px]">
                        Belum dipetakan
                      </Badge>
                    )}
                    {r.pisahDpjp && <Badge className="px-2 py-0 text-[11px]">Dipisah menurut DPJP</Badge>}
                    {!r.aktif && <span>· nonaktif</span>}
                  </p>
                </div>
              )
            }
            redup={({ r, bagian }) => !bagian && r.status !== "terpetakan"}
            rincian={(x) => !!x.bagian}
            total={result.total}
            labelTotal="Total ruangan dipetakan"
          />
        )}
      </Card>

      {result && result.pemisahan.length > 0 && (
        <p className="text-xs text-fg-muted">
          <span className="font-medium text-fg">Dipisah menurut SMF DPJP</span> (
          {result.ruangan.filter((r) => r.pisahDpjp).map((r) => r.nama).join(", ")}):{" "}
          {result.pemisahan.map((p) => `${p.smf.nama} → ${p.kategori.kode}. ${p.kategori.deskripsi}`).join(" · ")}. SMF lain
          dan alokasi TT tetap ikut jenis pelayanan ruangannya.
        </p>
      )}

      <p className="text-xs leading-relaxed text-fg-subtle">
        Sumber: SIMGOS (hanya dibaca), logika SP <span className="font-mono">LaporanRL32RuanganRevisi</span>. Jenis
        pelayanan ditentukan oleh ruang rawat pasien menurut pemetaan ruangan ReportHub. Pasien dipindahkan = (awal +
        masuk + pindahan) − (keluar hidup + keluar mati + akhir bulan). Mati &lt; / ≥ 48 jam dihitung sejak pendaftaran.
        Alokasi TT diambil per tanggal 1.
      </p>

      <PemetaanRl32Drawer
        open={petaBuka}
        onClose={() => setPetaBuka(false)}
        bolehUbah={bolehUbahPeta}
        onTersimpan={reload}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- bagian */

function PeringatanPemetaan({
  semuaBelum,
  ruangan,
  bolehLihat,
  onAtur,
}: {
  semuaBelum: boolean;
  ruangan: Rl32Result["belumDipetakan"];
  bolehLihat: boolean;
  onAtur: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-warning/40 bg-warning-soft px-4 py-3 sm:flex-row sm:items-start"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-fg">
          {semuaBelum ? "Pemetaan ruangan belum diatur" : "Ada ruangan yang belum dipetakan"}
        </p>
        <p className="mt-0.5 text-fg-muted">
          {semuaBelum
            ? "Tentukan jenis pelayanan RL 3.2 untuk setiap ruang rawat inap agar angkanya masuk laporan."
            : "Angka ruangan berikut tidak masuk laporan sampai ruangannya dipetakan atau ditandai tidak dilaporkan."}
          {!bolehLihat && " Minta admin yang memegang izin Pemetaan Laporan RL untuk mengaturnya."}
        </p>
        {ruangan.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {ruangan.map((r) => (
              <li key={r.id} className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-fg ring-1 ring-warning/30">
                {r.nama}
                <span className="text-fg-subtle">
                  {" "}
                  · {formatNumber(r.pasien)} pasien{r.tempatTidur ? ` · ${formatNumber(r.tempatTidur)} TT` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {bolehLihat && (
        <Button size="sm" variant="secondary" icon={<Route className="size-4" />} onClick={onAtur} className="shrink-0">
          Atur pemetaan
        </Button>
      )}
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  nilai,
  hint,
  loading,
}: {
  icon: typeof LogIn;
  label: string;
  nilai: number | undefined;
  hint: string;
  loading: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span className="flex size-7 items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-fg-muted">
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular text-fg">
        {loading || nilai == null ? <span className="text-fg-subtle">—</span> : formatNumber(nilai)}
      </p>
      {hint && !loading && <p className="mt-0.5 truncate text-[11px] text-fg-subtle">{hint}</p>}
    </Card>
  );
}

function TabBtn({ aktif, onClick, children }: { aktif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={aktif}
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        aktif ? "border-brand text-fg" : "border-transparent text-fg-muted hover:text-fg",
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
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-3.5 w-48 rounded" />
          <Skeleton className="h-3.5 flex-1 rounded" />
        </div>
      ))}
    </div>
  );
}
