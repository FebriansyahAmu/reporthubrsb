import Link from "next/link";
import { ShieldX, ArrowLeft } from "lucide-react";
import { FadeIn } from "@/components/motion/Motion";
import { Card } from "@/components/ui/Card";
import { halamanAwal } from "@/components/layout/workspaces";
import { getCurrentUser } from "@/server/auth/session";
import { allowedModuleKeys } from "@/server/rbac/permissions";

export const metadata = { title: "Akses Ditolak · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function ForbiddenPage() {
  const user = await getCurrentUser();
  // Tautan kembali = modul pertama yang DIIZINKAN (bukan "/" → dasbor → 403 lagi).
  const tujuan = user ? halamanAwal(await allowedModuleKeys(user.role)) : null;

  return (
    <FadeIn className="mx-auto max-w-lg">
      <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
          <ShieldX className="size-7" />
        </div>
        <h1 className="text-lg font-semibold text-fg">Akses ditolak</h1>
        {tujuan ? (
          <p className="mt-1 max-w-md text-sm text-fg-muted">
            Anda tidak memiliki izin untuk membuka modul ini. Jika menurut Anda ini keliru,
            hubungi administrator untuk menyesuaikan hak akses peran Anda.
          </p>
        ) : (
          <p className="mt-1 max-w-md text-sm text-fg-muted">
            Peran Anda belum diberi akses ke modul apa pun. Hubungi administrator untuk
            mengatur hak akses peran Anda di Master › Peran &amp; Hak Akses.
          </p>
        )}
        {tujuan && (
          <Link
            href={tujuan}
            className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <ArrowLeft className="size-4" />
            Kembali ke modul Anda
          </Link>
        )}
      </Card>
    </FadeIn>
  );
}
