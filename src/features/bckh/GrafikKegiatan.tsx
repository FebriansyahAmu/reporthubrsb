"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useMeasure } from "@/components/charts/useMeasure";
import { cn } from "@/lib/cn";
import { tambahHari, tanggalPanjang, tingkat } from "@/server/modules/bckh/bckh.aturan";
import { LABEL_STATUS, NAMA_BULAN_PENDEK, NAMA_HARI_PENDEK, STATUS_BEKERJA } from "@/server/modules/bckh/bckh.constants";
import type { SelGrafik } from "@/server/modules/bckh/bckh.types";

const WARNA_TINGKAT = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"] as const;
/** Baris grafik: Senin di atas (pekan kerja) → Minggu. Label hanya Sen/Rab/Jum seperti GitHub. */
const URUT_HARI = [1, 2, 3, 4, 5, 6, 0] as const;
const LABEL_BARIS = new Set([1, 3, 5]);
/**
 * Lebar kolom label hari, jarak antarsel, & batas sisi sel (px). Sel minimal
 * lebih besar di layar sentuh agar mudah diketuk (lebih sering dibagi ke pita).
 */
const LEBAR_LABEL = 28;
const JARAK = 3;
const SEL_MIN = { halus: 9, kasar: 13 } as const;
const SEL_MAKS = 15;

const KUERI_SENTUH = "(pointer: coarse)";
function usePenunjukKasar(): boolean {
  return useSyncExternalStore(
    (ubah) => {
      const m = window.matchMedia(KUERI_SENTUH);
      m.addEventListener("change", ubah);
      return () => m.removeEventListener("change", ubah);
    },
    () => window.matchMedia(KUERI_SENTUH).matches,
    () => false,
  );
}

type Kotak = { t: string; n: number; tingkat: 0 | 1 | 2 | 3 | 4; sel?: SelGrafik } | null;

/** Senin pada/sebelum tanggal. */
const seninDari = (ymd: string) => tambahHari(ymd, -((new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7));
const bulanKolom = (k: Kotak[]) => k.find(Boolean)?.t.slice(5, 7) ?? "";

/**
 * Bagi kolom minggu ke pita bertumpuk agar tak pernah menggulir menyamping:
 * satu pita bila semua minggu muat dengan sel ≥ SEL_MIN, selain itu 2/3/…
 * pita sama panjang — batas pita digeser ≤ 2 kolom ke awal bulan terdekat
 * agar tiap pita dimulai dengan bulan utuh.
 */
function bagiPita(kolom: Kotak[][], muat: number): [number, number][] {
  const n = Math.ceil(kolom.length / Math.max(1, muat));
  const batas = [0];
  for (let i = 1; i < n; i++) {
    const target = Math.round((i * kolom.length) / n);
    const awalBulan = [0, -1, 1, -2, 2]
      .map((d) => target + d)
      .find((c) => c > batas[batas.length - 1] && c < kolom.length && bulanKolom(kolom[c]) !== bulanKolom(kolom[c - 1]) && c - batas[batas.length - 1] <= muat);
    batas.push(awalBulan ?? target);
  }
  batas.push(kolom.length);
  const pita = batas.slice(1).map((akhir, i): [number, number] => [batas[i], akhir]);
  // Pergeseran ke awal bulan tak boleh membuat pita terakhir melebihi muat.
  return pita.every(([a, b]) => b - a <= muat) ? pita : Array.from({ length: n }, (_, i) => [Math.round((i * kolom.length) / n), Math.round(((i + 1) * kolom.length) / n)]);
}

/**
 * Label bulan satu pita: di kolom pergantian bulan; label awal pita dilewati bila
 * < 3 kolom dari label berikutnya, label di 1 kolom terakhir pita dilewati (tak muat).
 */
function labelPita(kolom: Kotak[][]): { kolom: number; teks: string }[] {
  const awal: { kolom: number; teks: string }[] = [];
  kolom.forEach((k, i) => {
    const b = bulanKolom(k);
    if (b && (i === 0 || b !== bulanKolom(kolom[i - 1]))) awal.push({ kolom: i, teks: NAMA_BULAN_PENDEK[Number(b) - 1] });
  });
  return awal.filter((l, i) => (awal[i + 1] ? awal[i + 1].kolom - l.kolom >= 3 : kolom.length - l.kolom >= 2));
}

/**
 * Grafik kegiatan ala grafik kontribusi GitHub: kolom = minggu (Senin–Minggu),
 * warna = jumlah kegiatan (kuartil pribadi, 5 tingkat teal). Hari tidak bekerja
 * yang tercatat (Off/Cuti/…) diberi titik. Interaktif: tooltip, klik/Enter =
 * buka catatan hari itu, panah = pindah sel (roving tabindex, lintas pita).
 * `sorot` = sel yang baru disimpan → berdenyut sekali. Lebar sel cair 10–15 px;
 * kartu sempit (ponsel) → minggu dibagi ke beberapa pita, tanpa gulir samping.
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
  const [ukurRef, lebar] = useMeasure<HTMLDivElement>();
  const kasar = usePenunjukKasar();
  const [tip, setTip] = useState<{ x: number; y: number; t: string } | null>(null);

  const minggu = useMemo(() => {
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
    return kolom;
  }, [sel, dari, sampai, hariIni, ambang]);

  // Lebar tabel = label + n·sisi + (n+2)·jarak (border-spacing di tiap tepi kolom).
  const { pita, sisi } = useMemo(() => {
    if (lebar <= 0) return { pita: [[0, minggu.length]] as [number, number][], sisi: 11 };
    const muat = Math.max(1, Math.floor((lebar - LEBAR_LABEL - 2 * JARAK) / (SEL_MIN[kasar ? "kasar" : "halus"] + JARAK)));
    const pita = bagiPita(minggu, muat);
    const terpanjang = Math.max(...pita.map(([a, b]) => b - a));
    const sisi = Math.min(SEL_MAKS, Math.floor((lebar - LEBAR_LABEL - (terpanjang + 2) * JARAK) / terpanjang));
    return { pita, sisi: Math.max(1, sisi) };
  }, [lebar, minggu, kasar]);

  // Fokus roving: mulai di hari terakhir yang tampil; panah = ±1 hari / ±1 minggu (lintas pita).
  const petaKotak = useMemo(() => new Map(minggu.flat().flatMap((x) => (x ? [[x.t, x] as const] : []))), [minggu]);
  const urutTanggal = useMemo(() => [...petaKotak.keys()], [petaKotak]);
  const [fokus, setFokus] = useState<string | null>(null);
  const aktif = fokus && petaKotak.has(fokus) ? fokus : (urutTanggal.at(-1) ?? null);
  // Tooltip menyimpan TANGGAL saja; teksnya dihitung dari data terbaru (tetap benar setelah grafik dimuat ulang).
  const kotakTip = tip ? petaKotak.get(tip.t) : undefined;

  const teksTip = (k: NonNullable<Kotak>) => {
    const s = k.sel;
    if (s && !STATUS_BEKERJA.has(s.s)) return <><b className="font-semibold">{LABEL_STATUS[s.s]}</b> · {tanggalPanjang(k.t)}</>;
    if (!s) return <>Belum ada catatan · {tanggalPanjang(k.t)}</>;
    return (
      <>
        <b className="font-semibold">{k.n} kegiatan</b>
        {s.s !== "MASUK" ? ` (${LABEL_STATUS[s.s].toLowerCase()})` : ""} · {tanggalPanjang(k.t)}
      </>
    );
  };

  const tampilkanTip = (el: HTMLElement, k: NonNullable<Kotak>) => {
    const wadah = el.closest("[data-grafik]") as HTMLElement | null;
    if (!wadah) return;
    const a = el.getBoundingClientRect();
    const b = wadah.getBoundingClientRect();
    setTip({ x: a.left - b.left + a.width / 2, y: a.top - b.top, t: k.t });
  };

  const pindah = (e: React.KeyboardEvent, t: string) => {
    let tujuan: string | undefined;
    if (e.key === "ArrowRight") tujuan = tambahHari(t, 7);
    else if (e.key === "ArrowLeft") tujuan = tambahHari(t, -7);
    else if (e.key === "ArrowDown") tujuan = tambahHari(t, 1);
    else if (e.key === "ArrowUp") tujuan = tambahHari(t, -1);
    else if (e.key === "Home") tujuan = urutTanggal[0];
    else if (e.key === "End") tujuan = urutTanggal.at(-1);
    else if ((e.key === "Enter" || e.key === " ") && onPilih) {
      e.preventDefault();
      onPilih(t);
      return;
    } else return;
    e.preventDefault();
    if (!tujuan || !petaKotak.has(tujuan)) return;
    setFokus(tujuan);
    ukurRef.current?.querySelector<HTMLElement>(`[data-t="${tujuan}"]`)?.focus();
  };

  const ukuran = { width: sisi, height: sisi };

  return (
    <div ref={ukurRef} data-grafik className="relative space-y-3" onMouseLeave={() => setTip(null)}>
      {pita.map(([dariKolom, sampaiKolom], p) => {
        const kolom = minggu.slice(dariKolom, sampaiKolom);
        const label = labelPita(kolom);
        const lebarTabel = LEBAR_LABEL + kolom.length * sisi + (kolom.length + 2) * JARAK;
        return (
          <table
            key={dariKolom}
            role="grid"
            aria-readonly
            aria-label={pita.length > 1 ? `Grafik kegiatan harian, bagian ${p + 1} dari ${pita.length}` : "Grafik kegiatan harian"}
            className="mx-auto table-fixed border-separate"
            style={{ borderSpacing: JARAK, width: lebarTabel }}
          >
            <colgroup>
              <col style={{ width: LEBAR_LABEL - JARAK }} />
              {kolom.map((_, i) => (
                <col key={i} style={{ width: sisi }} />
              ))}
            </colgroup>
            <thead>
              <tr className="h-3.5">
                <td className="p-0" />
                {label[0]?.kolom > 0 && <td colSpan={label[0].kolom} className="p-0" />}
                {label.map((l, i) => (
                  <td
                    key={l.kolom}
                    colSpan={(label[i + 1]?.kolom ?? kolom.length) - l.kolom}
                    className="overflow-hidden whitespace-nowrap p-0 align-bottom text-[11px] leading-none text-fg-muted"
                  >
                    {l.teks}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {URUT_HARI.map((hari, r) => (
                <tr key={hari}>
                  <td className="overflow-hidden p-0 pr-1 text-right align-middle text-[11px] leading-none text-fg-muted">
                    {LABEL_BARIS.has(hari) ? NAMA_HARI_PENDEK[hari] : <span className="sr-only">{NAMA_HARI_PENDEK[hari]}</span>}
                  </td>
                  {kolom.map((k, c) => {
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
        );
      })}
      {tip && kotakTip && (
        <>
          {/* Digeser agar selalu di dalam kartu (clamp terhadap lebarnya sendiri); teks panjang dibungkus. */}
          <div
            role="tooltip"
            className="pointer-events-none absolute z-20 w-max max-w-full rounded-md bg-fg px-2.5 py-1.5 text-xs leading-snug text-white shadow-md"
            style={{ left: tip.x, top: tip.y - 6, transform: `translate(clamp(${-tip.x}px, -50%, calc(${lebar - tip.x}px - 100%)), -100%)` }}
          >
            {teksTip(kotakTip)}
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute z-20 -translate-x-1/2 border-4 border-transparent border-t-fg"
            style={{ left: tip.x, top: tip.y - 6 }}
          />
        </>
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
