"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMeasure } from "@/components/charts/useMeasure";
import { cn } from "@/lib/cn";
import { tambahHari, tanggalPanjang, tingkat } from "@/server/modules/bckh/bckh.aturan";
import { LABEL_STATUS, NAMA_BULAN_PENDEK, NAMA_HARI_PENDEK, STATUS_BEKERJA } from "@/server/modules/bckh/bckh.constants";
import type { SelGrafik } from "@/server/modules/bckh/bckh.types";

const WARNA_TINGKAT = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"] as const;
/** Baris grafik: Senin di atas (pekan kerja) → Minggu. Label hanya Sen/Rab/Jum seperti GitHub. */
const URUT_HARI = [1, 2, 3, 4, 5, 6, 0] as const;
const LABEL_BARIS = new Set([1, 3, 5]);
/** Lebar kolom label hari & jarak antarsel (px). Sel cair 9–15 px mengikuti lebar kartu. */
const LEBAR_LABEL = 30;
const JARAK = 3;

type Kotak = { t: string; n: number; tingkat: 0 | 1 | 2 | 3 | 4; sel?: SelGrafik } | null;

/** Senin pada/sebelum tanggal. */
const seninDari = (ymd: string) => tambahHari(ymd, -((new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7));

/**
 * Grafik kegiatan ala grafik kontribusi GitHub: kolom = minggu (Senin–Minggu),
 * warna = jumlah kegiatan (kuartil pribadi, 5 tingkat teal). Hari tidak bekerja
 * yang tercatat (Off/Cuti/…) diberi titik. Interaktif: tooltip, klik/Enter =
 * buka catatan hari itu, panah = pindah sel (roving tabindex). `sorot` = sel
 * yang baru disimpan → berdenyut sekali.
 */
export function GrafikKegiatan({
  sel,
  dari,
  sampai,
  hariIni,
  ambang,
  onPilih,
  sorot,
}: {
  sel: SelGrafik[];
  dari: string;
  sampai: string;
  hariIni: string;
  ambang: [number, number, number];
  onPilih?: (tanggal: string) => void;
  sorot?: string | null;
}) {
  const gulirRef = useRef<HTMLDivElement>(null);
  const [ukurRef, lebar] = useMeasure<HTMLDivElement>();
  const [tip, setTip] = useState<{ x: number; y: number; rata: "kiri" | "tengah" | "kanan"; teks: React.ReactNode } | null>(null);

  const { minggu, labelBulan } = useMemo(() => {
    const peta = new Map(sel.map((s) => [s.t, s]));
    const akhir = sampai < hariIni ? sampai : hariIni;
    const kolom: Kotak[][] = [];
    for (let senin = seninDari(dari); senin <= akhir; senin = tambahHari(senin, 7)) {
      kolom.push(
        URUT_HARI.map((_, i) => {
          const t = tambahHari(senin, i);
          if (t < dari || t > akhir) return null;
          const s = peta.get(t);
          const n = s?.n ?? 0;
          return { t, n, tingkat: tingkat(n, ambang), sel: s };
        }),
      );
    }
    // Label bulan = bulan hari pertama kolom, saat berganti dari kolom sebelumnya
    // (label yang terlalu rapat < 3 kolom dari sebelumnya dilewati).
    const label: { kolom: number; teks: string }[] = [];
    let bulanSebelum = "";
    kolom.forEach((k, i) => {
      const pertama = k.find(Boolean);
      if (!pertama) return;
      const bulan = pertama.t.slice(5, 7);
      if (bulan === bulanSebelum) return;
      bulanSebelum = bulan;
      if (label.length && i - label[label.length - 1].kolom < 3) return;
      label.push({ kolom: i, teks: NAMA_BULAN_PENDEK[Number(bulan) - 1] });
    });
    return { minggu: kolom, labelBulan: label };
  }, [sel, dari, sampai, hariIni, ambang]);

  // Ukuran sel cair: isi lebar kartu (seperti GitHub di layar lebar), menggulir bila < 9 px.
  const sisi = lebar > 0 ? Math.max(9, Math.min(15, Math.floor((lebar - LEBAR_LABEL - JARAK * (minggu.length + 2)) / minggu.length))) : 11;
  const ukuran = { width: sisi, height: sisi };

  // Fokus roving: mulai di hari terakhir yang tampil.
  const semuaSel = useMemo(() => minggu.flatMap((k, c) => k.map((x, r) => (x ? { c, r, t: x.t } : null))).filter(Boolean) as { c: number; r: number; t: string }[], [minggu]);
  const [fokus, setFokus] = useState<string | null>(null);
  const aktif = fokus && semuaSel.some((s) => s.t === fokus) ? fokus : (semuaSel.at(-1)?.t ?? null);

  // Ponsel: gulir ke minggu terbaru lebih dulu.
  useEffect(() => {
    const el = gulirRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [minggu.length]);

  const teksTip = (k: NonNullable<Kotak>) => {
    const s = k.sel;
    if (s && !STATUS_BEKERJA.has(s.s)) return <><b className="font-semibold">{LABEL_STATUS[s.s]}</b> · {tanggalPanjang(k.t)}</>;
    if (!s) return <>Belum ada catatan · {tanggalPanjang(k.t)}</>;
    return (
      <>
        <b className="font-semibold">{k.n} kegiatan</b>
        {s.s === "TUGAS_LUAR" ? " (tugas luar)" : ""} · {tanggalPanjang(k.t)}
      </>
    );
  };

  const tampilkanTip = (el: HTMLElement, k: NonNullable<Kotak>) => {
    const wadah = el.closest("[data-grafik]") as HTMLElement | null;
    if (!wadah) return;
    const a = el.getBoundingClientRect();
    const b = wadah.getBoundingClientRect();
    const x = a.left - b.left + a.width / 2;
    // Dekat tepi → tooltip menempel ke sisi dalam agar tak meluap keluar kartu/halaman.
    const rata = x < 140 ? "kiri" : x > b.width - 140 ? "kanan" : "tengah";
    setTip({ x, y: a.top - b.top, rata, teks: teksTip(k) });
  };

  const pindah = (e: React.KeyboardEvent, t: string) => {
    const i = semuaSel.findIndex((s) => s.t === t);
    if (i < 0) return;
    const { c, r } = semuaSel[i];
    const cari = (cc: number, rr: number) => semuaSel.find((s) => s.c === cc && s.r === rr)?.t;
    let tujuan: string | undefined;
    if (e.key === "ArrowRight") tujuan = cari(c + 1, r);
    else if (e.key === "ArrowLeft") tujuan = cari(c - 1, r);
    else if (e.key === "ArrowDown") tujuan = semuaSel[i + 1]?.t;
    else if (e.key === "ArrowUp") tujuan = semuaSel[i - 1]?.t;
    else if (e.key === "Home") tujuan = semuaSel[0]?.t;
    else if (e.key === "End") tujuan = semuaSel.at(-1)?.t;
    else if ((e.key === "Enter" || e.key === " ") && onPilih) {
      e.preventDefault();
      onPilih(t);
      return;
    } else return;
    e.preventDefault();
    if (!tujuan) return;
    setFokus(tujuan);
    const el = gulirRef.current?.querySelector<HTMLElement>(`[data-t="${tujuan}"]`);
    el?.focus();
  };

  return (
    <div ref={ukurRef} data-grafik className="relative">
      <div ref={gulirRef} className="overflow-x-auto pb-1">
        <table
          role="grid"
          aria-readonly
          aria-label="Grafik kegiatan harian"
          className="mx-auto border-separate border-spacing-[3px]"
          onMouseLeave={() => setTip(null)}
        >
          <thead>
            <tr className="h-4">
              <td className="sticky left-0 z-[1] bg-surface" style={{ minWidth: LEBAR_LABEL - JARAK }} />
              {minggu.map((_, i) => {
                const l = labelBulan.find((x) => x.kolom === i);
                return (
                  <td key={i} className="relative p-0 align-bottom">
                    {l && <span className="absolute bottom-0.5 left-0 whitespace-nowrap text-[11px] leading-none text-fg-muted">{l.teks}</span>}
                  </td>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {URUT_HARI.map((hari, r) => (
              <tr key={hari}>
                <td className="sticky left-0 z-[1] bg-surface p-0 pr-1 text-right align-middle text-[11px] leading-none text-fg-muted">
                  {LABEL_BARIS.has(hari) ? NAMA_HARI_PENDEK[hari] : <span className="sr-only">{NAMA_HARI_PENDEK[hari]}</span>}
                </td>
                {minggu.map((k, c) => {
                  const x = k[r];
                  if (!x) return <td key={c} className="p-0" style={ukuran} />;
                  const libur = x.sel && !STATUS_BEKERJA.has(x.sel.s);
                  return (
                    <td
                      key={c}
                      role="gridcell"
                      data-t={x.t}
                      data-tingkat={x.tingkat}
                      tabIndex={x.t === aktif ? 0 : -1}
                      aria-label={`${x.sel ? (libur ? LABEL_STATUS[x.sel.s] : `${x.n} kegiatan`) : "Belum ada catatan"}, ${tanggalPanjang(x.t)}`}
                      aria-current={x.t === hariIni ? "date" : undefined}
                      onMouseEnter={(e) => tampilkanTip(e.currentTarget, x)}
                      onFocus={(e) => {
                        setFokus(x.t);
                        tampilkanTip(e.currentTarget, x);
                      }}
                      onBlur={() => setTip(null)}
                      onClick={() => onPilih?.(x.t)}
                      onKeyDown={(e) => pindah(e, x.t)}
                      style={ukuran}
                      className={cn(
                        "relative rounded-[3px] p-0 outline-offset-1 ring-1 ring-inset ring-black/[0.06] transition-transform focus-visible:outline-2 focus-visible:outline-brand-ring",
                        WARNA_TINGKAT[x.tingkat],
                        onPilih && "cursor-pointer hover:scale-125",
                        libur && "after:absolute after:inset-[32%] after:rounded-full after:bg-fg-subtle",
                        x.t === hariIni && "ring-fg/40",
                        x.t === sorot && "motion-safe:animate-denyut",
                      )}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tip && (
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-20 -translate-y-full whitespace-nowrap rounded-md bg-fg px-2.5 py-1.5 text-xs text-white shadow-md",
            tip.rata === "tengah" && "-translate-x-1/2",
            tip.rata === "kiri" && "-translate-x-3",
            tip.rata === "kanan" && "-translate-x-[calc(100%-0.75rem)]",
          )}
          style={{ left: tip.x, top: tip.y - 6 }}
        >
          {tip.teks}
          <span
            aria-hidden
            className={cn(
              "absolute top-full -translate-x-1/2 border-4 border-transparent border-t-fg",
              tip.rata === "tengah" ? "left-1/2" : tip.rata === "kiri" ? "left-3" : "right-3 translate-x-1/2",
            )}
          />
        </div>
      )}
    </div>
  );
}

/** Legenda "Sedikit ▢▢▢▢▢ Banyak" + penanda hari tidak bekerja. */
export function LegendaGrafik({ ambang }: { ambang: [number, number, number] }) {
  const rentang = [
    "Tanpa kegiatan",
    `1–${ambang[0]} kegiatan`,
    `${ambang[0] + 1}–${ambang[1]} kegiatan`,
    `${ambang[1] + 1}–${ambang[2]} kegiatan`,
    `${ambang[2] + 1}+ kegiatan`,
  ].map((s) => s.replace(/^(\d+)–\1 /, "$1 "));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-muted">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="relative size-[11px] rounded-[2.5px] bg-heat-0 ring-1 ring-inset ring-black/[0.06] after:absolute after:inset-[3.5px] after:rounded-full after:bg-fg-subtle" />
        Off / cuti / izin
      </span>
      <span className="inline-flex items-center gap-1">
        Sedikit
        {WARNA_TINGKAT.map((w, i) => (
          <span key={w} title={rentang[i]} className={cn("size-[11px] rounded-[2.5px] ring-1 ring-inset ring-black/[0.06]", w)} />
        ))}
        Banyak
      </span>
    </div>
  );
}
