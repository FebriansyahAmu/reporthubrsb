import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { TindakLanjutView } from "@/features/verifikasi-klaim/TindakLanjutView";
import { MODUL_VERIFIKASI } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { requireAnyModule } from "@/server/rbac/guard";

export const metadata = { title: "Tindak Lanjut Berkas · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/**
 * Tindak Lanjut Berkas (PRD §6.4) — item berkas klaim & koreksi koding milik
 * DPJP / ruangan / peran pengguna; verifikator RM & coder juga bisa melihat
 * semua. Item otomatis tertutup sendiri begitu data SIMRS lengkap / sesuai.
 */
export default async function TindakLanjutBerkasPage() {
  await requireAnyModule([MODUL_VERIFIKASI.TINDAK_LANJUT, MODUL_VERIFIKASI.RM, MODUL_VERIFIKASI.KLAIM]);

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Tindak Lanjut Berkas"
        description="Item berkas klaim & koreksi koding yang perlu dilengkapi DPJP atau unit di SIMRS. Item tertutup sendiri begitu datanya sudah ada / sesuai di SIMRS."
      />
      <TindakLanjutView />
    </FadeIn>
  );
}
