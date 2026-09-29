import { BellRing, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Card } from "@/components/ui/Card";
import { MODUL_VERIFIKASI } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Tindak Lanjut Berkas · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/**
 * Tindak Lanjut Berkas — KERANGKA (Stage V0). Daftar item "milik saya" (DPJP)
 * & "ruangan saya" + penutupan otomatis dibangun di Stage V1.
 */
export default async function TindakLanjutBerkasPage() {
  await requireModule(MODUL_VERIFIKASI.TINDAK_LANJUT);

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Tindak Lanjut Berkas"
        description="Item berkas klaim yang perlu dilengkapi DPJP atau unit. Item tertutup sendiri begitu datanya sudah ada di SIMRS."
      />

      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <BellRing className="size-6" aria-hidden />
        </div>
        <p className="text-sm font-semibold text-fg">Belum ada tindak lanjut</p>
        <p className="max-w-md text-sm text-fg-muted">
          Saat verifikator menandai berkas tidak lengkap, item yang menjadi tanggung jawab Anda atau ruangan Anda akan
          muncul di sini, lengkap dengan nama pasien, item yang kurang, dan catatan verifikator.
        </p>
        <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <ShieldCheck className="size-3.5" aria-hidden />
          Lengkapi datanya di SIMRS — aplikasi ini hanya membaca dan menutup item secara otomatis.
        </p>
      </Card>
    </FadeIn>
  );
}
