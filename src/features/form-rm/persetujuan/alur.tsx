"use client";

import { useEffect, useRef } from "react";
import { ArrowDown, Check, CircleCheckBig } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { StatusLangkah } from "./informasi";

/**
 * Kerangka ALUR PENGISIAN bertahap (dipakai RM.22 & RM.33): navigasi lengket
 * berstatus, kartu langkah dengan sorotan "Langkah berikutnya", daftar
 * kekurangan per langkah (= syarat FINAL server), dan ringkasan akhir.
 */

export type LangkahAlur = { readonly id: string; readonly judul: string };

export const idLangkah = (id: string) => `langkah-${id}`;

/** Status tiap langkah, langkah aktif (berikutnya yang belum lengkap), dan props kartu langkah. */
export function hitungAlur<L extends LangkahAlur>(
  langkah: readonly L[],
  kurang: Record<L["id"], string[]>,
  statusLangkah: (id: L["id"], kurang: string[]) => StatusLangkah,
  terkunci: boolean,
) {
  const status = Object.fromEntries(langkah.map((l) => [l.id, statusLangkah(l.id, kurang[l.id as L["id"]])])) as Record<
    L["id"],
    StatusLangkah
  >;
  const jumlahLengkap = langkah.filter((l) => status[l.id as L["id"]] === "lengkap").length;
  const aktif: L["id"] | null = terkunci ? null : (langkah.find((l) => status[l.id as L["id"]] !== "lengkap")?.id ?? null);
  /** Props <Langkah>: nomor urut, status, sorotan, kekurangan, dan tautan ke langkah sesudahnya. */
  const props = (id: L["id"]) => {
    const i = langkah.findIndex((l) => l.id === id);
    return { id, no: i + 1, status: status[id], aktif: aktif === id, kurang: kurang[id], berikut: langkah[i + 1] };
  };
  return { status, jumlahLengkap, aktif, props };
}

export const NADA_LANGKAH: Record<StatusLangkah, string> = {
  lengkap: "bg-success text-white",
  sebagian: "bg-warning text-white",
  kosong: "bg-surface-2 text-fg-muted",
};

export function NavAlur<L extends LangkahAlur>({
  langkah,
  status,
  aktif,
}: {
  langkah: readonly L[];
  status: Record<L["id"], StatusLangkah>;
  aktif: L["id"] | null;
}) {
  const daftarRef = useRef<HTMLOListElement>(null);
  const jumlahLengkap = langkah.filter((l) => status[l.id as L["id"]] === "lengkap").length;
  // Layar sempit: geser navigasi (horizontal saja) agar langkah berikutnya terlihat.
  useEffect(() => {
    const ol = daftarRef.current;
    const chip = ol?.querySelector<HTMLElement>('[aria-current="step"]');
    if (ol && chip && ol.scrollWidth > ol.clientWidth) ol.scrollTo({ left: Math.max(0, chip.offsetLeft - 24), behavior: "smooth" });
  }, [aktif]);
  return (
    <nav
      aria-label="Alur pengisian"
      className="sticky top-16 z-10 -mx-4 border-b border-border bg-bg/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-bg/70 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="flex items-center gap-3">
        <ol ref={daftarRef} className="relative flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {langkah.map((l, i) => {
            const st = status[l.id as L["id"]];
            const sorot = aktif === l.id;
            return (
              <li key={l.id} className="flex shrink-0 items-center gap-1.5">
                {i > 0 && (
                  <span
                    className={cn("h-px w-3", status[langkah[i - 1].id as L["id"]] === "lengkap" ? "bg-success" : "bg-border")}
                    aria-hidden
                  />
                )}
                <a
                  href={`#${idLangkah(l.id)}`}
                  aria-current={sorot ? "step" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    sorot
                      ? "border-brand bg-brand-soft text-brand-soft-fg ring-2 ring-brand/25"
                      : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
                  )}
                  title={`${l.judul} — ${st === "lengkap" ? "lengkap" : st === "sebagian" ? "belum lengkap" : "belum diisi"}`}
                >
                  <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] font-bold", NADA_LANGKAH[st])}>
                    {st === "lengkap" ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  {l.judul}
                </a>
              </li>
            );
          })}
        </ol>
        <span className="hidden shrink-0 text-xs tabular-nums text-fg-subtle sm:inline">
          {jumlahLengkap}/{langkah.length} lengkap
        </span>
      </div>
    </nav>
  );
}

/** Kartu satu langkah: nomor/centang, judul, lencana status, kekurangan, dan tautan ke langkah berikut. */
export function Langkah({
  id,
  no,
  judul,
  desc,
  status,
  aktif,
  kurang,
  berikut,
  kanan,
  children,
}: {
  id: string;
  no: number;
  judul: string;
  desc: string;
  status: StatusLangkah;
  aktif: boolean;
  kurang: readonly string[];
  berikut?: LangkahAlur;
  kanan?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card
      id={idLangkah(id)}
      data-langkah={id}
      data-status={status}
      className={cn(
        "scroll-mt-32 p-4 transition-shadow sm:p-5",
        aktif && "ring-2 ring-brand/35",
        status === "lengkap" && !aktif && "border-success/35",
      )}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
              status === "kosong" ? "bg-brand-soft text-brand-soft-fg" : NADA_LANGKAH[status],
            )}
            aria-hidden
          >
            {status === "lengkap" ? <Check className="size-4" strokeWidth={3} /> : no}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-fg">{judul}</h2>
              <LencanaStatus status={status} kurang={kurang.length} />
              {aktif && (
                <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-brand-fg">Langkah berikutnya</span>
              )}
            </div>
            <p className="mt-0.5 max-w-3xl text-xs text-fg-muted">{desc}</p>
          </div>
        </div>
        {kanan}
      </header>

      {children}

      {(kurang.length > 0 && status !== "kosong") || berikut ? (
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          {kurang.length > 0 && status !== "kosong" ? (
            <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label="Belum lengkap">
              {kurang.slice(0, 4).map((x) => (
                <li key={x} className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] text-warning">
                  {x}
                </li>
              ))}
              {kurang.length > 4 && <li className="px-1 text-[11px] text-fg-subtle">+{kurang.length - 4} lagi</li>}
            </ul>
          ) : (
            <span />
          )}
          {berikut && (
            <a
              href={`#${idLangkah(berikut.id)}`}
              className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1 text-[13px] font-medium text-brand transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              Lanjut: {berikut.judul}
              <ArrowDown className="size-3.5" aria-hidden />
            </a>
          )}
        </footer>
      ) : null}
    </Card>
  );
}

function LencanaStatus({ status, kurang }: { status: StatusLangkah; kurang: number }) {
  if (status === "lengkap") {
    return (
      <Badge tone="success" className="py-0 text-[11px]">
        <Check className="size-3" aria-hidden /> Lengkap
      </Badge>
    );
  }
  if (status === "sebagian") {
    return (
      <Badge tone="warning" className="py-0 text-[11px]">
        {kurang} belum lengkap
      </Badge>
    );
  }
  return <Badge className="py-0 text-[11px]">Belum diisi</Badge>;
}

export function Meter({ label, nilai, total }: { label: string; nilai: number; total: number }) {
  const persen = total > 0 ? Math.round((nilai / total) * 100) : 0;
  const penuh = total > 0 && nilai === total;
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-right text-fg-muted">{label}</span>
      <span className="relative h-1.5 w-24 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full transition-[width]", penuh ? "bg-success" : "bg-brand")}
          style={{ width: `${persen}%` }}
        />
      </span>
      <span className={cn("w-10 tabular-nums", penuh ? "font-semibold text-success" : "text-fg")}>
        {nilai}/{total}
      </span>
    </div>
  );
}

/** Ringkasan akhir sebelum FINAL: kekurangan per langkah (tautan) atau ajakan memfinalkan. */
export function RingkasanKekurangan<L extends LangkahAlur>({
  langkah,
  kurang,
  terkunci,
}: {
  langkah: readonly L[];
  kurang: Record<L["id"], string[]>;
  terkunci: boolean;
}) {
  if (terkunci) return null;
  const sisa = langkah.map((l, i) => ({ ...l, no: i + 1, kurang: kurang[l.id as L["id"]] })).filter((l) => l.kurang.length > 0);
  if (sisa.length === 0) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-success/40 bg-success-soft px-4 py-3 text-sm text-fg">
        <CircleCheckBig className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <p>
          <b>Semua langkah lengkap.</b> Periksa kembali isian, lalu tekan <b>Finalkan</b> untuk mengunci formulir.
        </p>
      </div>
    );
  }
  const total = sisa.reduce((n, l) => n + l.kurang.length, 0);
  return (
    <Card className="p-4">
      <p className="mb-2 text-sm font-semibold text-fg">Sebelum difinalkan — {total} hal belum lengkap</p>
      <ul className="space-y-1.5 text-[13px]">
        {sisa.map((l) => (
          <li key={l.id} className="flex flex-wrap items-baseline gap-x-2">
            <a href={`#${idLangkah(l.id)}`} className="font-medium text-brand hover:underline">
              {l.no}. {l.judul}
            </a>
            <span className="text-fg-muted">{l.kurang.join(" · ")}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
