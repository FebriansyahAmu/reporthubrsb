"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, DoorOpen, Pencil, Signature, Stethoscope, UserRound, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { PejabatModal, type PejabatTarget } from "./PejabatModal";
import type {
  InstalasiGroup,
  Pejabat,
  PejabatData,
  RuanganMappingResult,
  RuanganPejabatItem,
} from "@/server/modules/master/ruangan/ruangan-pejabat.types";

/** null bila nama & NIP kosong (sinkronisasi state lokal pasca-simpan). TTD dipertahankan. */
function norm(p: Pejabat | undefined | null): Pejabat | null {
  if (!p) return null;
  const nama = (p.nama ?? "").trim();
  const nip = (p.nip ?? "").trim();
  if (!nama && !nip) return null;
  const ttd = (p.ttd ?? "").trim();
  return ttd ? { nama, nip, ttd } : { nama, nip };
}

export function RuanganMappingView({
  initial,
  canUpdate,
}: {
  initial: RuanganMappingResult;
  canUpdate: boolean;
}) {
  const [instalasi, setInstalasi] = useState<InstalasiGroup[]>(initial.instalasi);
  const [activeIdx, setActiveIdx] = useState(0);
  const [editing, setEditing] = useState<PejabatTarget | null>(null);

  const active = instalasi[activeIdx];

  function applySaved(ruanganId: string, data: PejabatData) {
    setInstalasi((prev) =>
      prev.map((inst) => {
        if (inst.instalasiId === ruanganId) {
          return { ...inst, kepalaInstalasi: norm(data.kepalaInstalasi) };
        }
        return {
          ...inst,
          ruangan: inst.ruangan.map((r) =>
            r.ruanganId === ruanganId
              ? { ...r, kepalaRuangan: norm(data.kepalaRuangan), ketuaTim: norm(data.ketuaTim) }
              : r,
          ),
        };
      }),
    );
    setEditing(null);
  }

  /** Pasca "terapkan ke semua ruangan": set Kepala Ruangan di semua ruangan satu kategori. */
  function applyToKategori(kategori: string, kepalaRuangan: Pejabat | null) {
    const kr = norm(kepalaRuangan);
    setInstalasi((prev) =>
      prev.map((inst) =>
        inst.kategori === kategori
          ? { ...inst, ruangan: inst.ruangan.map((r) => ({ ...r, kepalaRuangan: kr })) }
          : inst,
      ),
    );
  }

  function editInstalasi(inst: InstalasiGroup) {
    setEditing({
      ruanganId: inst.instalasiId,
      title: `Kepala Instalasi ${inst.label}`,
      subtitle: "Penanggung jawab tingkat instalasi",
      nama: inst.label,
      kategori: inst.kategori,
      roles: ["kepalaInstalasi"],
      initial: { kepalaInstalasi: inst.kepalaInstalasi ?? undefined },
    });
  }

  function editRuangan(inst: InstalasiGroup, r: RuanganPejabatItem) {
    setEditing({
      ruanganId: r.ruanganId,
      title: r.nama,
      subtitle: `${inst.label} · ${r.ruanganId}`,
      nama: r.nama,
      kategori: r.kategori,
      roles: ["kepalaRuangan", "ketuaTim"],
      initial: {
        kepalaRuangan: r.kepalaRuangan ?? undefined,
        ketuaTim: r.ketuaTim ?? undefined,
      },
      applyAll: { kategori: inst.kategori, label: inst.label, count: inst.ruangan.length },
    });
  }

  return (
    <div className="space-y-5">
      {/* Pemilih instalasi (segmented) */}
      <div className="inline-flex flex-wrap gap-1 rounded-[var(--radius-md)] border border-border bg-surface-2/50 p-1">
        {instalasi.map((inst, i) => (
          <button
            key={inst.instalasiId}
            type="button"
            onClick={() => setActiveIdx(i)}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-3.5 py-1.5 text-sm font-medium transition-colors",
              i === activeIdx
                ? "bg-surface text-fg shadow-xs"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {inst.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] tabular-nums",
                i === activeIdx ? "bg-brand-soft text-brand-soft-fg" : "bg-surface-2 text-fg-subtle",
              )}
            >
              {inst.ruangan.length}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.instalasiId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4"
        >
          {/* Kepala Instalasi */}
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand-soft-fg">
                <Building2 className="size-5" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                  Kepala Instalasi {active.label}
                </div>
                <PejabatValue p={active.kepalaInstalasi} />
              </div>
            </div>
            {canUpdate && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Pencil className="size-3.5" />}
                onClick={() => editInstalasi(active)}
              >
                Atur
              </Button>
            )}
          </Card>

          {/* Ruangan */}
          {active.ruangan.length === 0 ? (
            <Card className="p-10 text-center text-sm text-fg-muted">
              Tidak ada ruangan {active.label} yang terdaftar di SIMGOS.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {active.ruangan.map((r) => (
                <RoomCard
                  key={r.ruanganId}
                  r={r}
                  canUpdate={canUpdate}
                  onEdit={() => editRuangan(active, r)}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {editing && (
        <PejabatModal
          target={editing}
          onClose={() => setEditing(null)}
          onSaved={applySaved}
          onAppliedAll={applyToKategori}
        />
      )}
    </div>
  );
}

function RoomCard({
  r,
  canUpdate,
  onEdit,
}: {
  r: RuanganPejabatItem;
  canUpdate: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <DoorOpen className="size-4 shrink-0 text-fg-subtle" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg">{r.nama}</p>
            <p className="font-mono text-[11px] text-fg-subtle">{r.ruanganId}</p>
          </div>
        </div>
        {canUpdate && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Atur ${r.nama}`}
            className="shrink-0 rounded-[var(--radius-sm)] p-1.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <Pencil className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
        <RoleRow icon={<Stethoscope className="size-3.5" />} label="Kepala Ruangan" p={r.kepalaRuangan} highlight />
        <RoleRow icon={<Users className="size-3.5" />} label="Ketua Tim" p={r.ketuaTim} />
      </div>
    </div>
  );
}

function RoleRow({
  icon,
  label,
  p,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  p: Pejabat | null;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          highlight ? "bg-brand-soft text-brand-soft-fg" : "bg-surface-2 text-fg-subtle",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-fg-muted">{label}</span>
          {highlight && (
            <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-soft-fg">
              TT Bukti
            </span>
          )}
        </div>
        {p ? (
          <>
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium text-fg">{p.nama}</p>
              {p.ttd && <TtdBadge />}
            </div>
            {p.nip && <p className="font-mono text-[11px] text-fg-subtle">NIP {p.nip}</p>}
          </>
        ) : (
          <p className="text-sm text-fg-subtle">Belum ditetapkan</p>
        )}
      </div>
    </div>
  );
}

function PejabatValue({ p }: { p: Pejabat | null }) {
  if (!p) return <p className="text-sm text-fg-subtle">Belum ditetapkan</p>;
  return (
    <div className="flex items-center gap-2">
      <UserRound className="size-3.5 shrink-0 text-fg-subtle" />
      <span className="text-sm font-semibold text-fg">{p.nama}</span>
      {p.nip && <span className="font-mono text-[11px] text-fg-subtle">NIP {p.nip}</span>}
      {p.ttd && <TtdBadge />}
    </div>
  );
}

/** Penanda bahwa pejabat sudah punya tanda tangan tersimpan. */
function TtdBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-soft-fg">
      <Signature className="size-3" /> TTD
    </span>
  );
}
