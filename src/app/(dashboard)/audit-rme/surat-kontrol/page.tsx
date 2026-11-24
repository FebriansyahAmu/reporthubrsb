import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { SuratKontrolHalaman, type TampilanSuratKontrol } from "@/features/surat-kontrol/SuratKontrolHalaman";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Audit Surat Kontrol · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function AuditSuratKontrolPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("audit-rme.surat-kontrol");
  const bolehEkspor = await hasModule(user, "audit-rme.surat-kontrol", "print");
  const awal: TampilanSuratKontrol = (await searchParams).tampilan === "bpjs" ? "bpjs" : "pulang";

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Audit Surat Kontrol"
        description="Surat Kontrol pasien BPJS wajib terbit di hari pasien pulang (rawat inap & rawat jalan), serta kesesuaian surat BPJS dengan jadwal SIMRS — read-only."
      />
      <SuratKontrolHalaman awal={awal} bolehEkspor={bolehEkspor} />
    </FadeIn>
  );
}
