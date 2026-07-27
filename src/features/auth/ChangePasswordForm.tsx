"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const MIN_LEN = 8;

export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_LEN;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit =
    current.length > 0 && next.length >= MIN_LEN && confirm === next && next !== current;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Gagal mengubah kata sandi.");
        setLoading(false);
        return;
      }
      setSuccess(true);
      router.refresh();
      setTimeout(onDone, 1300);
    } catch {
      setError("Tidak dapat terhubung ke server.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-7" />
        </div>
        <p className="mt-1 text-sm font-semibold text-fg">Kata sandi berhasil diperbarui</p>
        <p className="max-w-xs text-xs leading-relaxed text-fg-muted">
          Sesi di perangkat lain telah dikeluarkan demi keamanan.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/40 bg-danger-soft px-3 py-2.5 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <PasswordField
          id="current-password"
          label="Kata sandi saat ini"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          disabled={loading}
        />

        <PasswordField
          id="new-password"
          label="Kata sandi baru"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          disabled={loading}
          error={tooShort ? `Minimal ${MIN_LEN} karakter` : undefined}
          hint={`Minimal ${MIN_LEN} karakter, berbeda dari yang lama.`}
        />

        <PasswordField
          id="confirm-password"
          label="Konfirmasi kata sandi baru"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          disabled={loading}
          error={mismatch ? "Konfirmasi tidak cocok" : undefined}
        />
      </div>

      {/* Footer bar — rata dengan tepi modal, rapi */}
      <div className="-mx-5 -mb-4 mt-6 flex items-center justify-end gap-2 border-t border-border bg-surface-2/40 px-5 py-3">
        <Button type="button" variant="secondary" size="sm" onClick={onDone} disabled={loading}>
          Batal
        </Button>
        <Button type="submit" size="sm" loading={loading} disabled={!canSubmit || loading}>
          Simpan Perubahan
        </Button>
      </div>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  disabled?: boolean;
  error?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">
          <Lock className="size-4" />
        </span>
        <input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          disabled={disabled}
          className={cn(
            "h-10 w-full rounded-[var(--radius-md)] border bg-surface pl-9 pr-10 text-sm text-fg placeholder:text-fg-subtle",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-60",
            error ? "border-danger/50" : "border-border hover:border-border-strong",
          )}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          aria-label={show ? "Sembunyikan" : "Tampilkan"}
          tabIndex={-1}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
