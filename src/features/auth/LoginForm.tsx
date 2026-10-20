"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, KeyRound, Lock, LogIn, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { diAplikasiDesktop, tujuanBawaanMasuk } from "@/lib/desktop";
import { catatSesiSegar } from "@/lib/sesi";

type KonstruktorKredensial = new (data: { id: string; password: string }) => Credential;

/**
 * Minta pengelola kata sandi browser (mis. Google Password Manager di Chrome)
 * menawarkan "Simpan kata sandi" secara eksplisit lewat Credential Management
 * API. Hanya ada di Chrome/Edge pada konteks aman (HTTPS/localhost); tanpa API
 * ini browser tetap menawarkan simpan karena form hilang setelah masuk berhasil.
 * Aplikasi desktop: WebView2 menawarkan sendiri (diaktifkan oleh aplikasi).
 * Kata sandi tidak pernah disimpan oleh halaman ini sendiri.
 */
function tawarkanSimpanKredensial(id: string, password: string): void {
  if (diAplikasiDesktop() || !window.isSecureContext) return;
  const Kredensial = (window as Window & { PasswordCredential?: KonstruktorKredensial }).PasswordCredential;
  if (!Kredensial || !navigator.credentials) return;
  try {
    void navigator.credentials.store(new Kredensial({ id, password })).catch(() => {});
  } catch {
    // Browser menolak (mis. kebijakan): cukup andalkan deteksi form bawaan.
  }
}

/**
 * Form masuk yang ramah pengelola kata sandi: `<form>` sungguhan, `name` +
 * `autocomplete="username"/"current-password"`, nilai dibaca dari form saat
 * kirim (isian otomatis browser tidak selalu memicu onChange), dan form
 * ditinggalkan hanya setelah masuk BERHASIL — browser tidak menawarkan
 * menyimpan kata sandi yang salah.
 */
export function LoginForm({ callbackUrl }: { callbackUrl: string | null }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Baca sebelum kolom dinonaktifkan (FormData melewatkan kolom disabled).
    const data = new FormData(e.currentTarget);
    const username = String(data.get("username") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!username || !password) {
      setError("Isi username dan kata sandi.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Gagal masuk. Coba lagi.");
        setLoading(false);
        return;
      }
      tawarkanSimpanKredensial(username, password);
      catatSesiSegar();
      // Cookie sesi sudah di-set server; pindah ke tujuan.
      router.replace(callbackUrl ?? tujuanBawaanMasuk());
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} method="post" className="space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/40 bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Field
        id="username"
        label="Username"
        type="text"
        icon={<User className="size-4" />}
        placeholder="username Anda"
        autoComplete="username"
        invalid={!!error}
        disabled={loading}
      />

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium text-fg">
            Kata Sandi
          </label>
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">
            <Lock className="size-4" />
          </span>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            aria-invalid={!!error}
            disabled={loading}
            className={cn(
              "h-11 w-full rounded-[var(--radius-md)] border bg-surface pl-9 pr-11 text-sm text-fg placeholder:text-fg-subtle",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-60",
              error ? "border-danger/50" : "border-border hover:border-border-strong",
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        loading={loading}
        icon={<LogIn className="size-4" />}
        className="w-full"
      >
        {loading ? "Memproses…" : "Masuk"}
      </Button>

      <p className="flex items-start gap-2 rounded-[var(--radius-md)] bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-fg-muted">
        <KeyRound className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" aria-hidden />
        <span>
          Klik kolom Username untuk memilih akun yang tersimpan. Simpan kata sandi hanya di komputer
          yang Anda percayai.
        </span>
      </p>

      <p className="text-center text-xs text-fg-subtle">
        Bisa memakai akun aplikasi atau akun SIMGOS Anda (jika sudah diberi akses oleh admin).
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  icon,
  placeholder,
  autoComplete,
  invalid,
  disabled,
}: {
  id: string;
  label: string;
  type: string;
  icon: React.ReactNode;
  placeholder?: string;
  autoComplete?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">
          {icon}
        </span>
        <input
          id={id}
          name={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={invalid}
          disabled={disabled}
          className={cn(
            "h-11 w-full rounded-[var(--radius-md)] border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-60",
            invalid ? "border-danger/50" : "border-border hover:border-border-strong",
          )}
        />
      </div>
    </div>
  );
}
