import { redirect } from "next/navigation";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { JALUR_AWAL_DESKTOP } from "@/lib/desktop-jalur";
import { JALUR_BERANDA } from "@/lib/jalur";
import { getCurrentUser } from "@/server/auth/session";
import { canAny } from "@/server/rbac/guard";

export const dynamic = "force-dynamic";

/**
 * Pintu masuk aplikasi desktop (Tauri membuka `JALUR_AWAL_DESKTOP`): petugas
 * langsung ke Form RM. Peran tanpa akses Form RM ke beranda (modul pertama yang
 * diizinkan) — bukan ke /403. Belum masuk → ke halaman masuk dengan callbackUrl ini.
 */
export default async function PintuDesktopPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/?callbackUrl=${encodeURIComponent(JALUR_AWAL_DESKTOP)}`);
  redirect((await canAny(user.role, MODUL_AKSES_FORM_RM, "view")) ? "/form-rm" : JALUR_BERANDA);
}
