import { cn } from "@/lib/cn";
import type { ChecklistItem, VitalSigns } from "@/features/resume-medis/types";

/* Primitives untuk dokumen report (Resume Medis dll.) — gaya formal, ramah cetak.
   Semua presentational (server-component friendly). */

export function ReportSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-4", className)}>
      <h2 className="mb-1.5 border-b border-neutral-400 pb-1 text-[11px] font-bold uppercase tracking-wide text-neutral-800">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Field({
  label,
  value,
  labelWidth = "w-36",
}: {
  label: string;
  value: React.ReactNode;
  labelWidth?: string;
}) {
  return (
    <div className="flex gap-1 text-[13px] leading-relaxed">
      <span className={cn("shrink-0 text-neutral-600", labelWidth)}>{label}</span>
      <span className="text-neutral-500">:</span>
      <span className="flex-1 text-neutral-900">{value ?? "—"}</span>
    </div>
  );
}

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-0.5 sm:grid-cols-2">{children}</div>
  );
}

/** Teks paragraf/multi-baris. Mengembalikan null bila kosong. */
export function Prose({
  value,
  label,
}: {
  value: string | null | undefined;
  label?: string;
}) {
  if (!value) return null;
  return (
    <div className="text-[13px] leading-relaxed text-neutral-900">
      {label && <span className="font-medium text-neutral-700">{label}: </span>}
      <span className="whitespace-pre-line">{value}</span>
    </div>
  );
}

/** Render HTML tersanitasi (mis. field FISIK). */
export function HtmlBlock({ html }: { html: string }) {
  return (
    <div
      className="report-html text-[13px] leading-relaxed text-neutral-900 [&_div]:min-h-0"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function CheckList({
  items,
  columns = 2,
}: {
  items: ChecklistItem[];
  columns?: number;
}) {
  return (
    <div
      className={cn(
        "grid gap-x-6 gap-y-1 text-[13px]",
        columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2",
      )}
    >
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-2 text-neutral-900">
          <span
            className={cn(
              "flex size-3.5 shrink-0 items-center justify-center border border-neutral-800",
              it.checked && "bg-neutral-900",
            )}
          >
            {it.checked && (
              <svg viewBox="0 0 12 12" className="size-2.5 text-white" fill="none">
                <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className={cn(it.checked ? "font-medium" : "text-neutral-600")}>{it.label}</span>
        </span>
      ))}
    </div>
  );
}

const VITAL_META: { key: keyof VitalSigns; label: string; unit: string }[] = [
  { key: "td", label: "TD", unit: "mmHg" },
  { key: "nadi", label: "Nadi", unit: "x/mnt" },
  { key: "nafas", label: "Nafas", unit: "x/mnt" },
  { key: "suhu", label: "Suhu", unit: "°C" },
  { key: "spo2", label: "SpO₂", unit: "%" },
];

export function VitalsGrid({ vital }: { vital: VitalSigns }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {VITAL_META.map((v) => (
        <div key={v.key} className="rounded border border-neutral-300 px-2 py-1.5 text-center">
          <div className="text-[10px] uppercase text-neutral-500">{v.label}</div>
          <div className="text-sm font-semibold text-neutral-900 tabular">
            {vital[v.key] ?? "—"}
          </div>
          <div className="text-[9px] text-neutral-400">{v.unit}</div>
        </div>
      ))}
    </div>
  );
}

export function SignatureBlock({
  kota,
  tanggal,
  peran,
  nama,
  nip,
}: {
  kota: string | null;
  tanggal: string;
  peran: string;
  nama: string;
  nip: string | null;
}) {
  return (
    <div className="mt-8 flex justify-end">
      <div className="text-center text-[13px] text-neutral-900">
        <p>
          {kota ? `${toTitle(kota)}, ` : ""}
          {tanggal}
        </p>
        <p>{peran}</p>
        <div className="h-16" />
        <p className="font-semibold underline">{nama}</p>
        {nip && <p className="text-xs text-neutral-600">NIP. {nip}</p>}
      </div>
    </div>
  );
}

function toTitle(s: string) {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
