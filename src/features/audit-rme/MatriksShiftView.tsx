"use client";

import { Ban, Check, CircleDashed, Minus, Stethoscope, Thermometer, TriangleAlert, UsersRound } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  PROFESI_BIDAN,
  PROFESI_DOKTER,
  PROFESI_PERAWAT,
  SHIFTS,
  type ShiftKey,
} from "@/server/modules/audit-rme/kunjungan.constants";
import type { HariDinas, Matriks, Petugas, SelStatus, ShiftCell } from "./audit.client";

const SEL_STYLE: Record<SelStatus, string> = {
  OK: "border-success/30 bg-success-soft",
  KURANG: "border-danger/35 bg-danger-soft",
  PARSIAL: "border-dashed border-border-strong bg-surface",
  NANTI: "border-dashed border-border bg-surface-2/40",
  LUAR: "border-transparent bg-surface-2/40",
};
const SEL_LABEL: Record<SelStatus, string> = {
  OK: "Terpenuhi",
  KURANG: "Tidak terpenuhi",
  PARSIAL: "Sebagian dalam masa rawat — tidak dinilai",
  NANTI: "Belum berjalan",
  LUAR: "Di luar masa rawat",
};

function StatusIcon({ s, className }: { s: SelStatus; className?: string }) {
  const cls = cn("size-3.5 shrink-0", className);
  if (s === "OK") return <Check className={cn(cls, "text-success")} aria-hidden />;
  if (s === "KURANG") return <TriangleAlert className={cn(cls, "text-danger")} aria-hidden />;
  if (s === "PARSIAL" || s === "NANTI") return <CircleDashed className={cn(cls, "text-fg-subtle")} aria-hidden />;
  return <Minus className={cn(cls, "text-fg-subtle")} aria-hidden />;
}

/** Warna avatar per profesi (identitas, bukan status). */
export function profesiTone(p: number | null | undefined): string {
  if (p === PROFESI_DOKTER) return "bg-brand text-white";
  if (p === PROFESI_PERAWAT) return "bg-accent text-white";
  if (p === PROFESI_BIDAN) return "bg-warning text-white";
  return "bg-fg-subtle text-white";
}

export function initialsOf(nama: string | null | undefined): string {
  const parts = (nama ?? "?").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AvatarStack({ ids, petugas, max = 3 }: { ids: string[]; petugas: Record<string, Petugas>; max?: number }) {
  if (ids.length === 0) return null;
  const shown = ids.slice(0, max);
  const names = ids.map((id) => `${petugas[id]?.nama ?? `#${id}`} (${petugas[id]?.profesiLabel ?? "?"})`).join("\n");
  return (
    <span className="inline-flex items-center" title={names} aria-label={`${ids.length} petugas: ${names.replace(/\n/g, ", ")}`}>
      {shown.map((id, i) => (
        <span
          key={id}
          className={cn(
            "flex size-5 items-center justify-center rounded-full text-[8px] font-bold ring-2 ring-surface",
            profesiTone(petugas[id]?.profesi),
            i > 0 && "-ml-1.5",
          )}
          aria-hidden
        >
          {initialsOf(petugas[id]?.nama)}
        </span>
      ))}
      {ids.length > max && <span className="ml-1 text-[10px] font-medium text-fg-muted">+{ids.length - max}</span>}
    </span>
  );
}

const hariFmt = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Matriks kepatuhan Rawat Inap: baris = hari dinas (mulai 07.00), kolom =
 * shift + visite dokter + TTV harian. Klik sel → saring data aktual.
 */
export function MatriksShiftView({
  matriks,
  petugas,
  onPilih,
}: {
  matriks: Matriks;
  petugas: Record<string, Petugas>;
  onPilih: (tanggal: string, shift?: ShiftKey) => void;
}) {
  const r = matriks.ringkasan;
  const t = matriks.target;

  return (
    <div className="space-y-4">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile icon={UsersRound} label="CPPT keperawatan per shift" nilai={r.shiftOk} dari={r.shiftDinilai} satuan="shift" />
        <Tile icon={Stethoscope} label="Visite dokter per hari" nilai={r.dokterOk} dari={r.hariDinilai} satuan="hari" />
        <Tile icon={Thermometer} label={`TTV ≥ ${t.ttvPerHari} per hari`} nilai={r.ttvOk} dari={r.hariDinilai} satuan="hari" />
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
          <p className="text-[11px] text-fg-muted">Kepatuhan keseluruhan</p>
          <p className={cn("mt-1 text-2xl font-semibold tabular", r.persen == null ? "text-fg-subtle" : r.persen >= 80 ? "text-success" : r.persen >= 60 ? "text-warning" : "text-danger")}>
            {r.persen == null ? "—" : `${r.persen}%`}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-fg-muted">
        Target: CPPT keperawatan (Paramedis/Bidan) ≥ {t.cpptPerawatPerShift}/shift · CPPT dokter ≥ {t.cpptDokterPerHari}/hari · TTV ≥ {t.ttvPerHari}/hari.
        Hari dinas dimulai pukul 07.00. Shift/hari yang hanya sebagian berada dalam masa rawat tidak dinilai.
      </p>

      {/* Grid */}
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface">
        <table className="w-full min-w-[600px] border-separate border-spacing-1 text-xs">
          <thead>
            <tr className="text-left text-[10px] font-semibold tracking-wide text-fg-muted uppercase">
              <th scope="col" className="w-24 px-1.5 py-1">Hari dinas</th>
              {SHIFTS.map((s) => (
                <th key={s.key} scope="col" className="px-1.5 py-1">
                  {s.label} <span className="font-normal normal-case">{String(s.start).padStart(2, "0")}–{String(s.end).padStart(2, "0")}</span>
                </th>
              ))}
              <th scope="col" className="w-20 px-1.5 py-1">Visite</th>
              <th scope="col" className="w-20 px-1.5 py-1">TTV</th>
            </tr>
          </thead>
          <tbody>
            {matriks.hari.map((h) => (
              <HariRow key={h.tanggal} h={h} petugas={petugas} ttvTarget={t.ttvPerHari} onPilih={onPilih} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-fg-muted">
        {(["OK", "KURANG", "PARSIAL", "NANTI"] as SelStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("inline-flex size-4 items-center justify-center rounded border", SEL_STYLE[s])}><StatusIcon s={s} className="size-2.5" /></span>
            {SEL_LABEL[s].split(" —")[0]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-full", profesiTone(PROFESI_DOKTER))} /> Dokter</span>
        <span className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-full", profesiTone(PROFESI_PERAWAT))} /> Perawat</span>
        <span className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-full", profesiTone(PROFESI_BIDAN))} /> Bidan</span>
        <span className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-full", profesiTone(null))} /> Lainnya</span>
      </div>
      {(matriks.terpotong || matriks.diLuarMasaRawat > 0) && (
        <p className="text-[11px] text-fg-muted">
          {matriks.terpotong && "Masa rawat sangat panjang — matriks dibatasi. "}
          {matriks.diLuarMasaRawat > 0 && `${matriks.diLuarMasaRawat} input tercatat di luar rentang hari dinas.`}
        </p>
      )}
    </div>
  );
}

function HariRow({
  h,
  petugas,
  ttvTarget,
  onPilih,
}: {
  h: HariDinas;
  petugas: Record<string, Petugas>;
  ttvTarget: number;
  onPilih: (tanggal: string, shift?: ShiftKey) => void;
}) {
  return (
    <tr>
      <th scope="row" className="px-1.5 py-1 text-left align-middle">
        <button type="button" onClick={() => onPilih(h.tanggal)} className="rounded text-left hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
          <span className="block text-xs font-semibold text-fg">H{h.hariKe}</span>
          <span className="block text-[10px] font-normal text-fg-muted">{hariFmt.format(new Date(`${h.tanggal}T00:00:00Z`))}</span>
        </button>
      </th>
      {h.shifts.map((c) => (
        <td key={c.shift} className="p-0 align-top">
          <ShiftButton c={c} tanggal={h.tanggal} hariKe={h.hariKe} petugas={petugas} onPilih={onPilih} />
        </td>
      ))}
      <td className="p-0 align-top">
        <HarianCell status={h.dokterStatus} utama={`${h.cpptDokter}`} sub="CPPT dokter" />
      </td>
      <td className="p-0 align-top">
        <HarianCell status={h.ttvStatus} utama={`${h.ttv}/${ttvTarget}`} sub="pemeriksaan" />
      </td>
    </tr>
  );
}

function ShiftButton({
  c,
  tanggal,
  hariKe,
  petugas,
  onPilih,
}: {
  c: ShiftCell;
  tanggal: string;
  hariKe: number;
  petugas: Record<string, Petugas>;
  onPilih: (tanggal: string, shift?: ShiftKey) => void;
}) {
  const lain = [c.ttv ? `TTV ${c.ttv}` : null, c.tindakan ? `TIN ${c.tindakan}` : null, c.cpptDokter ? `Dr ${c.cpptDokter}` : null]
    .filter(Boolean)
    .join(" · ");
  const label = `H${hariKe} ${c.shift.toLowerCase()}: ${SEL_LABEL[c.status]}. CPPT keperawatan ${c.cpptKeperawatan}${lain ? `, ${lain}` : ""}${c.batal ? `, ${c.batal} batal` : ""}. ${c.petugas.length} petugas.`;
  // Tanpa input & tak dinilai (di luar masa rawat / belum berjalan) → tampil ringkas, bukan "0".
  const kosong =
    (c.status === "LUAR" || c.status === "NANTI") && c.petugas.length === 0 && c.cpptKeperawatan + c.ttv + c.tindakan + c.batal === 0;
  return (
    <button
      type="button"
      onClick={() => onPilih(tanggal, c.shift)}
      disabled={kosong}
      title={label}
      aria-label={label}
      className={cn(
        "flex min-h-[64px] w-full flex-col gap-1 rounded-md border p-1.5 text-left transition-shadow",
        "hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:cursor-default disabled:hover:shadow-none",
        SEL_STYLE[c.status],
      )}
    >
      <span className="flex items-center gap-1">
        <StatusIcon s={c.status} />
        {kosong ? (
          <span className="text-[10px] text-fg-subtle">{c.status === "NANTI" ? "belum" : ""}</span>
        ) : (
          <>
            <span className={cn("text-sm font-semibold tabular", c.status === "KURANG" ? "text-danger" : "text-fg")}>{c.cpptKeperawatan}</span>
            <span className="text-[10px] text-fg-muted">CPPT</span>
          </>
        )}
        {c.batal > 0 && (
          <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-medium text-danger"><Ban className="size-2.5" />{c.batal}</span>
        )}
      </span>
      {lain && <span className="text-[10px] leading-tight text-fg-muted">{lain}</span>}
      <AvatarStack ids={c.petugas} petugas={petugas} />
    </button>
  );
}

function HarianCell({ status, utama, sub }: { status: SelStatus; utama: string; sub: string }) {
  return (
    <div className={cn("flex min-h-[64px] flex-col justify-center gap-0.5 rounded-md border p-1.5", SEL_STYLE[status])} title={SEL_LABEL[status]}>
      <span className="flex items-center gap-1">
        <StatusIcon s={status} />
        <span className={cn("text-sm font-semibold tabular", status === "KURANG" ? "text-danger" : "text-fg")}>
          {status === "LUAR" ? "" : status === "NANTI" ? <span className="text-[10px] font-normal text-fg-subtle">belum</span> : utama}
        </span>
      </span>
      {status !== "LUAR" && status !== "NANTI" && <span className="text-[10px] text-fg-muted">{sub}</span>}
    </div>
  );
}

function Tile({ icon: Icon, label, nilai, dari, satuan }: { icon: typeof Check; label: string; nilai: number; dari: number; satuan: string }) {
  const pct = dari ? nilai / dari : null;
  const tone = pct == null ? "text-fg-subtle" : pct >= 0.8 ? "text-success" : pct >= 0.6 ? "text-warning" : "text-danger";
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
      <p className="flex items-center gap-1.5 text-[11px] text-fg-muted"><Icon className="size-3.5" />{label}</p>
      <p className="mt-1 text-lg font-semibold tabular text-fg">
        <span className={tone}>{nilai}</span>
        <span className="text-sm font-normal text-fg-muted">/{dari} {satuan}</span>
      </p>
    </div>
  );
}
