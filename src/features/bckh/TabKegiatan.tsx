"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { useAsyncData } from "@/lib/useAsyncData";
import { hariDalamMinggu, hariKerjaDalam, kunciUraian, rentangBulanIni } from "@/server/modules/bckh/bckh.aturan";
import { INFO_KATEGORI, KATEGORI, NAMA_HARI, type Kategori } from "@/server/modules/bckh/bckh.constants";
import type { HariDto } from "@/server/modules/bckh/bckh.types";
import { BadgeStatus, PemilihBulan, TitikKategori, bekerja } from "./ui";

type Entri = { jenis: "isi"; h: HariDto } | { jenis: "kosong"; tanggal: string };

/** Daftar catatan per bulan (terbaru di atas) + hari kerja yang belum diisi. */
export function TabKegiatan({
  u,
  hariIni,
  bulanAwal,
  segar,
  onUbah,
}: {
  u: string | null;
  hariIni: string;
  bulanAwal: string;
  segar: number;
  onUbah?: (tanggal: string) => void;
}) {
  const [bulan, setBulan] = useState(bulanAwal);
  const [cari, setCari] = useState("");
  const [kategori, setKategori] = useState<Kategori | null>(null);
  const { dari, sampai } = rentangBulanIni(bulan);
  const { result, loading, error, reload } = useAsyncData<HariDto[]>(
    () => apiGet<HariDto[]>(`/api/bckh/hari?${new URLSearchParams({ dari, sampai, ...(u ? { u } : {}) })}`),
    [dari, sampai, u, segar],
  );

  const entri = useMemo<Entri[]>(() => {
    if (!result) return [];
    const q = kunciUraian(cari);
    const tersaring = result.filter(
      (h) =>
        (!q || h.kegiatan.some((k) => kunciUraian(k.uraian).includes(q)) || kunciUraian(h.keterangan).includes(q)) &&
        (!kategori || h.kegiatan.some((k) => k.kategori === kategori)),
    );
    const ada = new Set(result.map((h) => h.tanggal));
    const kosong = cari || kategori ? [] : hariKerjaDalam(dari, sampai, hariIni).filter((t) => !ada.has(t));
    return [
      ...tersaring.map((h): Entri => ({ jenis: "isi", h })),
      ...kosong.map((tanggal): Entri => ({ jenis: "kosong", tanggal })),
    ].sort((a, b) => (b.jenis === "isi" ? b.h.tanggal : b.tanggal).localeCompare(a.jenis === "isi" ? a.h.tanggal : a.tanggal));
  }, [result, cari, kategori, dari, sampai, hariIni]);

  const jumlahKegiatan = result?.reduce((n, h) => n + h.kegiatan.length, 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center">
        <PemilihBulan bulan={bulan} onChange={setBulan} maks={hariIni.slice(0, 7)} className="self-start" />
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari uraian atau keterangan…" className="pl-9" aria-label="Cari kegiatan" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Saring kategori">
        {KATEGORI.map((k) => {
          const aktif = kategori === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={aktif}
              onClick={() => setKategori(aktif ? null : k)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                aktif ? "border-fg bg-fg text-white" : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
              )}
            >
              <TitikKategori kategori={k} className="size-2" />
              {INFO_KATEGORI[k].label}
            </button>
          );
        })}
      </div>

      {result && (
        <p className="text-xs text-fg-muted">
          <b className="font-semibold tabular text-fg">{result.length}</b> hari tercatat · <b className="font-semibold tabular text-fg">{jumlahKegiatan}</b> kegiatan
        </p>
      )}

      {error ? (
        <ErrorState onRetry={reload} />
      ) : !result ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : entri.length === 0 ? (
        <EmptyState title={cari || kategori ? "Tidak ada catatan yang cocok" : "Belum ada catatan bulan ini"} description={cari || kategori ? "Ubah kata kunci atau saringan kategori." : undefined} />
      ) : (
        <ol className={cn("space-y-3 transition-opacity", loading && "opacity-60")}>
          {entri.map((e) => (e.jenis === "isi" ? <KartuHari key={e.h.tanggal} h={e.h} onUbah={onUbah} /> : <KartuKosong key={e.tanggal} tanggal={e.tanggal} onIsi={onUbah} />))}
        </ol>
      )}
    </div>
  );
}

function TanggalBlok({ tanggal }: { tanggal: string }) {
  return (
    <div className="w-12 shrink-0 text-center">
      <p className="text-[11px] font-medium text-fg-subtle">{NAMA_HARI[hariDalamMinggu(tanggal)].slice(0, 3)}</p>
      <p className="text-2xl font-semibold leading-tight tabular text-fg">{Number(tanggal.slice(8, 10))}</p>
    </div>
  );
}

function KartuHari({ h, onUbah }: { h: HariDto; onUbah?: (t: string) => void }) {
  return (
    <li className="flex gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3 @md:gap-4 @md:p-4">
      <TanggalBlok tanggal={h.tanggal} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <BadgeStatus status={h.status} />
            {h.keterangan && <span className="min-w-0 text-xs text-fg-muted [overflow-wrap:anywhere]">KET: {h.keterangan}</span>}
          </div>
          {onUbah && (
            <button
              type="button"
              onClick={() => onUbah(h.tanggal)}
              aria-label={`Ubah catatan ${h.tanggal}`}
              className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <Pencil className="size-4" />
            </button>
          )}
        </div>
        {bekerja(h.status) && h.kegiatan.length > 0 && (
          <ul className="mt-2.5 space-y-1.5">
            {h.kegiatan.map((k) => (
              <li key={k.id} className="flex items-start gap-2 text-sm text-fg">
                <TitikKategori kategori={k.kategori} className="mt-1.5" />
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{k.uraian}</span>
                {k.target === "PROSES" && <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">Proses</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function KartuKosong({ tanggal, onIsi }: { tanggal: string; onIsi?: (t: string) => void }) {
  return (
    <li className="flex items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-border-strong bg-surface-2/40 p-3 @md:gap-4 @md:p-4">
      <TanggalBlok tanggal={tanggal} />
      <p className="min-w-0 flex-1 text-sm text-fg-muted">Hari kerja belum diisi</p>
      {onIsi && (
        <button
          type="button"
          onClick={() => onIsi(tanggal)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          <Plus className="size-3.5" aria-hidden />
          Isi
        </button>
      )}
    </li>
  );
}
