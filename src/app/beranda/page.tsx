import { redirect } from "next/navigation";
import { halamanAwal } from "@/components/layout/workspaces";
import { JALUR_BERANDA } from "@/lib/jalur";
import { getCurrentUser } from "@/server/auth/session";
import { allowedModuleKeys } from "@/server/rbac/permissions";

export const dynamic = "force-dynamic";

/**
 * Beranda = tujuan bawaan setelah masuk (browser & PWA): alihkan ke modul
 * PERTAMA yang boleh dibuka peran ini (urutan menu). Peran tanpa izin Dasbor
 * tidak lagi mendarat di "Akses ditolak". Tanpa modul sama sekali → /403
 * (halaman itu menjelaskan bahwa peran belum diberi akses).
 */
export default async function BerandaPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/?callbackUrl=${encodeURIComponent(JALUR_BERANDA)}`);
  redirect(halamanAwal(await allowedModuleKeys(user.role)) ?? "/403");
}
