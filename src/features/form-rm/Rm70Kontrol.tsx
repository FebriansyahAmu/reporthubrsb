"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Kontrol kecil bersama isian RM.70: chip pilihan (tunggal / ganda), segmen,
 * input angka yang hanya menyimpan nilai sah, dan area teks.
 */

const FOKUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring";

export type NadaChip = "brand" | "success" | "warning" | "danger";

const NADA_AKTIF: Record<NadaChip, string> = {
  brand: "border-brand bg-brand text-brand-fg",
  success: "border-success bg-success text-white",
  warning: "border-warning bg-warning text-white",
  danger: "border-danger bg-danger text-white",
};

/** Satu chip pilihan (role radio / checkbox mengikuti `ganda`). */
export function Chip({
  aktif,
  onClick,
  children,
  nada = "brand",
  ganda,
  title,
  className,
  data,
}: {
  aktif: boolean;
  onClick: () => void;
  children: React.ReactNode;
  nada?: NadaChip;
  ganda?: boolean;
  title?: string;
  className?: string;
  data?: string;
}) {
  return (
    <button
      type="button"
      role={ganda ? "checkbox" : "radio"}
      aria-checked={aktif}
      title={title}
      data-pilih={data}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors disabled:opacity-60",
        FOKUS,
        aktif ? NADA_AKTIF[nada] : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
        className,
      )}
    >
      {ganda && aktif && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
      {children}
    </button>
  );
}

/** Pilihan tunggal; klik pilihan aktif sekali lagi = kosongkan. */
export function PilihTunggal<T extends string>({
  label,
  opsi,
  nilai,
  onUbah,
  nada,
  id,
}: {
  label: string;
  opsi: readonly { id: T; label: string; ket?: string }[];
  nilai: "" | T;
  onUbah: (v: "" | T) => void;
  nada?: (id: T) => NadaChip;
  id?: string;
}) {
  return (
    <div id={id} role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {opsi.map((o) => (
        <Chip key={o.id} data={o.id} aktif={nilai === o.id} title={o.ket} nada={nada?.(o.id)} onClick={() => onUbah(nilai === o.id ? "" : o.id)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

/** Pilihan ganda (urutan simpan = urutan opsi). */
export function PilihGanda<T extends string>({
  label,
  opsi,
  nilai,
  onUbah,
  id,
}: {
  label: string;
  opsi: readonly { id: T; label: string }[];
  nilai: readonly T[];
  onUbah: (v: T[]) => void;
  id?: string;
}) {
  const alih = (x: T) => onUbah(opsi.map((o) => o.id).filter((o) => (o === x ? !nilai.includes(o) : nilai.includes(o))));
  return (
    <div id={id} role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {opsi.map((o) => (
        <Chip key={o.id} data={o.id} ganda aktif={nilai.includes(o.id)} onClick={() => alih(o.id)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

/** Ya / Tidak berdampingan; klik pilihan aktif = kosongkan. */
export function YaTidakSegmen({
  id,
  nilai,
  onUbah,
  ya = "Ya",
  tidak = "Tidak",
  nadaTidak = "warning",
}: {
  id?: string;
  nilai: "" | "ya" | "tidak";
  onUbah: (v: "" | "ya" | "tidak") => void;
  ya?: string;
  tidak?: string;
  nadaTidak?: "warning" | "neutral";
}) {
  return (
    <div id={id} role="radiogroup" className="inline-flex h-9 rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
      {(["ya", "tidak"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={nilai === v}
          data-pilih={v}
          onClick={() => onUbah(nilai === v ? "" : v)}
          className={cn(
            "min-w-16 rounded-[calc(var(--radius-md)-3px)] px-3 text-sm font-medium transition-colors",
            FOKUS,
            nilai === v
              ? v === "tidak" && nadaTidak === "warning"
                ? "bg-surface text-warning shadow-sm ring-1 ring-warning/40"
                : "bg-surface text-fg shadow-sm ring-1 ring-border"
              : "text-fg-muted hover:text-fg",
          )}
        >
          {v === "ya" ? ya : tidak}
        </button>
      ))}
    </div>
  );
}

const KELAS_INPUT =
  "h-9 w-full min-w-0 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 text-sm tabular-nums text-fg placeholder:text-fg-subtle/70 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 disabled:opacity-70";

/**
 * Input angka bulat: menyimpan hanya nilai dalam [min, maks] (kosong = hapus);
 * selama mengetik nilai antara (mis. "1" menuju "140") ditahan di input lalu
 * dikembalikan ke nilai tersimpan saat fokus lepas. Pasang `key` per konteks.
 */
export function InputAngka({
  id,
  nilai,
  min,
  maks,
  onUbah,
  placeholder,
  satuan,
  label,
  bahaya,
  className,
}: {
  id?: string;
  nilai: number | null;
  min: number;
  maks: number;
  onUbah: (v: number | null) => void;
  placeholder?: string;
  satuan?: string;
  label?: string;
  bahaya?: boolean;
  className?: string;
}) {
  const [teks, setTeks] = useState(nilai === null ? "" : String(nilai));
  const [awal, setAwal] = useState(nilai);
  // Nilai dari luar berubah (klik grafik / urungkan) → ikuti.
  if (awal !== nilai) {
    setAwal(nilai);
    setTeks(nilai === null ? "" : String(nilai));
  }
  const ubah = (v: string) => {
    const t = v.replace(/\D/g, "").slice(0, String(maks).length);
    setTeks(t);
    if (t === "") return onUbah(null);
    const n = Number(t);
    if (n >= min && n <= maks) onUbah(n);
  };
  return (
    <span className={cn("relative block", className)}>
      <input
        id={id}
        value={teks}
        inputMode="numeric"
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => ubah(e.target.value)}
        onBlur={() => setTeks(nilai === null ? "" : String(nilai))}
        className={cn(KELAS_INPUT, satuan && "pr-12", bahaya && "border-danger text-danger")}
      />
      {satuan && <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-fg-subtle">{satuan}</span>}
    </span>
  );
}

/** Input teks ringkas (gaya sama dengan InputAngka). */
export function InputRingkas({
  id,
  nilai,
  onUbah,
  maks,
  placeholder,
  label,
  mode,
  saring,
  className,
}: {
  id?: string;
  nilai: string;
  onUbah: (v: string) => void;
  maks: number;
  placeholder?: string;
  label?: string;
  mode?: "text" | "numeric" | "decimal";
  saring?: (v: string) => string;
  className?: string;
}) {
  return (
    <input
      id={id}
      value={nilai}
      maxLength={maks}
      inputMode={mode}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => onUbah((saring ? saring(e.target.value) : e.target.value).slice(0, maks))}
      className={cn(KELAS_INPUT, "tabular-nums", className)}
    />
  );
}

export function AreaTeks({
  id,
  nilai,
  onUbah,
  maks,
  placeholder,
  baris = 2,
}: {
  id?: string;
  nilai: string;
  onUbah: (v: string) => void;
  maks: number;
  placeholder?: string;
  baris?: number;
}) {
  return (
    <textarea
      id={id}
      rows={baris}
      maxLength={maks}
      value={nilai}
      placeholder={placeholder}
      onChange={(e) => onUbah(e.target.value)}
      className="w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 disabled:opacity-70"
    />
  );
}
