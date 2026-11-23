"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { useTerkunci } from "@/features/form-rm/isian/kunci";
import { TandaAsal } from "@/features/form-rm/isian/TandaAsal";

export type OpsiRadio = { value: string; label: string; ket?: string };

/** Kartu pilihan (radio/checkbox asli di dalam label) — dipakai PilihanRadio & PilihanCentang. */
export const KARTU_PILIHAN = cn(
  "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2.5 text-sm text-fg transition-colors",
  "pointer-coarse:min-h-12 hover:border-border-strong",
  // Sorotan terpilih hanya mengubah warna (tanpa ubah ukuran/tebal huruf → tak menggeser tetangga).
  "has-checked:border-brand has-checked:bg-brand-soft/60",
  "has-focus-visible:ring-2 has-focus-visible:ring-brand-ring",
  "has-disabled:cursor-default has-disabled:hover:border-border",
);
/** Varian ringkas: pil sebaris untuk pilihan berlabel pendek (SD/SLTP/…). */
export const PIL_PILIHAN = cn(
  "inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 py-1.5 text-[13px] text-fg transition-colors",
  "pointer-coarse:min-h-11 pointer-coarse:px-3 hover:border-border-strong",
  "has-checked:border-brand has-checked:bg-brand-soft/60",
  "has-focus-visible:ring-2 has-focus-visible:ring-brand-ring",
  "has-disabled:cursor-default has-disabled:hover:border-border",
);
export const KONTROL_PILIHAN = "size-4 shrink-0 accent-brand focus-visible:outline-none";

/** Judul grup pilihan (<legend>) + penanda asal SIMRS + petunjuk. */
export function LegendPilihan({
  children,
  asal,
  petunjuk,
}: {
  children: React.ReactNode;
  asal?: string | readonly string[];
  petunjuk?: string;
}) {
  return (
    <legend className="mb-1.5 flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 p-0 text-xs font-medium text-fg-muted">
      <span>{children}</span>
      {petunjuk && <span className="font-normal text-fg-subtle">{petunjuk}</span>}
      {asal && <TandaAsal path={asal} />}
    </legend>
  );
}

/**
 * Grup radio asli (2–5 pilihan eksklusif): label membungkus input sehingga
 * seluruh kartu/pil jadi target klik; warna merek lewat `accent-color`. Radio
 * tak bisa "dibatalkan" → tombol "Kosongkan pilihan" bila nilai boleh kosong.
 * Nonaktif otomatis di dalam <BidangIsian> terkunci.
 */
export function PilihanRadio({
  legend,
  keterangan,
  asal,
  value,
  onChange,
  opsi,
  bolehKosong = false,
  ringkas = false,
  id,
  className,
  children,
}: {
  legend: React.ReactNode;
  keterangan?: React.ReactNode;
  asal?: string | readonly string[];
  value: string;
  onChange: (v: string) => void;
  opsi: readonly OpsiRadio[];
  bolehKosong?: boolean;
  /** Pil sebaris (label pendek) alih-alih kartu dua kolom. */
  ringkas?: boolean;
  /** id fieldset (tujuan fokus/tautan). */
  id?: string;
  className?: string;
  /** Kontrol tambahan di dalam grup (mis. kolom "Lainnya"). */
  children?: React.ReactNode;
}) {
  const nama = useId();
  const idKet = `${nama}-ket`;
  const terkunci = useTerkunci();
  return (
    <fieldset
      id={id}
      tabIndex={id ? -1 : undefined}
      className={cn("m-0 min-w-0 border-0 p-0 outline-none", className)}
      aria-describedby={keterangan ? idKet : undefined}
    >
      <LegendPilihan asal={asal}>{legend}</LegendPilihan>
      {keterangan && (
        <p id={idKet} className="-mt-0.5 mb-2 text-xs text-fg-subtle">
          {keterangan}
        </p>
      )}
      <div className={ringkas ? "flex flex-wrap gap-1.5" : "grid grid-cols-1 gap-2 @sm:grid-cols-2"}>
        {opsi.map((o) => (
          <label key={o.value} className={ringkas ? PIL_PILIHAN : KARTU_PILIHAN}>
            <input
              type="radio"
              name={nama}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className={cn(KONTROL_PILIHAN, !ringkas && "mt-0.5")}
            />
            {ringkas ? (
              <span>{o.label}</span>
            ) : (
              <span className="min-w-0">
                <span className="block font-medium">{o.label}</span>
                {o.ket && <span className="mt-0.5 block text-xs text-fg-muted">{o.ket}</span>}
              </span>
            )}
          </label>
        ))}
        {children}
      </div>
      {bolehKosong && value && !terkunci && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="mt-1.5 rounded-[var(--radius-sm)] px-1 py-0.5 text-xs font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          Kosongkan pilihan
        </button>
      )}
    </fieldset>
  );
}
