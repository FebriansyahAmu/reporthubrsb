import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { getCurrentUser } from "@/server/auth/session";
import { hasModule } from "@/server/rbac/guard";
import { MasterTabs, type MasterTab } from "@/features/master/MasterTabs";

export const dynamic = "force-dynamic";

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [canPengguna, canPeran, canRuangan] = await Promise.all([
    hasModule(user, "master.pengguna"),
    hasModule(user, "master.peran"),
    hasModule(user, "master.ruangan"),
  ]);
  if (!canPengguna && !canPeran && !canRuangan) redirect("/403");

  const tabs: MasterTab[] = [
    canPengguna && { href: "/master/pengguna", label: "Pengguna" },
    canPeran && { href: "/master/peran", label: "Peran & Hak Akses" },
    canRuangan && { href: "/master/ruangan", label: "Mapping Ruangan" },
  ].filter(Boolean) as MasterTab[];

  return (
    <div className="space-y-5">
      <PageHeader title="Master" description="Kelola pengguna, peran, hak akses, dan mapping ruangan." />
      <MasterTabs tabs={tabs} />
      {children}
    </div>
  );
}
