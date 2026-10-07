import { AppShell } from "@/components/layout/AppShell";
import { menitIdle } from "@/server/auth/idle";
import { getCurrentUser } from "@/server/auth/session";
import { adaRilisDesktop } from "@/server/modules/desktop/rilis";
import { allowedModuleKeys } from "@/server/rbac/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  // Modul yang boleh dibuka user → untuk memfilter menu (UX). Penegakan nyata
  // tetap di guard halaman/API, bukan hanya di sini.
  const [allowed, unduhDesktop] = await Promise.all([
    user ? allowedModuleKeys(user.role).then((s) => Array.from(s)) : Promise.resolve([]),
    adaRilisDesktop().catch(() => false),
  ]);
  return (
    <AppShell
      user={user ? { name: user.name, username: user.username, role: user.role } : null}
      allowedModules={allowed}
      menitIdle={menitIdle()}
      unduhDesktop={unduhDesktop}
    >
      {children}
    </AppShell>
  );
}
