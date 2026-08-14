import { requireModule, hasModule } from "@/server/rbac/guard";
import { MODULES } from "@/server/rbac/modules";
import { PeranView } from "@/features/master/PeranView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Peran & Hak Akses · Master · ReportHub RSB" };

export default async function PeranPage() {
  const user = await requireModule("master.peran");
  const [canCreate, canUpdate, canDelete] = await Promise.all([
    hasModule(user, "master.peran", "create"),
    hasModule(user, "master.peran", "update"),
    hasModule(user, "master.peran", "delete"),
  ]);

  const modules = MODULES.map((m) => ({
    key: m.key,
    group: m.group,
    label: m.label,
    actions: [...m.actions],
  }));

  return (
    <PeranView
      modules={modules}
      perms={{ create: canCreate, update: canUpdate, delete: canDelete }}
    />
  );
}
