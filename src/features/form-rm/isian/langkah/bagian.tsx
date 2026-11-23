"use client";

import { ArrowDown, Check, ChevronRight, Circle, Clock, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DateTimePicker, nowLocalDateTime } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Field";
import { useTerkunci } from "@/features/form-rm/isian/kunci";
import { TandaAsal } from "@/features/form-rm/isian/TandaAsal";
import { NavLangkah, idLangkah, useLangkahAktif, type Langkah, type StatusLangkah } from "@/features/form-rm/isian/langkah/NavLangkah";
import { cn } from "@/lib/cn";

/*
 * Kerangka bersama layar isian Form RM berlangkah (RM.03, RM.21, …): navigasi
 * langkah (scrollspy) + panel "Syarat finalisasi" + kartu langkah + kolom
 * berlabel. Hanya tampilan pengisian — cetak tiap formulir tidak memakai ini.
 */

/** Kontrol teks: tinggi & huruf lebih besar di layar sentuh (target ≥ 44 px, tanpa zoom iOS). */
export const KONTROL = "pointer-coarse:h-11 pointer-coarse:text-base";
export const TOMBOL_KECIL =
  "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring pointer-coarse:min-h-10";

export const terisi = (v: string) => v.trim() !== "";
export const statusDari = (n: number, total: number): StatusLangkah =>
  n === 0 ? "kosong" : n >= total ? "lengkap" : "sebagian";

export const fmtTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

/** Gulir ke elemen lalu fokuskan (tanpa animasi bila pengguna memilih gerak dikurangi). */
export function fokusKe(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const halus = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: halus ? "smooth" : "auto", block: "center" });
  el.focus({ preventScroll: true });
}

/**
 * Tata letak berlangkah: layar ≥ 1280 px → kolom samping lengket (navigasi +
 * `samping`, mis. syarat finalisasi); lebih kecil → bilah langkah lengket di
 * bawah topbar.
 */
export function TataLetakLangkah({
  langkah,
  samping,
  children,
}: {
  langkah: readonly Langkah[];
  samping?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Efek scrollspy bergantung pada gabungan id (string) → aman walau array dibuat ulang tiap render.
  const { aktif, cssAsli } = useLangkahAktif(idLangkah(langkah));
  return (
    <div className="xl:grid xl:grid-cols-[15rem_minmax(0,1fr)] xl:items-start xl:gap-6">
      {/* Tinggi dibatasi (topbar + bilah aksi bawah) → isi panjang bergulir di dalam kolom. */}
      <aside className="sticky top-20 hidden max-h-[calc(100dvh-11rem)] space-y-4 overflow-y-auto overscroll-contain pb-2 xl:block">
        <NavLangkah langkah={langkah} aktif={aktif} cssAsli={cssAsli} arah="vertikal" />
        {samping}
      </aside>

      <div className="min-w-0 space-y-5">
        {/* Ponsel & tablet: bilah langkah lengket di bawah topbar. */}
        <div className="sticky top-16 z-10 -mx-4 border-b border-border bg-bg/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-bg/75 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:hidden">
          <NavLangkah langkah={langkah} aktif={aktif} cssAsli={cssAsli} arah="horizontal" className="overflow-x-auto" />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Kartu satu langkah: <section> berjudul (h2) + nomor urut; tujuan tautan navigasi. */
export function BagianLangkah({
  id,
  no,
  judul,
  ket,
  aksi,
  lencana,
  sorot,
  children,
}: {
  id: string;
  no: number;
  judul: string;
  ket?: React.ReactNode;
  aksi?: React.ReactNode;
  /** Lencana di samping judul (mis. status langkah). */
  lencana?: React.ReactNode;
  /** Sorot kartu (mis. "Langkah berikutnya"). */
  sorot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} tabIndex={-1} aria-labelledby={`${id}-judul`} className="outline-none">
      <Card className={cn("@container p-4 transition-shadow sm:p-5", sorot && "ring-2 ring-brand/35")}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-white tabular-nums"
            >
              {no}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 id={`${id}-judul`} className="text-base font-semibold text-fg [text-wrap:balance]">
                  <span className="sr-only">Langkah {no}: </span>
                  {judul}
                </h2>
                {lencana}
              </div>
              {ket && <p className="mt-0.5 text-xs text-fg-muted [text-wrap:pretty]">{ket}</p>}
            </div>
          </div>
          {aksi}
        </div>
        {children}
      </Card>
    </section>
  );
}

/** Lencana status langkah (teks, bukan warna saja). `berikutnya` = langkah pertama yang belum lengkap. */
export function LencanaLangkah({ status, kurang, berikutnya }: { status: StatusLangkah; kurang: number; berikutnya?: boolean }) {
  return (
    <>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
          status === "lengkap" && "bg-success-soft text-success",
          status === "sebagian" && "bg-warning-soft text-warning",
          status === "kosong" && "bg-surface-2 text-fg-muted",
        )}
      >
        {status === "lengkap" && <Check className="size-3" aria-hidden />}
        {status === "lengkap" ? "Lengkap" : status === "sebagian" ? `${kurang} belum lengkap` : "Belum diisi"}
      </span>
      {berikutnya && (
        <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-brand-fg">Langkah berikutnya</span>
      )}
    </>
  );
}

/**
 * Kaki kartu langkah: kekurangan yang bisa diklik (memfokuskan kolomnya) dan
 * tautan ke langkah sesudahnya. Kekurangan tidak ditampilkan selama langkah
 * belum disentuh (`tampilKurang` = false) agar tidak terasa "dimarahi".
 */
export function KakiLangkah({
  kurang,
  tampilKurang,
  lanjut,
  fokus = fokusKe,
}: {
  kurang: readonly { label: string; tujuan: string }[];
  tampilKurang: boolean;
  lanjut?: { id: string; judul: string };
  /** Pemindah fokus (bawaan `fokusKe`); formulir dengan panel tertutup membukanya lebih dulu. */
  fokus?: (id: string) => void;
}) {
  const terkunci = useTerkunci();
  const daftar = tampilKurang && !terkunci ? kurang : [];
  if (daftar.length === 0 && !lanjut) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
      {daftar.length > 0 ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-fg-subtle">Belum lengkap:</span>
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {daftar.map((x) => (
              <li key={x.label}>
                <button
                  type="button"
                  onClick={() => fokus(x.tujuan)}
                  className="rounded-full bg-warning-soft px-2 py-0.5 text-left text-[11px] text-warning transition-colors hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring pointer-coarse:min-h-9"
                >
                  {x.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <span />
      )}
      {lanjut && (
        <a
          href={`#${lanjut.id}`}
          className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1 text-[13px] font-medium text-brand transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring pointer-coarse:min-h-10"
        >
          Lanjut: {lanjut.judul}
          <ArrowDown className="size-3.5" aria-hidden />
        </a>
      )}
    </div>
  );
}

export type ButirSyarat = {
  kunci: string;
  label: string;
  ok: boolean;
  /** id elemen yang difokuskan saat butir yang belum terpenuhi diklik. */
  tujuan: string;
  /** Rincian singkat (mis. kekurangan di langkah itu). */
  ket?: string;
};

/** Daftar syarat FINAL + kemajuan; butir yang belum terpenuhi membawa ke kolomnya. */
export function SyaratFinal({
  butir,
  idJudul,
  className,
  fokus = fokusKe,
}: {
  butir: readonly ButirSyarat[];
  /** id judul (unik per instans — panel samping & versi ponsel). */
  idJudul: string;
  className?: string;
  /** Pemindah fokus (bawaan `fokusKe`); formulir dengan panel tertutup membukanya lebih dulu. */
  fokus?: (id: string) => void;
}) {
  const total = butir.length;
  const ok = butir.filter((b) => b.ok).length;
  return (
    <section aria-labelledby={idJudul} className={cn("rounded-[var(--radius-lg)] border border-border bg-surface p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id={idJudul} className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          <ListChecks className="size-4 text-brand" aria-hidden />
          Syarat finalisasi
        </h2>
        <span className="text-xs tabular-nums text-fg-muted" aria-hidden>
          {ok}/{total}
        </span>
      </div>
      <progress
        value={ok}
        max={total}
        aria-labelledby={idJudul}
        className={cn(
          "mb-1 block h-1.5 w-full appearance-none overflow-clip rounded-full border-0 bg-surface-2",
          "[&::-webkit-progress-bar]:bg-transparent",
          "[&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-success [&::-webkit-progress-value]:transition-[inline-size]",
          "[&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-success",
        )}
      />
      <p className="mb-2 text-[11px] text-fg-muted" aria-live="polite">
        {ok === total ? "Semua syarat terpenuhi — isian siap difinalkan." : `${ok} dari ${total} terpenuhi`}
      </p>
      <ul className="space-y-0.5">
        {butir.map((s) => (
          <li key={s.kunci}>
            {s.ok ? (
              <span className="flex items-start gap-2 px-1.5 py-1 text-xs text-fg-muted">
                <Check className="mt-px size-3.5 shrink-0 text-success" aria-hidden />
                <span className="min-w-0">
                  {s.label}
                  <span className="sr-only"> — terpenuhi</span>
                </span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => fokus(s.tujuan)}
                className="flex w-full items-start gap-2 rounded-[var(--radius-sm)] px-1.5 py-1 text-left text-xs text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring pointer-coarse:min-h-10"
              >
                <Circle className="mt-px size-3.5 shrink-0 text-fg-subtle" aria-hidden />
                <span className="min-w-0 flex-1">
                  {s.label}
                  <span className="sr-only"> — belum, buka kolomnya</span>
                  {s.ket && <span className="mt-0.5 block text-[11px] text-fg-muted [overflow-wrap:anywhere]">{s.ket}</span>}
                </span>
                <ChevronRight className="mt-px size-3.5 shrink-0 text-fg-subtle" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Wajib() {
  return (
    <>
      <span aria-hidden className="text-danger">
        *
      </span>
      <span className="sr-only">(wajib sebelum finalisasi)</span>
    </>
  );
}

/** Label kolom + penanda asal SIMRS/diubah (bila `asal`) + tanda wajib/opsional. */
export function LabelKolom({
  htmlFor,
  asal,
  wajib,
  opsional,
  children,
}: {
  htmlFor: string;
  asal?: string | readonly string[];
  wajib?: boolean;
  opsional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <label htmlFor={htmlFor} className="min-w-0 text-xs font-medium text-fg-muted">
        {children} {wajib && <Wajib />}
        {opsional && <span className="font-normal text-fg-subtle">(opsional)</span>}
      </label>
      {asal && <TandaAsal path={asal} />}
    </div>
  );
}

export function KolomTeks({
  id,
  label,
  asal,
  wajib,
  opsional,
  value,
  onChange,
  placeholder,
  describedBy,
}: {
  id: string;
  label: string;
  asal?: string | readonly string[];
  wajib?: boolean;
  opsional?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  describedBy?: string;
}) {
  return (
    <div>
      <LabelKolom htmlFor={id} asal={asal} wajib={wajib} opsional={opsional}>
        {label}
      </LabelKolom>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={describedBy}
        enterKeyHint="next"
        className={KONTROL}
      />
    </div>
  );
}

/** Tanggal & jam (WITA) + pintasan "Sekarang" selama kosong dan tidak terkunci. */
export function KolomWaktu({
  id,
  label,
  asal,
  wajib,
  value,
  onChange,
}: {
  id: string;
  label: string;
  asal?: string;
  wajib?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const terkunci = useTerkunci();
  return (
    <div>
      <LabelKolom htmlFor={id} asal={asal} wajib={wajib}>
        {label}
      </LabelKolom>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 @md:max-w-xs">
          <DateTimePicker id={id} value={value} onChange={onChange} />
        </div>
        {!terkunci && !value && (
          <button type="button" onClick={() => onChange(nowLocalDateTime())} className={cn(TOMBOL_KECIL, "h-10")}>
            <Clock className="size-3.5" aria-hidden />
            Sekarang
          </button>
        )}
      </div>
    </div>
  );
}

export function ItemId({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-fg-muted">{label}</dt>
      <dd className={cn("truncate text-fg", mono && "font-mono", strong && "font-semibold")}>{value || "—"}</dd>
    </div>
  );
}

export type PilihanCepat = { kunci: string; ket: string; nilai: string; pilih: () => void };

/** Pintasan isi satu klik dari data yang sudah ada ("Isi dengan: Pasien — …"). Tersembunyi saat terkunci. */
export function IsiCepat({ pilihan, judul = "Isi dengan:" }: { pilihan: readonly PilihanCepat[]; judul?: string }) {
  const terkunci = useTerkunci();
  if (terkunci || pilihan.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-fg-subtle">{judul}</span>
      {pilihan.map((p) => (
        <button
          key={p.kunci}
          type="button"
          onClick={p.pilih}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-fg-muted transition-colors hover:border-brand hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring pointer-coarse:min-h-9"
        >
          <span className="font-medium text-fg">{p.ket}</span>
          {p.nilai && <span className="truncate">— {p.nilai}</span>}
        </button>
      ))}
    </div>
  );
}
