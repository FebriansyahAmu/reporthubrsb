"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatIndoDate, parseYmd } from "@/components/ui/DatePicker";

/* ------------------------------------------------------------------ helpers */

const p2 = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" → "DD-MM-YYYY" (untuk ditampilkan/diketik). */
function ymdToDisplay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/** Ketikan bebas → mask "DD-MM-YYYY" (maks 8 digit, strip non-angka). */
function maskDisplay(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  const dd = d.slice(0, 2);
  const mm = d.slice(2, 4);
  const yy = d.slice(4, 8);
  let out = dd;
  if (d.length > 2) out += "-" + mm;
  if (d.length > 4) out += "-" + yy;
  return out;
}

type Parsed =
  | { kind: "empty" }
  | { kind: "partial" }
  | { kind: "invalid" }
  | { kind: "future" }
  | { kind: "ok"; ymd: string; date: Date };

/** Uraikan teks "DD-MM-YYYY" → status + nilai YYYY-MM-DD bila valid & dalam rentang. */
function parseDisplay(text: string, maxYmd: string): Parsed {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 0) return { kind: "empty" };
  if (digits.length < 8) return { kind: "partial" };
  const dd = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const yyyy = Number(digits.slice(4, 8));
  const date = new Date(yyyy, mm - 1, dd);
  // Tanggal nyata (mis. tolak 31-02) & tahun masuk akal.
  const real =
    date.getFullYear() === yyyy &&
    date.getMonth() === mm - 1 &&
    date.getDate() === dd &&
    yyyy >= 1900;
  if (!real) return { kind: "invalid" };
  const max = parseYmd(maxYmd) ?? new Date();
  if (date > new Date(max.getFullYear(), max.getMonth(), max.getDate())) return { kind: "future" };
  return { kind: "ok", ymd: `${yyyy}-${p2(mm)}-${p2(dd)}`, date };
}

/* -------------------------------------------------------------- component */

/**
 * Input tanggal ketik-manual (format tampil "DD-MM-YYYY", nilai keluar "YYYY-MM-DD").
 * Emit "" selama kosong/belum lengkap/tidak valid; emit YYYY-MM-DD saat valid.
 * `onValidChange` memberi tahu induk apakah isian sah (kosong dianggap sah) →
 * dipakai untuk memblokir submit bila tanggal diketik tapi keliru.
 */
export function DateTextInput({
  value,
  onChange,
  onValidChange,
  id,
  max,
  disabled,
  className,
}: {
  value: string; // "YYYY-MM-DD" | ""
  onChange: (v: string) => void; // "YYYY-MM-DD" | ""
  onValidChange?: (valid: boolean) => void;
  id?: string;
  /** Batas atas (YYYY-MM-DD). Default: hari ini. */
  max?: string;
  disabled?: boolean;
  className?: string;
}) {
  const maxYmd = max ?? new Date().toISOString().slice(0, 10);
  const [text, setText] = useState<string>(() => ymdToDisplay(value));
  // Lacak nilai yang KITA pancarkan agar sinkronisasi eksternal (prefill/edit,
  // reset) tak menimpa ketikan pengguna.
  const emitted = useRef<string>(value);

  useEffect(() => {
    if (value === emitted.current) return; // gema dari perubahan kita sendiri
    setText(ymdToDisplay(value));
    emitted.current = value;
  }, [value]);

  const parsed = parseDisplay(text, maxYmd);
  const valid = parsed.kind === "empty" || parsed.kind === "ok";

  // Beri tahu induk status validitas (kosong = sah).
  const lastValidRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastValidRef.current !== valid) {
      lastValidRef.current = valid;
      onValidChange?.(valid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid]);

  function handle(raw: string) {
    const masked = maskDisplay(raw);
    setText(masked);
    const p = parseDisplay(masked, maxYmd);
    const next = p.kind === "ok" ? p.ymd : "";
    emitted.current = next;
    onChange(next);
  }

  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">
          <CalendarIcon className="size-4" />
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={text}
          placeholder="HH-BB-TTTT"
          aria-invalid={!valid}
          onChange={(e) => handle(e.target.value)}
          className={cn(
            "h-10 w-full rounded-[var(--radius-md)] border bg-surface pl-9 pr-9 text-sm tabular-nums text-fg",
            "placeholder:text-fg-subtle placeholder:tracking-normal transition-colors",
            "focus-visible:outline-none focus-visible:ring-2",
            "disabled:opacity-50 disabled:pointer-events-none",
            valid
              ? "border-border focus-visible:border-brand focus-visible:ring-brand-ring/40"
              : "border-danger/60 focus-visible:border-danger focus-visible:ring-danger/30",
            className,
          )}
        />
        {parsed.kind === "ok" && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-success">
            <Check className="size-4" strokeWidth={2.5} />
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-1 text-[11px]",
          parsed.kind === "invalid" || parsed.kind === "future" ? "text-danger" : "text-fg-subtle",
        )}
      >
        {parsed.kind === "ok"
          ? formatIndoDate(parsed.date)
          : parsed.kind === "invalid"
            ? "Tanggal tidak valid."
            : parsed.kind === "future"
              ? "Tanggal lahir tidak boleh di masa depan."
              : "Ketik tanggal lahir, mis. 17-08-1990."}
      </p>
    </div>
  );
}
