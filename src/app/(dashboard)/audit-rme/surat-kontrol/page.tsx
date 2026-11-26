import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { SuratKontrolHalaman, type TampilanSuratKontrol } from "@/features/surat-kontrol/SuratKontrolHalaman";
import { hasModule, requireModule } from "@/server/rbac/guard";

/** Nilai `?tampilan=` yang dikenal (didefinisikan di sini: nilai dari modul "use client" tak boleh dipakai di server). */
const TAMPILAN: readonly TampilanSuratKontrol[] = ["pulang", "sep", "bpjs"];

export const metadata = { title: "Audit Surat Kontrol · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function AuditSuratKontrolPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("audit-rme.surat-kontrol");
  const bolehEkspor = await hasModule(user, "audit-rme.surat-kontrol", "print");
  const diminta = (await searchParams).tampilan;
  const awal: TampilanSuratKontrol = TAMPILAN.find((t) => t === diminta) ?? "pulang";

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Audit Surat Kontrol"
        description="Surat Kontrol pasien BPJS wajib terbit di hari pasien pulang (rawat inap & rawat jalan), surat yang baru dibuat bersamaan dengan SEP, serta kesesuaian surat BPJS dengan jadwal SIMRS — read-only."
      />
      <SuratKontrolHalaman awal={awal} bolehEkspor={bolehEkspor} />
    </FadeIn>
  );
}
