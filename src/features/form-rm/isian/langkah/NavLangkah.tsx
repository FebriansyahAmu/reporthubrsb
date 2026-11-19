"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type StatusLangkah = "lengkap" | "sebagian" | "kosong";

/** Sub-bagian langkah (mis. kategori edukasi) — tampil di navigasi samping saja. */
export type SubLangkah = {
  id: string;
  judul: string;
  status: StatusLangkah;
  ket: string;
};

export type Langkah = {
  /** id elemen <section> tujuan (juga fragmen URL). */
  id: string;
  no: number;
  judul: string;
  singkat: string;
  status: StatusLangkah;
  /** Ringkasan status, mis. "3 dari 4 terisi". */
  ket: string;
  sub?: readonly SubLangkah[];
};

const LABEL_STATUS: Record<StatusLangkah, string> = {
  lengkap: "lengkap",
  sebagian: "sebagian terisi",
  kosong: "belum diisi",
};

/** Semua id tujuan (langkah + sub-bagian) dalam urutan dokumen. */
export const idLangkah = (langkah: readonly Langkah[]): string[] =>
  langkah.flatMap((l) => [l.id, ...(l.sub?.map((s) => s.id) ?? [])]);

/*
 * Sorotan asli `:target-current` dipasang lewat CSSOM, bukan di globals.css:
 * Lightning CSS (pipeline CSS Next/Turbopack) belum mengenal pseudo-kelas ini
 * dan memberi peringatan "Parsing CSS source code failed" setiap kompilasi.
 * Hanya dipasang bila peramban mendukung `scroll-target-group`; CSSOM tidak
 * dibatasi CSP style-src. Gagal → kembali ke kelas cadangan `.target-current`.
 */
const CSS_SOROTAN_ASLI = `[data-nav-langkah] a:target-current {
  background-color: var(--brand-soft);
  color: var(--fg);
  font-weight: var(--font-weight-semibold, 600);
}`;
let sorotanTerpasang = false;
function pasangSorotanAsli(): boolean {
  if (sorotanTerpasang) return true;
  try {
    const lembar = new CSSStyleSheet();
    lembar.replaceSync(CSS_SOROTAN_ASLI);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, lembar];
    sorotanTerpasang = true;
  } catch {
    sorotanTerpasang = false;
  }
  return sorotanTerpasang;
}

const terlihat = (el: Element) => el.checkVisibility?.() ?? (el as HTMLElement).offsetParent !== null;

/**
 * Langkah/sub-bagian yang sedang terlihat (scrollspy). Bila peramban mendukung
 * `scroll-target-group`, sorotan visual ditangani `:target-current` dan di sini
 * hanya menyelaraskan `aria-current` saat gulir berhenti (dari navigasi yang
 * tampil); selain itu IntersectionObserver (pita atas-tengah layar) yang
 * menentukan: bagian TERDALAM/terakhir yang memotong pita menang.
 */
export function useLangkahAktif(ids: readonly string[]): {
  aktif: string;
  cssAsli: boolean;
} {
  const [aktif, setAktif] = useState(ids[0] ?? "");
  const [cssAsli, setCssAsli] = useState(false);
  const kunci = ids.join("|");

  useEffect(() => {
    const daftar = kunci.split("|");
    if (
      typeof CSS !== "undefined" &&
      CSS.supports("scroll-target-group: auto") &&
      pasangSorotanAsli()
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deteksi fitur peramban sekali saat mount
      setCssAsli(true);
      const sinkron = () => {
        let a: HTMLAnchorElement | undefined;
        try {
          a = [
            ...document.querySelectorAll<HTMLAnchorElement>(
              "[data-nav-langkah] a:target-current",
            ),
          ].find(terlihat);
        } catch {
          return;
        }
        const id = a?.hash.slice(1);
        if (id) setAktif(id);
      };
      sinkron();
      document.addEventListener("scrollend", sinkron);
      return () => document.removeEventListener("scrollend", sinkron);
    }
    const memotong = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) memotong.set(e.target.id, e.isIntersecting);
        const id = daftar.findLast((x) => memotong.get(x));
        if (id) setAktif(id);
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    for (const id of daftar) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [kunci]);

  return { aktif, cssAsli };
}

/** Penanda status langkah: centang bila lengkap, nomor bila belum — tak hanya warna. */
function TandaLangkah({ status, no }: { status: StatusLangkah; no?: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full border font-semibold tabular-nums",
        no === undefined ? "size-4 text-[9px]" : "size-6 text-[11px]",
        status === "lengkap" && "border-success bg-success text-white",
        status === "sebagian" &&
          "border-brand bg-brand-soft text-brand-soft-fg",
        status === "kosong" && "border-border-strong bg-surface text-fg-muted",
      )}
    >
      {status === "lengkap" ? (
        <Check
          className={no === undefined ? "size-2.5" : "size-3.5"}
          strokeWidth={3}
        />
      ) : no === undefined ? (
        status === "sebagian" && (
          <span className="size-1.5 rounded-full bg-brand" />
        )
      ) : (
        no
      )}
    </span>
  );
}

const TAUTAN =
  "group flex items-center rounded-[var(--radius-md)] text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring";
/* Sorotan cadangan (IntersectionObserver); sorotan asli :target-current dipasang lewat CSSOM. */
const SOROTAN_CADANGAN =
  "[&.target-current]:bg-brand-soft [&.target-current]:font-semibold [&.target-current]:text-fg";

/**
 * Navigasi langkah pengisian (tautan fragmen ke tiap <section>). `vertikal` =
 * kolom samping layar lebar (termasuk sub-bagian); `horizontal` = bilah
 * lengket di ponsel/tablet (langkah utama saja).
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
  // Sub-bagian aktif → langkah induknya yang aktif di bilah horizontal.
  const induk = (l: Langkah) =>
    l.id === aktif || (l.sub?.some((s) => s.id === aktif) ?? false);
  const kini = langkah.find(induk) ?? langkah[0];
  const aktifIni = (l: Langkah) => (vertikal ? l.id === aktif : induk(l));
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
          {langkah.map((l) => (
            <li key={l.id}>
              <a
                href={`#${l.id}`}
                aria-current={aktifIni(l) ? "true" : undefined}
                className={cn(
                  TAUTAN,
                  "gap-2.5",
                  vertikal
                    ? "px-2.5 py-2"
                    : "justify-center px-2 py-1.5 max-sm:min-w-11 pointer-coarse:min-h-11",
                  SOROTAN_CADANGAN,
                  !cssAsli && aktifIni(l) && "target-current",
                )}
              >
                <TandaLangkah status={l.status} no={l.no} />
                {/* Ponsel: label disembunyikan secara visual (tetap dibaca pembaca layar) → semua langkah muat tanpa geser. */}
                <span className={cn("min-w-0", !vertikal && "max-sm:sr-only")}>
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
              {vertikal && l.sub && l.sub.length > 0 && (
                <ol className="mt-0.5 ml-[1.375rem] space-y-0.5 border-l border-border pl-2">
                  {l.sub.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        aria-current={s.id === aktif ? "true" : undefined}
                        className={cn(
                          TAUTAN,
                          "gap-2 px-2 py-1 text-[13px]",
                          SOROTAN_CADANGAN,
                          !cssAsli && s.id === aktif && "target-current",
                        )}
                      >
                        <TandaLangkah status={s.status} />
                        <span className="min-w-0">
                          <span className="block truncate">{s.judul}</span>
                          <span className="block truncate text-[11px] font-normal text-fg-subtle">
                            {s.ket}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
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
