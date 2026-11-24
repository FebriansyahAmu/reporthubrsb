"use client";

import { useRef, useState } from "react";
import { ArrowLeftRight, CalendarCheck2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { AuditSuratKontrolView } from "./AuditSuratKontrolView";
import { TerbitPulangView } from "./TerbitPulangView";

export type TampilanSuratKontrol = "pulang" | "bpjs";

const TAB = [
  { key: "pulang", label: "Terbit saat pulang", ket: "Tanggal terbit vs tanggal pulang pasien BPJS", ikon: CalendarCheck2 },
  { key: "bpjs", label: "Jadwal BPJS ↔ SIMRS", ket: "Surat Kontrol & SPRI di BPJS vs jadwal SIMRS", ikon: ArrowLeftRight },
] as const;

/**
 * Halaman Audit Surat Kontrol: dua tampilan dalam satu tablist. Seleksi lewat
 * AKTIVASI (panah memindah fokus, Enter/Spasi memilih) karena memilih tab
 * mengubah URL (`?tampilan=`) dan memuat data. Panel dipasang saat pertama
 * dibuka lalu disembunyikan (`hidden`) — saringan tetap saat berpindah tab.
 */
export function SuratKontrolHalaman({ awal, bolehEkspor }: { awal: TampilanSuratKontrol; bolehEkspor: boolean }) {
  const [tab, setTab] = useState<TampilanSuratKontrol>(awal);
  const [terpasang, setTerpasang] = useState<ReadonlySet<TampilanSuratKontrol>>(() => new Set([awal]));
  const [belum, setBelum] = useState<number | null>(null);
  const tombol = useRef<Partial<Record<TampilanSuratKontrol, HTMLButtonElement | null>>>({});

  function pilih(t: TampilanSuratKontrol) {
    setTab(t);
    setTerpasang((s) => (s.has(t) ? s : new Set([...s, t])));
    const url = new URL(window.location.href);
    if (t === "pulang") url.searchParams.delete("tampilan");
    else url.searchParams.set("tampilan", t);
    window.history.replaceState(window.history.state, "", url);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const urutan = TAB.map((t) => t.key);
    const kini = urutan.findIndex((k) => tombol.current[k] === document.activeElement);
    if (kini < 0) return;
    let tujuan: number | null = null;
    if (e.key === "ArrowRight") tujuan = (kini + 1) % urutan.length;
    else if (e.key === "ArrowLeft") tujuan = (kini - 1 + urutan.length) % urutan.length;
    else if (e.key === "Home") tujuan = 0;
    else if (e.key === "End") tujuan = urutan.length - 1;
    if (tujuan === null) return;
    e.preventDefault();
    tombol.current[urutan[tujuan]]?.focus();
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Tampilan Audit Surat Kontrol" onKeyDown={onKeyDown} className="flex overflow-x-auto border-b border-border">
        {TAB.map((t) => {
          const Ikon = t.ikon;
          const aktif = tab === t.key;
          return (
            <button
              key={t.key}
              ref={(el) => {
                tombol.current[t.key] = el;
              }}
              id={`skt-tab-${t.key}`}
              type="button"
              role="tab"
              aria-selected={aktif}
              tabIndex={aktif ? 0 : -1}
              onClick={() => pilih(t.key)}
              className={cn(
                "relative flex min-h-11 flex-none items-start gap-2.5 px-3 pt-2 pb-3 text-left transition-colors sm:px-4",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring",
                "after:absolute after:inset-x-2 after:bottom-0 after:border-b-[3px] after:border-transparent after:content-['']",
                "aria-selected:text-brand aria-selected:after:border-brand",
                aktif ? "text-brand" : "text-fg-muted hover:text-fg",
              )}
            >
              <Ikon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold whitespace-nowrap">
                  {t.label}
                  {t.key === "pulang" && belum !== null && belum > 0 && (
                    <>
                      <span aria-hidden className="rounded-full bg-danger px-1.5 text-[11px] leading-[1.125rem] font-semibold text-white tabular">
                        {belum}
                      </span>
                      <span className="sr-only">, {belum} pasien belum terbit</span>
                    </>
                  )}
                </span>
                <span className="hidden text-[11px] font-normal text-fg-subtle sm:block">{t.ket}</span>
              </span>
            </button>
          );
        })}
      </div>

      {terpasang.has("pulang") && (
        <div role="tabpanel" id="skt-panel-pulang" aria-labelledby="skt-tab-pulang" hidden={tab !== "pulang"}>
          <TerbitPulangView bolehEkspor={bolehEkspor} onBelumTerbit={setBelum} />
        </div>
      )}
      {terpasang.has("bpjs") && (
        <div role="tabpanel" id="skt-panel-bpjs" aria-labelledby="skt-tab-bpjs" hidden={tab !== "bpjs"}>
          <AuditSuratKontrolView bolehEkspor={bolehEkspor} />
        </div>
      )}
    </div>
  );
}
