"use client";

import { useState } from "react";
import { Check, Layers, UserCog } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { PegawaiCombobox } from "./PegawaiCombobox";
import type {
  Pejabat,
  PejabatData,
} from "@/server/modules/master/ruangan/ruangan-pejabat.types";

export type PejabatRole = "kepalaInstalasi" | "kepalaRuangan" | "ketuaTim";

export type PejabatTarget = {
  /** ruanganId (`master.ruangan.ID`) atau "inst:*". */
  ruanganId: string;
  title: string;
  subtitle?: string;
  /** Snapshot untuk disimpan. */
  nama: string;
  kategori: string;
  roles: PejabatRole[];
  initial: PejabatData;
  /** Bila ada (mode ruangan): tampilkan opsi terapkan Kepala Ruangan ke semua ruangan instalasi. */
  applyAll?: { kategori: string; label: string; count: number };
};

const ROLE_LABEL: Record<PejabatRole, string> = {
  kepalaInstalasi: "Kepala Instalasi",
  kepalaRuangan: "Kepala Ruangan",
  ketuaTim: "Ketua Tim",
};

/** Jabatan yang menandatangani dokumen → punya penangkap tanda tangan. */
const SIGN_ROLES = new Set<PejabatRole>(["kepalaInstalasi", "kepalaRuangan"]);

/** Modal penetapan pejabat (satu ruangan atau instalasi): combobox pegawai + TTD. */
export function PejabatModal({
  target,
  onClose,
  onSaved,
  onAppliedAll,
}: {
  target: PejabatTarget;
  onClose: () => void;
  onSaved: (ruanganId: string, data: PejabatData) => void;
  /** Dipanggil setelah Kepala Ruangan diterapkan ke semua ruangan satu kategori. */
  onAppliedAll?: (kategori: string, kepalaRuangan: Pejabat | null) => void;
}) {
  const [data, setData] = useState<PejabatData>(target.initial);
  const [applyAll, setApplyAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  /** Set nama+NIP sebuah jabatan, PERTAHANKAN TTD yang sudah ada. */
  function setIdentity(role: PejabatRole, v: Pejabat | null) {
    setData((d) => {
      const prevTtd = d[role]?.ttd;
      if (!v) return { ...d, [role]: prevTtd ? { nama: "", nip: "", ttd: prevTtd } : undefined };
      return { ...d, [role]: { ...v, ttd: prevTtd } };
    });
  }

  /** Set TTD sebuah jabatan, PERTAHANKAN nama+NIP. */
  function setTtd(role: PejabatRole, ttd: string) {
    setData((d) => {
      const prev = d[role] ?? { nama: "", nip: "" };
      return { ...d, [role]: { ...prev, ttd: ttd || undefined } };
    });
  }

  const canApplyAll = !!target.applyAll && !!data.kepalaRuangan?.nama?.trim();

  async function save() {
    setSaving(true);
    setError(false);
    try {
      // 1) Simpan entitas ini (ruangan / instalasi).
      const res = await fetch(`/api/master/ruangan/${encodeURIComponent(target.ruanganId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: target.nama, kategori: target.kategori, data }),
      });
      if (!res.ok) throw new Error("save");

      // 2) Terapkan Kepala Ruangan ke semua ruangan instalasi bila diminta.
      if (target.applyAll && applyAll && canApplyAll) {
        const res2 = await fetch("/api/master/ruangan/terapkan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kategori: target.applyAll.kategori,
            pejabat: data.kepalaRuangan ?? null,
          }),
        });
        if (!res2.ok) throw new Error("apply");
        onAppliedAll?.(target.applyAll.kategori, data.kepalaRuangan ?? null);
      }

      onSaved(target.ruanganId, data);
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      dismissible={!saving}
      title={target.title}
      description={target.subtitle}
      icon={
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand-soft-fg">
          <UserCog className="size-4.5" />
        </div>
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button size="sm" onClick={save} loading={saving}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {target.roles.map((role) => (
          <div key={role} className="rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3.5">
            <PegawaiCombobox
              label={ROLE_LABEL[role]}
              value={data[role] ?? null}
              onChange={(v) => setIdentity(role, v)}
              hint={
                role === "kepalaRuangan"
                  ? "Muncul sebagai penandatangan pada cetakan Bukti Pelayanan."
                  : undefined
              }
            />

            {SIGN_ROLES.has(role) && (
              <div className="mt-3 border-t border-border/60 pt-3">
                <SignaturePad
                  label={`Tanda Tangan ${ROLE_LABEL[role]}`}
                  value={data[role]?.ttd ?? ""}
                  onChange={(ttd) => setTtd(role, ttd)}
                  context={`${ROLE_LABEL[role]} — ${target.nama}`}
                />
              </div>
            )}

            {/* Terapkan Kepala Ruangan (nama+NIP+TTD) ke semua ruangan instalasi */}
            {role === "kepalaRuangan" && target.applyAll && (
              <button
                type="button"
                disabled={!canApplyAll}
                onClick={() => setApplyAll((v) => !v)}
                aria-pressed={applyAll && canApplyAll}
                className={cn(
                  "mt-3 flex w-full items-start gap-3 rounded-[var(--radius-md)] border p-3 text-left transition-colors",
                  !canApplyAll
                    ? "cursor-not-allowed border-border bg-surface-2/40 opacity-60"
                    : applyAll
                      ? "border-brand/50 bg-brand-soft"
                      : "border-border bg-surface hover:border-brand/40 hover:bg-brand-soft/50",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors",
                    applyAll && canApplyAll
                      ? "border-brand bg-brand text-brand-fg"
                      : "border-border-strong bg-surface",
                  )}
                >
                  {applyAll && canApplyAll && <Check className="size-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
                    <Layers className="size-3.5 text-brand" />
                    Terapkan ke semua ruangan {target.applyAll.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-fg-muted">
                    {canApplyAll
                      ? `Kepala Ruangan ini (nama, NIP & tanda tangan) dipakai untuk seluruh ${target.applyAll.count} ruangan ${target.applyAll.label}.`
                      : "Isi Kepala Ruangan dulu untuk bisa menerapkannya ke semua ruangan."}
                  </span>
                </span>
              </button>
            )}
          </div>
        ))}

        {error && <p className="text-sm text-danger">Gagal menyimpan. Coba lagi.</p>}
      </div>
    </Modal>
  );
}
