"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Database,
  FileSpreadsheet,
  OctagonAlert,
  RefreshCw,
  RotateCcw,
  Search,
  Stethoscope,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { Input, InputWithIcon, Label } from "@/components/ui/Field";
import { NumberedPagination } from "@/components/ui/NumberedPagination";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { formatDate, formatNumber, tanggalHariIniWita } from "@/lib/format";
import { cn } from "@/lib/cn";
import { tambahHari } from "@/server/modules/surat-kontrol/surat-kontrol.filter";
import {
  namaRuangan,
  ringkasPulang,
  ringkasPulangPerHari,
  ringkasPulangPerRuangan,
  saringPulang,
  urutkanPulang,
  type FilterPulang,
  type RingkasPulang,
} from "@/server/modules/surat-kontrol/surat-kontrol.pulang";
import {
  LAYANAN_PULANG,
  LAYANAN_PULANG_KEYS,
  RENTANG_PULANG_MAKS_HARI,
  STATUS_DINILAI,
  STATUS_PULANG,
  type LayananPulang,
  type StatusPulang,
} from "@/server/modules/surat-kontrol/surat-kontrol.pulang.constants";
import type { AuditTerbitPulang, EpisodePulang } from "@/server/modules/surat-kontrol/surat-kontrol.pulang.types";
import { SebaranHarianChart } from "./SebaranHarianChart";
import { fetchTerbitPulang, unduhEksporTerbitPulang } from "./suratKontrol.client";
import { TerbitPulangDetail } from "./TerbitPulangDetail";
import { JejakTerbit, LencanaStatus, SERI_PULANG, persenId, teksSelisih, warnaStatus } from "./pulang.ui";

const PAGE_SIZE = 25;
type Urut = "prioritas" | "terbaru" | "selisih";

const awalBulan = (iso: string) => `${iso.slice(0, 8)}01`;
const akhirBulan = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).toISOString().slice(0, 10);

const PRESET = [
  { key: "hari-ini", label: "Hari ini", rentang: (t: string) => [t, t] },
  { key: "kemarin", label: "Kemarin", rentang: (t: string) => [tambahHari(t, -1), tambahHari(t, -1)] },
  { key: "7-hari", label: "7 hari terakhir", rentang: (t: string) => [tambahHari(t, -6), t] },
  { key: "bulan-ini", label: "Bulan ini", rentang: (t: string) => [awalBulan(t), t] },
  { key: "bulan-lalu", label: "Bulan lalu", rentang: (t: string) => { const a = awalBulan(tambahHari(awalBulan(t), -1)); return [a, akhirBulan(a)]; } },
] as const;

const URUT_OPSI: SelectOption[] = [
  { value: "prioritas", label: "Prioritas (belum terbit dulu)" },
  { value: "terbaru", label: "Tanggal pulang terbaru" },
  { value: "selisih", label: "Selisih hari terbesar" },
];

const LAYANAN_IKON: Record<LayananPulang, typeof BedDouble> = { RI: BedDouble, RJ: Stethoscope };

/** Label kolom saat tabel bertumpuk jadi kartu (container query < 48rem). */
const LABEL_TUMPUK =
  "@max-3xl:before:mb-0.5 @max-3xl:before:block @max-3xl:before:text-[11px] @max-3xl:before:font-medium @max-3xl:before:text-fg-subtle @max-3xl:before:content-[attr(data-label)]";

/** Jaga [from, to] sah setelah satu ujung diubah: from ≤ to ≤ hari ini, lebar ≤ 31 hari. */
function jepit(from: string, to: string, diubah: "from" | "to", hariIni: string): [string, string] {
  const lebar = RENTANG_PULANG_MAKS_HARI - 1;
  let f = from > hariIni ? hariIni : from;
  let t = to > hariIni ? hariIni : to;
  if (diubah === "from") {
    if (t < f) t = f;
    if (t > tambahHari(f, lebar)) t = tambahHari(f, lebar);
  } else {
    if (f > t) f = t;
    if (f < tambahHari(t, -lebar)) f = tambahHari(t, -lebar);
  }
  return [f, t];
}

/**
 * Audit "Terbit saat pulang": Surat Kontrol pasien BPJS harus terbit di BPJS
 * pada tanggal yang sama dengan tanggal pulang (RI) / kunjungan (RJ). Data satu
 * rentang diambil sekali; saringan, cari, urut & paginasi di klien (instan).
 */
export function TerbitPulangView({ bolehEkspor, onBelumTerbit }: { bolehEkspor: boolean; onBelumTerbit?: (n: number | null) => void }) {
  const hariIni = tanggalHariIniWita();
  const [from, setFrom] = useState(() => awalBulan(hariIni));
  const [to, setTo] = useState(hariIni);
  const [layanan, setLayanan] = useState<LayananPulang | "">("");
  const [status, setStatus] = useState<StatusPulang | "">("");
  const [ruangan, setRuangan] = useState("");
  const [tanggal, setTanggal] = useState<string | null>(null);
  const [qInput, setQInput] = useState("");
  const q = useDebounce(qInput.trim(), 250);
  const [urut, setUrut] = useState<Urut>("prioritas");
  const [page, setPage] = useState(1);
  const [pilihKey, setPilihKey] = useState<string | null>(null);
  const [terbuka, setTerbuka] = useState(false);
  const [semuaRuangan, setSemuaRuangan] = useState(false);
  const [mengekspor, setMengekspor] = useState(false);
  const [pesanEkspor, setPesanEkspor] = useState<{ ok: boolean; teks: string } | null>(null);
  const daftarRef = useRef<HTMLElement>(null);
  const segarRef = useRef(false);

  const data = useAsyncData<AuditTerbitPulang>(() => {
    const segar = segarRef.current;
    segarRef.current = false;
    return fetchTerbitPulang({ from, to }, { segar });
  }, [from, to]);
  const d = data.result;
  const semua = useMemo(() => d?.episode ?? [], [d]);

  // Jumlah belum terbit (seluruh rentang) untuk lencana tab.
  const belumSemua = d ? semua.filter((e) => e.status === "BELUM_TERBIT").length : null;
  useEffect(() => {
    onBelumTerbit?.(belumSemua);
  }, [belumSemua, onBelumTerbit]);

  const ubah = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => {
    fn(...a);
    setPage(1);
  };
  const ubahRentang = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
    setTanggal(null);
    setPilihKey(null);
    setPage(1);
  };

  const cari = q || undefined;
  const perKey = useMemo(() => new Map(semua.map((e) => [e.key, e])), [semua]);
  // Dasar ringkasan = semua saringan KECUALI status (status dipilih dari ringkasan ini).
  const dasar = useMemo(() => saringPulang(semua, { layanan: layanan || undefined, ruangan: ruangan || undefined, tanggal: tanggal ?? undefined, q: cari }), [semua, layanan, ruangan, tanggal, cari]);
  const r = useMemo(() => ringkasPulang(dasar, hariIni), [dasar, hariIni]);
  const perLayanan = useMemo(
    () =>
      Object.fromEntries(
        LAYANAN_PULANG_KEYS.map((l) => [l, ringkasPulang(saringPulang(semua, { layanan: l, ruangan: ruangan || undefined, tanggal: tanggal ?? undefined, q: cari }), hariIni)]),
      ) as Record<LayananPulang, RingkasPulang>,
    [semua, ruangan, tanggal, cari, hariIni],
  );
  const tampil = useMemo(() => {
    const x = saringPulang(dasar, { status: status || undefined });
    if (urut === "terbaru") return x.sort((a, b) => b.tglPulang.localeCompare(a.tglPulang) || (b.jamPulang ?? "").localeCompare(a.jamPulang ?? "") || a.key.localeCompare(b.key));
    if (urut === "selisih") {
      const besar = (e: EpisodePulang) => (e.status === "BELUM_TERBIT" ? e.hariSejakPulang : Math.abs(e.selisihHari ?? -1));
      return x.sort((a, b) => besar(b) - besar(a) || a.key.localeCompare(b.key));
    }
    return urutkanPulang(x);
  }, [dasar, status, urut]);
  const harian = useMemo(
    () => (d ? ringkasPulangPerHari(saringPulang(semua, { layanan: layanan || undefined, ruangan: ruangan || undefined, q: cari, status: status || undefined }), d.rentang.from, d.rentang.to) : []),
    [d, semua, layanan, ruangan, cari, status],
  );
  const perRuangan = useMemo(() => ringkasPulangPerRuangan(saringPulang(semua, { layanan: layanan || undefined, tanggal: tanggal ?? undefined, q: cari })), [semua, layanan, tanggal, cari]);
  const ruanganOpsi = useMemo<SelectOption[]>(
    () => [{ value: "", label: "Semua ruangan / poli" }, ...[...new Set(semua.map(namaRuangan))].sort().map((n) => ({ value: n, label: n }))],
    [semua],
  );
  const belumTerlama = useMemo(() => dasar.reduce((m, e) => (e.status === "BELUM_TERBIT" ? Math.max(m, e.hariSejakPulang) : m), 0), [dasar]);

  const totalPages = Math.max(1, Math.ceil(tampil.length / PAGE_SIZE));
  const halaman = Math.min(page, totalPages);
  const isiHalaman = tampil.slice((halaman - 1) * PAGE_SIZE, halaman * PAGE_SIZE);
  const pilih = pilihKey ? (perKey.get(pilihKey) ?? null) : null;
  const posisi = pilihKey ? tampil.findIndex((e) => e.key === pilihKey) : -1;
  const filter: FilterPulang = { layanan: layanan || undefined, status: status || undefined, ruangan: ruangan || undefined, tanggal: tanggal ?? undefined, q: cari };
  const adaSaringan = !!(layanan || status || ruangan || tanggal || qInput);
  const presetAktif = PRESET.find((p) => { const [a, b] = p.rentang(hariIni); return a === from && b === to; })?.key;

  function pilihBaris(key: string) {
    setPilihKey(key);
    setTerbuka(true);
    const i = tampil.findIndex((e) => e.key === key);
    if (i >= 0) setPage(Math.floor(i / PAGE_SIZE) + 1);
  }

  function pindah(delta: number) {
    const aktif = document.activeElement?.id?.startsWith("tp-") ? document.activeElement.id.slice(3) : pilihKey;
    const i = isiHalaman.findIndex((x) => x.key === aktif);
    const next = isiHalaman[i < 0 ? 0 : i + delta];
    if (next) {
      setPilihKey(next.key);
      document.getElementById(`tp-${next.key}`)?.focus();
    }
  }

  function tampilkanStatus(s: StatusPulang | "") {
    setStatus(s);
    setPage(1);
  }

  function lihatBelumTerbit() {
    tampilkanStatus("BELUM_TERBIT");
    setUrut("prioritas");
    daftarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function reset() {
    setLayanan("");
    setStatus("");
    setRuangan("");
    setTanggal(null);
    setQInput("");
    setUrut("prioritas");
    setPage(1);
  }

  async function ekspor() {
    setMengekspor(true);
    setPesanEkspor(null);
    try {
      const kode = await unduhEksporTerbitPulang({ from, to }, filter);
      setPesanEkspor({ ok: true, teks: `Berkas Excel diunduh${kode ? ` · kode ${kode}` : ""}.` });
    } catch (e) {
      setPesanEkspor({ ok: false, teks: e instanceof Error ? e.message : "Gagal mengekspor." });
    } finally {
      setMengekspor(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Saringan rentang & cari */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[auto_300px_minmax(0,1fr)]">
          <div className="min-w-0 md:col-span-2 xl:col-span-1">
            <span id="tp-preset-label" className="mb-1.5 block text-sm font-medium text-fg">Tanggal pulang</span>
            <div role="group" aria-labelledby="tp-preset-label" className="flex max-w-full flex-wrap gap-1 rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
              {PRESET.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={presetAktif === p.key}
                  onClick={() => { const [a, b] = p.rentang(hariIni); ubahRentang(a, b); }}
                  className={cn(
                    "min-h-8 shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    presetAktif === p.key ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="tp-from">Dari</Label>
              <Input id="tp-from" type="date" value={from} max={hariIni} onChange={(e) => e.target.value && ubahRentang(...jepit(e.target.value, to, "from", hariIni))} />
            </div>
            <div>
              <Label htmlFor="tp-to">Sampai</Label>
              <Input id="tp-to" type="date" value={to} min={from} max={hariIni} onChange={(e) => e.target.value && ubahRentang(...jepit(from, e.target.value, "to", hariIni))} />
            </div>
          </div>
          <div className="min-w-0">
            <Label htmlFor="tp-q">Cari pasien</Label>
            <InputWithIcon
              id="tp-q"
              type="search"
              icon={<Search className="size-4" />}
              placeholder="Nama, RM, NOPEN, SEP, no. surat…"
              aria-describedby="tp-q-bantuan"
              value={qInput}
              maxLength={80}
              onChange={ubah((e: React.ChangeEvent<HTMLInputElement>) => setQInput(e.target.value))}
            />
            <span id="tp-q-bantuan" className="sr-only">Cari nama pasien, nomor RM, NOPEN, SEP, nomor surat kontrol, dokter, atau ruangan</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <SumberTerbit d={d} loading={data.loading} onSegar={() => { segarRef.current = true; data.reload(); }} />
          <div className="flex flex-wrap items-center gap-2">
            {adaSaringan && (
              <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={reset}>
                Atur ulang saringan
              </Button>
            )}
            {bolehEkspor && (
              <Button variant="secondary" size="sm" icon={<FileSpreadsheet className="size-4" />} loading={mengekspor} disabled={!d || tampil.length === 0 || mengekspor} onClick={ekspor}>
                Ekspor Excel
              </Button>
            )}
          </div>
        </div>
        {pesanEkspor && <p role="status" className={cn("mt-2 text-xs", pesanEkspor.ok ? "text-success" : "text-danger")}>{pesanEkspor.teks}</p>}
      </Card>

      {d?.galatBpjs && (
        <div role="alert" className="flex gap-3 rounded-[var(--radius-lg)] border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-fg">
          <WifiOff className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-semibold">Webservice BPJS tidak tersedia — tanggal terbit diambil dari cache SIMGOS</p>
            <p className="text-xs text-fg-muted">{d.galatBpjs} Surat yang tanggal terbitnya belum tersimpan ditandai &ldquo;Tanggal terbit belum terbaca&rdquo;. Coba segarkan beberapa saat lagi.</p>
          </div>
        </div>
      )}

      {data.loading && !d ? (
        <Memuat />
      ) : data.error && !d ? (
        <Card><ErrorState description="Gagal memuat data pasien pulang. Periksa koneksi ke SIMGOS lalu coba lagi." onRetry={data.reload} /></Card>
      ) : d ? (
        <div className={cn("space-y-4 transition-opacity", data.loading && "pointer-events-none opacity-60")} aria-busy={data.loading}>
          {/* Ringkasan kepatuhan + sorotan belum terbit */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
            <Kepatuhan
              r={r}
              perLayanan={perLayanan}
              rentang={d.rentang}
              status={status}
              layanan={layanan}
              onStatus={(s) => tampilkanStatus(status === s ? "" : s)}
              onLayanan={(l) => { setLayanan(layanan === l ? "" : l); setPage(1); }}
            />
            <SorotanBelum jumlah={r.perStatus.BELUM_TERBIT} hariIni={r.belumHariIni} terlama={belumTerlama} wajib={r.dinilai} onLihat={lihatBelumTerbit} />
          </div>

          {/* Sebaran harian & per ruangan */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="min-w-0 p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-fg">Sebaran per tanggal pulang</h2>
                <span className="text-[11px] text-fg-subtle">pasien yang dinilai · titik = hari ini</span>
              </div>
              <SebaranHarianChart
                data={harian}
                seri={SERI_PULANG}
                hariIni={d.hariIni}
                aktif={tanggal}
                satuan="pasien"
                judul="Sebaran pasien BPJS pulang per tanggal menurut waktu terbit Surat Kontrol"
                onPilih={(t) => { setTanggal(t); setPage(1); }}
              />
            </Card>
            <PerRuangan
              data={perRuangan}
              aktif={ruangan}
              semua={semuaRuangan}
              onSemua={() => setSemuaRuangan((v) => !v)}
              onPilih={(n) => { setRuangan(ruangan === n ? "" : n); setPage(1); }}
            />
          </div>

          {/* Daftar pasien */}
          <Card className="min-w-0 overflow-hidden">
            <section ref={daftarRef} aria-labelledby="tp-daftar-judul" className="scroll-mt-20">
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
                <div className="mr-auto min-w-0">
                  <h2 id="tp-daftar-judul" className="text-sm font-semibold text-fg">
                    Pasien BPJS pulang
                    <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-fg-muted tabular">{formatNumber(tampil.length)}</span>
                  </h2>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {status ? <>Menampilkan <b className="font-semibold text-fg">{STATUS_PULANG[status].label.toLowerCase()}</b> · </> : null}
                    {tanggal ? <>tanggal {formatDate(tanggal)} · </> : null}
                    Klik baris untuk melihat jejak pulang → terbit → rencana kontrol.
                  </p>
                </div>
                <SegmentedControl<LayananPulang | "">
                  label="Layanan"
                  value={layanan}
                  onChange={(v) => { setLayanan(v); setPage(1); }}
                  items={[
                    { value: "", label: "Semua", jumlah: perLayanan.RI.total + perLayanan.RJ.total },
                    { value: "RI", label: "Rawat Inap", labelSingkat: "RI", jumlah: perLayanan.RI.total },
                    { value: "RJ", label: "Rawat Jalan", labelSingkat: "RJ", jumlah: perLayanan.RJ.total },
                  ]}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/40 px-4 py-2">
                <Label htmlFor="tp-status" className="sr-only">Status</Label>
                <Select
                  id="tp-status"
                  className="w-full sm:w-56"
                  value={status}
                  onChange={(v) => tampilkanStatus(v as StatusPulang | "")}
                  options={[{ value: "", label: "Semua status" }, ...(Object.keys(STATUS_PULANG) as StatusPulang[]).map((k) => ({ value: k, label: `${STATUS_PULANG[k].label} (${formatNumber(r.perStatus[k])})` }))]}
                />
                <Label htmlFor="tp-ruangan" className="sr-only">Ruangan atau poli</Label>
                <Select id="tp-ruangan" className="w-full sm:w-56" value={ruangan} onChange={ubah(setRuangan)} options={ruanganOpsi} />
                <Label htmlFor="tp-urut" className="sr-only">Urutkan</Label>
                <Select id="tp-urut" className="w-full sm:ml-auto sm:w-60" value={urut} onChange={ubah((v: string) => setUrut(v as Urut))} options={URUT_OPSI} />
              </div>

              {tampil.length === 0 ? (
                <EmptyState
                  title={semua.length === 0 ? "Tidak ada pasien BPJS pulang pada rentang ini" : "Tidak ada pasien yang cocok"}
                  description={semua.length === 0 ? "Pilih rentang tanggal pulang lain." : "Ubah atau atur ulang saringan untuk melihat pasien lain."}
                  action={adaSaringan ? <Button variant="secondary" size="sm" onClick={reset}>Atur ulang saringan</Button> : undefined}
                />
              ) : (
                <>
                  <div className="@container">
                    <div role="region" aria-labelledby="tp-daftar-judul" tabIndex={0} className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring @max-3xl:overflow-visible">
                      <table className="w-full border-separate border-spacing-0 text-sm @max-3xl:block @max-3xl:space-y-2 @max-3xl:p-3">
                        <caption className="sr-only">Pasien BPJS pulang dan waktu terbit Surat Kontrol terhadap tanggal pulang</caption>
                        <thead className="bg-surface-2/60 text-left text-[11px] font-semibold tracking-wide text-fg-muted uppercase @max-3xl:hidden">
                          <tr>
                            <th scope="col" className="border-b border-border py-2 pr-2 pl-5">Pasien</th>
                            <th scope="col" className="border-b border-border px-2 py-2">Pulang</th>
                            <th scope="col" className="border-b border-border px-2 py-2">Surat Kontrol</th>
                            <th scope="col" className="border-b border-border px-2 py-2">Terbit vs pulang</th>
                            <th scope="col" className="border-b border-border py-2 pr-4 pl-2">Status</th>
                          </tr>
                        </thead>
                        <tbody
                          className="@max-3xl:block @max-3xl:space-y-2"
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                              e.preventDefault();
                              pindah(e.key === "ArrowDown" ? 1 : -1);
                            }
                          }}
                        >
                          {isiHalaman.map((e) => (
                            <BarisPulang key={e.key} e={e} aktif={pilihKey === e.key} hariIni={d.hariIni} onPilih={() => pilihBaris(e.key)} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
                    <p className="text-xs text-fg-muted">
                      <b className="tabular text-fg">{formatNumber((halaman - 1) * PAGE_SIZE + 1)}–{formatNumber((halaman - 1) * PAGE_SIZE + isiHalaman.length)}</b> dari{" "}
                      <b className="tabular text-fg">{formatNumber(tampil.length)}</b>
                      <span className="hidden sm:inline"> · ↑/↓ berpindah baris, Enter membuka rincian</span>
                    </p>
                    <NumberedPagination
                      page={halaman}
                      totalPages={totalPages}
                      onPageChange={(p) => {
                        setPage(p);
                        daftarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    />
                  </div>
                </>
              )}
            </section>
          </Card>
        </div>
      ) : null}

      <Drawer
        open={terbuka && !!pilih}
        onClose={() => setTerbuka(false)}
        title="Rincian terbit Surat Kontrol"
        size="md"
        header={
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <p className="truncate text-sm font-semibold text-fg" aria-hidden>Rincian terbit Surat Kontrol</p>
            {posisi >= 0 && (
              <span className="ml-auto flex shrink-0 items-center gap-1">
                <span className="mr-1 text-[11px] text-fg-muted tabular">{formatNumber(posisi + 1)} / {formatNumber(tampil.length)}</span>
                <Button variant="ghost" size="sm" className="px-2" aria-label="Pasien sebelumnya" disabled={posisi <= 0} onClick={() => pilihBaris(tampil[posisi - 1].key)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" className="px-2" aria-label="Pasien berikutnya" disabled={posisi >= tampil.length - 1} onClick={() => pilihBaris(tampil[posisi + 1].key)}>
                  <ChevronRight className="size-4" />
                </Button>
              </span>
            )}
          </div>
        }
      >
        <div className="p-5">{pilih && d && <TerbitPulangDetail e={pilih} hariIni={d.hariIni} />}</div>
      </Drawer>
    </div>
  );
}

function SumberTerbit({ d, loading, onSegar }: { d: AuditTerbitPulang | null; loading: boolean; onSegar: () => void }) {
  if (!d) return <p className="text-xs text-fg-muted">{loading ? "Menyusun data pasien pulang…" : "—"}</p>;
  const live = d.bpjsDipanggil && !d.galatBpjs;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
      <span
        className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium", live ? "bg-success-soft text-success" : "bg-surface-2 text-fg-muted")}
        title="Tanggal terbit dibaca dari BPJS (webservice) atau cache SIMGOS bpjs.monitoring_rencana_kontrol"
      >
        {live ? <Wifi className="size-3.5" aria-hidden /> : <Database className="size-3.5" aria-hidden />}
        {live ? "BPJS live + cache" : "Cache BPJS di SIMGOS"}
      </span>
      <span>disusun {d.disusun.slice(11, 16).replace(":", ".")} WITA</span>
      <span aria-hidden>·</span>
      <CalendarRange className="size-3.5" aria-hidden />
      <span>{formatDate(d.rentang.from)} – {formatDate(d.rentang.to)}</span>
      {d.asal.belum > 0 && <span className="text-warning">· {formatNumber(d.asal.belum)} surat belum terbaca tanggalnya</span>}
      <button
        type="button"
        onClick={onSegar}
        disabled={loading}
        className="inline-flex min-h-8 items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5 font-medium text-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-50"
      >
        <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden /> Segarkan dari BPJS
      </button>
    </div>
  );
}

/** Angka utama kepatuhan + batang komposisi (segmen & legenda = saringan) + perbandingan RI/RJ. */
function Kepatuhan({
  r,
  perLayanan,
  rentang,
  status,
  layanan,
  onStatus,
  onLayanan,
}: {
  r: RingkasPulang;
  perLayanan: Record<LayananPulang, RingkasPulang>;
  rentang: { from: string; to: string };
  status: StatusPulang | "";
  layanan: LayananPulang | "";
  onStatus: (s: StatusPulang) => void;
  onLayanan: (l: LayananPulang) => void;
}) {
  const tidakDinilai = r.perStatus.TIDAK_WAJIB + r.perStatus.TAK_TERVERIFIKASI;
  const pascaRi = r.pascaRiTidakWajib;
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <section aria-labelledby="tp-kepatuhan-judul">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h2 id="tp-kepatuhan-judul" className="text-sm font-semibold text-fg">Surat Kontrol terbit di hari pulang</h2>
            <p className="text-xs text-fg-muted">
              Pasien BPJS rawat inap &amp; rawat jalan · {formatDate(rentang.from)} – {formatDate(rentang.to)}
            </p>
          </div>
        </div>
        <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-4xl font-semibold tracking-tight text-fg tabular sm:text-5xl">{persenId(r.kepatuhan)}</span>
          <span className="text-sm text-fg-muted">
            <b className="font-semibold text-fg tabular">{formatNumber(r.perStatus.TEPAT)}</b> dari <b className="font-semibold text-fg tabular">{formatNumber(r.dinilai)}</b> pasien dinilai
          </span>
        </p>

        <BatangKomposisi perStatus={r.perStatus} dinilai={r.dinilai} aktif={status} className="mt-3 h-3" />
        <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4" aria-label="Saring menurut status">
          {STATUS_DINILAI.map((k) => {
            const w = warnaStatus(k);
            const n = r.perStatus[k];
            return (
              <li key={k}>
                <button
                  type="button"
                  aria-pressed={status === k}
                  title={STATUS_PULANG[k].jelas}
                  onClick={() => onStatus(k)}
                  className={cn(
                    "flex min-h-11 w-full items-start gap-2 rounded-[var(--radius-md)] border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    status === k ? "border-brand bg-brand-soft/60" : "border-border hover:border-border-strong hover:bg-surface-2/50",
                    k === "BELUM_TERBIT" && n > 0 && status !== k && "border-danger/30",
                  )}
                >
                  <span className={cn("mt-1 size-2.5 shrink-0 rounded-[3px]", w.isi)} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[11px] leading-tight font-medium text-fg-muted">{STATUS_PULANG[k].label}</span>
                    <span className="block text-base font-semibold text-fg tabular">
                      {formatNumber(n)}
                      <span className="ml-1 text-[11px] font-medium text-fg-subtle">{r.dinilai ? persenId(Math.round((n / r.dinilai) * 1000) / 10) : ""}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 border-t border-border pt-3">
          <ul className="space-y-1" aria-label="Kepatuhan per layanan (klik untuk menyaring)">
            {LAYANAN_PULANG_KEYS.map((l) => {
              const x = perLayanan[l];
              const Ikon = LAYANAN_IKON[l];
              return (
                <li key={l}>
                  <button
                    type="button"
                    aria-pressed={layanan === l}
                    onClick={() => onLayanan(l)}
                    className={cn(
                      "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring sm:grid-cols-[150px_minmax(0,1fr)_auto]",
                      layanan === l ? "bg-brand-soft" : "hover:bg-surface-2/60",
                    )}
                  >
                    <span className="flex items-center gap-2 text-xs font-medium text-fg">
                      <Ikon className="size-4 text-fg-muted" aria-hidden />
                      {LAYANAN_PULANG[l].label}
                    </span>
                    <BatangKomposisi perStatus={x.perStatus} dinilai={x.dinilai} aktif={status} className="h-2" />
                    <span className="text-right text-xs whitespace-nowrap text-fg-muted tabular">
                      <b className="font-semibold text-fg">{persenId(x.kepatuhan)}</b>
                      <span className="hidden sm:inline"> · {formatNumber(x.perStatus.TEPAT)}/{formatNumber(x.dinilai)}</span>
                      {x.perStatus.BELUM_TERBIT > 0 && <span className="ml-1.5 font-semibold text-danger">{formatNumber(x.perStatus.BELUM_TERBIT)} belum</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {tidakDinilai > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-subtle">
              <span>Tidak masuk perhitungan:</span>
              {(["TIDAK_WAJIB", "TAK_TERVERIFIKASI"] as const).map((k) =>
                r.perStatus[k] > 0 ? (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={status === k}
                    title={STATUS_PULANG[k].jelas}
                    onClick={() => onStatus(k)}
                    className={cn("rounded-sm font-medium underline-offset-2 hover:text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring", status === k ? "text-brand underline" : "text-fg-muted")}
                  >
                    {formatNumber(r.perStatus[k])} {STATUS_PULANG[k].label.toLowerCase()}
                    {k === "TIDAK_WAJIB" && pascaRi > 0 && ` (${formatNumber(pascaRi)} kontrol pasca rawat inap)`}
                  </button>
                ) : null,
              )}
            </p>
          )}
        </div>
      </section>
    </Card>
  );
}

/** Batang 100% bertumpuk: tepat → lebih awal → terlambat → belum terbit (celah 2px antarsegmen). */
function BatangKomposisi({ perStatus, dinilai, aktif, className }: { perStatus: Record<StatusPulang, number>; dinilai: number; aktif: StatusPulang | ""; className?: string }) {
  return (
    <span className={cn("flex w-full gap-0.5 overflow-hidden rounded-full bg-chart-track", className)} aria-hidden>
      {dinilai > 0 &&
        STATUS_DINILAI.map((k) =>
          perStatus[k] > 0 ? (
            <span
              key={k}
              className={cn("h-full transition-opacity first:rounded-l-full last:rounded-r-full", warnaStatus(k).isi, aktif && aktif !== k && "opacity-30")}
              style={{ width: `${(perStatus[k] / dinilai) * 100}%` }}
            />
          ) : null,
        )}
    </span>
  );
}

function SorotanBelum({ jumlah, hariIni, terlama, wajib, onLihat }: { jumlah: number; hariIni: number; terlama: number; wajib: number; onLihat: () => void }) {
  if (wajib === 0) {
    return (
      <Card className="flex flex-col justify-center gap-2 p-5 text-sm text-fg-muted">
        <p className="font-semibold text-fg">Belum ada pasien wajib kontrol</p>
        <p className="text-xs">Tidak ada pasien BPJS pulang yang memerlukan Surat Kontrol pada rentang &amp; saringan ini.</p>
      </Card>
    );
  }
  if (jumlah === 0) {
    return (
      <Card className="flex flex-col justify-center gap-2 border-success/30 bg-success-soft/50 p-5">
        <CircleCheckBig className="size-7 text-success" aria-hidden />
        <p className="text-base font-semibold text-fg">Semua sudah terbit</p>
        <p className="text-xs text-fg-muted">Setiap pasien BPJS yang wajib kontrol pada rentang ini sudah punya Surat Kontrol di BPJS.</p>
      </Card>
    );
  }
  return (
    <section aria-labelledby="tp-belum-judul" className="flex flex-col rounded-[var(--radius-lg)] border border-danger/30 bg-danger-soft/60 p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger text-white">
          <OctagonAlert className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="tp-belum-judul" className="text-sm font-semibold text-fg">Belum terbit Surat Kontrol</h2>
          <p className="mt-0.5 text-4xl font-semibold tracking-tight text-danger tabular">{formatNumber(jumlah)}</p>
          <p className="text-xs text-fg-muted">pasien BPJS sudah pulang tanpa Surat Kontrol aktif di BPJS</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-fg">
        {hariIni > 0 && (
          <li className="rounded-[var(--radius-sm)] bg-surface/70 px-2 py-1">
            <b className="font-semibold">{formatNumber(hariIni)}</b> pulang hari ini — masih bisa diterbitkan tepat waktu
          </li>
        )}
        {terlama > 0 && (
          <li className="px-2">
            Paling lama <b className="font-semibold">{formatNumber(terlama)} hari</b> sejak pulang
          </li>
        )}
      </ul>
      <Button variant="danger" size="sm" className="mt-4 self-start" onClick={onLihat}>
        Tampilkan pasien belum terbit
      </Button>
    </section>
  );
}

function PerRuangan({
  data,
  aktif,
  semua,
  onSemua,
  onPilih,
}: {
  data: ReturnType<typeof ringkasPulangPerRuangan>;
  aktif: string;
  semua: boolean;
  onSemua: () => void;
  onPilih: (nama: string) => void;
}) {
  const BATAS = 7;
  const isi = semua ? data : data.slice(0, BATAS);
  return (
    <Card className="p-4">
      <section aria-labelledby="tp-ruangan-judul">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 id="tp-ruangan-judul" className="text-sm font-semibold text-fg">Per ruangan / poli</h2>
          {aktif && (
            <button type="button" className="rounded-sm text-[11px] font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring" onClick={() => onPilih(aktif)}>
              Lepas saringan
            </button>
          )}
        </div>
        {data.length === 0 ? (
          <p className="py-6 text-center text-xs text-fg-subtle">Tidak ada data.</p>
        ) : (
          <ul className="space-y-0.5">
            {isi.map((x) => (
              <li key={`${x.layanan}|${x.ruangan}`}>
                <button
                  type="button"
                  aria-pressed={aktif === x.ruangan}
                  onClick={() => onPilih(x.ruangan)}
                  className={cn(
                    "w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    aktif === x.ruangan ? "bg-brand-soft" : "hover:bg-surface-2/60",
                  )}
                >
                  <span className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 rounded bg-surface-2 px-1 text-[10px] font-semibold text-fg-muted">{LAYANAN_PULANG[x.layanan].pendek}</span>
                      <span className="truncate font-medium text-fg">{x.ruangan}</span>
                    </span>
                    <span className="shrink-0 text-fg-muted tabular">
                      {x.belum > 0 && <b className="mr-1.5 font-semibold text-danger">{formatNumber(x.belum)} belum</b>}
                      {formatNumber(x.tepat)}/{formatNumber(x.dinilai)}
                    </span>
                  </span>
                  <span className="flex h-1.5 gap-px overflow-hidden rounded-full bg-chart-track" aria-hidden>
                    {x.dinilai > 0 && (
                      <>
                        <span className="bg-success" style={{ width: `${(x.tepat / x.dinilai) * 100}%` }} />
                        <span className="bg-warning" style={{ width: `${(x.meleset / x.dinilai) * 100}%` }} />
                        <span className="bg-danger" style={{ width: `${(x.belum / x.dinilai) * 100}%` }} />
                      </>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {data.length > BATAS && (
          <button type="button" onClick={onSemua} className="mt-2 rounded-sm text-[11px] font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
            {semua ? "Tampilkan lebih sedikit" : `Tampilkan semua (${formatNumber(data.length)})`}
          </button>
        )}
        <p className="mt-2 text-[11px] text-fg-subtle">Tepat / dinilai. Hijau = di hari pulang, kuning = sebelum/setelah pulang, merah = belum terbit.</p>
      </section>
    </Card>
  );
}

function BarisPulang({ e, aktif, hariIni, onPilih }: { e: EpisodePulang; aktif: boolean; hariIni: string; onPilih: () => void }) {
  const belum = e.status === "BELUM_TERBIT";
  const acuan = e.surat.find((s) => s.noSurat === e.noSuratAcuan) ?? null;
  const Ikon = LAYANAN_IKON[e.layanan];
  const w = warnaStatus(e.status);
  const sel = "border-b border-border px-2 py-2.5 align-top @max-3xl:block @max-3xl:min-w-0 @max-3xl:border-0 @max-3xl:p-0";
  return (
    <tr
      onClick={onPilih}
      data-status={e.status}
      className={cn(
        "cursor-pointer transition-colors",
        "@max-3xl:grid @max-3xl:grid-cols-2 @max-3xl:gap-x-3 @max-3xl:gap-y-2.5 @max-3xl:rounded-[var(--radius-md)] @max-3xl:border @max-3xl:p-3",
        aktif ? "bg-brand-soft @max-3xl:border-brand" : belum ? "bg-danger-soft/45 hover:bg-danger-soft/70 @max-3xl:border-danger/35" : "hover:bg-surface-2/50 @max-3xl:border-border",
      )}
    >
      <th scope="row" className={cn(sel, "relative py-2.5 pr-2 pl-5 text-left font-normal @max-3xl:col-span-2 @max-3xl:pl-3")}>
        {belum && <span className="absolute inset-y-1.5 left-1.5 w-[3px] rounded-full bg-danger @max-3xl:hidden" aria-hidden />}
        <button
          id={`tp-${e.key}`}
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            onPilih();
          }}
          className="block max-w-56 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring @max-3xl:max-w-full"
        >
          <span className="block truncate text-[13px] font-semibold text-fg" title={e.pasien ?? undefined}>{e.pasien ?? "Tanpa nama"}</span>
          <span className="block font-mono text-[10px] text-fg-subtle">RM {e.norm ?? "—"} · {e.nopen}</span>
        </button>
      </th>
      <td data-label="Pulang" className={cn(sel, LABEL_TUMPUK, "whitespace-nowrap @max-3xl:whitespace-normal")}>
        <span className="block text-xs text-fg tabular">
          {formatDate(e.tglPulang)}
          {e.jamPulang && <span className="ml-1 font-mono text-[10px] text-fg-muted">{e.jamPulang.replace(":", ".")}</span>}
          {e.tglPulang === hariIni && <span className="ml-1.5 inline-block rounded bg-brand-soft px-1 text-[10px] font-semibold whitespace-nowrap text-brand-soft-fg">hari ini</span>}
        </span>
        <span className="mt-0.5 flex max-w-48 items-center gap-1 text-[11px] text-fg-muted">
          <Ikon className="size-3.5 shrink-0" role="img" aria-label={LAYANAN_PULANG[e.layanan].label} />
          <span className="truncate" title={e.ruangan?.nama ?? undefined}>{e.ruangan?.nama ?? "—"}</span>
        </span>
      </td>
      <td data-label="Surat Kontrol" className={cn(sel, LABEL_TUMPUK)}>
        {acuan ? (
          <>
            <span className="block font-mono text-[11px] text-fg">{acuan.noSurat}</span>
            <span className="block max-w-48 truncate text-[11px] text-fg-muted">
              {acuan.tglTerbit ? `terbit ${formatDate(acuan.tglTerbit)}` : "tanggal terbit belum terbaca"}
              {acuan.poliTujuan ? ` · ${acuan.poliTujuan.nama ?? acuan.poliTujuan.kode}` : ""}
            </span>
            {e.surat.length > 1 && <span className="block text-[10px] text-fg-subtle">+{e.surat.length - 1} surat lain</span>}
          </>
        ) : e.kontrolPascaRi ? (
          <>
            <span className="block text-xs font-medium text-fg-muted">Tidak dapat terbit</span>
            <span className="block max-w-48 truncate text-[11px] text-fg-subtle">kontrol pasca RI{e.kontrolPascaRi.suratDipakai ? ` · pakai ${e.kontrolPascaRi.suratDipakai}` : ""}</span>
          </>
        ) : belum ? (
          <>
            <span className="block text-xs font-semibold text-danger">Belum ada</span>
            {e.jadwalTanpaSurat && <span className="block text-[11px] text-fg-muted">jadwal SIMRS {formatDate(e.jadwalTanpaSurat.tanggal)}, belum terbit di BPJS</span>}
          </>
        ) : (
          <span className="text-xs text-fg-subtle">—</span>
        )}
      </td>
      <td data-label="Terbit vs pulang" className={cn(sel, LABEL_TUMPUK)}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {e.status !== "TIDAK_WAJIB" && e.status !== "TAK_TERVERIFIKASI" && <JejakTerbit e={e} />}
          <span className={cn("text-xs font-medium", e.status === "TIDAK_WAJIB" || e.status === "TAK_TERVERIFIKASI" ? "text-fg-muted" : w.teks)}>{teksSelisih(e)}</span>
        </span>
      </td>
      <td data-label="Status" className={cn(sel, LABEL_TUMPUK, "pr-4")}>
        <LencanaStatus s={e.status} pendek />
      </td>
    </tr>
  );
}

function Memuat() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
      </div>
      <Card className="flex items-center gap-3 p-4 text-sm text-fg-muted">
        <RefreshCw className="size-4 animate-spin text-brand" aria-hidden />
        Menyusun pasien BPJS pulang lalu mencocokkan dengan Surat Kontrol yang terbit di BPJS…
      </Card>
      <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
    </div>
  );
}
