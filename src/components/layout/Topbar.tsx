"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/cn";

export type TopbarUser = { name: string; username: string; role?: string };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Topbar({
  onMenu,
  user,
}: {
  onMenu: () => void;
  user: TopbarUser | null;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Abaikan; tetap arahkan ke login.
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onMenu}
        className="text-fg-muted hover:text-fg lg:hidden"
        aria-label="Buka menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <div className="hidden h-6 w-px bg-border sm:block" />
        <div className="flex items-center gap-2.5">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium text-fg">{user?.name ?? "Pengguna"}</p>
            <p className="text-[11px] text-fg-muted">
              {user?.username ? `@${user.username}` : "—"}
            </p>
          </div>
          <div className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-soft-fg">
            {user ? initials(user.name) : "?"}
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className={cn(
              "flex size-9 items-center justify-center rounded-full text-fg-muted transition-colors",
              "hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-50",
            )}
            aria-label="Keluar"
            title="Keluar"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
