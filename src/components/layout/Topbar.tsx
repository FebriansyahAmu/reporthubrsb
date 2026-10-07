"use client";

import { Menu } from "lucide-react";
import { UserMenu, type MenuUser } from "./UserMenu";
import { ModuleSwitcher } from "./ModuleSwitcher";
import { AdminMenu } from "./AdminMenu";
import { NotificationBell } from "./NotificationBell";

export type TopbarUser = MenuUser;

export function Topbar({
  onMenu,
  user,
  allowedModules,
  unduhDesktop,
}: {
  onMenu: () => void;
  user: TopbarUser | null;
  allowedModules: string[];
  /** Server punya rilis aplikasi desktop yang bisa diunduh. */
  unduhDesktop: boolean;
}) {
  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-surface/80 px-4 backdrop-blur-md sm:gap-3 sm:px-6">
      <button
        onClick={onMenu}
        className="text-fg-muted hover:text-fg lg:hidden"
        aria-label="Buka menu"
      >
        <Menu className="size-5" />
      </button>

      <ModuleSwitcher allowedModules={allowedModules} />

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {user && <NotificationBell />}
        <AdminMenu allowedModules={allowedModules} />
        <div className="hidden h-6 w-px bg-border sm:block" />
        <UserMenu user={user} unduhDesktop={unduhDesktop} />
      </div>
    </header>
  );
}
