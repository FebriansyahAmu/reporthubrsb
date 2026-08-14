import { requireModule, hasModule } from "@/server/rbac/guard";
import { listRoles } from "@/server/modules/master/master.service";
import { PenggunaView } from "@/features/master/PenggunaView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pengguna · Master · ReportHub RSB" };

export default async function PenggunaPage() {
  const user = await requireModule("master.pengguna");
  const [roles, canCreate, canUpdate, canDelete] = await Promise.all([
    listRoles(),
    hasModule(user, "master.pengguna", "create"),
    hasModule(user, "master.pengguna", "update"),
    hasModule(user, "master.pengguna", "delete"),
  ]);

  return (
    <PenggunaView
      roleOptions={roles.map((r) => ({ key: r.key, name: r.name }))}
      perms={{ create: canCreate, update: canUpdate, delete: canDelete }}
      currentUserId={user.id}
    />
  );
}
