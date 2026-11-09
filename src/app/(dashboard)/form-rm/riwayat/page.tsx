import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { RiwayatPengisianView, type OpsiFormRiwayat } from "@/features/form-rm/RiwayatPengisianView";
import { uraiFilterRiwayat } from "@/features/form-rm/riwayat";
import { TAMPILAN_FORM } from "@/features/form-rm/tampilan";
import { tanggalHariIniWita } from "@/lib/format";
import { requireAnyModule } from "@/server/rbac/guard";
import { formBoleh, hakFormRm } from "@/server/modules/form-rm/form-rm.akses";

export const metadata = { title: "Riwayat Pengisian Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/**
 * Riwayat Pengisian (PRD §16 "Katalog baru & Riwayat Pengisian"): isian form
 * yang boleh dilihat per rentang tanggal. Filter awal dari URL (longgar); data
 * dimuat klien lewat `GET /api/form-rm/riwayat` (validasi ketat).
 */
export default async function RiwayatPengisianPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, sp] = await Promise.all([requireAnyModule(MODUL_AKSES_FORM_RM), searchParams]);
  const forms = formBoleh(await hakFormRm(user));
  const opsiForm: OpsiFormRiwayat[] = forms.map((d) => ({ kode: d.kode, label: TAMPILAN_FORM[d.kode].label }));
  const hariIni = tanggalHariIniWita();
  const awal = uraiFilterRiwayat(sp, hariIni, opsiForm.map((o) => o.kode));

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Riwayat Pengisian"
        description="Isian Form RM yang sudah dibuat, dari formulir yang boleh Anda lihat. Buka isian untuk melanjutkan draf, meninjau, atau mencetak yang sudah final."
        action={
          <Link
            href="/form-rm"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm font-medium text-fg shadow-xs transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <LayoutGrid className="size-4" />
            Katalog formulir
          </Link>
        }
      />
      <RiwayatPengisianView opsiForm={opsiForm} hariIni={hariIni} awal={awal} />
    </FadeIn>
  );
}
