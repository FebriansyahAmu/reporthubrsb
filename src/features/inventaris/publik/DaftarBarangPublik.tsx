"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BarangPublik, KondisiPublik } from "@/server/modules/inventaris/publik.types";
import { ISI_KONDISI, TITIK_KONDISI } from "./tone";

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const angka = (n: number) => n.toLocaleString("id-ID");

/**
 * Bagian interaktif halaman publik: ringkasan kondisi (bilah komposisi +
 * legenda yang sekaligus menjadi saringan), pencarian nama, dan daftar barang
 * bergaya register. Semua di browser atas data yang sudah dikirim server.
 * Tanpa atribut `style` inline — CSP halaman publik melarangnya.
 */
export function DaftarBarangPublik({
  barang,
  kondisi,
  totalUnit,
}: {
  barang: BarangPublik[];
  kondisi: KondisiPublik[];
  totalUnit: number;
}) {
  const [cari, setCari] = useState("");
  const [pilih, setPilih] = useState<string | null>(null);
  const kunci = normal(useDeferredValue(cari));

  const tampil = useMemo(
    () => barang.filter((b) => (!pilih || b.kondisi === pilih) && (!kunci || normal(b.nama).includes(kunci))),
    [barang, pilih, kunci],
  );
  const unitTampil = tampil.reduce((n, b) => n + b.jumlah, 0);
  const kondisiPilih = kondisi.find((k) => k.nama === pilih);

  return (
    <>
      {totalUnit > 0 && (
        <section aria-labelledby="judul-kondisi" className="mt-9">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="judul-kondisi" className="text-[15px] font-semibold text-fg">Kondisi barang</h2>
            {pilih && (
              <button type="button" onClick={() => setPilih(null)} className="text-[13px] font-medium text-brand hover:text-brand-hover focus-visible:underline focus-visible:outline-none">
                Tampilkan semua
              </button>
            )}
          </div>
          <BilahKondisi kondisi={kondisi} total={totalUnit} />
          <ul className="-mx-3 mt-2 grid grid-cols-1 gap-x-2 sm:grid-cols-3">
            {kondisi.map((k) => {
              const aktif = pilih === k.nama;
              return (
                <li key={k.nama}>
                  <button
                    type="button"
                    aria-pressed={aktif}
                    onClick={() => setPilih(aktif ? null : k.nama)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-left text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                      aktif ? "bg-surface text-fg shadow-sm ring-1 ring-brand/40" : pilih ? "text-fg-subtle hover:bg-surface/70" : "text-fg hover:bg-surface/70",
                    )}
                  >
                    <span className={cn("size-2.5 shrink-0 rounded-full", TITIK_KONDISI[k.tone])} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{k.nama}</span>
                    <span className="font-semibold tabular-nums">{angka(k.jumlah)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="judul-daftar" className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="judul-daftar" className="text-[15px] font-semibold text-fg">Daftar barang</h2>
          <p className="text-[13px] tabular-nums text-fg-muted" aria-live="polite">
            {angka(unitTampil)} unit dalam {angka(tampil.length)} jenis
          </p>
        </div>

        {/* Menempel di atas saat menggulir daftar panjang. */}
        <div className="sticky top-0 z-10 -mx-4 mt-2 flex items-center gap-2 bg-bg/85 px-4 py-2.5 backdrop-blur-md">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Cari nama barang</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama barang"
              maxLength={80}
              autoComplete="off"
              enterKeyHint="search"
              className="h-11 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-[15px] text-fg shadow-xs placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40"
            />
          </label>
          {kondisiPilih && (
            <button
              type="button"
              onClick={() => setPilih(null)}
              aria-label={`Hapus saringan ${kondisiPilih.nama}`}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-surface pl-3 pr-2.5 text-[13px] font-medium text-fg shadow-xs ring-1 ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <span className={cn("size-2 rounded-full", TITIK_KONDISI[kondisiPilih.tone])} aria-hidden />
              <span className="max-w-[7rem] truncate">{kondisiPilih.nama}</span>
              <X className="size-3.5 text-fg-subtle" aria-hidden />
            </button>
          )}
        </div>

        <div className="mt-1 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-xs">
          {tampil.length === 0 ? (
            <div className="px-6 py-12 text-center">
              {barang.length === 0 ? (
                <p className="text-[15px] text-fg-muted">Belum ada barang tercatat di ruangan ini.</p>
              ) : (
                <>
                  <p className="text-[15px] text-fg">Tidak ada barang yang cocok.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCari("");
                      setPilih(null);
                    }}
                    className="mt-3 inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-brand ring-1 ring-border hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                  >
                    Hapus pencarian &amp; saringan
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
            <div aria-hidden className="flex justify-between border-b border-border bg-surface-2/50 px-4 py-2 text-xs font-medium text-fg-muted sm:px-5">
              <span>Nama barang</span>
              <span>Unit</span>
            </div>
            <ul className="divide-y divide-border">
              {tampil.map((b) => (
                <li key={`${b.nama}|${b.kondisi}|${b.tahun ?? ""}`} className="flex items-start gap-4 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug text-fg [overflow-wrap:anywhere]">{b.nama}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-fg-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full", TITIK_KONDISI[b.tone])} aria-hidden />
                        {b.kondisi}
                      </span>
                      <span>{b.tahun ? `Perolehan ${b.tahun}` : "Tahun tidak tercatat"}</span>
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-[17px] font-bold leading-snug tabular-nums text-fg">
                    {angka(b.jumlah)}
                    <span className="sr-only"> unit</span>
                  </p>
                </li>
              ))}
            </ul>
            </>
          )}
        </div>
      </section>
    </>
  );
}

/**
 * Bilah komposisi kondisi — SVG dengan atribut x/width (bukan `style`), celah
 * 2 px antarsegmen dari goresan warna latar; ujung membulat dari wadahnya.
 */
function BilahKondisi({ kondisi, total }: { kondisi: KondisiPublik[]; total: number }) {
  const lebar = kondisi.map((k) => (k.jumlah / total) * 100);
  const segmen = kondisi.map((k, i) => ({ ...k, lebar: lebar[i], x: lebar.slice(0, i).reduce((a, b) => a + b, 0) }));
  const ringkas = kondisi.map((k) => `${k.nama} ${angka(k.jumlah)} unit`).join(", ");
  return (
    <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-2">
      <svg className="block size-full origin-left motion-safe:animate-tumbuh" role="img" aria-label={`Komposisi kondisi: ${ringkas}`}>
        {segmen.map((s) => (
          <rect
            key={s.nama}
            x={`${s.x.toFixed(3)}%`}
            y="0"
            width={`${s.lebar.toFixed(3)}%`}
            height="100%"
            strokeWidth={2}
            className={cn(ISI_KONDISI[s.tone], "stroke-bg")}
          />
        ))}
      </svg>
    </div>
  );
}
