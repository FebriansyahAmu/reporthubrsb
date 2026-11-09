"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, History, Link2Off, PencilLine, Search, SearchX } from "lucide-react";
import { InputWithIcon } from "@/components/ui/Field";
import { SegmentedControl, type SegmentItem } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { DAFTAR_KATEGORI, KATEGORI_FORM, type KategoriForm } from "./kategori";
import { cocokLayanan, jenisDariLayanan, LAYANAN, layananDariJenis, TITIK_LAYANAN, type KunciLayanan } from "./layanan";
import type { JenisKunjungan, KodeForm } from "./registry";
import { TAMPILAN_FORM } from "./tampilan";

/** Satu form di katalog (dihitung server: hanya form yang boleh dilihat pengguna). */
export type ItemKatalog = {
  kode: KodeForm;
  kategori: KategoriForm;
  /** Ringkasan sasaran pasien, mis. "Pasien IGD & Rawat Inap". */
  sasaran: string;
  /** Jenis kunjungan sasaran (dasar filter layanan). */
  jenis: JenisKunjungan[];
  /** Nama ruang bila sasaran dibatasi ruangan (mis. RM.70: IRDO & Perawatan OBGYN). */
  ruangan: string[];
  /** Form dihitung wajib untuk episode berjenis ini. */
  wajib: JenisKunjungan[];
  draf: { saya: number; semua: number };
  /** Isian sebelum pasien terdaftar yang belum ditautkan ke pendaftaran. */
  belumTertaut: number;
};

/** Tautan pintas ringkasan (disusun server: rentang tanggal memakai hari ini WITA). */
export type TautanKatalog = { drafSaya: string };

const normal = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const daftarDan = (s: readonly string[]) => (s.length > 1 ? `${s.slice(0, -1).join(", ")} & ${s[s.length - 1]}` : s.join(""));

/**
 * Katalog Form RM (PRD §6.1, §16 "Katalog baru"): filter layanan langsung
 * (disimpan di `?layanan=`), cari kode / judul, kartu per formulir di bawah
 * kategorinya. Kategori tanpa form yang cocok tak tampil.
 */
export function KatalogFormRm({
  items,
  awalLayanan,
  tautan,
}: {
  items: ItemKatalog[];
  awalLayanan: KunciLayanan | null;
  tautan: TautanKatalog;
}) {
  const [layanan, setLayanan] = useState<KunciLayanan | null>(awalLayanan);
  const [cari, setCari] = useState("");

  // Hanya layanan yang benar-benar dimiliki form yang boleh dilihat; satu layanan saja → tanpa filter.
  const layananAda = LAYANAN.filter((l) => items.some((it) => it.jenis.includes(l.jenis)));
  const pakaiFilter = layananAda.length > 1;
  const aktif = pakaiFilter && layanan && layananAda.some((l) => l.kunci === layanan) ? layanan : null;

  const pilihLayanan = (v: KunciLayanan | "semua") => {
    const k = v === "semua" ? null : v;
    setLayanan(k);
    const url = new URL(window.location.href);
    if (k) url.searchParams.set("layanan", k);
    else url.searchParams.delete("layanan");
    window.history.replaceState(window.history.state, "", url);
  };

  const q = normal(cari);
  const cocok = items.filter(
    (it) =>
      cocokLayanan(it.jenis, aktif) &&
      (!q || normal(`${it.kode} ${TAMPILAN_FORM[it.kode].label} ${TAMPILAN_FORM[it.kode].keterangan}`).includes(q)),
  );
  const kelompok = DAFTAR_KATEGORI.map((k) => ({ k, forms: cocok.filter((it) => it.kategori === k) })).filter(
    (g) => g.forms.length > 0,
  );

  const segmen: SegmentItem<KunciLayanan | "semua">[] = [
    { value: "semua", label: "Semua", jumlah: items.length },
    ...layananAda.map((l) => ({
      value: l.kunci,
      label: l.label,
      labelSingkat: l.singkat,
      jumlah: items.filter((it) => it.jenis.includes(l.jenis)).length,
    })),
  ];

  const drafSaya = items.reduce((n, it) => n + it.draf.saya, 0);
  const belumTertaut = items.filter((it) => it.belumTertaut > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {pakaiFilter ? (
          <SegmentedControl
            label="Filter layanan"
            items={segmen}
            value={aktif ?? "semua"}
            onChange={pilihLayanan}
            penuh
            jumlahPonsel={false}
            className="md:shrink-0"
          />
        ) : (
          <span />
        )}
        <div className="w-full min-w-0 md:w-auto md:max-w-xs md:flex-1">
          <label htmlFor="cari-form" className="sr-only">
            Cari formulir
          </label>
          <InputWithIcon
            id="cari-form"
            type="search"
            icon={<Search className="size-4" />}
            placeholder="Cari kode atau judul, mis. RM.04"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            autoComplete="off"
            className="rounded-xl shadow-xs"
          />
        </div>
      </div>

      {(drafSaya > 0 || belumTertaut.length > 0) && (
        <div className="flex flex-col gap-2 rounded-xl border border-warning/25 bg-warning-soft/60 px-4 py-3 text-sm text-fg sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
          {drafSaya > 0 && (
            <p className="flex items-start gap-2">
              <PencilLine className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                Anda punya <b className="font-semibold">{drafSaya} draf</b> yang belum difinalkan.{" "}
                <Link
                  href={tautan.drafSaya}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-md font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                >
                  <History className="size-3.5" aria-hidden />
                  Lihat draf saya
                </Link>
              </span>
            </p>
          )}
          {belumTertaut.map((it) => (
            <p key={it.kode} className="flex items-start gap-2">
              <Link2Off className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                <b className="font-semibold">{it.belumTertaut}</b> isian {TAMPILAN_FORM[it.kode].singkat.toLowerCase()} belum tertaut ke
                pendaftaran.{" "}
                <Link
                  href={`/form-rm/f/${it.kode}`}
                  prefetch={false}
                  className="whitespace-nowrap rounded-md font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                >
                  Tautkan
                </Link>
              </span>
            </p>
          ))}
        </div>
      )}

      {kelompok.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border-strong bg-surface/60 px-6 py-14 text-center">
          <span className="mb-3 grid size-11 place-items-center rounded-full bg-surface-2 text-fg-subtle">
            <SearchX className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-fg">Tidak ada formulir yang cocok</p>
          <p className="mt-1 max-w-sm text-sm text-fg-muted">
            {aktif ? "Coba layanan lain, atau periksa ejaan kode dan judul." : "Periksa ejaan kode atau judul formulir."}
          </p>
          {(aktif || cari) && (
            <button
              type="button"
              onClick={() => {
                setCari("");
                pilihLayanan("semua");
              }}
              className="mt-4 inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-fg shadow-xs transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              Tampilkan semua formulir
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {kelompok.map(({ k, forms }) => {
            const kat = KATEGORI_FORM[k];
            const Ikon = kat.ikon;
            return (
              <section key={k} aria-labelledby={`kat-${k}`}>
                <header className="mb-3 flex items-start gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface text-fg-muted shadow-xs">
                    <Ikon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 id={`kat-${k}`} className="flex items-baseline gap-2 text-[15px] font-semibold text-fg">
                      {kat.label}
                      <span className="text-xs font-medium text-fg-subtle tabular">{forms.length} formulir</span>
                    </h2>
                    <p className="text-[13px] text-fg-muted">{kat.keterangan}</p>
                  </div>
                </header>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {forms.map((it) => (
                    <li key={it.kode} className="min-w-0">
                      <KartuForm item={it} layanan={aktif} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** `layanan` = filter katalog aktif: ikut dibawa ke halaman detail (daftar pasien langsung tersaring). */
function KartuForm({ item, layanan }: { item: ItemKatalog; layanan: KunciLayanan | null }) {
  const t = TAMPILAN_FORM[item.kode];
  const Ikon = t.ikon;
  const wajib = item.wajib.map((j) => layananDariJenis(j)?.label ?? "").filter(Boolean);
  const bawa = layanan && item.jenis.length > 1 && item.jenis.includes(jenisDariLayanan(layanan)) ? `?layanan=${layanan}` : "";
  return (
    <Link
      href={`/form-rm/f/${item.kode}${bawa}`}
      prefetch={false}
      title={item.sasaran}
      className={cn(
        "group flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-xs",
        "transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand ring-1 ring-inset ring-brand/10">
          <Ikon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-border px-1.5 font-mono text-[11px] font-medium leading-5 text-fg-muted">
              {item.kode}
            </span>
            {wajib.length > 0 && (
              <span className="rounded-md bg-accent-soft px-1.5 text-[11px] font-medium leading-5 text-accent">
                Wajib {daftarDan(wajib)}
              </span>
            )}
            {t.berulang && <span className="text-[11px] leading-5 text-fg-subtle">Satu isian per {t.berulang.satuan}</span>}
          </div>
          <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-fg">{t.label}</h3>
        </div>
      </div>

      <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-fg-muted">{t.keterangan}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {item.jenis.map((j) => (
          <span
            key={j}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 text-[11px] font-medium leading-5 text-fg-muted"
          >
            <span className={cn("size-1.5 rounded-full", TITIK_LAYANAN[j])} aria-hidden />
            {layananDariJenis(j)?.label}
          </span>
        ))}
        {item.ruangan.length > 0 && <span className="text-[11px] text-fg-subtle">Hanya {daftarDan(item.ruangan)}</span>}
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
          <StatusDraf item={item} />
          <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-brand">
            Pilih pasien
            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

function StatusDraf({ item }: { item: ItemKatalog }) {
  const { saya, semua } = item.draf;
  if (item.belumTertaut > 0) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1 font-medium text-warning">
        <Link2Off className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{item.belumTertaut} belum tertaut</span>
      </span>
    );
  }
  if (semua === 0) return <span className="text-fg-subtle">Tidak ada draf berjalan</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-fg-muted">
      <PencilLine className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
      <span className="truncate">
        {saya > 0 ? (
          <>
            <b className="font-semibold text-warning">{saya} draf Anda</b>
            {semua > saya && <> dari {semua}</>}
          </>
        ) : (
          <>{semua} draf berjalan</>
        )}
      </span>
    </span>
  );
}
