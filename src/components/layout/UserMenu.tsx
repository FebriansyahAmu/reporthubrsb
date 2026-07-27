"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ChangePasswordForm } from "@/features/auth/ChangePasswordForm";
import { cn } from "@/lib/cn";

export type MenuUser = { name: string; username: string; role?: string };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserMenu({ user }: { user: MenuUser | null }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Tutup dropdown saat klik di luar.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // abaikan; tetap arahkan ke login
    }
    router.replace("/");
    router.refresh();
  }

  const name = user?.name ?? "Pengguna";
  const username = user?.username ?? "";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-surface-2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        )}
      >
        <div className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-soft-fg">
          {user ? initials(name) : "?"}
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-xs font-medium leading-tight text-fg">{name}</p>
          <p className="text-[11px] leading-tight text-fg-muted">
            {username ? `@${username}` : "—"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "hidden size-4 text-fg-subtle transition-transform sm:block",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-[calc(100%+8px)] z-30 w-60 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-md"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-semibold text-fg">{name}</p>
              <p className="truncate text-xs text-fg-muted">
                {username ? `@${username}` : "—"}
              </p>
              {user?.role && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-soft-fg">
                  <ShieldCheck className="size-3" />
                  {user.role}
                </span>
              )}
            </div>

            <div className="p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setPwOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg transition-colors hover:bg-surface-2"
              >
                <KeyRound className="size-4 text-fg-muted" />
                Ubah Password
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
              >
                <LogOut className="size-4" />
                {loggingOut ? "Keluar…" : "Keluar"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Ubah Password"
        description="Perbarui kata sandi akun Anda."
        icon={
          <div className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-brand-soft-fg">
            <KeyRound className="size-4" />
          </div>
        }
      >
        <ChangePasswordForm onDone={() => setPwOpen(false)} />
      </Modal>
    </div>
  );
}
