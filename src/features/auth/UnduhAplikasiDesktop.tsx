"use client";

import { AppWindow, Download } from "lucide-react";
import { useTawarkanUnduhDesktop } from "@/lib/desktop";

/**
 * Tawaran installer aplikasi desktop di halaman masuk: hanya bila server punya
 * rilis, browser di Windows, dan halaman TIDAK sedang dibuka di dalam aplikasi
 * desktop itu sendiri (ditentukan setelah hidrasi — server merender kosong).
 * Installer disajikan `/api/desktop/unduh/terbaru` (publik, dari manifest rilis).
 */
export function UnduhAplikasiDesktop({ versi }: { versi: string | null }) {
  const tawarkan = useTawarkanUnduhDesktop(versi !== null);
  if (!tawarkan || !versi) return null;
  return (
    <a
      href="/api/desktop/unduh/terbaru"
      download
      className="group mt-6 flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-3 transition-colors hover:border-brand/40 hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-fg">
        <AppWindow className="size-4.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">Unduh aplikasi desktop</span>
        <span className="block text-xs text-fg-muted">Versi {versi} · Windows 10/11 64-bit</span>
      </span>
      <Download className="size-4 shrink-0 text-fg-subtle transition-colors group-hover:text-brand" aria-hidden />
    </a>
  );
}
