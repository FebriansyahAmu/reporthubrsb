"use client";

import { useState } from "react";
import { UserCog } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
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
};

const ROLE_LABEL: Record<PejabatRole, string> = {
  kepalaInstalasi: "Kepala Instalasi",
  kepalaRuangan: "Kepala Ruangan",
  ketuaTim: "Ketua Tim",
};

/** Modal penetapan pejabat (satu ruangan atau instalasi) dengan combobox pegawai. */
export function PejabatModal({
  target,
  onClose,
  onSaved,
}: {
  target: PejabatTarget;
  onClose: () => void;
  onSaved: (ruanganId: string, data: PejabatData) => void;
}) {
  const [data, setData] = useState<PejabatData>(target.initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  function setRole(role: PejabatRole, v: Pejabat | null) {
    setData((d) => ({ ...d, [role]: v ?? undefined }));
  }

  async function save() {
    setSaving(true);
    setError(false);
    try {
      const res = await fetch(`/api/master/ruangan/${encodeURIComponent(target.ruanganId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: target.nama, kategori: target.kategori, data }),
      });
      if (!res.ok) throw new Error("save");
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
      size="md"
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
      <div className="space-y-4">
        {target.roles.map((role) => (
          <PegawaiCombobox
            key={role}
            label={ROLE_LABEL[role]}
            value={data[role] ?? null}
            onChange={(v) => setRole(role, v)}
            hint={
              role === "kepalaRuangan"
                ? "Muncul sebagai penandatangan pada cetakan Bukti Pelayanan."
                : undefined
            }
          />
        ))}
        {error && <p className="text-sm text-danger">Gagal menyimpan. Coba lagi.</p>}
      </div>
    </Modal>
  );
}
