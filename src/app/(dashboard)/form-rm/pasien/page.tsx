import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { FormRmListView, type RuanganJenis } from "@/features/form-rm/FormRmListView";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { JENIS_KUNJUNGAN, LABEL_JENIS_KUNJUNGAN } from "@/features/form-rm/registry";
import { requireAnyModule } from "@/server/rbac/guard";
import { JENIS_KUNJUNGAN_KATEGORI } from "@/server/modules/kunjungan/kunjungan.types";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";
import { formBoleh, hakFormRm } from "@/server/modules/form-rm/form-rm.akses";
import { jenisSasaran } from "@/server/modules/form-rm/form-rm.pasien";

export const metadata = { title: "Form RM per Pasien · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/** Alur pasien lebih dulu (PRD §6.2): daftar episode sasaran + kelengkapan form wajib. */
export default async function DaftarPasienFormRmPage() {
  const user = await requireAnyModule(MODUL_AKSES_FORM_RM);
  const jenis = jenisSasaran(formBoleh(await hakFormRm(user)));
  const jenisDariKategori = new Map(JENIS_KUNJUNGAN.map((j) => [JENIS_KUNJUNGAN_KATEGORI[j], j]));
  const ruangan: RuanganJenis[] = await getRuanganKunjunganList()
    .catch(() => [])
    .then((rs) =>
      rs.flatMap((r) => {
        const j = jenisDariKategori.get(r.kategori);
        return j && jenis.includes(j) ? [{ id: r.id, nama: r.nama, jenis: j }] : [];
      }),
    );

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Form RM per Pasien"
        description={`Pasien ${jenis.map((j) => LABEL_JENIS_KUNJUNGAN[j]).join(" & ")} — pilih pasien untuk melihat dan mengisi semua formulirnya. Lengkap = semua form wajib FINAL.`}
        action={
          <Link
            href="/form-rm"
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <LayoutGrid className="size-4" />
            Mulai dari formulir
          </Link>
        }
      />
      <FormRmListView ruanganOptions={ruangan} jenisOptions={jenis} nowIso={new Date().toISOString()} />
    </FadeIn>
  );
}
