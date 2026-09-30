import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { VerifikasiView } from "@/features/verifikasi-klaim/VerifikasiView";
import { MODUL_ANTREAN, MODUL_VERIFIKASI } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { hasModule, requireAnyModule } from "@/server/rbac/guard";

export const metadata = { title: "Verifikasi Klaim · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/**
 * Verifikasi Klaim BPJS — antrean kerja + ruang kerja berkas (Stage V1: Tahap 1
 * Kelengkapan RM). `?nopen=` membuka ruang kerja berkas itu langsung (tautan
 * notifikasi). docs/PRD_Verifikasi_Klaim_BPJS.md §6.
 */
export default async function VerifikasiKlaimPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAnyModule(MODUL_ANTREAN);
  const bolehRm = await hasModule(user, MODUL_VERIFIKASI.RM, "update");
  const { nopen } = await searchParams;
  const nopenAwal = typeof nopen === "string" && /^\d{6,20}$/.test(nopen) ? nopen : null;

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Verifikasi Klaim BPJS"
        description="Antrean kerja per episode (tanggal pulang): periksa kelengkapan berkas RM dari SIMRS, loloskan ke coder, atau kirim tindak lanjut ke DPJP / unit yang harus melengkapi."
      />
      <VerifikasiView bolehRm={bolehRm} nopenAwal={nopenAwal} />
    </FadeIn>
  );
}
