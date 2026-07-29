import type { Metadata } from "next";
import { BarChart3, FileText, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/features/auth/LoginForm";

export const metadata: Metadata = { title: "Masuk · ReportHub RSB" };

function safePath(v: string | undefined): string {
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/kunjungan";
  return v;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const target = safePath(callbackUrl);

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Panel brand (desktop) */}
      <section className="relative hidden overflow-hidden bg-linear-to-br from-[#47403d] via-[#1a1919] to-[#111111] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Ornamen halus */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-[#e07b5b]/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-black/10 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <BarChart3 className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">ReportHub RSB</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Pusat pelaporan &amp; cetak rumah sakit
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            Melengkapi cetakan yang tidak disediakan SIMGOS — resume medis, resume
            pulang, dan laporan kunjungan — dalam satu tempat yang rapi dan aman.
          </p>

          <ul className="mt-8 space-y-3 text-sm">
            <Feature icon={<FileText className="size-4" />} text="Cetak resume medis & pulang siap pakai" />
            <Feature icon={<BarChart3 className="size-4" />} text="Rekap kunjungan per minggu & ruangan" />
            <Feature icon={<ShieldCheck className="size-4" />} text="Akses read-only ke SIMGOS — data pasien aman" />
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          © {new Date().getFullYear()} ReportHub RSB
        </p>
      </section>

      {/* Panel form */}
      <section className="flex items-center justify-center bg-bg px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo (mobile) */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand text-brand-fg">
              <BarChart3 className="size-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-fg">
              ReportHub RSB
            </span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-fg">
              Selamat datang kembali
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              Masuk untuk melanjutkan ke dasbor.
            </p>
          </div>

          <LoginForm callbackUrl={target} />

          <p className="mt-8 text-center text-xs text-fg-subtle">
            Hubungi administrator bila lupa kata sandi atau butuh akun.
          </p>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
        {icon}
      </span>
      <span className="text-white/90">{text}</span>
    </li>
  );
}
