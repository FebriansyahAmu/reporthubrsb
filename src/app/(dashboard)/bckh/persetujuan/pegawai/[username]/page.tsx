import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { FadeIn } from "@/components/motion/Motion";
import { BckhProfilView } from "@/features/bckh/BckhProfilView";
import { tabDari } from "@/features/bckh/tab";
import { penggunaDariUsername } from "@/server/modules/bckh/bckh.akses";
import { adalahBawahan } from "@/server/modules/bckh/bckh.relasi";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = {
  title: "Profil BCKH Pegawai · AuditTrail RS BOLTIM",
};
export const dynamic = "force-dynamic";

/**
 * Profil BCKH bawahan — hanya-lihat (`bckh.persetujuan:view` + target bawahan
 * penampil, PRD §15.3). Bukan bawahan → 404 (tak membocorkan keberadaan akun).
 */
export default async function BckhBawahanPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("bckh.persetujuan");
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const target = await penggunaDariUsername(decodeURIComponent(username).slice(0, 191));
  if (!target) notFound();
  if (target.id === user.id) redirect("/bckh");
  if (!(await adalahBawahan(user.id, target.id))) notFound();
  const [cetak, atur] = await Promise.all([hasModule(user, "bckh.persetujuan", "print"), hasModule(user, "bckh.pengaturan", "update")]);

  return (
    <FadeIn className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/bckh/persetujuan?tab=pegawai" className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden />
          Kembali ke Pegawai saya
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-fg-muted">
          <Eye className="size-3.5" aria-hidden />
          Hanya-lihat
        </span>
      </div>
      <BckhProfilView targetId={target.id} hak={{ ubah: false, cetak, atur }} tabAwal={tabDari(sp.tab)} />
    </FadeIn>
  );
}
