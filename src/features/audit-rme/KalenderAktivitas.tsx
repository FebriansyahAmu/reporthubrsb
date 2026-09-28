"use client";

import { cn } from "@/lib/cn";
import { KATEGORI, KATEGORI_KEYS } from "@/server/modules/audit-rme/kunjungan.constants";
import type { HarianPetugas } from "./audit.client";

const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const bulanFmt = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" });
const panjangFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Skala berurutan satu warna (brand), terang → gelap; teks putih hanya di tingkat tergelap (kontras AA). */
const TINGKAT = [
  "bg-surface-2/60 text-fg-subtle",
  "bg-brand/12 text-fg",
  "bg-brand/28 text-fg",
  "bg-brand/50 text-fg",
  "bg-brand text-white",
];

const tanggal = (iso: string) => new Date(`${iso}T00:00:00Z`);

/**
 * Kalender aktivitas per HARI DINAS (07.00–07.00): baris = minggu, kolom =
 * Senin–Minggu, warna = jumlah input klinis aktif (relatif terhadap hari
 * tersibuk petugas ini). Titik merah = ada input dibatalkan.
 */
export function KalenderAktivitas({ harian }: { harian: HarianPetugas[] }) {
  if (harian.length === 0) return null;
  const maks = Math.max(1, ...harian.map((h) => h.klinis));
  const tingkat = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / maks) * 4)));

  const offset = (tanggal(harian[0].tanggal).getUTCDay() + 6) % 7;
  const sel: (HarianPetugas | null)[] = [...Array<null>(offset).fill(null), ...harian];
  while (sel.length % 7) sel.push(null);
  const minggu = Array.from({ length: sel.length / 7 }, (_, i) => sel.slice(i * 7, i * 7 + 7));

  return (
    <div>
      <table className="w-full table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            {HARI.map((h) => (
              <th key={h} scope="col" className="pb-0.5 text-[10px] font-semibold text-fg-muted">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {minggu.map((row, i) => (
            <tr key={i}>
              {row.map((h, j) => {
                if (!h) return <td key={j} aria-hidden />;
                const d = tanggal(h.tanggal);
                const rincian = KATEGORI_KEYS.filter((k) => h.perKategori[k] > 0).map((k) => `${KATEGORI[k].label} ${h.perKategori[k]}`);
                const label = `${panjangFmt.format(d)}: ${h.klinis} input klinis${rincian.length ? ` (${rincian.join(", ")})` : ""}${h.tarif ? `, ${h.tarif} item tarif` : ""}${h.batal ? `, ${h.batal} batal` : ""}`;
                const awal = d.getUTCDate() === 1 || h === harian[0];
                return (
                  <td key={j} className="p-0">
                    <div
                      title={label}
                      aria-label={label}
                      className={cn("relative flex h-11 flex-col justify-between rounded-md px-1.5 py-1", TINGKAT[tingkat(h.klinis)])}
                    >
                      <span className="text-[9px] leading-none opacity-80">
                        {d.getUTCDate()}
                        {awal && ` ${bulanFmt.format(d)}`}
                      </span>
                      <span className="text-right text-sm leading-none font-semibold tabular">{h.klinis || ""}</span>
                      {h.batal > 0 && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-danger ring-1 ring-surface" aria-hidden />}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-fg-muted">
        <span className="inline-flex items-center gap-1">
          Sedikit
          {TINGKAT.map((t, i) => <span key={i} className={cn("size-3 rounded-sm", t.split(" ")[0])} aria-hidden />)}
          Banyak
        </span>
        <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-danger" aria-hidden /> ada input batal</span>
        <span>Angka = input klinis aktif per hari dinas (07.00–07.00)</span>
      </div>
    </div>
  );
}
