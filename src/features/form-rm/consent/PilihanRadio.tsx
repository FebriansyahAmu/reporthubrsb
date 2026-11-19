"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { useTerkunci } from "@/features/form-rm/isian/kunci";

export type OpsiRadio = { value: string; label: string; ket?: string };

/**
 * Grup radio asli (2–5 pilihan eksklusif) berbentuk kartu: label membungkus
 * input sehingga seluruh kartu jadi target klik; warna merek lewat
 * `accent-color`. Radio tak bisa "dibatalkan" → tombol "Kosongkan pilihan"
 * bila nilai boleh kosong. Nonaktif otomatis di dalam <BidangIsian> terkunci.
 */
export function PilihanRadio({
  legend,
  keterangan,
  value,
  onChange,
  opsi,
  bolehKosong = false,
  className,
}: {
  legend: React.ReactNode;
  keterangan?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  opsi: readonly OpsiRadio[];
  bolehKosong?: boolean;
  className?: string;
}) {
  const nama = useId();
  const idKet = `${nama}-ket`;
  const terkunci = useTerkunci();
  return (
    <fieldset className={cn("m-0 min-w-0 border-0 p-0", className)} aria-describedby={keterangan ? idKet : undefined}>
      <legend className="mb-1.5 p-0 text-xs font-medium text-fg-muted">{legend}</legend>
      {keterangan && (
        <p id={idKet} className="-mt-0.5 mb-2 text-xs text-fg-subtle">
          {keterangan}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 @sm:grid-cols-2">
        {opsi.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2.5 text-sm text-fg transition-colors",
              "pointer-coarse:min-h-12 hover:border-border-strong",
              "has-checked:border-brand has-checked:bg-brand-soft/60",
              "has-focus-visible:ring-2 has-focus-visible:ring-brand-ring",
              "has-disabled:cursor-default has-disabled:hover:border-border",
            )}
          >
            <input
              type="radio"
              name={nama}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="mt-0.5 size-4 shrink-0 accent-brand focus-visible:outline-none"
            />
            <span className="min-w-0">
              <span className="block font-medium">{o.label}</span>
              {o.ket && <span className="mt-0.5 block text-xs text-fg-muted">{o.ket}</span>}
            </span>
          </label>
        ))}
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
