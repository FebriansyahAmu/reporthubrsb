"use client";

import { CircleAlert, WifiOff } from "lucide-react";
import { teksOrang, tempatUnit } from "@/features/form-rm/aliran-isian";
import type { KendaliIsian } from "./useIsian";

/**
 * Kehadiran & status aliran langsung isian berlanjut (PRD Berlanjut §5.3 A):
 * "Juga membuka: Ns. Rina (Rawat Inap · Bougenville)". Diam bila tak ada orang
 * lain dan aliran sehat; aliran putus → satu baris redup; dihentikan (akses
 * berakhir / tautan berubah) → pita peringatan dengan alasannya.
 */
export function KehadiranIsian<T>({ kendali: k }: { kendali: KendaliIsian<T> }) {
  if (!k.gabung) return null;

  if (k.aliranBerhenti) {
    return (
      <div role="status" className="flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-warning">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{k.aliranBerhenti}</span>
      </div>
    );
  }

  const putus = k.koneksi === "terputus";
  if (k.hadir.length === 0 && !putus) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[13px]">
      {k.hadir.length > 0 ? (
        <div role="status" className="flex min-w-0 items-center gap-2.5 text-fg-muted">
          <span className="flex shrink-0 -space-x-1.5" aria-hidden>
            {k.hadir.slice(0, 3).map((o, i) => (
              <span
                key={`${o.nama}-${o.unit}-${i}`}
                title={teksOrang(o)}
                className="inline-flex size-6 items-center justify-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand-soft-fg ring-2 ring-surface"
              >
                {inisial(o.nama)}
              </span>
            ))}
          </span>
          <p className="min-w-0">
            Juga membuka:{" "}
            {k.hadir.map((o, i) => (
              <span key={`${o.nama}-${o.unit}-${i}`}>
                {i > 0 && ", "}
                <b className="font-semibold text-fg">{o.nama}</b>
                {tempatUnit(o.unit, o.ruang) && <> ({tempatUnit(o.unit, o.ruang)})</>}
              </span>
            ))}
          </p>
        </div>
      ) : (
        <span />
      )}
      {putus && (
        <p role="status" className="inline-flex items-center gap-1.5 text-fg-subtle">
          <WifiOff className="size-3.5" aria-hidden />
          Pembaruan langsung terputus — menyambung ulang…
        </p>
      )}
    </div>
  );
}

/** "Ns. Rina Wati" → "RW"; gelar & tanda baca dilewati. */
function inisial(nama: string): string {
  const kata = nama
    .split(/[\s,]+/)
    .filter((w) => w && !w.endsWith(".") && /^\p{L}/u.test(w));
  const pilih = kata.length > 0 ? kata : [nama];
  return pilih
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase("id-ID") ?? "")
    .join("");
}
