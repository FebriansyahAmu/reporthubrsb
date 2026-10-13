"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  FileSpreadsheet,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { Input, InputWithIcon, Label } from "@/components/ui/Field";
import { NumberedPagination } from "@/components/ui/NumberedPagination";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { formatDate, formatNumber, tanggalHariIniWita } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  JENIS_KONTROL,
  MAKS_HARI_KE_DEPAN,
  STATUS_AUDIT,
  TEMUAN,
  TEMUAN_KEYS,
  type StatusAudit,
  type TemuanKey,
} from "@/server/modules/surat-kontrol/surat-kontrol.constants";
import {
  jepitRentang,
  ringkas,
  ringkasPerHari,
  ringkasPerPoli,
  saringBaris,
  tambahHari,
  urutkanBaris,
  type FilterTampilan,
} from "@/server/modules/surat-kontrol/surat-kontrol.filter";
import type { AuditSuratKontrol, SuratKontrolBaris } from "@/server/modules/surat-kontrol/surat-kontrol.types";
import { DetailSurat } from "./DetailSurat";
import { JamBentrokView } from "./JamBentrokView";
import { SebaranHarianChart } from "./SebaranHarianChart";
import { SelisihBadge } from "./SelisihBadge";
import { fetchAuditSuratKontrol, unduhEksporSuratKontrol, type JenisPilihan } from "./suratKontrol.client";

const PAGE_SIZE = 25;
type Tab = "daftar" | "bentrok";
type Urut = "prioritas" | "tanggal" | "selisih";

const awalBulan = (iso: string) => `${iso.slice(0, 8)}01`;
const akhirBulan = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).toISOString().slice(0, 10);

const PRESET = [
  { key: "bulan-ini", label: "Bulan ini", rentang: (t: string) => [awalBulan(t), akhirBulan(t)] },
  { key: "7-depan", label: "7 hari ke depan", rentang: (t: string) => [t, tambahHari(t, 6)] },
  { key: "7-lalu", label: "7 hari terakhir", rentang: (t: string) => [tambahHari(t, -6), t] },
  { key: "bulan-lalu", label: "Bulan lalu", rentang: (t: string) => { const a = awalBulan(tambahHari(awalBulan(t), -1)); return [a, akhirBulan(a)]; } },
] as const;

const JENIS_OPSI: { value: JenisPilihan; label: string }[] = [
  { value: "2", label: "Surat Kontrol" },
  { value: "1", label: "SPRI" },
  { value: "semua", label: "Semua" },
];

const URUT_OPSI: SelectOption[] = [
  { value: "prioritas", label: "Prioritas temuan" },
  { value: "tanggal", label: "Tanggal rencana" },
  { value: "selisih", label: "Selisih tanggal terbesar" },
];

const jamWita = (iso: string) => iso.slice(11, 16).replace(":", ".");

/**
 * Audit Surat Kontrol — surat BPJS (live) ↔ jadwal SIMRS ↔ catatan lokal.
 * Data satu rentang diambil sekali; saringan, cari, urut & paginasi di klien
 * (instan, tanpa memanggil BPJS ulang).
 */
export function AuditSuratKontrolView({ bolehEkspor }: { bolehEkspor: boolean }) {
  const hariIni = tanggalHariIniWita();
  const [from, setFrom] = useState(() => awalBulan(hariIni));
  const [to, setTo] = useState(() => akhirBulan(hariIni));
  const [jenis, setJenis] = useState<JenisPilihan>("2");
  const [status, setStatus] = useState<StatusAudit | "">("");
  const [temuan, setTemuan] = useState<TemuanKey | "">("");
  const [poli, setPoli] = useState("");
  const [tanggal, setTanggal] = useState<string | null>(null);
  const [qInput, setQInput] = useState("");
  const q = useDebounce(qInput.trim(), 250);
  const [urut, setUrut] = useState<Urut>("prioritas");
  const [tab, setTab] = useState<Tab>("daftar");
  const [page, setPage] = useState(1);
  const [pilihKey, setPilihKey] = useState<string | null>(null);
  const [terbuka, setTerbuka] = useState(false);
  const [mengekspor, setMengekspor] = useState(false);
  const [pesanEkspor, setPesanEkspor] = useState<{ ok: boolean; teks: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const segarRef = useRef(false);

  const data = useAsyncData<AuditSuratKontrol>(() => {
    const segar = segarRef.current;
    segarRef.current = false;
    return fetchAuditSuratKontrol({ from, to, jenis }, { segar });
  }, [from, to, jenis]);
  const d = data.result;

  // Setiap perubahan saringan → halaman 1 (tanpa effect).
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

  const semua = useMemo(() => d?.baris ?? [], [d]);
  const perKey = useMemo(() => new Map(semua.map((b) => [b.key, b])), [semua]);
  const cari = q || undefined;
  // Dasar ringkasan = saringan non-status (status/temuan dipilih DARI ringkasan ini).
  const dasar = useMemo(() => saringBaris(semua, { poli: poli || undefined, tanggal: tanggal ?? undefined, q: cari }), [semua, poli, tanggal, cari]);
  const r = useMemo(() => ringkas(dasar), [dasar]);
  const tampil = useMemo(() => {
    const x = saringBaris(dasar, { status: status || undefined, temuan: temuan || undefined });
    if (urut === "tanggal") return x.sort((a, b) => a.tglAcuan.localeCompare(b.tglAcuan) || a.key.localeCompare(b.key));
    if (urut === "selisih") return x.sort((a, b) => Math.abs(b.selisihHari ?? 0) - Math.abs(a.selisihHari ?? 0) || a.tglAcuan.localeCompare(b.tglAcuan));
    return urutkanBaris(x);
  }, [dasar, status, temuan, urut]);
  const harian = useMemo(
    () => (d ? ringkasPerHari(saringBaris(semua, { poli: poli || undefined, q: cari, status: status || undefined, temuan: temuan || undefined }), d.rentang.from, d.rentang.to) : []),
    [d, semua, poli, cari, status, temuan],
  );
  const perPoli = useMemo(() => ringkasPerPoli(saringBaris(semua, { tanggal: tanggal ?? undefined, q: cari })).slice(0, 6), [semua, tanggal, cari]);
  const slot = useMemo(() => {
    if (!d) return [];
    const keys = new Set(dasar.map((b) => b.key));
    return d.slot.filter((s) => s.keys.some((k) => keys.has(k)));
  }, [d, dasar]);
  const poliOpsi = useMemo<SelectOption[]>(
    () => [{ value: "", label: "Semua poli" }, ...[...new Set(semua.map((b) => b.poli).filter((p): p is string => !!p))].sort().map((p) => ({ value: p, label: p }))],
    [semua],
  );

  const totalPages = Math.max(1, Math.ceil(tampil.length / PAGE_SIZE));
  const halaman = Math.min(page, totalPages);
  const isiHalaman = tampil.slice((halaman - 1) * PAGE_SIZE, halaman * PAGE_SIZE);
  const pilih = pilihKey ? (perKey.get(pilihKey) ?? null) : null;
  const posisi = pilihKey ? tampil.findIndex((b) => b.key === pilihKey) : -1;
  const filterTampilan: FilterTampilan = { status: status || undefined, temuan: temuan || undefined, poli: poli || undefined, tanggal: tanggal ?? undefined, q: cari };
  const adaSaringan = !!(status || temuan || poli || tanggal || qInput);
  const presetAktif = PRESET.find((p) => { const [a, b] = p.rentang(hariIni); return a === from && b === to; })?.key;
  const batasDepan = tambahHari(hariIni, MAKS_HARI_KE_DEPAN);

  /** Pilih & buka perbandingan; halaman tabel ikut ke baris itu (bila tampil). */
  function pilihBaris(key: string) {
    setPilihKey(key);
    setTerbuka(true);
    if (tab !== "daftar") setTab("daftar");
    const i = tampil.findIndex((b) => b.key === key);
    if (i >= 0) setPage(Math.floor(i / PAGE_SIZE) + 1);
  }

  /** ↑/↓ di tabel: pindah fokus & sorotan baris (tanpa membuka drawer). */
  function pindah(delta: number) {
    const aktif = document.activeElement?.id?.startsWith("sk-") ? document.activeElement.id.slice(3) : pilihKey;
    const i = isiHalaman.findIndex((x) => x.key === aktif);
    const next = isiHalaman[i < 0 ? 0 : i + delta];
    if (next) {
      setPilihKey(next.key);
      document.getElementById(`sk-${next.key}`)?.focus();
    }
  }

  function reset() {
    setStatus("");
    setTemuan("");
    setPoli("");
    setTanggal(null);
    setQInput("");
    setUrut("prioritas");
    setPage(1);
  }

  async function ekspor() {
    setMengekspor(true);
    setPesanEkspor(null);
    try {
      const kode = await unduhEksporSuratKontrol({ from, to, jenis }, filterTampilan);
      setPesanEkspor({ ok: true, teks: `Berkas Excel diunduh${kode ? ` · kode ${kode}` : ""}.` });
    } catch (e) {
      setPesanEkspor({ ok: false, teks: e instanceof Error ? e.message : "Gagal mengekspor." });
    } finally {
      setMengekspor(false);
    }
  }

  return (
    <div ref={topRef} className="scroll-mt-4 space-y-4">
      {/* Saringan rentang & jenis */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[auto_300px_auto_minmax(0,1fr)]">
          <div className="min-w-0">
            <Label>Tanggal rencana</Label>
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
              {PRESET.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={presetAktif === p.key}
                  onClick={() => { const [a, b] = p.rentang(hariIni); ubahRentang(a, b); }}
                  className={cn(
                    "shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
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
              <Label htmlFor="sk-from">Dari</Label>
              <Input
                id="sk-from"
                type="date"
                value={from}
                max={batasDepan}
                onChange={(e) => e.target.value && ubahRentang(...jepitRentang(e.target.value, to, "from", batasDepan))}
              />
            </div>
            <div>
              <Label htmlFor="sk-to">Sampai</Label>
              <Input
                id="sk-to"
                type="date"
                value={to}
                min={from}
                max={batasDepan}
                onChange={(e) => e.target.value && ubahRentang(...jepitRentang(from, e.target.value, "to", batasDepan))}
              />
            </div>
          </div>
          <div>
            <Label>Jenis surat</Label>
            <div className="inline-flex h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 p-1" role="group" aria-label="Jenis surat">
              {JENIS_OPSI.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={jenis === o.value}
                  onClick={() => { setJenis(o.value); setPilihKey(null); setTanggal(null); setPage(1); }}
                  className={cn(
                    "flex-1 rounded-[var(--radius-sm)] px-3 text-sm font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    jenis === o.value ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0">
            <Label htmlFor="sk-q">Cari</Label>
            <InputWithIcon
              id="sk-q"
              icon={<Search className="size-4" />}
              placeholder="Surat, SEP, kartu, RM, nama…"
              aria-describedby="sk-q-bantuan"
              value={qInput}
              maxLength={80}
              onChange={ubah((e: React.ChangeEvent<HTMLInputElement>) => setQInput(e.target.value))}
            />
            <span id="sk-q-bantuan" className="sr-only">Cari nomor surat, SEP, nomor kartu BPJS, nomor RM, NOPEN, nama pasien atau dokter</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <SumberData d={d} loading={data.loading} onSegar={() => { segarRef.current = true; data.reload(); }} />
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
        {pesanEkspor && (
          <p role="status" className={cn("mt-2 text-xs", pesanEkspor.ok ? "text-success" : "text-danger")}>{pesanEkspor.teks}</p>
        )}
      </Card>

      {d?.sumber === "LOKAL" && (
        <div role="alert" className="flex gap-3 rounded-[var(--radius-lg)] border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-fg">
          <WifiOff className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="font-semibold">Data BPJS live tidak tersedia — memakai catatan penerbitan lokal SIMGOS</p>
            <p className="text-xs text-fg-muted">
              {d.galatBpjs} Temuan &ldquo;Catatan lokal beda&rdquo; & &ldquo;Belum dipakai&rdquo; tidak dapat dinilai, dan surat yang dibuat langsung di VClaim tidak terlihat. Coba segarkan beberapa saat lagi.
            </p>
          </div>
        </div>
      )}

      {data.loading && !d ? (
        <MemuatBpjs />
      ) : data.error && !d ? (
        <Card><ErrorState description="Gagal memuat audit surat kontrol. Periksa koneksi ke SIMGOS lalu coba lagi." onRetry={data.reload} /></Card>
      ) : d ? (
        <div className={cn("space-y-4 transition-opacity", data.loading && "pointer-events-none opacity-60")} aria-busy={data.loading}>
          {/* Ringkasan status (klik = saring) */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Ubin label="Total surat" nilai={r.total} ikon={ListChecks} catatan={`${formatDate(d.rentang.from)} – ${formatDate(d.rentang.to)}`} aktif={!status} onClick={ubah(() => setStatus(""))} />
            <UbinKesesuaian persen={r.kesesuaian} sesuai={r.perStatus.SESUAI} total={r.total} aktif={status === "SESUAI"} onClick={ubah(() => setStatus(status === "SESUAI" ? "" : "SESUAI"))} />
            <Ubin label="Bermasalah" nilai={r.perStatus.MASALAH} ikon={ShieldAlert} nada="danger" catatan="Tanggal beda / tak ada di BPJS" aktif={status === "MASALAH"} onClick={ubah(() => setStatus(status === "MASALAH" ? "" : "MASALAH"))} />
            <Ubin label="Perlu ditinjau" nilai={r.perStatus.TINJAU} ikon={AlertTriangle} nada="warning" catatan="Tanpa jadwal, batal, poli, bridging" aktif={status === "TINJAU"} onClick={ubah(() => setStatus(status === "TINJAU" ? "" : "TINJAU"))} />
            <Ubin label="Jam bentrok" nilai={slot.length} ikon={Clock3} nada="accent" catatan={`${formatNumber(r.perTemuan.JAM_BENTROK)} jadwal di slot padat`} satuan="slot" aktif={tab === "bentrok"} onClick={() => setTab(tab === "bentrok" ? "daftar" : "bentrok")} />
          </div>

          {/* Saringan temuan */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Saring menurut temuan">
            <span className="text-xs font-medium text-fg-muted">Temuan:</span>
            {TEMUAN_KEYS.filter((t) => r.perTemuan[t] > 0 || temuan === t).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={temuan === t}
                title={TEMUAN[t].jelas}
                onClick={ubah(() => setTemuan(temuan === t ? "" : t))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                  temuan === t ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
                )}
              >
                <span className={cn("size-1.5 rounded-full", TITIK[TEMUAN[t].nada])} aria-hidden />
                {TEMUAN[t].label}
                <span className="tabular text-fg-subtle">{formatNumber(r.perTemuan[t])}</span>
              </button>
            ))}
            {TEMUAN_KEYS.every((t) => r.perTemuan[t] === 0) && <span className="text-xs text-fg-subtle">tidak ada temuan</span>}
          </div>

          {/* Grafik & per poli */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="min-w-0 p-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-fg">Sebaran per tanggal rencana</h2>
                <span className="text-[11px] text-fg-subtle">titik = hari ini</span>
              </div>
              <SebaranHarianChart data={harian} hariIni={d.hariIni} aktif={tanggal} onPilih={(t) => { setTanggal(t); setPage(1); }} />
            </Card>
            <Card className="p-4">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-fg">Per poli tujuan</h2>
                {poli && (
                  <button type="button" className="text-[11px] font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring" onClick={ubah(() => setPoli(""))}>
                    Lepas
                  </button>
                )}
              </div>
              {perPoli.length === 0 ? (
                <p className="py-6 text-center text-xs text-fg-subtle">Tidak ada data.</p>
              ) : (
                <ul className="space-y-1">
                  {perPoli.map((p) => (
                    <li key={p.poli}>
                      <button
                        type="button"
                        aria-pressed={poli === p.poli}
                        onClick={ubah(() => setPoli(poli === p.poli ? "" : p.poli))}
                        className={cn(
                          "w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                          poli === p.poli ? "bg-brand-soft" : "hover:bg-surface-2/60",
                        )}
                      >
                        <span className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-fg">{p.poli}</span>
                          <span className="shrink-0 tabular text-fg-muted">
                            {p.masalah + p.tinjau > 0 && <b className="text-danger">{formatNumber(p.masalah + p.tinjau)}</b>}
                            {p.masalah + p.tinjau > 0 && " / "}
                            {formatNumber(p.total)}
                          </span>
                        </span>
                        <span className="flex h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <span className="bg-danger" style={{ width: `${(p.masalah / p.total) * 100}%` }} />
                          <span className="bg-warning" style={{ width: `${(p.tinjau / p.total) * 100}%` }} />
                          <span className="bg-success/70" style={{ width: `${((p.total - p.masalah - p.tinjau) / p.total) * 100}%` }} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-fg-subtle">Angka merah = bermasalah + perlu ditinjau / total.</p>
            </Card>
          </div>

          {/* Tab daftar / jam bentrok */}
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Tampilan audit" className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
              {([
                { key: "daftar", label: "Daftar surat", n: tampil.length },
                { key: "bentrok", label: "Jam bentrok", n: slot.length },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    tab === t.key ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {t.label}
                  <span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular text-fg-muted">{formatNumber(t.n)}</span>
                </button>
              ))}
            </div>
            {tab === "daftar" && (
              <div className="ml-auto flex items-center gap-2">
                <Label htmlFor="sk-poli" className="sr-only">Poli</Label>
                <Select id="sk-poli" className="w-44" value={poli} onChange={ubah(setPoli)} options={poliOpsi} />
                <Label htmlFor="sk-urut" className="sr-only">Urutkan</Label>
                <Select id="sk-urut" className="w-52" value={urut} onChange={ubah((v: string) => setUrut(v as Urut))} options={URUT_OPSI} />
              </div>
            )}
          </div>

          {tab === "bentrok" ? (
            <Card className="overflow-hidden">
              <JamBentrokView slot={slot} semua={perKey} onPilih={pilihBaris} />
            </Card>
          ) : (
            <Card className="min-w-0 overflow-hidden">
                {tampil.length === 0 ? (
                  <EmptyState
                    title={semua.length === 0 ? "Tidak ada surat pada rentang ini" : "Tidak ada surat yang cocok"}
                    description={semua.length === 0 ? "BPJS tidak mencatat surat dengan tanggal rencana di rentang ini." : "Ubah atau atur ulang saringan untuk melihat surat lain."}
                    action={adaSaringan ? <Button variant="secondary" size="sm" onClick={reset}>Atur ulang saringan</Button> : undefined}
                  />
                ) : (
                  <>
                    <div className="relative overflow-x-auto">
                      <table className="w-full min-w-[780px] text-sm">
                        <thead>
                          <tr className="border-b border-border bg-surface-2/50 text-left text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
                            <th scope="col" className="px-4 py-2">Surat</th>
                            <th scope="col" className="px-2 py-2">Pasien</th>
                            <th scope="col" className="px-2 py-2">Poli · dokter</th>
                            <th scope="col" className="px-2 py-2">Rencana BPJS</th>
                            <th scope="col" className="px-2 py-2">Jadwal SIMRS</th>
                            <th scope="col" className="px-4 py-2">Temuan</th>
                          </tr>
                        </thead>
                        <tbody
                          className="divide-y divide-border"
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                              e.preventDefault();
                              pindah(e.key === "ArrowDown" ? 1 : -1);
                            }
                          }}
                        >
                          {isiHalaman.map((b) => (
                            <Baris key={b.key} b={b} aktif={pilihKey === b.key} sorot={temuan || null} onPilih={() => pilihBaris(b.key)} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
                      <p className="text-xs text-fg-muted">
                        <b className="tabular text-fg">{formatNumber((halaman - 1) * PAGE_SIZE + 1)}–{formatNumber((halaman - 1) * PAGE_SIZE + isiHalaman.length)}</b> dari{" "}
                        <b className="tabular text-fg">{formatNumber(tampil.length)}</b>
                        {d.nonBpjsDilewati > 0 && <> · {formatNumber(d.nonBpjsDilewati)} jadwal non-BPJS tidak diaudit</>}
                        <span className="hidden sm:inline"> · ↑/↓ berpindah baris, Enter membuka perbandingan</span>
                      </p>
                      <NumberedPagination
                        page={halaman}
                        totalPages={totalPages}
                        onPageChange={(p) => {
                          setPage(p);
                          topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      />
                    </div>
                  </>
                )}
            </Card>
          )}
        </div>
      ) : null}

      <Drawer
        open={terbuka && !!pilih}
        onClose={() => setTerbuka(false)}
        title="Perbandingan surat"
        size="md"
        header={
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <p className="truncate text-sm font-semibold text-fg" aria-hidden>Perbandingan surat</p>
            {posisi >= 0 && (
              <span className="ml-auto flex shrink-0 items-center gap-1">
                <span className="mr-1 text-[11px] text-fg-muted tabular">{formatNumber(posisi + 1)} / {formatNumber(tampil.length)}</span>
                <Button variant="ghost" size="sm" className="px-2" aria-label="Surat sebelumnya" disabled={posisi <= 0} onClick={() => pilihBaris(tampil[posisi - 1].key)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" className="px-2" aria-label="Surat berikutnya" disabled={posisi >= tampil.length - 1} onClick={() => pilihBaris(tampil[posisi + 1].key)}>
                  <ChevronRight className="size-4" />
                </Button>
              </span>
            )}
          </div>
        }
      >
        <div className="p-5">
          <DetailSurat b={pilih} semua={perKey} onPilih={pilihBaris} />
        </div>
      </Drawer>
    </div>
  );
}

const TITIK: Record<string, string> = { danger: "bg-danger", warning: "bg-warning", accent: "bg-accent", neutral: "bg-fg-subtle", success: "bg-success" };

function SumberData({ d, loading, onSegar }: { d: AuditSuratKontrol | null; loading: boolean; onSegar: () => void }) {
  if (!d) return <p className="text-xs text-fg-muted">{loading ? "Mengambil data dari BPJS…" : "—"}</p>;
  const live = d.sumber === "LIVE";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium", live ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
        {live ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
        {live ? "BPJS live" : "Cadangan lokal"}
      </span>
      <span>
        diambil {jamWita(d.diambil)} WITA{d.dariCache ? " (tersimpan sementara)" : ""}
      </span>
      <span aria-hidden>·</span>
      <CalendarRange className="size-3.5" />
      <span>{formatDate(d.rentang.from)} – {formatDate(d.rentang.to)}</span>
      <button
        type="button"
        onClick={onSegar}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5 font-medium text-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-50"
      >
        <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Segarkan dari BPJS
      </button>
    </div>
  );
}

function Ubin({
  label,
  nilai,
  ikon: Ikon,
  nada,
  catatan,
  satuan,
  aktif,
  onClick,
}: {
  label: string;
  nilai: number;
  ikon: typeof ListChecks;
  nada?: "danger" | "warning" | "accent";
  catatan: string;
  satuan?: string;
  aktif: boolean;
  onClick: () => void;
}) {
  const warna = nada === "danger" ? "text-danger bg-danger-soft" : nada === "warning" ? "text-warning bg-warning-soft" : nada === "accent" ? "text-accent bg-accent-soft" : "text-brand bg-brand-soft";
  return (
    <button
      type="button"
      aria-pressed={aktif}
      onClick={onClick}
      className={cn(
        "rounded-[var(--radius-lg)] border bg-surface p-3 text-left shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        aktif ? "border-brand ring-1 ring-brand/30" : "border-border hover:border-border-strong",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-fg-muted">{label}</span>
        <span className={cn("grid size-7 place-items-center rounded-[var(--radius-sm)]", warna)}><Ikon className="size-4" /></span>
      </span>
      <span className="mt-1 block text-2xl font-semibold tracking-tight text-fg tabular">
        {formatNumber(nilai)}
        {satuan && <span className="ml-1 text-xs font-medium text-fg-muted">{satuan}</span>}
      </span>
      <span className="block truncate text-[11px] text-fg-subtle">{catatan}</span>
    </button>
  );
}

function UbinKesesuaian({ persen, sesuai, total, aktif, onClick }: { persen: number | null; sesuai: number; total: number; aktif: boolean; onClick: () => void }) {
  const p = persen ?? 0;
  const R = 15;
  const K = 2 * Math.PI * R;
  return (
    <button
      type="button"
      aria-pressed={aktif}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-lg)] border bg-surface p-3 text-left shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        aktif ? "border-brand ring-1 ring-brand/30" : "border-border hover:border-border-strong",
      )}
    >
      <svg width={44} height={44} viewBox="0 0 40 40" className="shrink-0 -rotate-90" aria-hidden>
        <circle cx={20} cy={20} r={R} fill="none" stroke="var(--chart-track)" strokeWidth={5} />
        <circle cx={20} cy={20} r={R} fill="none" stroke="var(--success)" strokeWidth={5} strokeLinecap="round" strokeDasharray={`${(p / 100) * K} ${K}`} />
      </svg>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-fg-muted">Kesesuaian</span>
        <span className="block text-2xl font-semibold tracking-tight text-fg tabular">{persen == null ? "—" : `${String(p).replace(".", ",")}%`}</span>
        <span className="block truncate text-[11px] text-fg-subtle">{formatNumber(sesuai)} dari {formatNumber(total)} sesuai</span>
      </span>
    </button>
  );
}

function Baris({ b, aktif, sorot, onPilih }: { b: SuratKontrolBaris; aktif: boolean; sorot: TemuanKey | null; onPilih: () => void }) {
  // Urutan lencana: temuan yang sedang disaring → temuan berat → info.
  const peringkat = (t: TemuanKey) => (t === sorot ? 0 : TEMUAN[t].berat === "info" ? 2 : 1);
  const tampilTemuan = [...b.temuan].sort((x, y) => peringkat(x) - peringkat(y)).slice(0, 2);
  const sisa = b.temuan.length - tampilTemuan.length;
  return (
    <tr onClick={onPilih} aria-selected={aktif} className={cn("cursor-pointer transition-colors", aktif ? "bg-brand-soft" : "hover:bg-surface-2/50")}>
      <td className="px-4 py-2 align-top">
        <button
          id={`sk-${b.key}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPilih();
          }}
          className="flex items-start gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          aria-label={`Bandingkan ${b.noSurat ?? "jadwal tanpa surat"} ${b.pasien ?? ""}`}
        >
          <CircleDot className={cn("mt-0.5 size-3.5 shrink-0", b.status === "MASALAH" ? "text-danger" : b.status === "TINJAU" ? "text-warning" : "text-success")} aria-label={STATUS_AUDIT[b.status].label} />
          <span>
            <span className="block font-mono text-[11px] text-fg">{b.noSurat ?? "— belum terbit —"}</span>
            <span className="block text-[10px] whitespace-nowrap text-fg-subtle">{JENIS_KONTROL[b.jenis].label}{b.bpjs?.tglTerbit ? ` · terbit ${formatDate(b.bpjs.tglTerbit)}` : ""}</span>
          </span>
        </button>
      </td>
      <td className="px-2 py-2 align-top">
        <span className="block max-w-44 truncate text-xs font-medium text-fg" title={b.pasien ?? undefined}>{b.pasien ?? "Tanpa nama"}</span>
        <span className="block font-mono text-[10px] text-fg-subtle">
          {b.simrs?.kunjungan?.norm ? `RM ${b.simrs.kunjungan.norm}` : b.bpjs?.noKartu ? `Kartu ${b.bpjs.noKartu}` : "—"}
        </span>
      </td>
      <td className="px-2 py-2 align-top">
        <span className="block max-w-40 truncate text-xs text-fg" title={b.poli ?? undefined}>{b.poli ?? "—"}</span>
        <span className="block max-w-40 truncate text-[10px] text-fg-muted" title={b.dokter ?? undefined}>{b.dokter ?? "—"}</span>
      </td>
      <td className="px-2 py-2 align-top text-xs whitespace-nowrap text-fg tabular">
        {b.bpjs ? formatDate(b.bpjs.tglRencana) : <span className="text-fg-subtle">—</span>}
        {b.bpjs?.sepTerbit === true && <span className="block text-[10px] text-success">SEP kontrol terbit</span>}
      </td>
      <td className="px-2 py-2 align-top text-xs whitespace-nowrap tabular">
        {b.simrs ? (
          <>
            <span className={cn(b.simrs.aktif ? "text-fg" : "text-fg-subtle line-through")}>{formatDate(b.simrs.tanggal)}</span>
            {b.simrs.jam && <span className="ml-1 font-mono text-[10px] text-fg-muted">{b.simrs.jam.replace(":", ".")}</span>}
            {b.selisihHari !== null && b.selisihHari !== 0 && <SelisihBadge hari={b.selisihHari} className="ml-1.5" />}
          </>
        ) : (
          <span className="text-fg-subtle">tidak ada</span>
        )}
      </td>
      <td className="px-4 py-2 align-top">
        {b.temuan.length === 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3.5" /> Sesuai</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {tampilTemuan.map((t) => (
              <Badge key={t} tone={TEMUAN[t].nada} className="px-1.5 text-[10px]">{TEMUAN[t].label}</Badge>
            ))}
            {sisa > 0 && <span className="text-[10px] text-fg-subtle">+{sisa}</span>}
          </span>
        )}
      </td>
    </tr>
  );
}

function MemuatBpjs() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-[var(--radius-lg)]" />)}
      </div>
      <Card className="flex items-center gap-3 p-4 text-sm text-fg-muted">
        <RefreshCw className="size-4 animate-spin text-brand" />
        Mengambil Surat Kontrol & SPRI dari BPJS lalu mencocokkan dengan jadwal SIMRS…
      </Card>
      <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
    </div>
  );
}
