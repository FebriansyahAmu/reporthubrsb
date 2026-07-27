"use client";

import { Menu } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu, type MenuUser } from "./UserMenu";

export type TopbarUser = MenuUser;

export function Topbar({
  onMenu,
  user,
}: {
  onMenu: () => void;
  user: TopbarUser | null;
}) {
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
        <UserMenu user={user} />
      </div>
    </header>
  );
}
