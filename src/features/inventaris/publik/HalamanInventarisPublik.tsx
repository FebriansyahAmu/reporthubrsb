import type { ReactNode } from "react";
import type { InventarisPublik } from "@/server/modules/inventaris/publik.types";
import { DaftarBarangPublik } from "./DaftarBarangPublik";

const waktuWita = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Makassar",
});

/**
 * "Papan nama" ruangan — kelanjutan digital dari label yang baru dipindai:
 * pelat navy bergaris aksen di tepi kiri seperti signage rumah sakit. Dipakai
 * juga oleh halaman "tautan tidak berlaku".
 */
export function PapanRuangan({ judul, children }: { judul: string; children?: ReactNode }) {
  return (
    <header className="relative overflow-hidden rounded-[var(--radius-lg)] bg-fg px-6 pb-6 pt-5 text-white shadow-md before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:bg-brand-ring sm:px-8 sm:pb-8 sm:pt-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-white p-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- aset statis lokal, tanpa optimizer */}
          <img src="/logo/logoboltim.png" alt="" className="size-full object-contain" />
        </span>
        <p className="text-[13px] font-medium leading-snug text-white/75">
          RSUD Bolaang Mongondow Timur
          <span className="block text-white/55">Kartu Inventaris Ruangan</span>
        </p>
      </div>
      <h1 className="mt-7 text-[length:clamp(1.75rem,7.5vw,2.5rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-balance [overflow-wrap:anywhere]">
        {judul}
      </h1>
      {children}
    </header>
  );
}

/**
 * Halaman publik daftar barang satu ruangan (server component). Bagian
 * interaktif (ringkasan kondisi yang sekaligus filter, pencarian, daftar)
 * ada di `DaftarBarangPublik`.
 */
export function HalamanInventarisPublik({ data }: { data: InventarisPublik }) {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pb-12 pt-4 sm:pt-8">
      <PapanRuangan judul={data.ruangan}>
        <p className="mt-4 text-[15px] leading-relaxed text-white/80">
          <span className="font-bold tabular-nums text-white">{data.totalUnit.toLocaleString("id-ID")} unit</span> barang
          tercatat di ruangan ini, per {waktuWita.format(new Date(data.disusunPada))} WITA.
        </p>
      </PapanRuangan>

      <DaftarBarangPublik barang={data.barang} kondisi={data.kondisi} totalUnit={data.totalUnit} />

      {data.terpotong && (
        <p className="mt-4 rounded-[var(--radius-md)] bg-warning-soft px-4 py-3 text-[13px] text-warning">
          Hanya {data.totalUnit.toLocaleString("id-ID")} unit pertama yang ditampilkan.
        </p>
      )}

      <footer className="mt-10 border-t border-border-strong pt-5 text-[13px] leading-relaxed text-fg-muted">
        <p>Halaman ini hanya menampilkan nama, kondisi, dan tahun perolehan barang.</p>
        <p className="mt-1">Ada barang yang tidak sesuai? Sampaikan kepada petugas pengelola barang RSUD Boltim.</p>
      </footer>
    </main>
  );
}
