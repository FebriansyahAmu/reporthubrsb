"use client";

import { useState } from "react";
import { CalendarCheck, CheckCircle2, Clock, ListChecks } from "lucide-react";
import { HBarList } from "@/components/charts/HBarList";
import { VBarChart } from "@/components/charts/VBarChart";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatNumber } from "@/lib/format";
import { persen, rentangBulanIni } from "@/server/modules/bckh/bckh.aturan";
import { INFO_KATEGORI, LABEL_STATUS, NAMA_BULAN_PENDEK, NAMA_HARI, type StatusHari } from "@/server/modules/bckh/bckh.constants";
import type { DasborResult } from "@/server/modules/bckh/bckh.types";
import { BilahKomposisi, PemilihBulan, bagianKategori, bulanBawaan, type Bagian } from "./ui";

/** Warna status hari (entitas berbeda dari kategori; legenda selalu berlabel). */
const WARNA_STATUS: Record<StatusHari, string> = {
  MASUK: "#1a7b6e",
  TUGAS_LUAR: "#2a78d6",
  OFF: "#8a9bab",
  CUTI: "#eda100",
  SAKIT: "#e34948",
  IZIN: "#e87ba4",
  LIBUR: "#c3d0db",
};

const KOTAK = "rounded-[var(--radius-md)] border border-border bg-surface";

/** Dasbor persentase kegiatan per bulan / tahun (PRD §6.5). */
export function TabDasbor({ u, hariIni, segar }: { u: string | null; hariIni: string; segar: number }) {
  const [mode, setMode] = useState<"bulan" | "tahun">("bulan");
  const [bulan, setBulan] = useState(() => bulanBawaan(hariIni));
  const [tahun, setTahun] = useState(Number(hariIni.slice(0, 4)));
  const { dari, sampai } = mode === "bulan" ? rentangBulanIni(bulan) : { dari: `${tahun}-01-01`, sampai: `${tahun}-12-31` };
  const { result: d, loading, error, reload } = useAsyncData<DasborResult>(
    () => apiGet<DasborResult>(`/api/bckh/dasbor?${new URLSearchParams({ dari, sampai, ...(u ? { u } : {}) })}`),
    [dari, sampai, u, segar],
  );
  const tahunIni = Number(hariIni.slice(0, 4));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Periode dasbor" className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface p-0.5">
          {(["bulan", "tahun"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "h-9 rounded-[var(--radius-sm)] px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                mode === m ? "bg-fg text-white" : "text-fg-muted hover:text-fg",
              )}
            >
              {m === "bulan" ? "Bulanan" : "Tahunan"}
            </button>
          ))}
        </div>
        {mode === "bulan" ? (
          <PemilihBulan bulan={bulan} onChange={setBulan} maks={hariIni.slice(0, 7)} />
        ) : (
          <div className="inline-flex gap-1">
            {[tahunIni - 1, tahunIni].map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tahun === t}
                onClick={() => setTahun(t)}
                className={cn(
                  "h-9 rounded-[var(--radius-sm)] border px-3.5 text-sm font-medium tabular transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                  tahun === t ? "border-fg bg-fg text-white" : "border-border bg-surface text-fg-muted hover:text-fg",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && !d ? (
        <ErrorState onRetry={reload} />
      ) : !d ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className={cn("space-y-5 transition-opacity", loading && "opacity-60")}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile ikon={ListChecks} label="Kegiatan tercatat" nilai={formatNumber(d.kegiatan)} rinci={`${d.hariTercatat} hari tercatat`} />
            <Tile
              ikon={CalendarCheck}
              label="Kepatuhan pengisian"
              nilai={fmtPersen(persen(d.hariKerjaTerisi, d.hariKerja))}
              rinci={`${d.hariKerjaTerisi} dari ${d.hariKerja} hari kerja terisi`}
              meter={persen(d.hariKerjaTerisi, d.hariKerja)}
            />
            <Tile
              ikon={Clock}
              label="Tepat waktu"
              nilai={fmtPersen(persen(d.tepatWaktu, d.hariTercatat))}
              rinci="dicatat paling lambat H+1"
              meter={persen(d.tepatWaktu, d.hariTercatat)}
            />
            <Tile
              ikon={CheckCircle2}
              label="Kegiatan selesai"
              nilai={fmtPersen(persen(d.selesai, d.kegiatan))}
              rinci={`${d.proses} masih proses`}
              meter={persen(d.selesai, d.kegiatan)}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel judul="Komposisi kategori" sub="Persentase kegiatan per kategori">
              <BilahKomposisi bagian={bagianKategori(d.perKategori)} kolom={1} />
            </Panel>
            <Panel judul="Status hari" sub="Persentase hari tercatat per status">
              <BilahKomposisi
                kolom={1}
                satuan="hari"
                bagian={d.perStatus.map((s): Bagian => ({ kunci: s.status, label: LABEL_STATUS[s.status], warna: WARNA_STATUS[s.status], n: s.n }))}
              />
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel judul="Kegiatan teratas" sub="Uraian yang paling sering dicatat">
              <HBarList
                items={d.teratas.map((t) => ({
                  label: t.uraian,
                  value: t.n,
                  color: INFO_KATEGORI[t.kategori].warna,
                  sub: `${Math.round((t.n / Math.max(1, d.kegiatan)) * 100)}%`,
                }))}
              />
            </Panel>
            {mode === "tahun" ? (
              <Panel judul="Kegiatan per bulan" sub={`Jumlah kegiatan tiap bulan ${tahun}`}>
                <VBarChart
                  ariaLabel="Kegiatan per bulan"
                  color="var(--heat-3)"
                  data={d.perBulan.map((b) => ({ label: NAMA_BULAN_PENDEK[Number(b.bulan.slice(5)) - 1], value: b.kegiatan, hint: `${b.hari} hari tercatat` }))}
                />
              </Panel>
            ) : (
              <Panel judul="Pola mingguan" sub="Rata-rata kegiatan per hari bekerja">
                <VBarChart
                  ariaLabel="Rata-rata kegiatan per hari dalam minggu"
                  color="var(--heat-3)"
                  data={[1, 2, 3, 4, 5, 6, 0].map((h) => {
                    const x = d.perHariMinggu[h];
                    return { label: NAMA_HARI[h].slice(0, 3), value: x.rata, hint: `${x.hariBekerja} hari bekerja` };
                  })}
                />
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const fmtPersen = (p: number | null) => (p === null ? "—" : `${p}%`);

function Tile({ ikon: Ikon, label, nilai, rinci, meter }: { ikon: typeof ListChecks; label: string; nilai: string; rinci: string; meter?: number | null }) {
  return (
    <div className={cn(KOTAK, "p-4")}>
      <p className="flex items-center gap-2 text-xs font-medium text-fg-muted">
        <Ikon className="size-4 text-fg-subtle" aria-hidden />
        {label}
      </p>
      <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-tight tabular text-fg">{nilai}</p>
      {meter !== undefined && (
        <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-chart-track" aria-hidden>
          <span className="block h-full rounded-full bg-heat-3 motion-safe:animate-tumbuh origin-left" style={{ width: `${meter ?? 0}%` }} />
        </span>
      )}
      <p className="mt-2 text-[11px] text-fg-subtle">{rinci}</p>
    </div>
  );
}

function Panel({ judul, sub, children }: { judul: string; sub: string; children: React.ReactNode }) {
  return (
    <section className={cn(KOTAK, "p-4 sm:p-5")}>
      <h3 className="text-sm font-semibold text-fg">{judul}</h3>
      <p className="mb-4 text-xs text-fg-muted">{sub}</p>
      {children}
    </section>
  );
}
