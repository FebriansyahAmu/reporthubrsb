"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { formatRelatif } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import { ambangTingkat, hariDalamMinggu, persen, tambahHari, tanggalPanjang, tingkat } from "@/server/modules/bckh/bckh.aturan";
import type { AnggotaTim, TimResult } from "@/server/modules/bckh/bckh.types";
import { AvatarBckh, PemilihBulan, bulanBawaan } from "./ui";

const WARNA = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"] as const;

/** Tim (pemegang `bckh.tim`): ringkasan pengisian per pegawai, hanya-lihat. */
export function TimView({ hariIni, bolehCetak }: { hariIni: string; bolehCetak: boolean }) {
  const [bulan, setBulan] = useState(() => bulanBawaan(hariIni));
  const [cari, setCari] = useState("");
  const [kini] = useState(() => Date.now());
  const { result, loading, error, reload } = useAsyncData<TimResult>(() => apiGet<TimResult>(`/api/bckh/tim?bulan=${bulan}`), [bulan]);

  const anggota = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (result?.anggota ?? []).filter((a) => !q || `${a.nama} ${a.username} ${a.jabatan} ${a.unit}`.toLowerCase().includes(q));
  }, [result, cari]);
  const ambang = useMemo(() => ambangTingkat((result?.anggota ?? []).flatMap((a) => a.mini)), [result]);

  return (
    <div className="@container space-y-4">
      <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center">
        <PemilihBulan bulan={bulan} onChange={setBulan} maks={hariIni.slice(0, 7)} className="self-start" />
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, jabatan, unit…" className="pl-9" aria-label="Cari pegawai" />
        </div>
      </div>

      {error && !result ? (
        <ErrorState onRetry={reload} />
      ) : !result ? (
        <Skeleton className="h-72 w-full" />
      ) : anggota.length === 0 ? (
        <EmptyState title={cari ? "Tidak ada pegawai yang cocok" : "Belum ada pegawai pengisi BCKH"} description={cari ? undefined : "Beri peran pegawai hak modul \"Catatan Kegiatan Saya\" agar muncul di sini."} />
      ) : (
        <ul className={cn("divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface", loading && "opacity-60")}>
          {anggota.map((a) => (
            <BarisAnggota key={a.userId} a={a} bulan={bulan} hariIni={hariIni} kini={kini} ambang={ambang} bolehCetak={bolehCetak} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BarisAnggota({
  a,
  bulan,
  hariIni,
  kini,
  ambang,
  bolehCetak,
}: {
  a: AnggotaTim;
  bulan: string;
  hariIni: string;
  kini: number;
  ambang: [number, number, number];
  bolehCetak: boolean;
}) {
  const p = persen(a.hariKerjaTerisi, a.hariKerja);
  const awalMini = tambahHari(hariIni, -(a.mini.length - 1));
  return (
    // Sempit: [nama ……… Laporan] lalu [grafik mini | kepatuhan]; lebar (@4xl): satu baris empat kolom.
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-3 py-4 @md:px-4 @4xl:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)_auto]">
      <Link href={`/bckh/tim/${encodeURIComponent(a.username)}`} className="group col-span-2 flex min-w-0 items-center gap-3 focus-visible:outline-none @4xl:col-span-1">
        <AvatarBckh userId={a.userId} versi={a.avatar} className="size-10 shrink-0 border border-border" label="" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-fg group-hover:text-brand group-hover:underline group-focus-visible:underline">{a.nama}</span>
          <span className="block truncate text-xs text-fg-muted">
            {[a.jabatan, a.unit].filter(Boolean).join(" · ") || a.username}
          </span>
        </span>
      </Link>

      <div className="col-start-1 grid w-fit grid-flow-col grid-rows-7 gap-[2px] @4xl:col-start-auto" role="img" aria-label={`Kegiatan 5 minggu terakhir: ${a.mini.reduce((s, n) => s + n, 0)} kegiatan`}>
        {/* Sel kosong agar kolom pertama mulai hari Senin. */}
        {Array.from({ length: (hariDalamMinggu(awalMini) + 6) % 7 }, (_, i) => (
          <span key={`k${i}`} className="size-[9px]" />
        ))}
        {a.mini.map((n, i) => (
          <span key={i} title={`${n} kegiatan · ${tanggalPanjang(tambahHari(awalMini, i))}`} className={cn("size-[9px] rounded-[2px] ring-1 ring-inset ring-black/[0.05]", WARNA[tingkat(n, ambang)])} />
        ))}
      </div>

      <div className="col-span-2 min-w-0 @4xl:col-span-1">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-fg-muted">Kepatuhan</span>
          <span className="font-semibold tabular text-fg">{p === null ? "—" : `${p}%`}</span>
        </div>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-chart-track" aria-hidden>
          <span className={cn("block h-full rounded-full", (p ?? 0) >= 80 ? "bg-heat-3" : (p ?? 0) >= 50 ? "bg-warning" : "bg-danger")} style={{ width: `${p ?? 0}%` }} />
        </span>
        <p className="mt-1 text-[11px] text-fg-subtle tabular">
          {a.hariKerjaTerisi}/{a.hariKerja} hari kerja · {a.kegiatan} kegiatan · {a.terakhirMengisi ? `terakhir ${formatRelatif(a.terakhirMengisi, kini)}` : "belum pernah mengisi"}
        </p>
      </div>

      {bolehCetak && (
        <a
          href={`/api/bckh/laporan/pdf?${new URLSearchParams({ bulan, u: a.userId })}`}
          target="_blank"
          rel="noopener"
          aria-label={`Laporan ${a.nama}`}
          className="col-start-3 row-start-1 inline-flex h-8 w-fit items-center gap-1.5 rounded-[var(--radius-md)] border border-border px-3 text-xs font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring @4xl:col-start-auto @4xl:row-start-auto"
        >
          <Download className="size-3.5" aria-hidden />
          Laporan
        </a>
      )}
    </li>
  );
}
