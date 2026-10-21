"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { Label } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { MONTHS_ID } from "@/server/modules/rl41/rl41.constants";
import { RL32_MAKS_HARI } from "@/server/modules/rl32/rl32.constants";
import { ROMAWI_TRIWULAN, selisihHari, triwulanDari, type Triwulan } from "@/server/modules/rl32/rl32.periode";
import {
  batasBulan,
  batasTriwulan,
  bulanDari,
  gantiMode,
  geserBulan,
  geserTriwulan,
  TAHUN_AWAL,
  TANGGAL_AWAL,
  ubahRentang,
  type ModePeriode,
  type PilihanPeriode,
} from "./periode";

const MODE: { key: ModePeriode; label: string }[] = [
  { key: "bulan", label: "Bulan" },
  { key: "triwulan", label: "Triwulan" },
  { key: "rentang", label: "Rentang tanggal" },
];

/** "III (Jul–Sep)" — kata "Triwulan" sudah tampil di tombol jenis periode; angka Romawi di depan agar tetap jelas bila terpotong. */
const NAMA_TRIWULAN = (tw: Triwulan) =>
  `${ROMAWI_TRIWULAN[tw - 1]} (${MONTHS_ID[tw * 3 - 3].slice(0, 3)}–${MONTHS_ID[tw * 3 - 1].slice(0, 3)})`;

const PANAH =
  "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-fg-muted " +
  "transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-40";

/** Baris ‹ pilihan · tahun ›: memenuhi lebar di ponsel, selebar isi di layar lebar. */
const BARIS = "flex w-full items-center gap-2 sm:w-auto";
/** Pemilih tahun: cukup untuk "2026" + ikon tanpa terpotong, sisa lebar untuk bulan/triwulan. */
const TAHUN = "w-[5.5rem] shrink-0 sm:w-24";

/**
 * Pemilih periode laporan (RL 3.2, Klasifikasi Domisili): bulan (bawaan
 * formulir SIRS 6), triwulan, atau rentang tanggal bebas (maks. RL32_MAKS_HARI
 * hari). Tidak bisa memilih periode setelah hari ini atau sebelum TAHUN_AWAL.
 */
export function PemilihPeriode({
  nilai,
  onChange,
  hariIni,
  idAwalan = "rl32",
}: {
  nilai: PilihanPeriode;
  onChange: (p: PilihanPeriode) => void;
  hariIni: string;
  /** Awalan `id` kontrol, unik per halaman. */
  idAwalan?: string;
}) {
  const kini = useMemo(() => bulanDari(hariIni), [hariIni]);
  const kiniTw = useMemo(() => ({ tahun: kini.tahun, tw: triwulanDari(kini.bulan) }), [kini]);
  const opsiTahun = useMemo(
    () => Array.from({ length: kini.tahun - TAHUN_AWAL + 1 }, (_, i) => String(kini.tahun - i)),
    [kini.tahun],
  );

  const { bulan, triwulan, rentang } = nilai;
  const set = (p: Partial<PilihanPeriode>) => onChange({ ...nilai, ...p });

  // Tahun berjalan: hanya bulan/triwulan yang sudah dimulai.
  const opsiBulan = MONTHS_ID.slice(0, bulan.tahun === kini.tahun ? kini.bulan : 12).map((m, i) => ({
    value: String(i + 1),
    label: m,
  }));
  const opsiTriwulan = ([1, 2, 3, 4] as Triwulan[])
    .filter((tw) => triwulan.tahun < kiniTw.tahun || tw <= kiniTw.tw)
    .map((tw) => ({ value: String(tw), label: NAMA_TRIWULAN(tw) }));

  const jumlahHari = selisihHari(rentang.from, rentang.to) + 1;

  return (
    <div className="w-full min-w-0 sm:w-auto">
      <Label>Periode laporan</Label>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div
          role="group"
          aria-label="Jenis periode"
          className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-border bg-surface-2 p-1"
        >
          {MODE.map((m) => {
            const aktif = nilai.mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                aria-pressed={aktif}
                onClick={() => onChange(gantiMode(nilai, m.key, hariIni))}
                className={cn(
                  "h-full rounded-[calc(var(--radius-md)-3px)] px-3 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40",
                  aktif ? "bg-surface text-fg shadow-sm ring-1 ring-border" : "text-fg-muted hover:text-fg",
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {nilai.mode === "bulan" && (
          <div className={BARIS}>
            <button
              type="button"
              onClick={() => set({ bulan: batasBulan(geserBulan(bulan, -1), kini) })}
              disabled={bulan.tahun === TAHUN_AWAL && bulan.bulan === 1}
              aria-label="Bulan sebelumnya"
              className={PANAH}
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="min-w-0 flex-1 sm:w-36 sm:flex-none">
              <Select
                id={`${idAwalan}-bulan`}
                value={String(bulan.bulan)}
                options={opsiBulan}
                onChange={(v) => set({ bulan: { ...bulan, bulan: Number(v) } })}
              />
            </div>
            <div className={TAHUN}>
              <Select
                value={String(bulan.tahun)}
                options={opsiTahun}
                onChange={(v) => set({ bulan: batasBulan({ ...bulan, tahun: Number(v) }, kini) })}
              />
            </div>
            <button
              type="button"
              onClick={() => set({ bulan: batasBulan(geserBulan(bulan, 1), kini) })}
              disabled={bulan.tahun === kini.tahun && bulan.bulan === kini.bulan}
              aria-label="Bulan berikutnya"
              className={PANAH}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}

        {nilai.mode === "triwulan" && (
          <div className={BARIS}>
            <button
              type="button"
              onClick={() => set({ triwulan: batasTriwulan(geserTriwulan(triwulan, -1), kiniTw) })}
              disabled={triwulan.tahun === TAHUN_AWAL && triwulan.tw === 1}
              aria-label="Triwulan sebelumnya"
              className={PANAH}
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
              <Select
                id={`${idAwalan}-triwulan`}
                value={String(triwulan.tw)}
                options={opsiTriwulan}
                onChange={(v) => set({ triwulan: { ...triwulan, tw: Number(v) as Triwulan } })}
              />
            </div>
            <div className={TAHUN}>
              <Select
                value={String(triwulan.tahun)}
                options={opsiTahun}
                onChange={(v) => set({ triwulan: batasTriwulan({ ...triwulan, tahun: Number(v) }, kiniTw) })}
              />
            </div>
            <button
              type="button"
              onClick={() => set({ triwulan: batasTriwulan(geserTriwulan(triwulan, 1), kiniTw) })}
              disabled={triwulan.tahun === kiniTw.tahun && triwulan.tw === kiniTw.tw}
              aria-label="Triwulan berikutnya"
              className={PANAH}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}

        {nilai.mode === "rentang" && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label htmlFor={`${idAwalan}-dari`} className="sr-only">
              Tanggal awal
            </label>
            <label htmlFor={`${idAwalan}-sampai`} className="sr-only">
              Tanggal akhir
            </label>
            {/* Ponsel: dua kolom sama lebar; layar lebar: sebaris dengan tanda pisah. */}
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
              <div className="min-w-0 sm:w-[10.5rem]">
                <DatePicker
                  id={`${idAwalan}-dari`}
                  value={rentang.from}
                  onChange={(v) => v && set({ rentang: ubahRentang(rentang, "from", v, hariIni) })}
                  min={TANGGAL_AWAL}
                  max={hariIni}
                  clearable={false}
                />
              </div>
              <span className="hidden text-fg-subtle sm:inline" aria-hidden>
                –
              </span>
              <div className="min-w-0 sm:w-[10.5rem]">
                <DatePicker
                  id={`${idAwalan}-sampai`}
                  value={rentang.to}
                  onChange={(v) => v && set({ rentang: ubahRentang(rentang, "to", v, hariIni) })}
                  min={rentang.from}
                  max={hariIni}
                  clearable={false}
                />
              </div>
            </div>
            <span className="text-xs text-fg-subtle tabular">
              {formatNumber(jumlahHari)} hari · maks. {formatNumber(RL32_MAKS_HARI)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
