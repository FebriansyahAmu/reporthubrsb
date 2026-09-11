import { requireModule, hasModule } from "@/server/rbac/guard";
import { getRuanganMapping } from "@/server/modules/master/ruangan/ruangan-pejabat.service";
import { RuanganMappingView } from "@/features/master/RuanganMappingView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mapping Ruangan · Master · AuditTrail RS BOLTIM" };

export default async function MappingRuanganPage() {
  const user = await requireModule("master.ruangan");
  const [canUpdate, data] = await Promise.all([
    hasModule(user, "master.ruangan", "update"),
    getRuanganMapping(),
  ]);

  return <RuanganMappingView initial={data} canUpdate={canUpdate} />;
}
