"use client";

import { useState } from "react";
import { AlertCircle, ShieldPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { ApiError, createRole, updateRole, type RoleItem } from "@/features/master/master.client";

export function RoleFormModal({
  open,
  mode,
  role,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  role?: RoleItem;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  // Modal di-mount saat dibuka → inisialisasi dari props lewat initializer.
  const [key, setKey] = useState(role?.key ?? "");
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = mode === "edit";

  async function submit() {
    if (!isEdit && !/^[a-z0-9._-]{2,40}$/.test(key.trim().toLowerCase())) {
      setError("Kunci peran 2–40 karakter: huruf kecil, angka, titik, garis bawah, strip.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Nama peran minimal 2 karakter.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && role) {
        await updateRole(role.id, { name: name.trim(), description: description.trim() });
        onSaved("Peran diperbarui.");
      } else {
        await createRole({ key: key.trim().toLowerCase(), name: name.trim(), description: description.trim() });
        onSaved(`Peran "${name.trim()}" dibuat. Atur hak aksesnya berikutnya.`);
      }
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menyimpan peran.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      dismissible={!saving}
      icon={
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand-soft-fg">
          <ShieldPlus className="size-4.5" />
        </div>
      }
      title={isEdit ? "Ubah Peran" : "Tambah Peran"}
      description={isEdit ? role?.key : "Peran baru dibuat tanpa izin — atur setelahnya."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={submit} loading={saving}>
            {isEdit ? "Simpan" : "Buat Peran"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div>
          <Label>Kunci peran (slug)</Label>
          <Input
            value={key}
            disabled={isEdit}
            placeholder="mis. admisi"
            className="font-mono"
            onChange={(e) => setKey(e.target.value)}
          />
          {isEdit && <p className="mt-1 text-[11px] text-fg-subtle">Kunci tidak dapat diubah.</p>}
        </div>
        <div>
          <Label>Nama peran</Label>
          <Input value={name} placeholder="mis. Petugas Admisi" onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Deskripsi (opsional)</Label>
          <Input value={description} placeholder="Ringkasan tugas peran" onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
