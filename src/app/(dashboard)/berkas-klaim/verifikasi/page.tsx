import { Database, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Card } from "@/components/ui/Card";
import { TAHAPAN, TahapanVerifikasi } from "@/features/verifikasi-klaim/TahapanVerifikasi";
import { MODUL_ANTREAN } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { hasModule, requireAnyModule } from "@/server/rbac/guard";

export const metadata = { title: "Verifikasi Klaim · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/**
 * Verifikasi Klaim BPJS — KERANGKA (Stage V0). Antrean kerja, ruang kerja berkas
 * & keputusan per tahap dibangun di Stage V1–V3 (docs/PRD_Verifikasi_Klaim_BPJS.md).
 * Fondasi data & API antrean sudah aktif: GET /api/berkas-klaim/verifikasi.
 */
export default async function VerifikasiKlaimPage() {
  const user = await requireAnyModule(MODUL_ANTREAN);
  const tahap = await Promise.all(TAHAPAN.map(async (t) => ({ ...t, akses: await hasModule(user, t.key, "view") })));

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Verifikasi Klaim BPJS"
        description="Antrean kerja verifikasi berkas klaim per episode: kelengkapan berkas RM → koding oleh coder → paket klaim final siap cetak."
      />

      <TahapanVerifikasi tahap={tahap} />

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-fg-muted">
          <Database className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-2 text-sm">
          <p className="font-semibold text-fg">Antrean kerja sedang disiapkan</p>
          <p className="text-fg-muted">
            Fondasi sudah aktif: episode BPJS final per tanggal pulang, penggabungan IGD → Rawat Inap, dan 11 pemeriksaan
            kelengkapan otomatis. Tampilan antrean, ruang kerja berkas, dan tombol keputusan menyusul di tahap berikutnya.
          </p>
          <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <ShieldCheck className="size-3.5" aria-hidden />
            Data SIMRS hanya dibaca. Keputusan & koreksi disimpan di aplikasi ini.
          </p>
        </div>
      </Card>
    </FadeIn>
  );
}
