"use client";

import { createContext, useContext } from "react";
import { DatabaseZap, PencilLine } from "lucide-react";
import { LABEL_SUMBER, statusAsalGabung, type AsalIsian } from "@/features/form-rm/asal";
import { cn } from "@/lib/cn";

/**
 * Penanda asal kolom (PRD §6.4 butir 2): "SIMRS" selama nilai kolom masih
 * nilai SIMRS, "Diubah" setelah petugas menggantinya. Konteks diisi
 * <IsianFrame>; di luar konteks penanda tidak dirender.
 */
type KonteksAsal = { asal: AsalIsian; data: unknown };
const AsalContext = createContext<KonteksAsal | null>(null);

export function AsalIsianProvider({ value, children }: { value: KonteksAsal; children: React.ReactNode }) {
  return <AsalContext value={value}>{children}</AsalContext>;
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Nilai kolom → teks ringkas untuk tooltip & perbandingan. */
export function formatNilaiIsian(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  if (Array.isArray(v)) return v.length ? v.map(formatNilaiIsian).join(", ") : "—";
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(v);
    if (m) return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}${m[4] ? ` ${m[4]}.${m[5]}` : ""}`;
    return v;
  }
  return String(v);
}

/** Penanda untuk satu kontrol; beberapa path (mis. sistolik/diastolik) digabung. */
export function TandaAsal({ path, className }: { path: string | readonly string[]; className?: string }) {
  const ctx = useContext(AsalContext);
  if (!ctx) return null;
  const paths = typeof path === "string" ? [path] : path;
  const status = statusAsalGabung(ctx.asal, ctx.data, paths);
  if (!status) return null;

  const entri = paths.map((p) => ctx.asal[p]).filter(Boolean);
  const sumber = [...new Set(entri.map((a) => (a.sumber ? LABEL_SUMBER[a.sumber] : "SIMRS")))].join(", ");
  const igd = entri.find((a) => a.nopen)?.nopen;
  const judul =
    status === "simrs"
      ? `Terisi otomatis dari SIMRS (${sumber})${igd ? ` — episode IGD asal ${igd}` : ""}`
      : `Diubah petugas. Nilai SIMRS: ${entri
          .filter((a) => "nilai" in a)
          .map((a) => formatNilaiIsian(a.nilai))
          .join(" / ") || "—"}`;

  return (
    <span
      title={judul}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
        status === "simrs" ? "bg-brand-soft text-brand-soft-fg" : "bg-surface-2 text-fg-muted",
        className,
      )}
    >
      {status === "simrs" ? <DatabaseZap className="size-2.5" aria-hidden /> : <PencilLine className="size-2.5" aria-hidden />}
      {status === "simrs" ? (igd ? "SIMRS · IGD" : "SIMRS") : "Diubah"}
      <span className="sr-only">: {judul}</span>
    </span>
  );
}

/** Label kolom + penanda asal di sebelahnya. */
export function LabelAsal({
  path,
  htmlFor,
  className,
  children,
}: {
  path: string | readonly string[];
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // Kolom sempit: penanda turun ke baris berikutnya, label tak pernah terpotong.
    <div className={cn("mb-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5", className)}>
      <label htmlFor={htmlFor} className="min-w-0 text-xs font-medium text-fg-muted">
        {children}
      </label>
      <TandaAsal path={path} />
    </div>
  );
}
