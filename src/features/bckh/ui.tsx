"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  INFO_KATEGORI,
  LABEL_STATUS,
  NAMA_BULAN,
  STATUS_BEKERJA,
  type Kategori,
  type StatusHari,
} from "@/server/modules/bckh/bckh.constants";

/* --------------------------------------------------------------- identicon */

/** FNV-1a 32-bit — deterministik, cukup untuk pola identicon. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Hue identicon: keluarga dingin palet aplikasi (biru, teal, slate, nila). */
const HUE = [205, 188, 172, 222, 196, 240];

/**
 * Identicon 5×5 simetris dari ID pengguna (ala avatar bawaan GitHub) — tanpa
 * unggah foto, konsisten di semua perangkat.
 */
export function Identicon({ seed, className, label }: { seed: string; className?: string; label?: string }) {
  const h = hash(seed);
  const h2 = hash(`${seed}:2`);
  const hue = HUE[h % HUE.length];
  const sel: [number, number][] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      if ((h2 >> (r * 3 + c)) & 1) {
        sel.push([r, c]);
        if (c < 2) sel.push([r, 4 - c]);
      }
    }
  }
  return (
    <svg viewBox="-0.75 -0.75 6.5 6.5" className={cn("rounded-full bg-[#eef3f7]", className)} role="img" aria-label={label ?? "Avatar"}>
      {sel.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={c} y={r} width={1.02} height={1.02} fill={`hsl(${hue} 52% 42%)`} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------- kategori & status */

export function TitikKategori({ kategori, className }: { kategori: Kategori; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/5", className)}
      style={{ background: INFO_KATEGORI[kategori].warna }}
    />
  );
}

const NADA_STATUS: Record<StatusHari, string> = {
  MASUK: "bg-success-soft text-success ring-success/20",
  TUGAS_LUAR: "bg-brand-soft text-brand-soft-fg ring-brand/20",
  OFF: "bg-surface-2 text-fg-muted ring-border",
  CUTI: "bg-warning-soft text-warning ring-warning/20",
  SAKIT: "bg-danger-soft text-danger ring-danger/20",
  IZIN: "bg-warning-soft text-warning ring-warning/20",
  LIBUR: "bg-surface-2 text-fg-muted ring-border",
};

export function BadgeStatus({ status, className }: { status: StatusHari; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", NADA_STATUS[status], className)}>
      {LABEL_STATUS[status]}
    </span>
  );
}

export const bekerja = (s: StatusHari) => STATUS_BEKERJA.has(s);

/** Penghitung kecil di tab (ala "Counter" GitHub). */
export function Penghitung({ n, className }: { n: number | string; className?: string }) {
  return (
    <span className={cn("rounded-full bg-surface-2 px-1.5 py-px text-[11px] font-semibold tabular text-fg-muted", className)}>{n}</span>
  );
}

/* ------------------------------------------------ bilah komposisi kategori */

export type Bagian = { kunci: string; label: string; warna: string; n: number };

/**
 * Bilah komposisi tipis ala "Languages" GitHub: segmen proporsional dengan
 * celah 2 px permukaan, legenda berlabel + persentase selalu tampil (warna tak
 * pernah satu-satunya pembeda). Hover/fokus segmen menyorot baris legendanya.
 */
export function BilahKomposisi({
  bagian,
  satuan = "kegiatan",
  className,
  kolom = 2,
}: {
  bagian: Bagian[];
  satuan?: string;
  className?: string;
  /** 2 = kolom otomatis (min. 15rem, label panjang tak terpotong); 1 = satu kolom. */
  kolom?: 1 | 2;
}) {
  const total = bagian.reduce((s, b) => s + b.n, 0);
  if (total === 0) return <p className={cn("text-sm text-fg-subtle", className)}>Belum ada {satuan}.</p>;
  const pct = (n: number) => (n / total) * 100;
  const fmt = (n: number) => {
    const p = pct(n);
    return `${p < 10 && p > 0 ? p.toFixed(1).replace(".", ",") : Math.round(p)}%`;
  };
  return (
    <div className={className}>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={bagian.map((b) => `${b.label} ${fmt(b.n)}`).join(", ")}>
        {bagian.map((b) => (
          <span
            key={b.kunci}
            title={`${b.label}: ${b.n} ${satuan} (${fmt(b.n)})`}
            className="h-full min-w-1 first:rounded-l-full last:rounded-r-full motion-safe:animate-tumbuh origin-left"
            style={{ width: `${pct(b.n)}%`, background: b.warna }}
          />
        ))}
      </div>
      <ul className={cn("mt-3 grid gap-x-5 gap-y-1.5 text-[13px]", kolom === 2 && "grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]")}>
        {bagian.map((b) => (
          <li key={b.kunci} className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full ring-1 ring-black/5" style={{ background: b.warna }} />
            <span className="truncate font-medium text-fg">{b.label}</span>
            <span className="ml-auto shrink-0 tabular text-fg-muted">
              {fmt(b.n)} <span className="text-fg-subtle">· {b.n}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const bagianKategori = (per: Partial<Record<Kategori, number>> | { kategori: Kategori; n: number }[]): Bagian[] => {
  const daftar = Array.isArray(per) ? per : (Object.entries(per) as [Kategori, number][]).map(([kategori, n]) => ({ kategori, n }));
  return (Object.keys(INFO_KATEGORI) as Kategori[])
    .map((k) => ({ k, n: daftar.find((d) => d.kategori === k)?.n ?? 0 }))
    .filter((x) => x.n > 0)
    .map(({ k, n }) => ({ kunci: k, label: INFO_KATEGORI[k].label, warna: INFO_KATEGORI[k].warna, n }));
};

/* ------------------------------------------------------------ pemilih bulan */

export const labelBulan = (bulan: string) => `${NAMA_BULAN[Number(bulan.slice(5, 7)) - 1]} ${bulan.slice(0, 4)}`;

export function geserBulan(bulan: string, n: number): string {
  const [y, m] = bulan.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Awal bulan (≤ tanggal 7) → bawaan bulan lalu: saat laporan bulan sebelumnya disusun. */
export const bulanBawaan = (hariIni: string) => (Number(hariIni.slice(8, 10)) <= 7 ? geserBulan(hariIni.slice(0, 7), -1) : hariIni.slice(0, 7));

export function PemilihBulan({
  bulan,
  onChange,
  maks,
  min,
  className,
}: {
  bulan: string;
  onChange: (b: string) => void;
  maks?: string;
  min?: string;
  className?: string;
}) {
  const tombol =
    "grid size-9 place-items-center rounded-[var(--radius-sm)] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring";
  return (
    <div className={cn("inline-flex items-center rounded-[var(--radius-md)] border border-border bg-surface p-0.5", className)}>
      <button type="button" className={tombol} onClick={() => onChange(geserBulan(bulan, -1))} disabled={!!min && bulan <= min} aria-label="Bulan sebelumnya">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-[8.5rem] px-1 text-center text-sm font-semibold tabular text-fg" aria-live="polite">
        {labelBulan(bulan)}
      </span>
      <button type="button" className={tombol} onClick={() => onChange(geserBulan(bulan, 1))} disabled={!!maks && bulan >= maks} aria-label="Bulan berikutnya">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
