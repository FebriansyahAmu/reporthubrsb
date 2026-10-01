"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BellRing, CheckCheck, Clock, GitMerge, RefreshCw, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { NumberedPagination } from "@/components/ui/NumberedPagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDate, formatJam, formatNumber, toLocalDateInput } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import {
  BATAS,
  KATEGORI,
  KATEGORI_LABEL,
  type Kategori,
  type StatusVerifikasi,
} from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { getAturanKoding } from "@/server/modules/verifikasi-klaim/koding.rules";
import { getAturan } from "@/server/modules/verifikasi-klaim/verifikasi.rules";
import type { AntreanItem, AntreanResult } from "@/server/modules/verifikasi-klaim/verifikasi.types";
import { LoloskanMassalModal } from "./LoloskanMassalModal";
import { MeterKelengkapan } from "./MeterKelengkapan";
import { PitaStatus } from "./PitaStatus";
import { RuangKerjaDrawer } from "./RuangKerjaDrawer";
import { StatusVerifikasiBadge } from "./status-ui";

/* ------------------------------------------------------------------ periode */

const DAY = 86_400_000;
/** `YYYY-MM-DD` mundur n hari (kalender, murni — tanpa jam sekarang). */
const mundur = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
const PRESET = [
  { hari: 7, label: "7 hari" },
  { hari: 14, label: "14 hari" },
  { hari: 31, label: "31 hari" },
] as const;
const selisih = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

type Filter = {
  from: string;
  to: string;
  cakupan: "bpjs" | "semua";
  kategori: Kategori | "";
  ruangan: string;
  q: string;
  status: StatusVerifikasi | "";
  masalah: string;
  lengkap: "" | "ya";
  siap: boolean;
  /** Hanya Lolos RM tanpa aturan koding yang gagal. */
  kodingBersih: boolean;
  page: number;
};

function params(f: Filter, segar: boolean): URLSearchParams {
  const p = new URLSearchParams({ from: f.from, to: f.to, cakupan: f.cakupan, page: String(f.page), pageSize: "25" });
  if (f.kategori) p.set("kategori", f.kategori);
  if (f.ruangan) p.set("ruangan", f.ruangan);
  if (f.q) p.set("q", f.q);
  if (f.status) p.set("status", f.status);
  if (f.masalah) p.set("masalah", f.masalah);
  if (f.lengkap) p.set("lengkap", f.lengkap);
  if (f.siap) p.set("siap", "1");
  if (f.kodingBersih) p.set("koding", "bersih");
  if (segar) p.set("segar", "1");
  return p;
}

/* --------------------------------------------------------------------- view */

export function VerifikasiView({
  bolehRm,
  bolehCoder,
  bolehPaket,
  nopenAwal,
}: {
  bolehRm: boolean;
  bolehCoder: boolean;
  bolehPaket: boolean;
  nopenAwal: string | null;
}) {
  const [hariIni] = useState(() => toLocalDateInput(new Date()));
  const [f, setF] = useState<Filter>(() => ({
    from: mundur(hariIni, 6),
    to: hariIni,
    cakupan: "bpjs",
    kategori: "",
    ruangan: "",
    q: "",
    // Tanpa izin RM langsung ke pekerjaannya: coder → Lolos RM, petugas paket → Siap Final.
    status: bolehRm ? "" : bolehCoder ? "LOLOS_RM" : bolehPaket ? "LOLOS_KLAIM" : "",
    masalah: "",
    lengkap: "",
    siap: false,
    kodingBersih: false,
    page: 1,
  }));
  const [cari, setCari] = useState("");
  const q = useDebounce(cari.trim(), 350);
  const [segar, setSegar] = useState(0);
  const [buka, setBuka] = useState<string | null>(nopenAwal);
  // `?nopen=` bisa berubah tanpa memuat ulang halaman (klik notifikasi di halaman ini) → buka berkasnya.
  const nopenParam = useSearchParams().get("nopen");
  const [paramTerakhir, setParamTerakhir] = useState(nopenParam);
  if (nopenParam !== paramTerakhir) {
    setParamTerakhir(nopenParam);
    if (nopenParam && /^\d{6,20}$/.test(nopenParam)) setBuka(nopenParam);
  }
  const [aktif, setAktif] = useState(0);
  const [massal, setMassal] = useState(false);
  const barisRef = useRef<Map<number, HTMLElement>>(new Map());

  const rentangSalah =
    f.from > f.to ? "Tanggal awal melebihi tanggal akhir." : selisih(f.from, f.to) >= BATAS.RENTANG_MAKS_HARI ? `Rentang maksimal ${BATAS.RENTANG_MAKS_HARI} hari.` : null;

  const fq = { ...f, q };
  const segarRef = useRef(false);
  const { result, loading, error, reload } = useAsyncData<AntreanResult | null>(
    () => {
      if (rentangSalah) return Promise.resolve(null);
      const s = segarRef.current;
      segarRef.current = false;
      return apiGet<AntreanResult>(`/api/berkas-klaim/verifikasi?${params(fq, s).toString()}`);
    },
    [f.from, f.to, f.cakupan, f.kategori, f.ruangan, q, f.status, f.masalah, f.lengkap, f.siap, f.kodingBersih, f.page, segar],
  );

  const ubah = (patch: Partial<Filter>) => {
    setF((cur) => ({ ...cur, ...patch, page: patch.page ?? 1 }));
    setAktif(0);
  };

  function muatSegar() {
    segarRef.current = true;
    setSegar((n) => n + 1);
  }

  const items = useMemo(() => result?.items ?? [], [result]);
  const totalPages = result ? Math.max(1, Math.ceil(result.filtered / result.pageSize)) : 1;

  // Navigasi keyboard daftar (PRD §6.2): ↑/↓ pindah, Enter buka ruang kerja.
  useEffect(() => {
    if (buka || massal) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || el?.closest("input, textarea, select, [role=listbox], [role=dialog]")) return;
      if (items.length === 0) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setAktif((i) => {
          const n = Math.min(items.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)));
          barisRef.current.get(n)?.scrollIntoView({ block: "nearest" });
          return n;
        });
      } else if (e.key === "Enter" && !el?.closest("button, a")) {
        e.preventDefault();
        const it = items[aktif];
        if (it) setBuka(it.nopen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, aktif, buka, massal]);

  const r = result?.ringkasan;
  const teratas = (x: Record<string, number>) =>
    Object.entries(x)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  const masalahTeratas = r ? teratas(r.perAturan) : [];
  const masalahKoding = r ? teratas(r.perAturanKoding) : [];
  const adaPekerjaanCoder = !!r && r.perStatus.LOLOS_RM + r.perStatus.KOREKSI_KODING > 0;
  const bisaMassal = bolehRm && (r?.lengkapOtomatis ?? 0) > 0;
  const ubahFilter =
    f.kategori || f.ruangan || cari || f.status || f.masalah || f.lengkap || f.siap || f.kodingBersih || f.cakupan !== "bpjs";

  return (
    <div className="space-y-5">
      {/* Status data & aksi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <Clock className="size-4" aria-hidden />
          {result ? (
            <span className="tabular">
              Data SIMRS pukul {formatJam(result.meta.dihitungPada)}
              {result.meta.digabung > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-fg-subtle">
                  <GitMerge className="size-3.5" aria-hidden />
                  {formatNumber(result.meta.digabung)} episode IGD digabung ke Rawat Inap
                </span>
              )}
            </span>
          ) : (
            <span>{loading ? "Memuat…" : "—"}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />}
            onClick={muatSegar}
            disabled={loading || !!rentangSalah}
          >
            Muat ulang dari SIMRS
          </Button>
          {bolehRm && (
            <Button
              size="sm"
              icon={<CheckCheck className="size-4" aria-hidden />}
              onClick={() => setMassal(true)}
              disabled={!bisaMassal || loading}
              title={bisaMassal ? undefined : "Tidak ada berkas Belum Diperiksa yang lengkap otomatis"}
            >
              Loloskan {formatNumber(r?.lengkapOtomatis ?? 0)} lengkap otomatis
            </Button>
          )}
        </div>
      </div>

      {/* Filter */}
      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Tanggal pulang</Label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-[10.5rem]">
                <DatePicker value={f.from} onChange={(v) => ubah({ from: v })} max={f.to || undefined} clearable={false} />
              </div>
              <span className="text-fg-subtle">–</span>
              <div className="w-[10.5rem]">
                <DatePicker value={f.to} onChange={(v) => ubah({ to: v })} min={f.from || undefined} clearable={false} />
              </div>
              {PRESET.map((p) => (
                <Chip
                  key={p.hari}
                  aktif={f.from === mundur(hariIni, p.hari - 1) && f.to === hariIni}
                  onClick={() => ubah({ from: mundur(hariIni, p.hari - 1), to: hariIni })}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor="vk-cari">Cari</Label>
            <InputWithIcon
              id="vk-cari"
              icon={<Search className="size-4" aria-hidden />}
              placeholder="Nama, No. RM, NOPEN, atau SEP"
              value={cari}
              maxLength={60}
              onChange={(e) => {
                setCari(e.target.value);
                setF((cur) => ({ ...cur, page: 1 }));
              }}
            />
          </div>
        </div>
        {rentangSalah && <p className="text-xs text-danger">{rentangSalah}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Jenis layanan</Label>
            <div role="group" aria-label="Jenis layanan" className="flex flex-wrap gap-1.5">
              <Chip aktif={!f.kategori} onClick={() => ubah({ kategori: "" })}>Semua</Chip>
              {KATEGORI.map((k) => (
                <Chip key={k} aktif={f.kategori === k} onClick={() => ubah({ kategori: k })}>
                  {k}
                  {r && <span className="ml-1 tabular text-fg-subtle">{r.perKategori[k]}</span>}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="vk-ruang">Ruangan</Label>
            <Select
              id="vk-ruang"
              value={f.ruangan}
              onChange={(v) => ubah({ ruangan: v })}
              options={[
                { value: "", label: "Semua ruangan" },
                ...(result?.opsi.ruang ?? []).map((x) => ({ value: x.id, label: `${x.nama} (${x.n})` })),
              ]}
            />
          </div>
          <div>
            <Label htmlFor="vk-penjamin">Penjamin</Label>
            <Select
              id="vk-penjamin"
              value={f.cakupan}
              onChange={(v) => ubah({ cakupan: v === "semua" ? "semua" : "bpjs" })}
              options={[
                { value: "bpjs", label: "BPJS / JKN" },
                { value: "semua", label: "Semua penjamin" },
              ]}
            />
          </div>
          <div className="flex items-end">
            {ubahFilter && (
              <button
                type="button"
                onClick={() => {
                  setCari("");
                  ubah({ kategori: "", ruangan: "", status: "", masalah: "", lengkap: "", siap: false, kodingBersih: false, cakupan: "bpjs" });
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Reset filter
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Pita tahap */}
      <PitaStatus
        ringkasan={r ?? null}
        aktif={f.status}
        siapAktif={f.siap}
        onPilih={(s) => ubah({ status: s, siap: false })}
        onSiap={() => ubah({ siap: !f.siap, status: f.siap ? "" : "TIDAK_LENGKAP" })}
      />

      {/* Chip masalah */}
      {r && (masalahTeratas.length > 0 || r.lengkapOtomatis > 0) && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Saring berdasarkan masalah kelengkapan">
          <span className="mr-1 w-20 text-xs font-medium text-fg-muted">Kelengkapan:</span>
          {masalahTeratas.map(([key, n]) => (
            <Chip key={key} aktif={f.masalah === key} onClick={() => ubah({ masalah: f.masalah === key ? "" : key })} tone="danger">
              {getAturan(key)?.label ?? key}
              <span className="ml-1 tabular">{n}</span>
            </Chip>
          ))}
          <Chip aktif={f.lengkap === "ya"} onClick={() => ubah({ lengkap: f.lengkap === "ya" ? "" : "ya" })} tone="success">
            Lengkap otomatis
          </Chip>
        </div>
      )}
      {r && adaPekerjaanCoder && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Saring berdasarkan masalah koding">
          <span className="mr-1 w-20 text-xs font-medium text-fg-muted">Koding:</span>
          {masalahKoding.map(([key, n]) => (
            <Chip key={key} aktif={f.masalah === key} onClick={() => ubah({ masalah: f.masalah === key ? "" : key })} tone="danger">
              {getAturanKoding(key)?.label ?? key}
              <span className="ml-1 tabular">{n}</span>
            </Chip>
          ))}
          <Chip
            aktif={f.kodingBersih}
            onClick={() => ubah({ kodingBersih: !f.kodingBersih, status: f.kodingBersih ? f.status : "LOLOS_RM" })}
            tone="success"
          >
            Koding sesuai aturan
            <span className="ml-1 tabular">{r.kodingBersih}</span>
          </Chip>
        </div>
      )}

      {/* Daftar */}
      <Card className="overflow-hidden p-0">
        {rentangSalah ? (
          <EmptyState title="Periode belum valid" description={rentangSalah} />
        ) : loading && !result ? (
          <DaftarSkeleton />
        ) : error || !result ? (
          <ErrorState onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Tidak ada berkas"
            description={
              ubahFilter
                ? "Tidak ada berkas yang cocok dengan filter ini. Lepas filter atau ubah rentang tanggal pulang."
                : "Belum ada episode final dengan tanggal pulang pada rentang ini."
            }
          />
        ) : (
          <div className={cn(loading && "opacity-60 transition-opacity")} aria-busy={loading}>
            <DaftarBerkas items={items} aktif={aktif} onBuka={(i) => { setAktif(i); setBuka(items[i].nopen); }} barisRef={barisRef} />
          </div>
        )}
      </Card>

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-fg-subtle">
            {formatNumber(result.filtered)} berkas · <kbd className="rounded border border-border px-1">↑</kbd>
            <kbd className="ml-0.5 rounded border border-border px-1">↓</kbd> pilih, <kbd className="rounded border border-border px-1">Enter</kbd> buka
          </p>
          <NumberedPagination page={f.page} totalPages={totalPages} onPageChange={(p) => ubah({ page: p })} disabled={loading} />
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
        <ShieldCheck className="size-3.5" aria-hidden />
        Data SIMRS hanya dibaca. Keputusan, tindak lanjut & riwayat disimpan di aplikasi ini.
      </p>

      <RuangKerjaDrawer
        nopen={buka}
        onClose={() => {
          setBuka(null);
          // Lepas `?nopen=` agar tautan notifikasi yang sama bisa membuka lagi & muat ulang tak membuka otomatis.
          if (nopenParam) window.history.replaceState(window.history.state, "", window.location.pathname);
        }}
        onBerubah={reload}
      />
      <LoloskanMassalModal
        open={massal}
        onClose={() => setMassal(false)}
        jumlah={r?.lengkapOtomatis ?? 0}
        filter={{
          from: f.from,
          to: f.to,
          cakupan: f.cakupan,
          ...(f.kategori ? { kategori: f.kategori } : {}),
          ...(f.ruangan ? { ruangan: f.ruangan } : {}),
          ...(q ? { q } : {}),
        }}
        onSelesai={reload}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- daftar */

const umurAntrean = (pulang: string | null, now: number) =>
  pulang ? Math.max(0, Math.floor((now - new Date(pulang).getTime()) / DAY)) : null;

function DaftarBerkas({
  items,
  aktif,
  onBuka,
  barisRef,
}: {
  items: AntreanItem[];
  aktif: number;
  onBuka: (i: number) => void;
  barisRef: React.RefObject<Map<number, HTMLElement>>;
}) {
  const [now] = useState(() => Date.now());
  return (
    <ul className="divide-y divide-border" aria-label="Antrean berkas klaim">
      <li className="hidden grid-cols-[minmax(0,2.1fr)_minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.8fr)_minmax(0,1.4fr)] gap-3 bg-surface-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted lg:grid">
        <span>Pasien</span>
        <span>Layanan</span>
        <span>Pulang</span>
        <span>Kelengkapan</span>
        <span>Masalah</span>
        <span>Status</span>
      </li>
      {items.map((it, i) => {
        const umur = umurAntrean(it.pulang, now);
        return (
          <li key={it.nopen}>
            <button
              type="button"
              ref={(el) => {
                if (el) barisRef.current.set(i, el);
                else barisRef.current.delete(i);
              }}
              onClick={() => onBuka(i)}
              aria-current={i === aktif ? "true" : undefined}
              className={cn(
                "grid w-full grid-cols-1 gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring",
                "lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.8fr)_minmax(0,1.4fr)] lg:items-center lg:gap-3",
                i === aktif && "bg-brand-soft/40 shadow-[inset_3px_0_0_var(--brand)]",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-fg">{it.nama}</span>
                <span className="block truncate text-[11px] text-fg-subtle">
                  RM {it.norm} · <span className="font-mono">{it.nopen}</span>
                  {it.sep ? ` · SEP ${it.sep}` : " · tanpa SEP"}
                </span>
              </span>
              <span className="min-w-0 text-sm text-fg-muted">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Badge tone={it.kategori === "RI" ? "brand" : it.kategori === "IGD" ? "danger" : "neutral"} className="shrink-0 px-1.5 py-0 text-[10px]">
                    {it.kategori}
                  </Badge>
                  <span className="truncate" title={it.ruang ?? undefined}>{it.ruang ?? KATEGORI_LABEL[it.kategori]}</span>
                </span>
                {it.asalNopen && (
                  <span className="block truncate text-[11px] text-fg-subtle">
                    <GitMerge className="mr-0.5 inline size-3" aria-hidden />+ IGD {it.asalNopen}
                  </span>
                )}
              </span>
              <span className="text-sm text-fg-muted">
                <span className="block whitespace-nowrap tabular">{it.pulang ? formatDate(it.pulang) : "—"}</span>
                {it.kategori === "RI" && <span className="block text-[11px] text-fg-subtle">{it.lamaRawat} hari rawat</span>}
              </span>
              <MeterKelengkapan lolos={it.cek.lolos} peringatan={it.cek.peringatan} gagal={it.cek.gagal} total={it.cek.total} />
              <SelMasalah it={it} />
              <span className="flex flex-wrap items-center gap-1.5">
                <StatusVerifikasiBadge status={it.status} />
                {it.tl.open > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-warning" title="Tindak lanjut terbuka">
                    <BellRing className="size-3" aria-hidden />
                    {it.tl.open}
                  </span>
                )}
                {it.status === "TIDAK_LENGKAP" && it.tl.total > 0 && it.tl.open === 0 && (
                  <span className="text-[11px] font-medium text-success">siap diperiksa ulang</span>
                )}
                {umur != null && <span className="w-full text-[11px] text-fg-subtle">{umur} hari di antrean</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Masalah tahap berkas saat ini: kelengkapan (Tahap 1) atau koding (Tahap 2). */
function SelMasalah({ it }: { it: AntreanItem }) {
  if (it.status === "KOREKSI_KODING" && it.koreksi) {
    const selesai = it.koreksi.perubahan - it.koreksi.sisa;
    return (
      <span className="text-xs text-warning">
        Menunggu SIMRS · {selesai}/{it.koreksi.perubahan} langkah sesuai
      </span>
    );
  }
  if (it.status === "FINAL") {
    return (
      <span className="text-xs text-success">
        Paket final{it.paket ? ` · v${it.paket.versi} · ${it.paket.halaman} hal` : ""}
      </span>
    );
  }
  if (it.status === "LOLOS_KLAIM") {
    return it.paket ? (
      <span className="text-xs text-fg-muted">
        Draf paket v{it.paket.versi} · {it.paket.halaman} hal — belum dikunci
      </span>
    ) : (
      <span className="text-xs text-fg-subtle">Paket belum digabung</span>
    );
  }
  const tahap2 = it.status === "LOLOS_RM";
  const masalah = (tahap2 ? it.koding.masalah : it.cek.masalah).filter((m) => m.status === "gagal");
  if (masalah.length === 0) {
    return <span className="text-xs text-success">{tahap2 ? "Koding sesuai aturan" : "Lengkap"}</span>;
  }
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {tahap2 && <span className="text-[11px] font-medium text-fg-muted">Koding:</span>}
      {masalah.slice(0, 2).map((m) => (
        <span key={m.key} className="truncate rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger" title={m.pesan}>
          {m.label}
        </span>
      ))}
      {masalah.length > 2 && <span className="text-[11px] text-fg-subtle">+{masalah.length - 2}</span>}
    </span>
  );
}

function DaftarSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-44 rounded" />
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-4 flex-1 rounded" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function Chip({
  aktif,
  onClick,
  tone = "brand",
  children,
}: {
  aktif: boolean;
  onClick: () => void;
  tone?: "brand" | "danger" | "success";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={aktif}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        aktif
          ? {
              brand: "border-brand bg-brand-soft text-brand-soft-fg",
              danger: "border-danger bg-danger-soft text-danger",
              success: "border-success bg-success-soft text-success",
            }[tone]
          : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
