"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { PopoverPanel } from "@/components/ui/Popover";
import { apiGet, apiPost } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatRelatif } from "@/lib/format";
import { BATAS_NOTIFIKASI } from "@/server/modules/notifikasi/notifikasi.constants";
import type { NotifikasiDaftar, NotifikasiItem } from "@/server/modules/notifikasi/notifikasi.types";

/**
 * Lonceng notifikasi dalam aplikasi (PRD Verifikasi Klaim §6.1). Jumlah belum
 * dibaca diperbarui tiap menit HANYA saat tab terlihat; daftar dimuat saat
 * dibuka. Klik notifikasi = tandai dibaca + buka tautannya.
 */
export function NotificationBell() {
  const router = useRouter();
  const [tombol, setTombol] = useState<HTMLButtonElement | null>(null);
  const [buka, setBuka] = useState(false);
  const [data, setData] = useState<NotifikasiDaftar | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const muat = useCallback(async (limit: number) => {
    try {
      const d = await apiGet<NotifikasiDaftar>(`/api/notifikasi?limit=${limit}`);
      setData(d);
      setNow(Date.now());
    } catch {
      // Diam: lonceng tak boleh mengganggu halaman bila API sesaat gagal.
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void muat(BATAS_NOTIFIKASI.DAFTAR_DEFAULT);
    };
    tick();
    const id = setInterval(tick, BATAS_NOTIFIKASI.POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [muat]);

  async function toggle() {
    const next = !buka;
    setBuka(next);
    if (next) {
      setMemuat(true);
      await muat(BATAS_NOTIFIKASI.DAFTAR_DEFAULT);
      setMemuat(false);
    }
  }

  async function tandai(body: { ids: string[] } | { semua: true }) {
    try {
      await apiPost("/api/notifikasi/baca", body);
      await muat(BATAS_NOTIFIKASI.DAFTAR_DEFAULT);
    } catch {
      /* status baca tak kritis */
    }
  }

  function bukaItem(n: NotifikasiItem) {
    setBuka(false);
    if (!n.dibaca) void tandai({ ids: [n.id] });
    if (n.tautan?.startsWith("/")) router.push(n.tautan);
  }

  const belum = data?.belumDibaca ?? 0;
  return (
    <>
      <button
        ref={setTombol}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={buka}
        aria-label={belum ? `Notifikasi, ${belum} belum dibaca` : "Notifikasi"}
        className="relative flex size-9 items-center justify-center rounded-[var(--radius-md)] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <Bell className="size-5" aria-hidden />
        {belum > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-surface tabular">
            {belum > 9 ? "9+" : belum}
          </span>
        )}
      </button>
      <PopoverPanel
        anchor={tombol}
        open={buka}
        onClose={() => setBuka(false)}
        align="end"
        matchWidth={false}
        className="w-[min(22rem,calc(100vw-1rem))] p-0"
      >
        <div role="dialog" aria-label="Notifikasi">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold text-fg">Notifikasi</p>
            {belum > 0 && (
              <button
                type="button"
                onClick={() => tandai({ semua: true })}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Tandai semua dibaca
              </button>
            )}
          </div>
          {memuat && !data ? (
            <p className="px-3 py-6 text-center text-sm text-fg-subtle">Memuat…</p>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-sm text-fg-muted">
              <Inbox className="size-6 text-fg-subtle" aria-hidden />
              Belum ada notifikasi.
            </div>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
              {data.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => bukaItem(n)}
                    className={cn(
                      "flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none",
                      !n.dibaca && "bg-brand-soft/30",
                    )}
                  >
                    <span
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.dibaca ? "bg-transparent" : "bg-brand")}
                      aria-label={n.dibaca ? undefined : "Belum dibaca"}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", n.dibaca ? "text-fg-muted" : "font-medium text-fg")}>{n.judul}</span>
                      {n.pesan && <span className="mt-0.5 block text-xs text-fg-muted line-clamp-2">{n.pesan}</span>}
                      <span className="mt-0.5 block text-[11px] text-fg-subtle">{formatRelatif(n.createdAt, now)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverPanel>
    </>
  );
}
