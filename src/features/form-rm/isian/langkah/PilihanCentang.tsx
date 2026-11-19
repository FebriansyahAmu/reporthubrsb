"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { KONTROL_PILIHAN, LegendPilihan, PIL_PILIHAN } from "@/features/form-rm/isian/langkah/PilihanRadio";

/**
 * Grup checkbox asli untuk pilihan "boleh lebih dari satu" (beda bentuk dari
 * radio → pengguna tahu bisa memilih banyak). `eksklusif` = opsi yang
 * meniadakan opsi lain (mis. hambatan "Tidak Ada"): memilihnya mengosongkan
 * yang lain, memilih yang lain melepasnya. `lain` = kolom teks berlabel
 * "Lainnya" untuk isian di luar daftar.
 */
export function PilihanCentang({
  legend,
  asal,
  opsi,
  nilai,
  onUbah,
  eksklusif,
  lain,
  keterangan,
  className,
}: {
  legend: React.ReactNode;
  asal?: string | readonly string[];
  opsi: readonly string[];
  nilai: readonly string[];
  onUbah: (v: string[]) => void;
  eksklusif?: string;
  lain?: { nilai: string; onUbah: (v: string) => void; placeholder?: string };
  keterangan?: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  function ubah(o: string, centang: boolean) {
    if (!centang) return onUbah(nilai.filter((x) => x !== o));
    if (o === eksklusif) return onUbah([o]);
    onUbah([...nilai.filter((x) => x !== eksklusif), o]);
  }
  return (
    <fieldset
      className={cn("m-0 min-w-0 border-0 p-0", className)}
      aria-describedby={keterangan ? `${id}-ket` : undefined}
    >
      <LegendPilihan asal={asal} petunjuk="(boleh lebih dari satu)">
        {legend}
      </LegendPilihan>
      {keterangan && (
        <p id={`${id}-ket`} className="-mt-0.5 mb-2 text-xs text-fg-subtle">
          {keterangan}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {opsi.map((o) => (
          <label key={o} className={PIL_PILIHAN}>
            <input
              type="checkbox"
              value={o}
              checked={nilai.includes(o)}
              onChange={(e) => ubah(o, e.target.checked)}
              className={KONTROL_PILIHAN}
            />
            <span>{o}</span>
          </label>
        ))}
        {lain && <KolomLainnya {...lain} />}
      </div>
    </fieldset>
  );
}

/** Kolom teks "Lainnya" berlabel tampak, sebaris dengan pil pilihan. */
export function KolomLainnya({
  nilai,
  onUbah,
  placeholder,
}: {
  nilai: string;
  onUbah: (v: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <span className="flex min-w-[12rem] flex-1 items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-[13px] text-fg-muted">
        Lainnya
      </label>
      <input
        id={id}
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        placeholder={placeholder ?? "Sebutkan bila ada"}
        enterKeyHint="next"
        className="h-9 min-w-0 flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 text-[13px] text-fg placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 pointer-coarse:h-11 pointer-coarse:text-base"
      />
    </span>
  );
}
