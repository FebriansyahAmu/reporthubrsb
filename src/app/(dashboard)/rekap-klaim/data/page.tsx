import { ComingSoon } from "@/features/rekap-klaim/ComingSoon";
import { requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Data Klaim · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function DataKlaimPage() {
  await requireModule("rekap-klaim.data");
  return (
    <ComingSoon
      title="Data Klaim"
      description="Entri & kelola klaim INA-CBG's dan rujukan ambulans beserta potongan/adjustment."
      sesi="Sesi 2 (CRUD Klaim) & Sesi 3 (Potongan)"
    />
  );
}
