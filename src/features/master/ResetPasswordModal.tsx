"use client";

import { useState } from "react";
import { AlertCircle, Copy, KeyRound, Wand2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { generatePassword } from "@/features/master/master.constants";
import { ApiError, resetUserPassword, type UserListItem } from "@/features/master/master.client";

export function ResetPasswordModal({
  open,
  user,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: UserListItem;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  // Modal di-mount saat dibuka → inisialisasi state lewat initializer (bukan effect).
  const [password, setPassword] = useState(() => generatePassword());
  const [mustChange, setMustChange] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    if (password.length < 8) {
      setError("Sandi minimal 8 karakter.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await resetUserPassword(user.id, { password, mustChangePassword: mustChange });
      onSaved(`Sandi "${user.username}" telah direset. Semua sesinya diakhiri.`);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal mereset sandi.");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* abaikan */
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      dismissible={!saving}
      icon={
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-warning-soft text-warning">
          <KeyRound className="size-4.5" />
        </div>
      }
      title="Reset Sandi"
      description={user.namaLengkap}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={submit} loading={saving}>
            Reset Sandi
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div>
          <Label>Sandi baru</Label>
          <div className="flex gap-2">
            <Input value={password} className="font-mono" onChange={(e) => setPassword(e.target.value)} />
            <Button type="button" variant="secondary" icon={<Wand2 className="size-4" />} onClick={() => setPassword(generatePassword())}>
              Buat
            </Button>
            <Button type="button" variant="secondary" icon={<Copy className="size-4" />} onClick={copy}>
              {copied ? "✓" : "Salin"}
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-fg-subtle">
            Semua sesi pengguna akan diakhiri setelah reset.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg">
          <Switch checked={mustChange} onChange={setMustChange} />
          Wajib ganti sandi saat login berikutnya
        </label>
      </div>
    </Modal>
  );
}
