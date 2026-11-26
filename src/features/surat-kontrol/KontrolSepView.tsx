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
import { JENIS_KONTROL, type JenisKontrol } from "@/server/modules/surat-kontrol/surat-kontrol.constants";
import {
  namaRuanganSep,
  ringkasSep,
  ringkasSepPerHari,
  ringkasSepPerRuangan,
  saringSep,
  teksSelisihSep,
  urutkanSep,
  type FilterSep,
  type RingkasSep,
} from "@/server/modules/surat-kontrol/surat-kontrol.sep";
import {
  LAYANAN_SEP,
  RENTANG_SEP_MAKS_HARI,
  STATUS_SEP,
  STATUS_SEP_KEYS,
  STATUS_SEP_TERBACA,
  type LayananSep,
  type StatusSep,
} from "@/server/modules/surat-kontrol/surat-kontrol.sep.constants";
import type { AuditKontrolSep, SepKontrol } from "@/server/modules/surat-kontrol/surat-kontrol.sep.types";
import { KontrolSepDetail } from "./KontrolSepDetail";
import { KontrolSepSummary } from "./KontrolSepSummary";
import { persenId } from "./pulang.ui";
import { awalBulan, jepitRentang, PRESET_RENTANG } from "./rentang";
import { SebaranHarianChart } from "./SebaranHarianChart";
import { JejakEntri, LencanaStatusSep, SERI_SEP, warnaStatusSep } from "./sep.ui";
import { fetchKontrolSep, unduhEksporKontrolSep } from "./suratKontrol.client";

const PAGE_SIZE = 25;
type Urut = "prioritas" | "terbaru" | "selisih";
/** Jenis surat yang dinilai: Surat Kontrol saja (bawaan), Surat Kontrol + SPRI, SPRI saja, atau Summary (gabungan). */
type Cakupan = "kontrol" | "semua" | "spri" | "summary";
const FILTER_CAKUPAN: Record<Cakupan, Pick<FilterSep, "spri" | "jenis">> = {
  kontrol: { spri: false },
  semua: { spri: true },
  spri: { spri: true, jenis: 1 },
  summary: { spri: true },
};

const URUT_OPSI: SelectOption[] = [
  { value: "prioritas", label: "Prioritas (surat = SEP dulu)" },
  { value: "terbaru", label: "Tanggal rencana terbaru" },
  { value: "selisih", label: "Selisih hari terbesar" },
];

const LAYANAN_IKON: Record<LayananSep, typeof BedDouble> = { RI: BedDouble, RJ: Stethoscope };

/** Label kolom saat tabel bertumpuk jadi kartu (container query < 48rem). */
const LABEL_TUMPUK =
  "@max-3xl:before:mb-0.5 @max-3xl:before:block @max-3xl:before:text-[11px] @max-3xl:before:font-medium @max-3xl:before:text-fg-subtle @max-3xl:before:content-[attr(data-label)]";

const FOKUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring";

/**
 * Audit "Kontrol = SEP": tanggal entri surat di BPJS dibandingkan dengan tanggal
 * SEP yang memakainya. Bawaan hanya Surat Kontrol (kode 2); SPRI (kode 1) dapat
 * disertakan. Data satu rentang diambil sekali; saringan, cari, urut &
 * paginasi di klien (instan).
 */
export function KontrolSepView({ bolehEkspor, onTemuan }: { bolehEkspor: boolean; onTemuan?: (n: number | null) => void }) {
  const hariIni = tanggalHariIniWita();
  const [from, setFrom] = useState(() => awalBulan(hariIni));
  const [to, setTo] = useState(hariIni);
  const [cakupan, setCakupan] = useState<Cakupan>("kontrol");
  const [status, setStatus] = useState<StatusSep | "">("");
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

  const data = useAsyncData<AuditKontrolSep>(() => {
    const segar = segarRef.current;
    segarRef.current = false;
    return fetchKontrolSep({ from, to }, { segar });
  }, [from, to]);
  const d = data.result;
  const semua = useMemo(() => d?.baris ?? [], [d]);

  const { spri, jenis } = FILTER_CAKUPAN[cakupan];
  const cari = q || undefined;
  const lingkup = { ruangan: ruangan || undefined, tanggal: tanggal ?? undefined, q: cari };

  // Lencana tab = surat terbit bersama SEP (seluruh rentang, sesuai jenis surat yang dipilih).
  const temuanSemua = d ? saringSep(semua, { spri, jenis, status: "SAMA_HARI" }).length : null;
  useEffect(() => {
    onTemuan?.(temuanSemua);
  }, [temuanSemua, onTemuan]);

  const perKey = useMemo(() => new Map(semua.map((e) => [e.key, e])), [semua]);
  // Dasar ringkasan = semua saringan KECUALI status (status dipilih dari ringkasan ini).
  const dasar = useMemo(
    () => saringSep(semua, { spri, jenis, ruangan: ruangan || undefined, tanggal: tanggal ?? undefined, q: cari }),
    [semua, spri, jenis, ruangan, tanggal, cari],
  );
  const r = useMemo(() => ringkasSep(dasar), [dasar]);
  const perJenis = useMemo(
    () => ({
      2: ringkasSep(saringSep(semua, { spri: true, jenis: 2, ruangan: ruangan || undefined, tanggal: tanggal ?? undefined, q: cari })),
      1: ringkasSep(saringSep(semua, { spri: true, jenis: 1, ruangan: ruangan || undefined, tanggal: tanggal ?? undefined, q: cari })),
    }),
    [semua, ruangan, tanggal, cari],
  );
  const jumlahJenis = useMemo(() => ({ 2: semua.filter((e) => e.surat.jenis === 2).length, 1: semua.filter((e) => e.surat.jenis === 1).length }), [semua]);
  const tampil = useMemo(() => {
    const x = saringSep(dasar, { spri: true, status: status || undefined });
    if (urut === "terbaru") return x.sort((a, b) => b.surat.tglRencana.localeCompare(a.surat.tglRencana) || (b.sep?.jamSep ?? "").localeCompare(a.sep?.jamSep ?? "") || a.key.localeCompare(b.key));
    if (urut === "selisih") return x.sort((a, b) => Math.abs(b.selisihHari ?? -1) - Math.abs(a.selisihHari ?? -1) || a.key.localeCompare(b.key));
    return urutkanSep(x);
  }, [dasar, status, urut]);
  const harian = useMemo(
    () => (d ? ringkasSepPerHari(saringSep(semua, { spri, jenis, ruangan: ruangan || undefined, q: cari, status: status || undefined }), d.rentang.from, d.rentang.to) : []),
    [d, semua, spri, jenis, ruangan, cari, status],
  );
  const perRuangan = useMemo(() => ringkasSepPerRuangan(saringSep(semua, { spri, jenis, tanggal: tanggal ?? undefined, q: cari })), [semua, spri, jenis, tanggal, cari]);
  const ruanganOpsi = useMemo<SelectOption[]>(
    () => [{ value: "", label: "Semua ruangan / poli" }, ...[...new Set(saringSep(semua, { spri, jenis }).map(namaRuanganSep))].sort().map((n) => ({ value: n, label: n }))],
    [semua, spri, jenis],
  );

  const totalPages = Math.max(1, Math.ceil(tampil.length / PAGE_SIZE));
  const halaman = Math.min(page, totalPages);
  const isiHalaman = tampil.slice((halaman - 1) * PAGE_SIZE, halaman * PAGE_SIZE);
  const pilih = pilihKey ? (perKey.get(pilihKey) ?? null) : null;
  const posisi = pilihKey ? tampil.findIndex((e) => e.key === pilihKey) : -1;
  const ringkasanAktif = cakupan === "summary";
  // Summary = gabungan tanpa saringan layar (ekspor berisi semua surat + lembar rekap audit BPJS).
  const filter: FilterSep = ringkasanAktif ? { spri: true } : { spri, jenis, status: status || undefined, ...lingkup };
  const adaSaringan = !!(status || ruangan || tanggal || qInput);
  const presetAktif = PRESET_RENTANG.find((p) => {
    const [a, b] = p.rentang(hariIni);
    return a === from && b === to;
  })?.key;

  const ubahRentang = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
    setTanggal(null);
    setPilihKey(null);
    setPage(1);
  };
  const jepit = (f: string, t: string, diubah: "from" | "to") => jepitRentang(f, t, diubah, hariIni, RENTANG_SEP_MAKS_HARI);

  function ubahCakupan(c: Cakupan) {
    setCakupan(c);
    // Ruangan yang hanya ada di jenis lain akan mengosongkan daftar — lepaskan.
    setRuangan("");
    setPilihKey(null);
    setPage(1);
  }

  function pilihBaris(key: string) {
    setPilihKey(key);
    setTerbuka(true);
    const i = tampil.findIndex((e) => e.key === key);
    if (i >= 0) setPage(Math.floor(i / PAGE_SIZE) + 1);
  }

  function pindah(delta: number) {
    const aktif = document.activeElement?.id?.startsWith("ks-r-") ? document.activeElement.id.slice(5) : pilihKey;
    const i = isiHalaman.findIndex((x) => x.key === aktif);
    const next = isiHalaman[i < 0 ? 0 : i + delta];
    if (next) {
      setPilihKey(next.key);
      document.getElementById(`ks-r-${next.key}`)?.focus();
    }
  }

  function tampilkanStatus(s: StatusSep | "") {
    setStatus(s);
    setPage(1);
  }

  /** Dari Summary: buka daftar satu jenis surat dengan status tertentu, lalu gulir ke daftar. */
  function bukaDaftar(c: Exclude<Cakupan, "summary" | "semua">, s?: StatusSep) {
    setCakupan(c);
    setRuangan("");
    setTanggal(null);
    setQInput("");
    setStatus(s ?? "");
    setUrut("prioritas");
    setPilihKey(null);
    setPage(1);
    // Daftar baru terpasang setelah render berikutnya.
    requestAnimationFrame(() => requestAnimationFrame(() => daftarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })));
  }

  /** Tampilkan surat = SEP dari kartu sorotan (Surat Kontrol, atau SPRI bila cakupan "SPRI saja"). */
  function lihatSamaSep() {
    if (cakupan === "semua") setCakupan("kontrol");
    tampilkanStatus("SAMA_HARI");
    setUrut("prioritas");
    daftarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function reset() {
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
      const kode = await unduhEksporKontrolSep({ from, to }, filter);
      setPesanEkspor({ ok: true, teks: `Berkas Excel diunduh${kode ? ` · kode ${kode}` : ""}.` });
    } catch (e) {
      setPesanEkspor({ ok: false, teks: e instanceof Error ? e.message : "Gagal mengekspor." });
    } finally {
      setMengekspor(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Saringan rentang, SPRI & cari */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[auto_300px_minmax(0,1fr)]">
          <div className="min-w-0 md:col-span-2 xl:col-span-1">
            <span id="ks-preset-label" className="mb-1.5 block text-sm font-medium text-fg">Tanggal rencana (VClaim)</span>
            <div role="group" aria-labelledby="ks-preset-label" className="flex max-w-full flex-wrap gap-1 rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
              {PRESET_RENTANG.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={presetAktif === p.key}
                  onClick={() => {
                    const [a, b] = p.rentang(hariIni);
                    ubahRentang(a, b);
                  }}
                  className={cn(
                    "min-h-8 shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-medium transition-colors",
                    FOKUS,
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
              <Label htmlFor="ks-from">Dari</Label>
              <Input id="ks-from" type="date" value={from} max={hariIni} onChange={(e) => e.target.value && ubahRentang(...jepit(e.target.value, to, "from"))} />
            </div>
            <div>
              <Label htmlFor="ks-to">Sampai</Label>
              <Input id="ks-to" type="date" value={to} min={from} max={hariIni} onChange={(e) => e.target.value && ubahRentang(...jepit(from, e.target.value, "to"))} />
            </div>
          </div>
          <div className={cn("min-w-0", ringkasanAktif && "hidden")}>
            <Label htmlFor="ks-q">Cari</Label>
            <InputWithIcon
              id="ks-q"
              type="search"
              icon={<Search className="size-4" />}
              placeholder="Nama, RM, kartu, SEP, no. surat, petugas…"
              aria-describedby="ks-q-bantuan"
              value={qInput}
              maxLength={80}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setQInput(e.target.value);
                setPage(1);
              }}
            />
            <span id="ks-q-bantuan" className="sr-only">
              Cari nama pasien, nomor RM, NOPEN, nomor kartu BPJS, SEP, SEP asal, nomor surat, dokter, ruangan, atau petugas penerbit surat dan pembuat SEP
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <span aria-hidden className="text-sm font-medium text-fg">Jenis surat</span>
            <SegmentedControl<Cakupan>
              label="Jenis surat"
              value={cakupan}
              onChange={ubahCakupan}
              className="max-sm:w-full"
              items={[
                { value: "kontrol", label: "Surat Kontrol", labelSingkat: "Kontrol", jumlah: d ? jumlahJenis[2] : undefined },
                { value: "semua", label: "Kontrol + SPRI", labelSingkat: "+ SPRI", jumlah: d ? semua.length : undefined },
                { value: "spri", label: "SPRI saja", labelSingkat: "SPRI", jumlah: d ? jumlahJenis[1] : undefined },
                { value: "summary", label: "Summary" },
              ]}
            />
            <span className="text-[11px] text-fg-subtle [text-wrap:pretty]">
              Kode BPJS: Surat Kontrol = 2 (dibanding SEP kontrol), SPRI = 1 (dibanding SEP rawat inap).
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {adaSaringan && !ringkasanAktif && (
              <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={reset}>
                Atur ulang saringan
              </Button>
            )}
            {bolehEkspor && (
              <Button variant="secondary" size="sm" icon={<FileSpreadsheet className="size-4" />} loading={mengekspor} disabled={!d || (ringkasanAktif ? semua.length === 0 : tampil.length === 0) || mengekspor} onClick={ekspor}>
                Ekspor Excel
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2">
          <SumberEntri
            d={d}
            loading={data.loading}
            onSegar={() => {
              segarRef.current = true;
              data.reload();
            }}
          />
        </div>
        {pesanEkspor && <p role="status" className={cn("mt-2 text-xs", pesanEkspor.ok ? "text-success" : "text-danger")}>{pesanEkspor.teks}</p>}
      </Card>

      {d?.galatBpjs && (
        <div role="alert" className="flex gap-3 rounded-[var(--radius-lg)] border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-fg">
          <WifiOff className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-semibold">Webservice BPJS tidak tersedia — daftar surat diambil dari cache SIMGOS</p>
            <p className="text-xs text-fg-muted">{d.galatBpjs} Cache hanya berisi surat yang pernah diambil, jadi jumlahnya bisa kurang dari VClaim. Coba segarkan beberapa saat lagi.</p>
          </div>
        </div>
      )}

      {data.loading && !d ? (
        <Memuat />
      ) : data.error && !d ? (
        <Card>
          <ErrorState description="Gagal memuat data SEP. Periksa koneksi ke SIMGOS lalu coba lagi." onRetry={data.reload} />
        </Card>
      ) : d && ringkasanAktif ? (
        <div className={cn("transition-opacity", data.loading && "pointer-events-none opacity-60")} aria-busy={data.loading}>
          <KontrolSepSummary d={d} onBuka={bukaDaftar} />
        </div>
      ) : d ? (
        <div className={cn("space-y-4 transition-opacity", data.loading && "pointer-events-none opacity-60")} aria-busy={data.loading}>
          {/* Ringkasan + sorotan Surat Kontrol dibuat di hari kontrol */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
            <Ringkasan
              r={r}
              perJenis={perJenis}
              cakupan={cakupan}
              rentang={d.rentang}
              status={status}
              onStatus={(s) => tampilkanStatus(status === s ? "" : s)}
              onCakupan={ubahCakupan}
            />
            {cakupan === "spri" ? <SorotanSpri r={perJenis[1]} onLihat={lihatSamaSep} /> : <SorotanKontrol r={perJenis[2]} onLihat={lihatSamaSep} />}
          </div>

          {/* Sebaran harian & per ruangan */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="min-w-0 p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-fg">Sebaran per tanggal rencana</h2>
                <span className="text-[11px] text-fg-subtle">surat menurut tanggal rencana kontrol · titik = hari ini</span>
              </div>
              <SebaranHarianChart
                data={harian}
                seri={SERI_SEP}
                hariIni={d.hariIni}
                aktif={tanggal}
                satuan="surat"
                judul="Sebaran surat per tanggal rencana menurut tanggal entri surat dibanding SEP pemakainya"
                onPilih={(t) => {
                  setTanggal(t);
                  setPage(1);
                }}
              />
            </Card>
            <PerRuangan
              data={perRuangan}
              aktif={ruangan}
              semua={semuaRuangan}
              onSemua={() => setSemuaRuangan((v) => !v)}
              onPilih={(n) => {
                setRuangan(ruangan === n ? "" : n);
                setPage(1);
              }}
            />
          </div>

          {/* Daftar SEP */}
          <Card className="min-w-0 overflow-hidden">
            <section ref={daftarRef} aria-labelledby="ks-daftar-judul" className="scroll-mt-20">
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
                <div className="mr-auto min-w-0">
                  <h2 id="ks-daftar-judul" className="text-sm font-semibold text-fg">
                    Surat BPJS &amp; SEP pemakai
                    <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-fg-muted tabular">{formatNumber(tampil.length)}</span>
                  </h2>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {status ? (
                      <>
                        Menampilkan <b className="font-semibold text-fg">{STATUS_SEP[status].label.toLowerCase()}</b> ·{" "}
                      </>
                    ) : null}
                    {tanggal ? <>tanggal {formatDate(tanggal)} · </> : null}
                    Klik baris untuk melihat urutan asal → surat → SEP / rencana.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/40 px-4 py-2">
                <Label htmlFor="ks-status" className="sr-only">Status</Label>
                <Select
                  id="ks-status"
                  className="w-full sm:w-60"
                  value={status}
                  onChange={(v) => tampilkanStatus(v as StatusSep | "")}
                  options={[{ value: "", label: "Semua status" }, ...STATUS_SEP_KEYS.map((k) => ({ value: k, label: `${STATUS_SEP[k].label} (${formatNumber(r.perStatus[k])})` }))]}
                />
                <Label htmlFor="ks-ruangan" className="sr-only">Ruangan atau poli</Label>
                <Select
                  id="ks-ruangan"
                  className="w-full sm:w-56"
                  value={ruangan}
                  onChange={(v) => {
                    setRuangan(v);
                    setPage(1);
                  }}
                  options={ruanganOpsi}
                />
                <Label htmlFor="ks-urut" className="sr-only">Urutkan</Label>
                <Select
                  id="ks-urut"
                  className="w-full sm:ml-auto sm:w-60"
                  value={urut}
                  onChange={(v) => {
                    setUrut(v as Urut);
                    setPage(1);
                  }}
                  options={URUT_OPSI}
                />
              </div>

              {tampil.length === 0 ? (
                <EmptyState
                  title={semua.length === 0 ? "Tidak ada surat pada rentang ini" : "Tidak ada surat yang cocok"}
                  description={semua.length === 0 ? "Pilih rentang tanggal rencana lain." : "Ubah atau atur ulang saringan untuk melihat surat lain."}
                  action={adaSaringan ? <Button variant="secondary" size="sm" onClick={reset}>Atur ulang saringan</Button> : undefined}
                />
              ) : (
                <>
                  <div className="@container">
                    <div role="region" aria-labelledby="ks-daftar-judul" tabIndex={0} className={cn("overflow-x-auto focus-visible:ring-inset @max-3xl:overflow-visible", FOKUS)}>
                      <table className="w-full border-separate border-spacing-0 text-sm @max-3xl:block @max-3xl:space-y-2 @max-3xl:p-3">
                        <caption className="sr-only">Surat Kontrol / SPRI BPJS menurut tanggal rencana, dengan tanggal entri surat dibandingkan tanggal SEP pemakainya</caption>
                        <thead className="bg-surface-2/60 text-left text-[11px] font-semibold tracking-wide text-fg-muted uppercase @max-3xl:hidden">
                          <tr>
                            <th scope="col" className="border-b border-border py-2 pr-2 pl-5">Pasien</th>
                            <th scope="col" className="border-b border-border px-2 py-2">SEP pemakai</th>
                            <th scope="col" className="border-b border-border px-2 py-2">Surat</th>
                            <th scope="col" className="border-b border-border px-2 py-2">Entri vs SEP</th>
                            <th scope="col" className="border-b border-border px-2 py-2">Asal surat</th>
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
                            <BarisSep key={e.key} e={e} aktif={pilihKey === e.key} onPilih={() => pilihBaris(e.key)} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
                    <p className="text-xs text-fg-muted">
                      <b className="tabular text-fg">
                        {formatNumber((halaman - 1) * PAGE_SIZE + 1)}–{formatNumber((halaman - 1) * PAGE_SIZE + isiHalaman.length)}
                      </b>{" "}
                      dari <b className="tabular text-fg">{formatNumber(tampil.length)}</b>
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
        title="Rincian surat & SEP"
        size="md"
        header={
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <p className="truncate text-sm font-semibold text-fg" aria-hidden>Rincian surat &amp; SEP</p>
            {posisi >= 0 && (
              <span className="ml-auto flex shrink-0 items-center gap-1">
                <span className="mr-1 text-[11px] text-fg-muted tabular">{formatNumber(posisi + 1)} / {formatNumber(tampil.length)}</span>
                <Button variant="ghost" size="sm" className="px-2" aria-label="SEP sebelumnya" disabled={posisi <= 0} onClick={() => pilihBaris(tampil[posisi - 1].key)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" className="px-2" aria-label="SEP berikutnya" disabled={posisi >= tampil.length - 1} onClick={() => pilihBaris(tampil[posisi + 1].key)}>
                  <ChevronRight className="size-4" />
                </Button>
              </span>
            )}
          </div>
        }
      >
        <div className="p-5">{pilih && d && <KontrolSepDetail e={pilih} hariIni={d.hariIni} />}</div>
      </Drawer>
    </div>
  );
}

function SumberEntri({ d, loading, onSegar }: { d: AuditKontrolSep | null; loading: boolean; onSegar: () => void }) {
  if (!d) return <p className="text-xs text-fg-muted">{loading ? "Mengambil daftar surat dari BPJS…" : "—"}</p>;
  const live = d.dariBpjs;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
      <span
        className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium", live ? "bg-success-soft text-success" : "bg-surface-2 text-fg-muted")}
        title="Daftar surat dari webservice BPJS (sama dengan VClaim); bila gagal, dari cache SIMGOS bpjs.monitoring_rencana_kontrol"
      >
        {live ? <Wifi className="size-3.5" aria-hidden /> : <Database className="size-3.5" aria-hidden />}
        {live ? "BPJS live (= VClaim)" : "Cache BPJS di SIMGOS"}
      </span>
      <span>disusun {d.disusun.slice(11, 16).replace(":", ".")} WITA</span>
      <span aria-hidden>·</span>
      <CalendarRange className="size-3.5" aria-hidden />
      <span>
        {formatDate(d.rentang.from)} – {formatDate(d.rentang.to)}
      </span>
      {d.asal.belum > 0 && <span className="text-warning">· {formatNumber(d.asal.belum)} surat belum terbaca tanggal entrinya</span>}
      <button
        type="button"
        onClick={onSegar}
        disabled={loading}
        className={cn("inline-flex min-h-8 items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5 font-medium text-brand hover:bg-brand-soft disabled:opacity-50", FOKUS)}
      >
        <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden /> Segarkan dari BPJS
      </button>
    </div>
  );
}

/** Angka utama + batang komposisi (tombol status = saringan) + baris per jenis surat. */
function Ringkasan({
  r,
  perJenis,
  cakupan,
  rentang,
  status,
  onStatus,
  onCakupan,
}: {
  r: RingkasSep;
  perJenis: Record<JenisKontrol, RingkasSep>;
  cakupan: Cakupan;
  rentang: { from: string; to: string };
  status: StatusSep | "";
  onStatus: (s: StatusSep) => void;
  onCakupan: (c: Cakupan) => void;
}) {
  const lingkup = cakupan === "kontrol" ? "Surat Kontrol (kode 2)" : cakupan === "spri" ? "SPRI saja (kode 1)" : "Surat Kontrol & SPRI";
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <section aria-labelledby="ks-ringkas-judul">
        <h2 id="ks-ringkas-judul" className="text-sm font-semibold text-fg">Surat terbit bersama SEP</h2>
        <p className="text-xs text-fg-muted">
          {lingkup} · tanggal entri di BPJS = tanggal SEP pemakai · rencana {formatDate(rentang.from)} – {formatDate(rentang.to)}
        </p>
        <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={cn("text-4xl font-semibold tracking-tight tabular sm:text-5xl", r.perStatus.SAMA_HARI > 0 ? "text-danger" : "text-fg")}>
            {formatNumber(r.perStatus.SAMA_HARI)}
          </span>
          <span className="text-sm text-fg-muted">
            dari <b className="font-semibold text-fg tabular">{formatNumber(r.terbaca)}</b> surat yang sudah dipakai SEP · <b className="font-semibold text-fg tabular">{persenId(r.persenSama)}</b>
          </span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
          <span>
            <b className="font-semibold text-fg tabular">{formatNumber(r.total)}</b> surat di BPJS (VClaim)
          </span>
          <span aria-hidden>·</span>
          <span>
            <b className="font-semibold text-fg tabular">{formatNumber(r.dipakai)}</b> dipakai SEP
          </span>
          <span aria-hidden>·</span>
          <button
            type="button"
            aria-pressed={status === "BELUM_DIPAKAI"}
            title={STATUS_SEP.BELUM_DIPAKAI.jelas}
            onClick={() => onStatus("BELUM_DIPAKAI")}
            className={cn("min-h-6 rounded-sm font-medium underline-offset-2 hover:text-fg hover:underline", FOKUS, status === "BELUM_DIPAKAI" ? "text-brand underline" : "text-fg-muted")}
          >
            <b className="font-semibold tabular">{formatNumber(r.perStatus.BELUM_DIPAKAI)}</b> belum dipakai SEP
          </button>
        </p>

        <BatangKomposisi perStatus={r.perStatus} terbaca={r.terbaca} aktif={status} className="mt-3 h-3" />
        <ul className="mt-3 grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-3" aria-label="Saring menurut status">
          {(["SAMA_HARI", "SETELAH_SEP", "SEBELUM_SEP"] as const).map((k) => {
            const w = warnaStatusSep(k);
            const n = r.perStatus[k];
            return (
              <li key={k}>
                <button
                  type="button"
                  aria-pressed={status === k}
                  title={STATUS_SEP[k].jelas}
                  onClick={() => onStatus(k)}
                  className={cn(
                    "flex min-h-11 w-full items-start gap-2 rounded-[var(--radius-md)] border px-2.5 py-2 text-left transition-colors",
                    FOKUS,
                    status === k ? "border-brand bg-brand-soft/60" : "border-border hover:border-border-strong hover:bg-surface-2/50",
                    k === "SAMA_HARI" && n > 0 && status !== k && "border-danger/30",
                  )}
                >
                  <span className={cn("mt-1 size-2.5 shrink-0 rounded-[3px]", w.isi)} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[11px] leading-tight font-medium text-fg-muted">{STATUS_SEP[k].label}</span>
                    <span className="block text-base font-semibold text-fg tabular">
                      {formatNumber(n)}
                      <span className="ml-1 text-[11px] font-medium text-fg-subtle">{r.terbaca ? persenId(Math.round((n / r.terbaca) * 1000) / 10) : ""}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 border-t border-border pt-3">
          {cakupan === "semua" ? (
            <ul className="space-y-1" aria-label="Per jenis surat (klik untuk menampilkan satu jenis)">
              {([2, 1] as const).map((j) => {
                const x = perJenis[j];
                return (
                  <li key={j}>
                    <button
                      type="button"
                      onClick={() => onCakupan(j === 2 ? "kontrol" : "spri")}
                      className={cn(
                        "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors hover:bg-surface-2/60 sm:grid-cols-[150px_minmax(0,1fr)_auto]",
                        FOKUS,
                      )}
                    >
                      <span className="text-xs font-medium text-fg">
                        {JENIS_KONTROL[j].label} <span className="font-normal text-fg-subtle">· kode {j}</span>
                      </span>
                      <BatangKomposisi perStatus={x.perStatus} terbaca={x.terbaca} aktif={status} className="h-2" />
                      <span className="text-right text-xs whitespace-nowrap text-fg-muted tabular">
                        <b className={cn("font-semibold", x.perStatus.SAMA_HARI > 0 ? "text-danger" : "text-fg")}>{formatNumber(x.perStatus.SAMA_HARI)}</b>
                        /{formatNumber(x.terbaca)}
                        <span className="hidden sm:inline"> · {persenId(x.persenSama)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : cakupan === "kontrol" ? (
            <p className="text-[11px] text-fg-subtle [text-wrap:pretty]">
              SPRI tidak disertakan. Pilih <b className="font-semibold text-fg-muted">Kontrol + SPRI</b> atau <b className="font-semibold text-fg-muted">SPRI saja</b> untuk menilai tanggal entri SPRI terhadap SEP rawat inap.
            </p>
          ) : (
            <p className="text-[11px] text-fg-subtle [text-wrap:pretty]">
              Hanya SPRI: tanggal entri SPRI di BPJS dibandingkan dengan tanggal SEP rawat inap yang memakainya.
            </p>
          )}
          {r.perStatus.TAK_TERBACA + r.perStatus.SEP_TAK_TERCATAT > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-subtle">
              <span>Tidak masuk perhitungan:</span>
              {(["SEP_TAK_TERCATAT", "TAK_TERBACA"] as const).map((k) =>
                r.perStatus[k] > 0 ? (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={status === k}
                    title={STATUS_SEP[k].jelas}
                    onClick={() => onStatus(k)}
                    className={cn("rounded-sm font-medium underline-offset-2 hover:text-fg hover:underline", FOKUS, status === k ? "text-brand underline" : "text-fg-muted")}
                  >
                    {formatNumber(r.perStatus[k])} {STATUS_SEP[k].label.toLowerCase()}
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

/** Batang 100% bertumpuk: sebelum → setelah → bersama SEP (celah 2px antarsegmen). */
function BatangKomposisi({ perStatus, terbaca, aktif, className }: { perStatus: Record<StatusSep, number>; terbaca: number; aktif: StatusSep | ""; className?: string }) {
  return (
    <span className={cn("flex w-full gap-0.5 overflow-hidden rounded-full bg-chart-track", className)} aria-hidden>
      {terbaca > 0 &&
        STATUS_SEP_TERBACA.map((k) =>
          perStatus[k] > 0 ? (
            <span
              key={k}
              className={cn("h-full transition-opacity first:rounded-l-full last:rounded-r-full", warnaStatusSep(k).isi, aktif && aktif !== k && "opacity-30")}
              style={{ width: `${(perStatus[k] / terbaca) * 100}%` }}
            />
          ) : null,
        )}
    </span>
  );
}

/** Sorotan temuan utama: Surat Kontrol yang baru dibuat di hari kontrol. */
function SorotanKontrol({ r, onLihat }: { r: RingkasSep; onLihat: () => void }) {
  const jumlah = r.perStatus.SAMA_HARI;
  if (r.total === 0) {
    return (
      <Card className="flex flex-col justify-center gap-2 p-5 text-sm text-fg-muted">
        <p className="font-semibold text-fg">Belum ada Surat Kontrol</p>
        <p className="text-xs">Tidak ada Surat Kontrol dengan tanggal rencana di rentang &amp; saringan ini.</p>
      </Card>
    );
  }
  if (jumlah === 0) {
    return (
      <Card className="flex flex-col justify-center gap-2 border-success/30 bg-success-soft/50 p-5">
        <CircleCheckBig className="size-7 text-success" aria-hidden />
        <p className="text-base font-semibold text-fg">Tidak ada Kontrol = SEP</p>
        <p className="text-xs text-fg-muted">Setiap Surat Kontrol yang sudah dipakai SEP pada rentang ini terbit sebelum hari kontrol.</p>
      </Card>
    );
  }
  const lain = jumlah - r.samaDariRi - r.samaDariRj;
  return (
    <section aria-labelledby="ks-sorot-judul" className="flex flex-col rounded-[var(--radius-lg)] border border-danger/30 bg-danger-soft/60 p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger text-white">
          <OctagonAlert className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="ks-sorot-judul" className="text-sm font-semibold text-fg">Kontrol = SEP</h2>
          <p className="mt-0.5 text-4xl font-semibold tracking-tight text-danger tabular">{formatNumber(jumlah)}</p>
          <p className="text-xs text-fg-muted">Surat Kontrol baru dibuat di hari pasien datang kontrol</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-fg">
        {r.samaDariRi > 0 && (
          <li className="rounded-[var(--radius-sm)] bg-surface/70 px-2 py-1">
            <b className="font-semibold">{formatNumber(r.samaDariRi)}</b> dari rawat inap — tidak diterbitkan saat pasien pulang
          </li>
        )}
        {r.samaDariRj > 0 && (
          <li className="px-2">
            <b className="font-semibold">{formatNumber(r.samaDariRj)}</b> dari kunjungan rawat jalan sebelumnya
          </li>
        )}
        {lain > 0 && (
          <li className="px-2">
            <b className="font-semibold">{formatNumber(lain)}</b> asal tidak diketahui
          </li>
        )}
      </ul>
      <Button variant="danger" size="sm" className="mt-4 self-start" onClick={onLihat}>
        Tampilkan Kontrol = SEP
      </Button>
    </section>
  );
}

/** Sorotan untuk cakupan "SPRI saja": SPRI yang dientri di hari SEP rawat inap & yang dientri setelahnya. */
function SorotanSpri({ r, onLihat }: { r: RingkasSep; onLihat: () => void }) {
  const jumlah = r.perStatus.SAMA_HARI;
  if (r.total === 0) {
    return (
      <Card className="flex flex-col justify-center gap-2 p-5 text-sm text-fg-muted">
        <p className="font-semibold text-fg">Belum ada SPRI</p>
        <p className="text-xs">Tidak ada SPRI dengan tanggal rencana di rentang &amp; saringan ini.</p>
      </Card>
    );
  }
  return (
    <section aria-labelledby="ks-sorot-judul" className={cn("flex flex-col rounded-[var(--radius-lg)] border p-5 shadow-xs", jumlah > 0 ? "border-danger/30 bg-danger-soft/60" : "border-success/30 bg-success-soft/50")}>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-white", jumlah > 0 ? "bg-danger" : "bg-success")}>
          {jumlah > 0 ? <OctagonAlert className="size-5" aria-hidden /> : <CircleCheckBig className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0">
          <h2 id="ks-sorot-judul" className="text-sm font-semibold text-fg">SPRI = SEP</h2>
          <p className={cn("mt-0.5 text-4xl font-semibold tracking-tight tabular", jumlah > 0 ? "text-danger" : "text-success")}>{formatNumber(jumlah)}</p>
          <p className="text-xs text-fg-muted">SPRI dientri di hari yang sama dengan SEP rawat inap · {persenId(r.persenSama)} dari {formatNumber(r.terbaca)}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-fg">
        {r.perStatus.SETELAH_SEP > 0 && (
          <li className="rounded-[var(--radius-sm)] bg-surface/70 px-2 py-1">
            <b className="font-semibold">{formatNumber(r.perStatus.SETELAH_SEP)}</b> SPRI dientri setelah SEP rawat inap
          </li>
        )}
        <li className="px-2">
          <b className="font-semibold">{formatNumber(r.perStatus.SEBELUM_SEP)}</b> SPRI dientri sebelum hari SEP
        </li>
      </ul>
      {jumlah > 0 && (
        <Button variant="danger" size="sm" className="mt-4 self-start" onClick={onLihat}>
          Tampilkan SPRI = SEP
        </Button>
      )}
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
  data: ReturnType<typeof ringkasSepPerRuangan>;
  aktif: string;
  semua: boolean;
  onSemua: () => void;
  onPilih: (nama: string) => void;
}) {
  const BATAS = 7;
  const isi = semua ? data : data.slice(0, BATAS);
  return (
    <Card className="p-4">
      <section aria-labelledby="ks-ruangan-judul">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 id="ks-ruangan-judul" className="text-sm font-semibold text-fg">Per ruangan / poli</h2>
          {aktif && (
            <button type="button" className={cn("rounded-sm text-[11px] font-medium text-brand hover:underline", FOKUS)} onClick={() => onPilih(aktif)}>
              Lepas saringan
            </button>
          )}
        </div>
        {data.length === 0 ? (
          <p className="py-6 text-center text-xs text-fg-subtle">Tidak ada data.</p>
        ) : (
          <ul className="space-y-0.5">
            {isi.map((x) => {
              const sebelum = x.terbaca - x.sama - x.setelah;
              return (
                <li key={`${x.layanan}|${x.ruangan}`}>
                  <button
                    type="button"
                    aria-pressed={aktif === x.ruangan}
                    onClick={() => onPilih(x.ruangan)}
                    className={cn("w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-colors", FOKUS, aktif === x.ruangan ? "bg-brand-soft" : "hover:bg-surface-2/60")}
                  >
                    <span className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 rounded bg-surface-2 px-1 text-[10px] font-semibold text-fg-muted">{LAYANAN_SEP[x.layanan].pendek}</span>
                        <span className="truncate font-medium text-fg">{x.ruangan}</span>
                      </span>
                      <span className="shrink-0 text-fg-muted tabular">
                        {x.sama > 0 && <b className="mr-1.5 font-semibold text-danger">{formatNumber(x.sama)} = SEP</b>}
                        {formatNumber(x.total)} surat
                      </span>
                    </span>
                    <span className="flex h-1.5 gap-px overflow-hidden rounded-full bg-chart-track" aria-hidden>
                      {x.terbaca > 0 && (
                        <>
                          <span className="bg-success" style={{ width: `${(sebelum / x.terbaca) * 100}%` }} />
                          <span className="bg-warning" style={{ width: `${(x.setelah / x.terbaca) * 100}%` }} />
                          <span className="bg-danger" style={{ width: `${(x.sama / x.terbaca) * 100}%` }} />
                        </>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {data.length > BATAS && (
          <button type="button" onClick={onSemua} className={cn("mt-2 rounded-sm text-[11px] font-medium text-brand hover:underline", FOKUS)}>
            {semua ? "Tampilkan lebih sedikit" : `Tampilkan semua (${formatNumber(data.length)})`}
          </button>
        )}
        <p className="mt-2 text-[11px] text-fg-subtle">Surat yang sudah dipakai SEP: hijau = terbit sebelum SEP, kuning = setelah SEP, merah = bersama SEP. Ruangan surat yang belum dipakai = poli tujuan surat.</p>
      </section>
    </Card>
  );
}

function BarisSep({ e, aktif, onPilih }: { e: SepKontrol; aktif: boolean; onPilih: () => void }) {
  const sorot = e.status === "SAMA_HARI" && e.surat.jenis === 2;
  const Ikon = LAYANAN_IKON[e.layanan];
  const w = warnaStatusSep(e.status);
  const sel = "border-b border-border px-2 py-2.5 align-top @max-3xl:block @max-3xl:min-w-0 @max-3xl:border-0 @max-3xl:p-0";
  const ruangan = namaRuanganSep(e);
  return (
    <tr
      onClick={onPilih}
      data-status={e.status}
      data-jenis={e.surat.jenis}
      className={cn(
        "cursor-pointer transition-colors",
        "@max-3xl:grid @max-3xl:grid-cols-2 @max-3xl:gap-x-3 @max-3xl:gap-y-2.5 @max-3xl:rounded-[var(--radius-md)] @max-3xl:border @max-3xl:p-3",
        aktif ? "bg-brand-soft @max-3xl:border-brand" : sorot ? "bg-danger-soft/45 hover:bg-danger-soft/70 @max-3xl:border-danger/35" : "hover:bg-surface-2/50 @max-3xl:border-border",
      )}
    >
      <th scope="row" className={cn(sel, "relative py-2.5 pr-2 pl-5 text-left font-normal @max-3xl:col-span-2 @max-3xl:pl-3")}>
        {sorot && <span className="absolute inset-y-1.5 left-1.5 w-[3px] rounded-full bg-danger @max-3xl:hidden" aria-hidden />}
        <button
          id={`ks-r-${e.key}`}
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            onPilih();
          }}
          className={cn("block max-w-56 rounded text-left @max-3xl:max-w-full", FOKUS)}
        >
          <span className="block truncate text-[13px] font-semibold text-fg" title={e.pasien ?? undefined}>{e.pasien ?? "Tanpa nama"}</span>
          <span className="block font-mono text-[10px] text-fg-subtle">RM {e.norm ?? "—"}{e.nopen ? ` · ${e.nopen}` : ""}</span>
        </button>
      </th>
      <td data-label="SEP pemakai" className={cn(sel, LABEL_TUMPUK)}>
        {e.sep ? (
          <span className="block text-xs whitespace-nowrap text-fg tabular">
            {formatDate(e.sep.tglSep)}
            {e.sep.jamSep && <span className="ml-1 font-mono text-[10px] text-fg-muted">{e.sep.jamSep.replace(":", ".")}</span>}
          </span>
        ) : (
          <span className={cn("block text-xs font-medium", w.teks)}>{e.status === "SEP_TAK_TERCATAT" ? "Tak tercatat di SIMGOS" : "Belum dipakai"}</span>
        )}
        <span className="mt-0.5 flex max-w-48 items-center gap-1 text-[11px] text-fg-muted">
          <Ikon className="size-3.5 shrink-0" role="img" aria-label={LAYANAN_SEP[e.layanan].label} />
          <span className="truncate" title={ruangan}>{ruangan}</span>
        </span>
        {e.sep && <span className="block font-mono text-[10px] text-fg-subtle">{e.sep.sep}</span>}
      </td>
      <td data-label="Surat" className={cn(sel, LABEL_TUMPUK)}>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded px-1 text-[10px] font-semibold", e.surat.jenis === 1 ? "bg-accent-soft text-accent" : "bg-brand-soft text-brand-soft-fg")}>
            {JENIS_KONTROL[e.surat.jenis].label}
          </span>
          <span className="font-mono text-[11px] text-fg">{e.surat.noSurat}</span>
        </span>
        <span className="block text-[11px] text-fg-muted">
          {e.surat.tglTerbit ? `entri ${formatDate(e.surat.tglTerbit)}` : "tanggal entri belum terbaca"} · rencana {formatDate(e.surat.tglRencana)}
          {!e.surat.aktif && " · dihapus"}
        </span>
      </td>
      <td data-label="Entri vs SEP" className={cn(sel, LABEL_TUMPUK)}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <JejakEntri selisih={e.selisihHari} status={e.status} />
          <span className={cn("text-xs font-medium", e.sep && e.status !== "TAK_TERBACA" ? w.teks : "text-fg-muted")}>{teksSelisihSep(e)}</span>
        </span>
      </td>
      <td data-label="Asal surat" className={cn(sel, LABEL_TUMPUK)}>
        {e.asal ? (
          <>
            <span className="block text-xs text-fg">
              {e.asal.layanan ? LAYANAN_SEP[e.asal.layanan].label : "SEP asal"}
              {e.asal.tglPulang ? ` · pulang ${formatDate(e.asal.tglPulang)}` : e.asal.tglSep ? ` · ${formatDate(e.asal.tglSep)}` : ""}
            </span>
            {e.hariSejakPulangAsal != null && <span className="block text-[11px] text-fg-muted">{e.hariSejakPulangAsal} hari sebelum SEP kontrol</span>}
          </>
        ) : (
          <span className="text-xs text-fg-subtle">—</span>
        )}
      </td>
      <td data-label="Status" className={cn(sel, LABEL_TUMPUK, "pr-4")}>
        <LencanaStatusSep s={e.status} pendek />
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
        Mengambil daftar Surat Kontrol &amp; SPRI dari BPJS lalu mencocokkan SEP pemakainya di SIMGOS…
      </Card>
      <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
    </div>
  );
}
