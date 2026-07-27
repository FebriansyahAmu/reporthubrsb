import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/server/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <AppShell user={user ? { name: user.name, username: user.username, role: user.role } : null}>
      {children}
    </AppShell>
  );
}
