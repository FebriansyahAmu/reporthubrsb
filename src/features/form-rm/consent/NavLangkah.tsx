"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type StatusLangkah = "lengkap" | "sebagian" | "kosong";

export type Langkah = {
  /** id elemen <section> tujuan (juga fragmen URL). */
  id: string;
  no: number;
  judul: string;
  singkat: string;
  status: StatusLangkah;
  /** Ringkasan status, mis. "3 dari 4 terisi". */
  ket: string;
};

const LABEL_STATUS: Record<StatusLangkah, string> = {
  lengkap: "lengkap",
  sebagian: "sebagian terisi",
  kosong: "belum diisi",
};

/**
 * Langkah yang sedang terlihat (scrollspy). Bila peramban mendukung
 * `scroll-target-group`, sorotan visual ditangani CSS `:target-current` dan di
 * sini hanya menyelaraskan `aria-current` saat gulir berhenti; selain itu
 * IntersectionObserver (pita tengah layar) yang menentukan langkah aktif.
 */
export function useLangkahAktif(ids: readonly string[]): {
  aktif: string;
  cssAsli: boolean;
} {
  const [aktif, setAktif] = useState(ids[0] ?? "");
  const [cssAsli, setCssAsli] = useState(false);

  useEffect(() => {
    if (
      typeof CSS !== "undefined" &&
      CSS.supports("scroll-target-group: auto")
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deteksi fitur peramban sekali saat mount
      setCssAsli(true);
      const sinkron = () => {
        const a = document.querySelector<HTMLAnchorElement>(
          "[data-nav-langkah] a:target-current",
        );
        const id = a?.hash.slice(1);
        if (id) setAktif(id);
      };
      sinkron();
      document.addEventListener("scrollend", sinkron);
      return () => document.removeEventListener("scrollend", sinkron);
    }
    const terlihat = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) terlihat.set(e.target.id, e.isIntersecting);
        const id = ids.find((x) => terlihat.get(x));
        if (id) setAktif(id);
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [ids]);

  return { aktif, cssAsli };
}

/** Penanda status langkah: centang bila lengkap, nomor bila belum — tak hanya warna. */
function TandaLangkah({ l }: { l: Langkah }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums",
        l.status === "lengkap" && "border-success bg-success text-white",
        l.status === "sebagian" &&
          "border-brand bg-brand-soft text-brand-soft-fg",
        l.status === "kosong" &&
          "border-border-strong bg-surface text-fg-muted",
      )}
    >
      {l.status === "lengkap" ? (
        <Check className="size-3.5" strokeWidth={3} />
      ) : (
        l.no
      )}
    </span>
  );
}

/**
 * Navigasi langkah pengisian (tautan fragmen ke tiap <section>). `vertikal` =
 * kolom samping layar lebar; `horizontal` = bilah lengket di ponsel/tablet.
 */
export function NavLangkah({
  langkah,
  aktif,
  cssAsli,
  arah,
  className,
}: {
  langkah: readonly Langkah[];
  aktif: string;
  cssAsli: boolean;
  arah: "vertikal" | "horizontal";
  className?: string;
}) {
  const vertikal = arah === "vertikal";
  const kini = langkah.find((l) => l.id === aktif) ?? langkah[0];
  return (
    <nav
      aria-label="Langkah pengisian"
      data-nav-langkah={arah}
      // scroll-target-group: peramban melacak tautan fragmen & mencocokkan :target-current.
      // `relative`: teks sr-only (absolut) ikut terpotong overflow nav — tanpa ini ia melebarkan halaman ponsel.
      className={cn("relative [scroll-target-group:auto]", className)}
    >
      <div className={cn(!vertikal && "flex items-center gap-3")}>
        <ol className={cn(vertikal ? "space-y-1" : "flex shrink-0 gap-1")}>
          {langkah.map((l) => {
            const aktifIni = l.id === aktif;
            return (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  aria-current={aktifIni ? "true" : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-[var(--radius-md)] text-sm text-fg-muted transition-colors",
                    "hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    vertikal
                      ? "px-2.5 py-2"
                      : "justify-center px-2 py-1.5 max-sm:min-w-11 pointer-coarse:min-h-11",
                    // Sorotan: :target-current (asli) atau kelas cadangan dari IntersectionObserver.
                    "[&:is(:target-current,.target-current)]:bg-brand-soft [&:is(:target-current,.target-current)]:font-semibold [&:is(:target-current,.target-current)]:text-fg",
                    !cssAsli && aktifIni && "target-current",
                  )}
                >
                  <TandaLangkah l={l} />
                  {/* Ponsel: label disembunyikan secara visual (tetap dibaca pembaca layar) → 4 langkah muat tanpa geser. */}
                  <span
                    className={cn("min-w-0", !vertikal && "max-sm:sr-only")}
                  >
                    <span className="block truncate">
                      {vertikal ? l.judul : l.singkat}
                    </span>
                    {vertikal && (
                      <span className="block truncate text-[11px] font-normal text-fg-subtle">
                        {l.ket}
                      </span>
                    )}
                    <span className="sr-only">
                      {" "}
                      — {LABEL_STATUS[l.status]}
                      {vertikal ? "" : `, ${l.ket}`}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
        {!vertikal && (
          // Ringkasan langkah aktif untuk layar sempit (tautan di atas sudah membawa aria-current).
          <p
            aria-hidden
            className="min-w-0 truncate text-xs text-fg-muted sm:hidden"
          >
            Langkah {kini.no} dari {langkah.length} ·{" "}
            <span className="font-semibold text-fg">{kini.singkat}</span>
          </p>
        )}
      </div>
    </nav>
  );
}
