"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Copy, LogOut, UserCog, UserPlus, Wand2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { AGAMA_VALUES, generatePassword } from "@/features/master/master.constants";
import {
  ApiError,
  createUser,
  fetchUserDetail,
  revokeUserSessions,
  updateUser,
  type RoleOption,
} from "@/features/master/master.client";

type FormState = {
  username: string;
  roleKey: string;
  password: string;
  mustChangePassword: boolean;
  isActive: boolean;
  nik: string;
  nip: string;
  gelarDepan: string;
  name: string;
  gelarBelakang: string;
  tanggalLahir: string;
  agama: string;
  phone: string;
};

const EMPTY: FormState = {
  username: "",
  roleKey: "",
  password: "",
  mustChangePassword: true,
  isActive: true,
  nik: "",
  nip: "",
  gelarDepan: "",
  name: "",
  gelarBelakang: "",
  tanggalLahir: "",
  agama: "",
  phone: "",
};

const todayYmd = () => new Date().toISOString().slice(0, 10);

export function UserFormModal({
  open,
  mode,
  userId,
  roleOptions,
  canUpdate,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  userId?: string;
  roleOptions: RoleOption[];
  canUpdate: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  // Modal di-mount saat dibuka → inisialisasi lewat initializer (bukan effect).
  const [form, setForm] = useState<FormState>(() =>
    mode === "create" ? { ...EMPTY, password: generatePassword() } : EMPTY,
  );
  const [loading, setLoading] = useState(mode === "edit" && !!userId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Edit: ambil detail (async). setState hanya di callback async → aman dari
  // aturan set-state-in-effect.
  useEffect(() => {
    if (mode !== "edit" || !userId) return;
    fetchUserDetail(userId)
      .then((d) =>
        setForm({
          username: d.username,
          roleKey: d.roleKey,
          password: "",
          mustChangePassword: d.mustChangePassword,
          isActive: d.isActive,
          nik: d.nik,
          nip: d.nip,
          gelarDepan: d.gelarDepan,
          name: d.name,
          gelarBelakang: d.gelarBelakang,
          tanggalLahir: d.tanggalLahir,
          agama: d.agama,
          phone: d.phone,
        }),
      )
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat data."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clientValidate(): string | null {
    if (mode === "create" && !/^[a-z0-9._-]{3,30}$/.test(form.username.trim().toLowerCase()))
      return "Username 3–30 karakter (huruf kecil, angka, titik, garis bawah, strip).";
    if (!form.roleKey) return "Peran wajib dipilih.";
    if (form.name.trim().length < 2) return "Nama lengkap wajib diisi.";
    if (mode === "create" && form.password.length < 8) return "Sandi minimal 8 karakter.";
    if (form.nik.trim() && !/^\d{16}$/.test(form.nik.trim())) return "NIK harus 16 digit.";
    return null;
  }

  async function submit() {
    const v = clientValidate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const profile = {
        roleKey: form.roleKey,
        isActive: form.isActive,
        mustChangePassword: form.mustChangePassword,
        nik: form.nik.trim(),
        nip: form.nip.trim(),
        gelarDepan: form.gelarDepan.trim(),
        name: form.name.trim(),
        gelarBelakang: form.gelarBelakang.trim(),
        tanggalLahir: form.tanggalLahir,
        agama: form.agama,
        phone: form.phone.trim(),
      };
      if (mode === "create") {
        await createUser({ ...profile, username: form.username.trim().toLowerCase(), password: form.password });
        onSaved(`Akun "${form.username.trim().toLowerCase()}" berhasil dibuat.`);
      } else if (userId) {
        await updateUser(userId, profile);
        onSaved("Perubahan akun tersimpan.");
      }
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menyimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(form.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* abaikan */
    }
  }

  async function doRevoke() {
    if (!userId) return;
    setSaving(true);
    try {
      await revokeUserSessions(userId);
      onSaved("Semua sesi pengguna diakhiri.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal mengakhiri sesi.");
    } finally {
      setSaving(false);
    }
  }

  const roleSelectOptions = roleOptions.map((r) => ({ value: r.key, label: r.name }));
  const agamaOptions = AGAMA_VALUES.map((a) => ({ value: a, label: a }));
  const isEdit = mode === "edit";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      dismissible={!saving}
      icon={
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand-soft-fg">
          {isEdit ? <UserCog className="size-4.5" /> : <UserPlus className="size-4.5" />}
        </div>
      }
      title={isEdit ? "Edit Akun" : "Tambah Akun"}
      description={isEdit ? form.username : "Buat akun pengguna baru & tetapkan perannya."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={submit} loading={saving} disabled={loading}>
            {isEdit ? "Simpan Perubahan" : "Buat Akun"}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-fg-muted">Memuat…</div>
      ) : (
        <div className="space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ---- Akun ---- */}
          <section className="space-y-3">
            <SubHead>Akun</SubHead>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Fld label="Username" required>
                <Input
                  value={form.username}
                  disabled={isEdit}
                  placeholder="mis. budi.santoso"
                  autoComplete="off"
                  onChange={(e) => set("username", e.target.value)}
                />
                {isEdit && <Hint>Username tidak dapat diubah.</Hint>}
              </Fld>
              <Fld label="Peran" required>
                <Select
                  value={form.roleKey}
                  onChange={(v) => set("roleKey", v)}
                  options={roleSelectOptions}
                  placeholder="Pilih peran…"
                />
              </Fld>
            </div>

            {!isEdit && (
              <Fld label="Sandi awal" required>
                <div className="flex gap-2">
                  <Input
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    className="font-mono"
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    icon={<Wand2 className="size-4" />}
                    onClick={() => set("password", generatePassword())}
                  >
                    Buat
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    icon={<Copy className="size-4" />}
                    onClick={copyPassword}
                  >
                    {copied ? "Tersalin" : "Salin"}
                  </Button>
                </div>
                <Hint>Bagikan sandi ini ke pengguna. Ia akan diminta menggantinya saat login pertama.</Hint>
              </Fld>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <ToggleRow
                label="Wajib ganti sandi saat login"
                checked={form.mustChangePassword}
                onChange={(v) => set("mustChangePassword", v)}
              />
              <ToggleRow
                label="Akun aktif"
                checked={form.isActive}
                onChange={(v) => set("isActive", v)}
                tone="success"
              />
            </div>

            {isEdit && canUpdate && (
              <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/40 px-3 py-2.5">
                <p className="mr-auto text-xs text-fg-muted">
                  Keluarkan pengguna dari semua perangkat (mis. setelah ganti peran).
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<LogOut className="size-3.5" />}
                  onClick={doRevoke}
                  disabled={saving}
                >
                  Akhiri semua sesi
                </Button>
              </div>
            )}
          </section>

          {/* ---- Data Diri ---- */}
          <section className="space-y-3">
            <SubHead>Data Diri</SubHead>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Fld label="NIK">
                <Input
                  value={form.nik}
                  inputMode="numeric"
                  maxLength={16}
                  placeholder="16 digit (opsional)"
                  onChange={(e) => set("nik", e.target.value.replace(/\D/g, ""))}
                />
              </Fld>
              <Fld label="NIP">
                <Input value={form.nip} placeholder="Nomor induk pegawai" onChange={(e) => set("nip", e.target.value)} />
              </Fld>
              <Fld label="Gelar depan">
                <Input value={form.gelarDepan} placeholder="mis. dr., Ns." onChange={(e) => set("gelarDepan", e.target.value)} />
              </Fld>
              <Fld label="Gelar belakang">
                <Input value={form.gelarBelakang} placeholder="mis. S.Kep., Sp.PD" onChange={(e) => set("gelarBelakang", e.target.value)} />
              </Fld>
            </div>
            <Fld label="Nama lengkap" required>
              <Input value={form.name} placeholder="Tanpa gelar" onChange={(e) => set("name", e.target.value)} />
            </Fld>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Fld label="Tanggal lahir">
                <DatePicker value={form.tanggalLahir} onChange={(v) => set("tanggalLahir", v)} max={todayYmd()} />
              </Fld>
              <Fld label="Agama">
                <Select value={form.agama} onChange={(v) => set("agama", v)} options={agamaOptions} placeholder="Pilih agama…" />
              </Fld>
            </div>
            <Fld label="No. HP / WA">
              <Input value={form.phone} inputMode="tel" placeholder="mis. 0812xxxxxxx" onChange={(e) => set("phone", e.target.value)} />
            </Fld>
          </section>
        </div>
      )}
    </Modal>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{children}</h3>
  );
}

function Fld({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] text-fg-subtle">{children}</p>;
}

function ToggleRow({
  label,
  checked,
  onChange,
  tone,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tone?: "brand" | "success";
}) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 text-sm text-fg")}>
      <Switch checked={checked} onChange={onChange} tone={tone} />
      {label}
    </label>
  );
}
