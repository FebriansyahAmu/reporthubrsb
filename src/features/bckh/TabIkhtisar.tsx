"use client";

import { useMemo, useState } from "react";
import { CalendarOff, NotebookPen, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { persen } from "@/server/modules/bckh/bckh.aturan";
import { INFO_KATEGORI, LABEL_STATUS, STATUS_BEKERJA, STATUS_HARI, type Kategori, type StatusHari } from "@/server/modules/bckh/bckh.constants";
import type { KegiatanRutin, ProfilResult, RingkasBulan } from "@/server/modules/bckh/bckh.types";
import { GrafikKegiatan, LegendaGrafik } from "./GrafikKegiatan";
import { BilahKomposisi, TitikKategori, bagianKategori, labelBulan } from "./ui";

const KOTAK = "rounded-[var(--radius-md)] border border-border bg-surface";

export function TabIkhtisar({
  data,
  loading,
  tahun,
  onTahun,
  sorot,
  onPilihHari,
  onPakaiRutin,
  onLihatBulan,
}: {
  data: ProfilResult | null;
  loading: boolean;
  tahun: number | null;
  onTahun: (t: number | null) => void;
  sorot: string | null;
  onPilihHari?: (tanggal: string) => void;
  onPakaiRutin?: (r: KegiatanRutin) => void;
  onLihatBulan: (bulan: string) => void;
}) {
  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  const judulRentang = tahun ? `pada ${tahun}` : "dalam setahun terakhir";

  return (
    <div className={cn("space-y-8 transition-opacity", loading && "opacity-60")}>
      <KegiatanRutinBlok rutin={data.rutin} onPakai={onPakaiRutin} />

      <section aria-labelledby="judul-grafik">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <h2 id="judul-grafik" className="text-base font-normal text-fg">
            <b className="font-semibold tabular">{formatNumber(data.totalKegiatan)}</b> kegiatan {judulRentang}
            <span className="text-fg-muted"> · {formatNumber(data.hariTercatat)} hari tercatat</span>
          </h2>
          <PemilihTahun tahun={tahun} tersedia={data.tahunTersedia} onTahun={onTahun} />
        </div>
        <div className={cn(KOTAK, "px-3 pb-3 pt-4 sm:px-4")}>
          <GrafikKegiatan
            sel={data.sel}
            dari={data.rentang.dari}
            sampai={data.rentang.sampai}
            hariIni={data.hariIni}
            ambang={data.ambang}
            sorot={sorot}
            onPilih={onPilihHari}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-[11px] text-fg-subtle">
              {onPilihHari ? "Klik sebuah hari untuk mengisi atau mengubah catatannya." : "Warna mengikuti jumlah kegiatan per hari."}
            </p>
            <LegendaGrafik ambang={data.ambang} />
          </div>
        </div>
      </section>

      <RingkasanAktivitas bulanan={data.bulanan} />

      <AktivitasBulanan bulanan={data.bulanan} judulRentang={judulRentang} onLihatBulan={onLihatBulan} />
    </div>
  );
}

/* --------------------------------------------------------- kegiatan rutin */

function KegiatanRutinBlok({ rutin, onPakai }: { rutin: KegiatanRutin[]; onPakai?: (r: KegiatanRutin) => void }) {
  return (
    <section aria-labelledby="judul-rutin">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 id="judul-rutin" className="text-base font-normal text-fg">
          Kegiatan rutin
        </h2>
        <p className="text-xs text-fg-subtle">Tersering dalam 90 hari terakhir</p>
      </div>
      {rutin.length === 0 ? (
        <p className={cn(KOTAK, "border-dashed px-4 py-6 text-center text-sm text-fg-muted")}>
          Kegiatan yang sering Anda catat akan muncul di sini — sekali klik untuk menambahkannya ke catatan hari ini.
        </p>
      ) : (
        <ul className="grid gap-3 @lg:grid-cols-2">
          {rutin.map((r) => {
            const isi = (
              <>
                <span className="flex items-start gap-2">
                  <NotebookPen className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-brand [overflow-wrap:anywhere] group-hover:underline">{r.uraian}</span>
                  {onPakai && <Plus className="size-4 shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />}
                </span>
                <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <TitikKategori kategori={r.kategori} />
                    {INFO_KATEGORI[r.kategori].label}
                  </span>
                  <span className="tabular">Dicatat {r.n}×</span>
                </span>
              </>
            );
            return (
              <li key={r.uraian}>
                {onPakai ? (
                  <button
                    type="button"
                    onClick={() => onPakai(r)}
                    title="Tambahkan ke catatan hari ini"
                    className={cn(KOTAK, "group flex h-full w-full flex-col justify-between p-4 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring")}
                  >
                    {isi}
                  </button>
                ) : (
                  <div className={cn(KOTAK, "group flex h-full flex-col justify-between p-4")}>{isi}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ----------------------------------------------------------- pilih tahun */

function PemilihTahun({ tahun, tersedia, onTahun }: { tahun: number | null; tersedia: number[]; onTahun: (t: number | null) => void }) {
  const pilihan: { nilai: number | null; label: string }[] = [{ nilai: null, label: "Setahun terakhir" }, ...tersedia.map((t) => ({ nilai: t, label: String(t) }))];
  return (
    <nav aria-label="Rentang grafik" className="flex max-w-full flex-wrap gap-1">
      {pilihan.map((p) => {
        const aktif = p.nilai === tahun;
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => onTahun(p.nilai)}
            aria-current={aktif ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
              aktif ? "bg-brand text-brand-fg font-semibold" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {p.label}
          </button>
        );
      })}
    </nav>
  );
}

/* ---------------------------------------------------- ringkasan aktivitas */

function RingkasanAktivitas({ bulanan }: { bulanan: RingkasBulan[] }) {
  const r = useMemo(() => {
    const perKategori: Partial<Record<Kategori, number>> = {};
    const perStatus: Partial<Record<StatusHari, number>> = {};
    let kegiatan = 0;
    let selesai = 0;
    let hari = 0;
    for (const b of bulanan) {
      kegiatan += b.kegiatan;
      selesai += b.selesai;
      hari += b.hari;
      for (const [k, n] of Object.entries(b.perKategori) as [Kategori, number][]) perKategori[k] = (perKategori[k] ?? 0) + n;
      for (const [s, n] of Object.entries(b.perStatus) as [StatusHari, number][]) perStatus[s] = (perStatus[s] ?? 0) + n;
    }
    const bekerja = STATUS_HARI.filter((s) => STATUS_BEKERJA.has(s)).reduce((n, s) => n + (perStatus[s] ?? 0), 0);
    return { perKategori, perStatus, kegiatan, selesai, hari, bekerja };
  }, [bulanan]);

  return (
    <section aria-labelledby="judul-ringkasan">
      <h2 id="judul-ringkasan" className="mb-2 text-base font-normal text-fg">
        Ringkasan aktivitas
      </h2>
      <div className={cn(KOTAK, "grid gap-6 p-4 @lg:p-5 @2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]")}>
        <div className="min-w-0">
          <p className="mb-3 text-xs font-medium text-fg-muted">Komposisi kategori kegiatan</p>
          <BilahKomposisi bagian={bagianKategori(r.perKategori)} />
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-4 border-t border-border pt-4 @md:grid-cols-3 @2xl:grid-cols-1 @2xl:border-l @2xl:border-t-0 @2xl:pl-6 @2xl:pt-0">
          <Angka label="Kegiatan selesai" nilai={persen(r.selesai, r.kegiatan)} satuan="%" rinci={`${formatNumber(r.selesai)} dari ${formatNumber(r.kegiatan)}`} />
          <Angka label="Hari bekerja" nilai={r.bekerja} rinci={`dari ${formatNumber(r.hari)} hari tercatat`} />
          <Angka label="Rata-rata per hari" nilai={r.bekerja ? Math.round((r.kegiatan / r.bekerja) * 10) / 10 : null} rinci="kegiatan per hari bekerja" />
        </dl>
      </div>
    </section>
  );
}

function Angka({ label, nilai, satuan = "", rinci }: { label: string; nilai: number | null; satuan?: string; rinci: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tracking-tight text-fg">
        {nilai === null ? "—" : `${String(nilai).replace(".", ",")}${satuan}`}
      </dd>
      <dd className="text-[11px] leading-snug text-fg-subtle">{rinci}</dd>
    </div>
  );
}

/* --------------------------------------------------- aktivitas per bulan */

function AktivitasBulanan({ bulanan, judulRentang, onLihatBulan }: { bulanan: RingkasBulan[]; judulRentang: string; onLihatBulan: (b: string) => void }) {
  const [tampil, setTampil] = useState(3);
  return (
    <section aria-labelledby="judul-aktivitas">
      <h2 id="judul-aktivitas" className="mb-3 text-base font-normal text-fg">
        Aktivitas per bulan
      </h2>
      {bulanan.length === 0 ? (
        <p className={cn(KOTAK, "border-dashed px-4 py-6 text-center text-sm text-fg-muted")}>Belum ada catatan {judulRentang}.</p>
      ) : (
        <ol className="space-y-6">
          {bulanan.slice(0, tampil).map((b) => (
            <BulanTimeline key={b.bulan} b={b} onLihat={() => onLihatBulan(b.bulan)} />
          ))}
        </ol>
      )}
      {bulanan.length > tampil && (
        <button
          type="button"
          onClick={() => setTampil((n) => n + 3)}
          className={cn(KOTAK, "mt-5 w-full py-2 text-sm font-medium text-brand transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring")}
        >
          Tampilkan aktivitas bulan sebelumnya
        </button>
      )}
    </section>
  );
}

function BulanTimeline({ b, onLihat }: { b: RingkasBulan; onLihat: () => void }) {
  const kategori = bagianKategori(b.perKategori).sort((x, y) => y.n - x.n);
  const maks = Math.max(1, ...kategori.map((k) => k.n));
  const statusLain = STATUS_HARI.filter((s) => s !== "MASUK" && b.perStatus[s]);
  const bekerjaLain = statusLain.filter((s) => STATUS_BEKERJA.has(s));
  const tidakBekerja = statusLain.filter((s) => !STATUS_BEKERJA.has(s));
  return (
    <li>
      <div className="mb-3 flex items-center gap-3">
        <h3 className="shrink-0 text-xs font-semibold text-fg">{labelBulan(b.bulan)}</h3>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
      <div className="relative ml-4 space-y-4 border-l-2 border-border pl-6">
        <div className="relative">
          <span className="absolute -left-[2.3rem] top-0 grid size-8 place-items-center rounded-full border border-border bg-surface text-fg-muted">
            <NotebookPen className="size-4" aria-hidden />
          </span>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm text-fg">
              Mencatat <b className="font-semibold tabular">{formatNumber(b.kegiatan)} kegiatan</b> dalam <b className="font-semibold tabular">{b.hari} hari</b>
            </p>
            <button type="button" onClick={onLihat} className="text-xs font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
              Lihat catatan
            </button>
          </div>
          {kategori.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {kategori.map((k) => (
                <li key={k.kunci} className="grid grid-cols-[minmax(0,1fr)_auto_4.5rem] items-center gap-3 text-[13px] @md:grid-cols-[minmax(0,1fr)_auto_7rem] @xl:grid-cols-[minmax(0,1fr)_auto_10rem]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: k.warna }} />
                    <span className="truncate text-fg">{k.label}</span>
                  </span>
                  <span className="tabular text-xs text-fg-muted">{k.n}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-chart-track" aria-hidden>
                    <span className="block h-full rounded-full" style={{ width: `${(k.n / maks) * 100}%`, background: k.warna }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-fg-subtle tabular">
            {persen(b.selesai, b.kegiatan) ?? 0}% kegiatan selesai
            {bekerjaLain.map((s) => ` · ${b.perStatus[s]} hari ${LABEL_STATUS[s].toLowerCase()}`).join("")}
          </p>
        </div>
        {tidakBekerja.length > 0 && (
          <div className="relative">
            <span className="absolute -left-[2.3rem] top-0 grid size-8 place-items-center rounded-full border border-border bg-surface text-fg-muted">
              <CalendarOff className="size-4" aria-hidden />
            </span>
            <p className="pt-1.5 text-sm text-fg-muted">
              {tidakBekerja.map((s, i) => (
                <span key={s}>
                  {i > 0 && " · "}
                  <b className="font-semibold tabular text-fg">{b.perStatus[s]}</b> {LABEL_STATUS[s].toLowerCase()}
                </span>
              ))}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
