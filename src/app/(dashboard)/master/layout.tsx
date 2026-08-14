import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { getCurrentUser } from "@/server/auth/session";
import { hasModule } from "@/server/rbac/guard";
import { MasterTabs, type MasterTab } from "@/features/master/MasterTabs";

export const dynamic = "force-dynamic";

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [canPengguna, canPeran] = await Promise.all([
    hasModule(user, "master.pengguna"),
    hasModule(user, "master.peran"),
  ]);
  if (!canPengguna && !canPeran) redirect("/403");

  const tabs: MasterTab[] = [
    canPengguna && { href: "/master/pengguna", label: "Pengguna" },
    canPeran && { href: "/master/peran", label: "Peran & Hak Akses" },
  ].filter(Boolean) as MasterTab[];

  return (
    <div className="space-y-5">
      <PageHeader title="Master" description="Kelola pengguna, peran, dan hak akses aplikasi." />
      <MasterTabs tabs={tabs} />
      {children}
    </div>
  );
}
