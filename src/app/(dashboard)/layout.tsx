import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/server/auth/session";
import { allowedModuleKeys } from "@/server/rbac/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  // Modul yang boleh dibuka user → untuk memfilter menu (UX). Penegakan nyata
  // tetap di guard halaman/API, bukan hanya di sini.
  const allowed = user ? Array.from(await allowedModuleKeys(user.role)) : [];
  return (
    <AppShell
      user={user ? { name: user.name, username: user.username, role: user.role } : null}
      allowedModules={allowed}
    >
      {children}
    </AppShell>
  );
}
