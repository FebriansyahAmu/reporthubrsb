"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, PencilLine, Search, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { EmptyState } from "@/components/feedback/States";
import { DAFTAR_KATEGORI, KATEGORI_FORM, type KategoriForm } from "./kategori";
import type { KodeForm } from "./registry";
import { TAMPILAN_FORM } from "./tampilan";

/** Satu form di katalog (dihitung server: hanya form yang boleh dilihat pengguna). */
export type ItemKatalog = {
  kode: KodeForm;
  kategori: KategoriForm;
  /** Ringkasan sasaran pasien, mis. "Pasien IGD & Rawat Inap". */
  sasaran: string;
  draf: { saya: number; semua: number };
};

const normal = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Katalog Form RM per kategori (PRD §6.1): cari berdasarkan kode / judul, lalu
 * pilih form → pemilih pasien. Kategori tanpa form yang boleh dilihat tak tampil.
 */
export function KatalogFormRm({ items }: { items: ItemKatalog[] }) {
  const [cari, setCari] = useState("");
  const q = normal(cari);
  const cocok = q
    ? items.filter((it) => normal(`${it.kode} ${TAMPILAN_FORM[it.kode].label} ${TAMPILAN_FORM[it.kode].keterangan}`).includes(q))
    : items;
  const kelompok = DAFTAR_KATEGORI.map((k) => ({ k, forms: cocok.filter((it) => it.kategori === k) })).filter(
    (g) => g.forms.length > 0,
  );

  return (
    <div className="space-y-5">
      <div className="max-w-md">
        <Label htmlFor="cari-form">Cari formulir</Label>
        <InputWithIcon
          id="cari-form"
          type="search"
          icon={<Search className="size-4" />}
          placeholder="Kode atau judul, mis. RM.04 / triase"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          autoComplete="off"
        />
      </div>

      {kelompok.length === 0 ? (
        <Card>
          <EmptyState title="Tidak ada formulir yang cocok" description="Periksa ejaan kode atau judul formulir." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {kelompok.map(({ k, forms }) => {
            const kat = KATEGORI_FORM[k];
            const Ikon = kat.ikon;
            return (
              <Card key={k} className="overflow-hidden">
                <section aria-labelledby={`kat-${k}`}>
                  <header className="flex items-start gap-3 border-b border-border px-4 py-3.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand-soft-fg">
                      <Ikon className="size-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h2 id={`kat-${k}`} className="font-semibold text-fg">
                        {kat.label}
                      </h2>
                      <p className="text-xs text-fg-muted">{kat.keterangan}</p>
                    </div>
                  </header>
                  <ul className="divide-y divide-border">
                    {forms.map((it) => (
                      <li key={it.kode}>
                        <BarisForm item={it} />
                      </li>
                    ))}
                  </ul>
                </section>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BarisForm({ item }: { item: ItemKatalog }) {
  const t = TAMPILAN_FORM[item.kode];
  return (
    <Link
      href={`/form-rm/f/${item.kode}`}
      prefetch={false}
      className="group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring"
    >
      <span className="w-14 shrink-0 font-mono text-xs font-semibold text-brand">{item.kode}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-fg">{t.label}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5 text-fg-subtle" aria-hidden />
            {item.sasaran}
          </span>
          {item.draf.semua > 0 && (
            <span className="inline-flex items-center gap-1">
              <PencilLine className="size-3.5 text-fg-subtle" aria-hidden />
              {item.draf.saya > 0 ? (
                <>
                  <b className="font-semibold text-warning">{item.draf.saya} draf Anda</b>
                  {item.draf.semua > item.draf.saya && <span>· {item.draf.semua} draf seluruhnya</span>}
                </>
              ) : (
                <span>{item.draf.semua} draf berjalan</span>
              )}
            </span>
          )}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg-muted" />
    </Link>
  );
}
