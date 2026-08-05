"use client";

import { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { PopoverPanel } from "@/components/ui/Popover";

/* -------------------------------------------------------------- date helpers */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const p2 = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD"(+opsional Txx) → Date lokal (tengah malam), null bila invalid. */
export function parseYmd(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
export const toYmd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** "YYYY-MM-DDTHH:mm" → { date, hh, mm }. */
export function parseLocalDateTime(s: string | null | undefined): { date: Date | null; hh: number; mm: number } {
  const date = parseYmd(s);
  const t = /T(\d{2}):(\d{2})/.exec(s ?? "");
  return { date, hh: t ? Number(t[1]) : 0, mm: t ? Number(t[2]) : 0 };
}
export const combineDateTime = (d: Date, hh: number, mm: number) =>
  `${toYmd(d)}T${p2(hh)}:${p2(mm)}`;

/** "YYYY-MM-DDTHH:mm" untuk saat ini (untuk auto-isi jam sekarang). */
export function nowLocalDateTime(): string {
  const d = new Date();
  return combineDateTime(d, d.getHours(), d.getMinutes());
}

export const formatIndoDate = (d: Date) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;

const sameYmd = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/* -------------------------------------------------------------- shared UI */

const TRIGGER =
  "flex h-10 w-full items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 " +
  "text-sm text-fg transition-colors cursor-pointer hover:border-border-strong " +
  "focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring/40 " +
  "disabled:opacity-50 disabled:pointer-events-none";

/** Grid kalender satu bulan dengan navigasi bulan & tahun. */
function MonthCalendar({
  selected,
  onSelect,
  min,
  max,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
  min?: Date;
  max?: Date;
}) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState(() => {
    const base = selected ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const cells = useMemo(() => {
    const firstDow = view.getDay(); // 0=Min
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(view.getFullYear(), view.getMonth(), d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [view]);

  const shift = (months: number) =>
    setView((v) => new Date(v.getFullYear(), v.getMonth() + months, 1));

  const outOfRange = (d: Date) =>
    (min && d < new Date(min.getFullYear(), min.getMonth(), min.getDate())) ||
    (max && d > new Date(max.getFullYear(), max.getMonth(), max.getDate()));

  return (
    <div className="w-[16.5rem] p-1.5">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <NavBtn onClick={() => shift(-12)} label="Tahun sebelumnya"><ChevronsLeft className="size-4" /></NavBtn>
          <NavBtn onClick={() => shift(-1)} label="Bulan sebelumnya"><ChevronLeft className="size-4" /></NavBtn>
        </div>
        <span className="text-sm font-semibold text-fg tabular-nums">
          {MONTHS_LONG[view.getMonth()]} {view.getFullYear()}
        </span>
        <div className="flex items-center gap-0.5">
          <NavBtn onClick={() => shift(1)} label="Bulan berikutnya"><ChevronRight className="size-4" /></NavBtn>
          <NavBtn onClick={() => shift(12)} label="Tahun berikutnya"><ChevronsRight className="size-4" /></NavBtn>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[11px] font-medium text-fg-subtle">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`b-${i}`} />;
          const isSel = selected && sameYmd(d, selected);
          const isToday = sameYmd(d, today);
          const disabled = outOfRange(d);
          return (
            <button
              key={toYmd(d)}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(d)}
              className={cn(
                "flex h-8 items-center justify-center rounded-[var(--radius-sm)] text-sm tabular-nums transition-colors",
                disabled && "cursor-not-allowed text-fg-subtle/40",
                !disabled && !isSel && "text-fg hover:bg-surface-2",
                isSel && "bg-brand font-semibold text-brand-fg hover:bg-brand-hover",
                !isSel && isToday && "font-semibold text-brand ring-1 ring-inset ring-brand/40",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------- DatePicker */

/** Pemilih tanggal ter-style (output "YYYY-MM-DD"). */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pilih tanggal",
  id,
  min,
  max,
  disabled,
  clearable = true,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const date = parseYmd(value);

  return (
    <>
      <button
        id={id}
        ref={setAnchorEl}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(TRIGGER, open && "border-brand ring-2 ring-brand-ring/40", className)}
      >
        <CalendarIcon className="size-4 shrink-0 text-fg-subtle" />
        <span className={cn("flex-1 truncate text-left", !date && "text-fg-subtle")}>
          {date ? formatIndoDate(date) : placeholder}
        </span>
        {clearable && date && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Kosongkan"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="shrink-0 rounded-full p-0.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-3.5" />
          </span>
        )}
      </button>

      <PopoverPanel anchor={anchorEl} open={open} onClose={() => setOpen(false)} matchWidth={false}>
        <MonthCalendar
          selected={date}
          min={parseYmd(min) ?? undefined}
          max={parseYmd(max) ?? undefined}
          onSelect={(d) => {
            onChange(toYmd(d));
            setOpen(false);
          }}
        />
        <div className="flex justify-end border-t border-border px-1.5 py-1.5">
          <button
            type="button"
            onClick={() => {
              onChange(toYmd(new Date()));
              setOpen(false);
            }}
            className="rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand-soft"
          >
            Hari ini
          </button>
        </div>
      </PopoverPanel>
    </>
  );
}

/* ---------------------------------------------------------- DateTimePicker */

/** Pemilih tanggal + jam ter-style (output "YYYY-MM-DDTHH:mm"). */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pilih tanggal & jam",
  id,
  min,
  max,
  disabled,
  clearable = true,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const { date, hh, mm } = parseLocalDateTime(value);

  const emit = (d: Date | null, h: number, m: number) => {
    if (!d) return;
    onChange(combineDateTime(d, h, m));
  };
  const setHour = (h: number) => emit(date ?? new Date(), clamp(h, 0, 23), mm);
  const setMin = (m: number) => emit(date ?? new Date(), hh, clamp(m, 0, 59));

  return (
    <>
      <button
        id={id}
        ref={setAnchorEl}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(TRIGGER, open && "border-brand ring-2 ring-brand-ring/40", className)}
      >
        <CalendarClock className="size-4 shrink-0 text-fg-subtle" />
        <span className={cn("flex-1 truncate text-left", !date && "text-fg-subtle")}>
          {date ? `${formatIndoDate(date)} · ${p2(hh)}:${p2(mm)}` : placeholder}
        </span>
        {clearable && date && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Kosongkan"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="shrink-0 rounded-full p-0.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-3.5" />
          </span>
        )}
      </button>

      <PopoverPanel anchor={anchorEl} open={open} onClose={() => setOpen(false)} matchWidth={false}>
        <MonthCalendar
          selected={date}
          min={parseYmd(min) ?? undefined}
          max={parseYmd(max) ?? undefined}
          onSelect={(d) => {
            // Pertahankan jam bila sudah ada; kalau belum, pakai jam sekarang.
            if (date) emit(d, hh, mm);
            else {
              const n = new Date();
              emit(d, n.getHours(), n.getMinutes());
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-fg-muted">Jam</span>
            <TimeBox value={hh} onChange={setHour} max={23} />
            <span className="text-fg-subtle">:</span>
            <TimeBox value={mm} onChange={setMin} max={59} />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const n = new Date();
                emit(n, n.getHours(), n.getMinutes());
              }}
              className="rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand-soft"
            >
              Sekarang
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[var(--radius-sm)] bg-brand px-2.5 py-1 text-xs font-medium text-brand-fg transition-colors hover:bg-brand-hover"
            >
              Selesai
            </button>
          </div>
        </div>
      </PopoverPanel>
    </>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Input jam/menit 2-digit kecil. */
function TimeBox({ value, onChange, max }: { value: number; onChange: (v: number) => void; max: number }) {
  return (
    <input
      type="number"
      min={0}
      max={max}
      value={p2(value)}
      onChange={(e) => {
        const n = Number(e.target.value.replace(/\D/g, ""));
        if (!Number.isNaN(n)) onChange(clamp(n, 0, max));
      }}
      className="h-8 w-11 rounded-[var(--radius-sm)] border border-border bg-surface text-center text-sm tabular-nums text-fg focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring/40"
    />
  );
}
