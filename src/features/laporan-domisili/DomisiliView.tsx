"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Clock, FileSpreadsheet, Home, MapPinned, RefreshCw, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { useAsyncData } from "@/lib/useAsyncData";
import { downloadFromEndpoint } from "@/lib/download";
import { formatJam, formatNumber, tanggalHariIniWita } from "@/lib/format";
import { judulPeriode } from "@/server/modules/rl32/rl32.periode";
import { KELAS_DOMISILI, LAYANAN, type KunciLayanan } from "@/server/modules/domisili/domisili.constants";
import type { BarisWilayah, DomisiliResult, KelasDomisili, NilaiLayanan } from "@/server/modules/domisili/domisili.types";
import { PemilihPeriode } from "@/features/laporan-rl32/PemilihPeriode";
import { pilihanAwal, rentangPilihan, type PilihanPeriode } from "@/features/laporan-rl32/periode";

type Ukuran = "kunjungan" | "pasien";
type Kolom = KunciLayanan | "semua";

const KOLOM: { key: Kolom; label: string }[] = [...LAYANAN.map((l) => ({ key: l.key, label: l.label })), { key: "semua", label: "Semua" }];
const KELAS: KelasDomisili[] = ["dalam", "luar", "tidakDiketahui"];

const persen = new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1 });
const porsi = (n: number, dari: number) => (dari > 0 ? persen.format(n / dari) : "—");

/**
 * Kolom pertama lengket saat tabel digulir ke samping (ponsel). Latar harus
 * pekat: kepala/total = paduan latar kepala tabel, isi = permukaan kartu.
 */
const LENGKET = "sticky left-0 z-10 shadow-[1px_0_0_var(--color-border)]";
const LENGKET_KEPALA = `${LENGKET} bg-[color-mix(in_srgb,var(--color-surface-2)_60%,var(--color-surface))]`;
const LENGKET_ISI = `${LENGKET} bg-surface`;
const LABEL_LEBAR = "min-w-40 sm:min-w-56";

/** Gaya segmen komposisi: satu rona, beda terang-gelap (terbaca tanpa warna). */
const SEGMEN: Record<KelasDomisili, string> = {
  dalam: "bg-brand",
  luar: "bg-brand/35",
  tidakDiketahui: "bg-border-strong",
};

export function DomisiliView() {
  const hariIni = useMemo(() => tanggalHariIniWita(), []);
  const [pilihan, setPilihan] = useState<PilihanPeriode>(() => pilihanAwal(hariIni));
  const [ukuran, setUkuran] = useState<Ukuran>("kunjungan");
  const [tab, setTab] = useState<"dalam" | "luar">("dalam");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { from, to } = rentangPilihan(pilihan);
  const { result, loading, error, reload } = useAsyncData<DomisiliResult>(
    () => apiGet<DomisiliResult>(`/api/laporan/domisili?${new URLSearchParams({ from, to })}`),
    [from, to],
  );

  const ambil = (n: NilaiLayanan, k: Kolom) => n[k][ukuran];
  const r = result?.ringkasan;
  const total = r ? ambil(r.total, "semua") : 0;
  const kosong = !!result && result.ringkasan.total.semua.kunjungan === 0;
  const kab = result ? `Kab. ${result.kabupaten.nama}` : "Kab. Bolaang Mongondow Timur";

  async function unduh() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadFromEndpoint(
        `/api/laporan/domisili/export?${new URLSearchParams({ from, to })}`,
        "Klasifikasi-Kunjungan-Domisili.xlsx",
      );
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Gagal mengekspor data.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Bilah status & aksi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Clock className="size-4" aria-hidden />
          {result ? <span className="tabular">Diperbarui pukul {formatJam(result.updatedAt)}</span> : <span>Memuat…</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={cn("size-4", loading && "animate-spin")} />}
            onClick={() => reload()}
          >
            Muat ulang
          </Button>
          <Button
            size="sm"
            icon={<FileSpreadsheet className="size-4" />}
            loading={exporting}
            disabled={loading || !!error || !result || exporting}
            onClick={unduh}
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

      {/* Periode & ukuran */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <PemilihPeriode nilai={pilihan} onChange={setPilihan} hariIni={hariIni} idAwalan="domisili" />
          <div>
            <Label>Hitung</Label>
            <Segmented
              label="Satuan hitung"
              options={[
                { key: "kunjungan", label: "Kunjungan" },
                { key: "pasien", label: "Pasien" },
              ]}
              value={ukuran}
              onChange={(v) => setUkuran(v as Ukuran)}
            />
          </div>
        </div>
        {to >= hariIni && (
          <p className="mt-3 text-xs text-fg-subtle">Periode berjalan — angka masih bertambah sampai periode berakhir.</p>
        )}
      </Card>

      {loading ? (
        <RingkasanSkeleton />
      ) : error || !result || !r ? (
        <Card className="p-0">
          <ErrorState onRetry={reload} />
        </Card>
      ) : kosong ? (
        <Card className="p-0">
          <EmptyState title="Tidak ada kunjungan" description="Tidak ada kunjungan IGD, rawat jalan, atau rawat inap pada periode ini. Pilih periode lain." />
        </Card>
      ) : (
        <>
          {/* Komposisi domisili */}
          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-fg">Komposisi domisili {ukuran === "kunjungan" ? "kunjungan" : "pasien"}</h2>
              <p className="text-xs text-fg-subtle">{judulPeriode(result.periode.from, result.periode.to)}</p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Angka
                icon={Home}
                label={`Dalam ${kab}`}
                nilai={ambil(r.dalam, "semua")}
                hint={`${porsi(ambil(r.dalam, "semua"), total)} dari total · ${formatNumber(result.kecamatan.filter((k) => k.kode && k.nilai.semua.kunjungan > 0).length)} kecamatan`}
                utama
              />
              <Angka
                icon={MapPinned}
                label={`Luar ${kab}`}
                nilai={ambil(r.luar, "semua")}
                hint={`${porsi(ambil(r.luar, "semua"), total)} dari total · ${formatNumber(result.luar.length)} kabupaten/kota`}
              />
              <Angka
                icon={Users}
                label={ukuran === "kunjungan" ? "Total kunjungan" : "Total pasien"}
                nilai={total}
                hint={
                  ambil(r.tidakDiketahui, "semua") > 0
                    ? `Termasuk ${formatNumber(ambil(r.tidakDiketahui, "semua"))} tanpa domisili tercatat`
                    : "Semua domisili tercatat"
                }
              />
            </div>
            <BilahKomposisi nilai={KELAS.map((k) => ({ kelas: k, n: ambil(r[k], "semua") }))} total={total} />
          </Card>

          {/* Per jenis layanan */}
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-fg">Per jenis layanan</h2>
              <p className="mt-0.5 text-xs text-fg-muted">
                Angka kecil = porsi dari total kolomnya.
                {ukuran === "pasien" && " Kolom Semua menghitung tiap pasien sekali walau berkunjung ke beberapa layanan."}
              </p>
            </div>
            <Table>
              <THead>
                <TH className={LENGKET_KEPALA}>Domisili</TH>
                {KOLOM.map((k) => (
                  <TH key={k.key} align="right" className={k.key === "semua" ? "text-fg" : undefined}>
                    {k.label}
                  </TH>
                ))}
              </THead>
              <TBody>
                {KELAS.filter((k) => k !== "tidakDiketahui" || r.tidakDiketahui.semua.kunjungan > 0).map((k) => (
                  <TR key={k}>
                    <TD className={cn(LENGKET_ISI, LABEL_LEBAR)}>
                      <span className="flex items-center gap-2">
                        <span aria-hidden className={cn("size-2.5 shrink-0 rounded-sm", SEGMEN[k])} />
                        {k === "tidakDiketahui" ? (
                          <span className="font-medium">{KELAS_DOMISILI.tidakDiketahui}</span>
                        ) : (
                          <span className="font-medium">
                            {k === "dalam" ? "Dalam" : "Luar"} <span className="sm:hidden">kabupaten</span>
                            <span className="hidden sm:inline">{kab}</span>
                          </span>
                        )}
                      </span>
                    </TD>
                    {KOLOM.map((c) => (
                      <TD key={c.key} align="right" className={cn("min-w-24", c.key === "semua" && "font-semibold")}>
                        {formatNumber(ambil(r[k], c.key))}
                        <span className="block text-[11px] font-normal text-fg-subtle">{porsi(ambil(r[k], c.key), ambil(r.total, c.key))}</span>
                      </TD>
                    ))}
                  </TR>
                ))}
                <TR className="bg-surface-2/60 font-semibold hover:bg-surface-2/60">
                  <TD className={LENGKET_KEPALA}>Total</TD>
                  {KOLOM.map((c) => (
                    <TD key={c.key} align="right">
                      {formatNumber(ambil(r.total, c.key))}
                    </TD>
                  ))}
                </TR>
              </TBody>
            </Table>
          </Card>

          {/* Rincian wilayah */}
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
            <div role="tablist" aria-label="Rincian wilayah" className="flex gap-1">
              <TabBtn aktif={tab === "dalam"} onClick={() => setTab("dalam")}>
                Dalam kabupaten<span className="hidden sm:inline"> · per kecamatan</span>
              </TabBtn>
              <TabBtn aktif={tab === "luar"} onClick={() => setTab("luar")}>
                Luar kabupaten<span className="hidden sm:inline"> · per kab/kota</span>
                <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-[11px] tabular text-fg-muted">{result.luar.length}</span>
              </TabBtn>
            </div>
          </div>

          <Card className="overflow-hidden p-0">
            {tab === "dalam" ? (
              <TabelWilayah baris={result.kecamatan} ukuran={ukuran} kepala="Kecamatan" total={r.dalam} />
            ) : result.luar.length === 0 ? (
              <EmptyState title="Tidak ada kunjungan dari luar kabupaten" description="Semua kunjungan pada periode ini berasal dari dalam kabupaten." />
            ) : (
              <TabelWilayah baris={result.luar} ukuran={ukuran} kepala="Kabupaten/Kota" total={r.luar} />
            )}
          </Card>
        </>
      )}

      <p className="text-xs leading-relaxed text-fg-subtle">
        Sumber: SIMGOS (hanya dibaca). Kunjungan = pendaftaran per jenis layanan menurut tanggal masuk (definisi yang sama dengan
        Laporan Pengunjung); pasien IGD yang lanjut rawat inap mendapat pendaftaran baru sehingga terhitung di IGD dan Rawat Inap.
        Pasien = No. RM unik. Domisili = alamat pasien saat ini di data master pasien SIMGOS, dipetakan ke wilayah Kemendagri
        (kabupaten = 4 digit pertama kode desa). Pendaftaran yang dibatalkan tidak dihitung.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- bagian */

function TabelWilayah({
  baris,
  ukuran,
  kepala,
  total,
}: {
  baris: BarisWilayah[];
  ukuran: Ukuran;
  kepala: string;
  total: NilaiLayanan;
}) {
  const semua = total.semua[ukuran];
  return (
    <Table>
      <THead>
        <TH className={LENGKET_KEPALA}>{kepala}</TH>
        {KOLOM.map((k) => (
          <TH key={k.key} align="right" className={k.key === "semua" ? "text-fg" : undefined}>
            {k.label}
          </TH>
        ))}
        <TH className="min-w-40">Porsi</TH>
      </THead>
      <TBody>
        {baris.map((b) => {
          const n = b.nilai.semua[ukuran];
          return (
            <TR key={b.kode || "tanpa"} className={cn(n === 0 && "text-fg-subtle")}>
              <TD className={cn(LENGKET_ISI, LABEL_LEBAR)}>
                <p className={cn("font-medium", n === 0 ? "text-fg-subtle" : "text-fg", !b.kode && "italic")}>{b.nama}</p>
                <p className="text-[11px] text-fg-subtle">
                  {b.kode && <span className="font-mono">{b.kode}</span>}
                  {b.provinsi && ` · ${b.provinsi}`}
                </p>
              </TD>
              {KOLOM.map((c) => (
                <TD key={c.key} align="right" className={cn("min-w-20", c.key === "semua" && "font-semibold", n === 0 && "text-fg-subtle")}>
                  {formatNumber(b.nilai[c.key][ukuran])}
                </TD>
              ))}
              <TD>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-chart-track" aria-hidden>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${semua > 0 ? (n / semua) * 100 : 0}%` }} />
                  </div>
                  <span className="w-12 text-right text-xs tabular text-fg-muted">{porsi(n, semua)}</span>
                </div>
              </TD>
            </TR>
          );
        })}
        <TR className="bg-surface-2/60 font-semibold hover:bg-surface-2/60">
          <TD className={LENGKET_KEPALA}>Total</TD>
          {KOLOM.map((c) => (
            <TD key={c.key} align="right">
              {formatNumber(total[c.key][ukuran])}
            </TD>
          ))}
          <TD />
        </TR>
      </TBody>
    </Table>
  );
}

function BilahKomposisi({ nilai, total }: { nilai: { kelas: KelasDomisili; n: number }[]; total: number }) {
  const ada = nilai.filter((x) => x.n > 0);
  if (total <= 0) return null;
  return (
    <div className="mt-5">
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={ada.map((x) => `${KELAS_DOMISILI[x.kelas]} ${porsi(x.n, total)}`).join(", ")}
      >
        {ada.map((x) => (
          <div key={x.kelas} className={cn("h-full first:rounded-l-full last:rounded-r-full", SEGMEN[x.kelas])} style={{ width: `${(x.n / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-muted">
        {ada.map((x) => (
          <li key={x.kelas} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2.5 rounded-sm", SEGMEN[x.kelas])} />
            {x.kelas === "dalam" ? "Dalam kabupaten" : x.kelas === "luar" ? "Luar kabupaten" : "Tidak tercatat"}
            <span className="tabular font-medium text-fg">{porsi(x.n, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Angka({
  icon: Icon,
  label,
  nilai,
  hint,
  utama,
}: {
  icon: typeof Home;
  label: string;
  nilai: number;
  hint: string;
  utama?: boolean;
}) {
  return (
    <div className={cn("rounded-[var(--radius-md)] border p-4", utama ? "border-brand/30 bg-brand-soft/60" : "border-border")}>
      <div className="flex items-center gap-2 text-xs font-medium text-fg-muted">
        <Icon className={cn("size-3.5", utama ? "text-brand" : "text-fg-subtle")} aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular text-fg">{formatNumber(nilai)}</p>
      <p className="mt-0.5 text-[11px] text-fg-subtle">{hint}</p>
    </div>
  );
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-border bg-surface-2 p-1"
    >
      {options.map((o) => {
        const aktif = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={aktif}
            onClick={() => onChange(o.key)}
            className={cn(
              "h-full rounded-[calc(var(--radius-md)-3px)] px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40",
              aktif ? "bg-surface text-fg shadow-sm ring-1 ring-border" : "text-fg-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
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

function RingkasanSkeleton() {
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <Skeleton className="h-4 w-48 rounded" />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[var(--radius-md)]" />
          ))}
        </div>
        <Skeleton className="mt-5 h-3 w-full rounded-full" />
      </Card>
      <Card className="p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="my-3 h-4 w-full rounded" />
        ))}
      </Card>
    </div>
  );
}
