import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { KatalogFormRm, type ItemKatalog } from "@/features/form-rm/KatalogFormRm";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { labelSasaran } from "@/features/form-rm/registry";
import { PindahDataLama } from "@/features/form-rm/isian/PindahDataLama";
import { requireAnyModule } from "@/server/rbac/guard";
import { formBoleh, hakFormRm } from "@/server/modules/form-rm/form-rm.akses";
import { hitungDraf } from "@/server/modules/form-rm/isian.cari";
import { hitungDataLamaTertunda } from "@/server/modules/form-rm/isian.lama";

export const metadata = { title: "Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/**
 * Katalog Form RM (PRD §6.1): form yang boleh dilihat, per kategori, dengan
 * hitungan draf. Registri di memori + satu kelompok query hitungan draf.
 */
export default async function KatalogFormRmPage() {
  const user = await requireAnyModule(MODUL_AKSES_FORM_RM);
  const hak = await hakFormRm(user);
  const forms = formBoleh(hak);
  const [draf, dataLama] = await Promise.all([
    hitungDraf(forms.map((d) => d.kode), user.id),
    // Hanya pengelola RM yang melihat & memicu pemindahan data lama.
    hak.kelola ? hitungDataLamaTertunda().catch(() => 0) : 0,
  ]);
  const items: ItemKatalog[] = forms.map((d) => ({
    kode: d.kode,
    kategori: d.kategori,
    sasaran: labelSasaran(d.sasaran),
    draf: draf[d.kode] ?? { saya: 0, semua: 0 },
  }));

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Form RM"
        description="Pilih formulir, lalu pilih pasien — identitas dan data SIMRS terisi otomatis. Isian FINAL terkunci dan tercatat di riwayat."
        action={
          <Link
            href="/form-rm/pasien"
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <Users className="size-4" />
            Mulai dari pasien
          </Link>
        }
      />
      {dataLama > 0 && <PindahDataLama jumlah={dataLama} />}
      <KatalogFormRm items={items} />
    </FadeIn>
  );
}
