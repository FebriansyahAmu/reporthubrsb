"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Ambulance,
  Clock,
  FileSpreadsheet,
  FileText,
  MapPin,
  RefreshCw,
  Route,
  Stethoscope,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { useAsyncData } from "@/lib/useAsyncData";
import { downloadFromEndpoint } from "@/lib/download";
import { formatJam, formatNumber, tanggalHariIniWita } from "@/lib/format";
import { PemilihPeriode } from "@/features/laporan-rl32/PemilihPeriode";
import { pilihanAwal, rentangPilihan, type PilihanPeriode } from "@/features/laporan-rl32/periode";
import {
  JK_GAWAT_DARURAT,
  LABEL_ALASAN,
  RL35_RATA_HARI_BUKA,
  RL35_RATA_KUNJUNGAN_HARI,
} from "@/server/modules/rl35/rl35.constants";
import type { NilaiRl35, PindahRl35, Rl35Result, RuanganRl35 } from "@/server/modules/rl35/rl35.types";
import { PemetaanRl35Drawer } from "./PemetaanRl35Drawer";
import { TabelRl35, type BarisEkor } from "./TabelRl35";

type BarisTabRuangan = { kunci: string; r: RuanganRl35; nilai: NilaiRl35; pindah?: PindahRl35 };

const desimal = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const persen = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const dalam = (n: NilaiRl35) => n.dalamLk + n.dalamPr;
const luar = (n: NilaiRl35) => n.luarLk + n.luarPr;

/** "KLINIK SARAF (dx stroke)" — sumbangan ruangan ke satu jenis kegiatan. */
const labelSumber = (x: Rl35Result["baris"][number]["ruangan"][number]) =>
  x.alasan ? `${x.nama} (${LABEL_ALASAN[x.alasan]})` : x.nama;

/* -------------------------------------------------------------------- view */

export function Rl35View({ bolehLihatPeta, bolehUbahPeta }: { bolehLihatPeta: boolean; bolehUbahPeta: boolean }) {
  const hariIni = useMemo(() => tanggalHariIniWita(), []);
  const [pilihan, setPilihan] = useState<PilihanPeriode>(() => pilihanAwal(hariIni));
  const [tab, setTab] = useState<"jenis" | "ruangan">("jenis");
  const [semuaBaris, setSemuaBaris] = useState(false);
  const [petaBuka, setPetaBuka] = useState(false);
  const [exporting, setExporting] = useState<"" | "xlsx" | "pdf">("");
  const [exportError, setExportError] = useState<string | null>(null);

  const { from, to } = rentangPilihan(pilihan);
  const { result, loading, error, reload } = useAsyncData<Rl35Result>(
    () => apiGet<Rl35Result>(`/api/laporan/rl35?${new URLSearchParams({ from, to })}`),
    [from, to],
  );
  const berjalan = to >= hariIni;

  const total = result?.total ?? null;
  const igd = useMemo(
    () => (result?.ruangan ?? []).filter((r) => r.jenisKunjungan === JK_GAWAT_DARURAT && r.kategori).reduce((s, r) => s + r.nilai.total, 0),
    [result],
  );
  const adaData = !!result && result.ruangan.some((r) => r.aktivitas);

  const barisJenis = useMemo(
    () => (result?.baris ?? []).filter((b) => semuaBaris || b.nilai.total > 0 || b.ruangan.length > 0),
    [result, semuaBaris],
  );
  const barisRuangan = useMemo<BarisTabRuangan[]>(
    () =>
      (result?.ruangan ?? [])
        .filter((r) => r.aktivitas || r.status === "terpetakan" || r.status === "dikecualikan")
        .flatMap((r) => [
          { kunci: r.id, r, nilai: r.nilai },
          ...r.pindah.map((p) => ({ kunci: `${r.id}:${p.kategori.id}`, r, nilai: p.nilai, pindah: p })),
        ]),
    [result],
  );

  const ekor = useMemo<BarisEkor[]>(() => {
    if (!result) return [];
    const rr = result.rataRata;
    return [
      {
        kode: String(RL35_RATA_HARI_BUKA),
        label: "Rata-rata hari poliklinik buka",
        nilai: desimal.format(rr.rataHariBuka),
        keterangan: `${formatNumber(rr.hariBuka)} hari berkunjungan poliklinik${rr.bulan > 1 ? ` ÷ ${rr.bulan} bulan` : ""}`,
      },
      {
        kode: String(RL35_RATA_KUNJUNGAN_HARI),
        label: "Rata-rata kunjungan per hari",
        nilai: rr.rataKunjunganPerHari == null ? "—" : desimal.format(rr.rataKunjunganPerHari),
        keterangan: `${formatNumber(rr.kunjunganRj)} kunjungan rawat jalan ÷ ${formatNumber(rr.hariBuka)} hari buka (tanpa IGD)`,
      },
    ];
  }, [result]);

  async function unduh(format: "xlsx" | "pdf") {
    setExporting(format);
    setExportError(null);
    try {
      await downloadFromEndpoint(`/api/laporan/rl35/export?${new URLSearchParams({ from, to, format })}`, `RL-3.5.${format}`);
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
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <PemilihPeriode nilai={pilihan} onChange={setPilihan} hariIni={hariIni} idAwalan="rl35" />
          {tab === "jenis" && (
            <label className="flex items-center gap-2 pb-2 text-sm text-fg-muted">
              <Switch checked={semuaBaris} onChange={setSemuaBaris} label="Tampilkan semua jenis kegiatan" />
              Semua jenis kegiatan
            </label>
          )}
        </div>
        {berjalan && (
          <p className="mt-3 text-xs text-fg-subtle">Periode berjalan — kunjungan dan hari poliklinik buka dihitung sampai hari ini.</p>
        )}
      </Card>

      {/* Peringatan pemetaan */}
      {result && result.belumDipetakan.length > 0 && (
        <PeringatanPemetaan ruangan={result.belumDipetakan} bolehLihat={bolehLihatPeta} onAtur={() => setPetaBuka(true)} />
      )}

      {/* Ringkasan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          icon={Users}
          label="Total kunjungan"
          nilai={total?.total}
          hint={total ? `Laki-laki ${formatNumber(total.lk)} · perempuan ${formatNumber(total.pr)}` : ""}
          loading={loading}
        />
        <Tile
          icon={Stethoscope}
          label="Kunjungan poliklinik"
          nilai={result?.rataRata.kunjunganRj}
          hint={
            result?.rataRata.rataKunjunganPerHari != null
              ? `${desimal.format(result.rataRata.rataKunjunganPerHari)} per hari · ${formatNumber(result.rataRata.hariBuka)} hari buka`
              : ""
          }
          loading={loading}
        />
        <Tile icon={Ambulance} label="Kunjungan rawat darurat" nilai={igd} hint={total ? `${persen(igd, total.total)} dari seluruh kunjungan` : ""} loading={loading} />
        <TileDomisili result={result} loading={loading} />
      </div>

      {/* Tab */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <div role="tablist" aria-label="Pengelompokan" className="flex gap-1">
          <TabBtn aktif={tab === "jenis"} onClick={() => setTab("jenis")}>
            Per jenis kegiatan
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
          !adaData && !semuaBaris ? (
            <EmptyState title="Tidak ada kunjungan" description="Tidak ada kunjungan poliklinik atau IGD pada periode ini. Pilih periode lain." />
          ) : (
            <TabelRl35
              baris={barisJenis}
              kunci={(b) => String(b.id)}
              nilai={(b) => b.nilai}
              kepala="Jenis kegiatan"
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
              redup={(b) => b.nilai.total === 0}
              total={result.total}
              labelTotal="99. Total"
              ekor={ekor}
            />
          )
        ) : barisRuangan.length === 0 ? (
          <EmptyState title="Belum ada kunjungan" description="Tidak ada poliklinik atau ruang IGD yang beraktivitas pada periode ini." />
        ) : (
          <TabelRl35
            baris={barisRuangan}
            kunci={(x) => x.kunci}
            nilai={(x) => x.nilai}
            kepala="Ruangan"
            sel={({ r, pindah }) =>
              pindah ? (
                <p className="truncate pl-4 text-xs text-fg-muted">
                  <span aria-hidden>↳ </span>
                  ke {pindah.kategori.kode}. {pindah.kategori.deskripsi}
                  <span className="text-fg-subtle"> · {LABEL_ALASAN[pindah.alasan]}</span>
                </p>
              ) : (
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{r.nama}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-subtle">
                    <span className="font-mono">{r.id}</span>
                    <span>· {r.jenisKunjungan === JK_GAWAT_DARURAT ? "IGD" : "Poliklinik"}</span>
                    <BadgePeta r={r} />
                    {!r.aktif && <span>· nonaktif</span>}
                  </p>
                </div>
              )
            }
            redup={({ r, pindah }) => !pindah && !r.kategori}
            rincian={(x) => !!x.pindah}
            total={result.total}
            labelTotal="Total ruangan dilaporkan"
          />
        )}
      </Card>

      <p className="text-xs leading-relaxed text-fg-subtle">
        Sumber: SIMGOS (hanya dibaca), logika SP <span className="font-mono">LaporanRL35Revisi</span>. Kunjungan = pendaftaran
        per poliklinik atau ruang IGD yang masuk pada periode; semua ruang IGD dilaporkan sebagai Rawat Darurat. Kunjungan
        Kesehatan Anak, Obstetri &amp; Ginekologi, Bedah Saraf, dan Saraf yang episodenya berdiagnosis neonatal, kehamilan, atau
        stroke dipindah ke baris khususnya. Dalam/luar kab/kota menurut domisili pasien
        {result ? ` (Kab. ${result.kabupaten.nama})` : ""}
        {result && result.domisiliTakTercatat > 0
          ? `; ${formatNumber(result.domisiliTakTercatat)} kunjungan berdomisili tak tercatat dihitung luar`
          : ""}
        . Formulir SIRS 6 bulanan; triwulan dan rentang tanggal dihitung dengan rumus yang sama atas seluruh periode.
      </p>

      <PemetaanRl35Drawer open={petaBuka} onClose={() => setPetaBuka(false)} bolehUbah={bolehUbahPeta} onTersimpan={reload} />
    </div>
  );
}

/* ---------------------------------------------------------------- bagian */

function BadgePeta({ r }: { r: RuanganRl35 }) {
  if (r.status === "terpetakan" && r.kategori) {
    return (
      <Badge tone="brand" className="px-2 py-0 text-[11px]">
        {r.kategori.kode}. {r.kategori.deskripsi}
      </Badge>
    );
  }
  if (r.status === "bawaan" && r.kategori) {
    return (
      <span title="Belum ditetapkan admin — memakai saran dari nama ruangan">
        <Badge className="px-2 py-0 text-[11px]">
          {r.kategori.kode}. {r.kategori.deskripsi} · bawaan
        </Badge>
      </span>
    );
  }
  if (r.status === "dikecualikan") return <Badge className="px-2 py-0 text-[11px]">Tidak dilaporkan</Badge>;
  return (
    <Badge tone="warning" dot className="px-2 py-0 text-[11px]">
      Belum dipetakan
    </Badge>
  );
}

function PeringatanPemetaan({
  ruangan,
  bolehLihat,
  onAtur,
}: {
  ruangan: Rl35Result["belumDipetakan"];
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
        <p className="font-semibold text-fg">Ada ruangan yang belum dipetakan</p>
        <p className="mt-0.5 text-fg-muted">
          Kunjungan ruangan berikut tidak masuk laporan sampai ruangannya dipetakan ke jenis kegiatan atau ditandai tidak
          dilaporkan.
          {!bolehLihat && " Minta admin yang memegang izin Pemetaan Laporan RL untuk mengaturnya."}
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {ruangan.map((r) => (
            <li key={r.id} className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-fg ring-1 ring-warning/30">
              {r.nama}
              <span className="text-fg-subtle"> · {formatNumber(r.kunjungan)} kunjungan</span>
            </li>
          ))}
        </ul>
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
  icon: typeof Users;
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

/** Porsi kunjungan dalam vs luar kab/kota — meter dua segmen + angka (identitas tak hanya lewat warna). */
function TileDomisili({ result, loading }: { result: Rl35Result | null; loading: boolean }) {
  const t = result?.total;
  const d = t ? dalam(t) : 0;
  const l = t ? luar(t) : 0;
  const n = d + l;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">Dalam kab/kota</p>
        <span className="flex size-7 items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-fg-muted">
          <MapPin className="size-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular text-fg">
        {loading || !t ? <span className="text-fg-subtle">—</span> : persen(d, n)}
      </p>
      {!loading && t && n > 0 && (
        <>
          <div
            className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`Dalam kab/kota ${formatNumber(d)}, luar ${formatNumber(l)}`}
          >
            <span className="rounded-full bg-brand" style={{ width: `${(d / n) * 100}%` }} />
            <span className="flex-1 rounded-full bg-border-strong" />
          </div>
          <p className="mt-1 truncate text-[11px] text-fg-subtle" title={result ? `Kab. ${result.kabupaten.nama}` : undefined}>
            {formatNumber(d)} dalam · {formatNumber(l)} luar kabupaten
          </p>
        </>
      )}
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
