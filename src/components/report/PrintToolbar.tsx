"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Toolbar cetak generik (disembunyikan saat print). */
export function PrintToolbar({
  title,
  subtitle,
  backHref,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
}) {
  const router = useRouter();
  return (
    <div className="no-print sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="size-4" />}
          onClick={() => (backHref ? router.push(backHref) : router.back())}
        >
          Kembali
        </Button>
        <p className="hidden truncate text-xs text-fg-muted sm:block">
          {title}
          {subtitle && <span className="font-mono"> · {subtitle}</span>}
        </p>
        <Button
          variant="primary"
          size="sm"
          icon={<Printer className="size-4" />}
          onClick={() => window.print()}
        >
          Cetak / Simpan PDF
        </Button>
      </div>
    </div>
  );
}
