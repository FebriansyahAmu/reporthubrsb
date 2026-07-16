"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function PrintToolbar({ nomorKunjungan }: { nomorKunjungan: string }) {
  const router = useRouter();
  return (
    <div className="no-print sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-3">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={() => router.back()}>
          Kembali
        </Button>
        <p className="hidden text-xs text-fg-muted sm:block">
          Resume Medik · <span className="font-mono">{nomorKunjungan}</span>
        </p>
        <Button variant="primary" size="sm" icon={<Printer className="size-4" />} onClick={() => window.print()}>
          Cetak / Simpan PDF
        </Button>
      </div>
    </div>
  );
}
