import { FadeIn } from "@/components/motion/Motion";
import { BckhProfilView } from "@/features/bckh/BckhProfilView";
import { tabDari } from "@/features/bckh/tab";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = {
  title: "BCKH — Catatan Kegiatan Harian · AuditTrail RS BOLTIM",
};
export const dynamic = "force-dynamic";

/** Profil BCKH sendiri (ala profil GitHub). Butuh `bckh:view`; isi/ubah `bckh:update`; unduh `bckh:print`. */
export default async function BckhPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("bckh");
  const [sp, ubah, cetak, atur] = await Promise.all([
    searchParams,
    hasModule(user, "bckh", "update"),
    hasModule(user, "bckh", "print"),
    hasModule(user, "bckh.pengaturan", "update"),
  ]);
  return (
    <FadeIn>
      <BckhProfilView targetId={null} hak={{ ubah, cetak, atur }} tabAwal={tabDari(sp.tab)} />
    </FadeIn>
  );
}
