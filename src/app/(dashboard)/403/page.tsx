import Link from "next/link";
import { ShieldX, ArrowLeft } from "lucide-react";
import { FadeIn } from "@/components/motion/Motion";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "Akses Ditolak · ReportHub RSB" };

export default function ForbiddenPage() {
  return (
    <FadeIn className="mx-auto max-w-lg">
      <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
          <ShieldX className="size-7" />
        </div>
        <h1 className="text-lg font-semibold text-fg">Akses ditolak</h1>
        <p className="mt-1 max-w-md text-sm text-fg-muted">
          Anda tidak memiliki izin untuk membuka modul ini. Jika menurut Anda ini keliru,
          hubungi administrator untuk menyesuaikan hak akses peran Anda.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <ArrowLeft className="size-4" />
          Kembali ke beranda
        </Link>
      </Card>
    </FadeIn>
  );
}
