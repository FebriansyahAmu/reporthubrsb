import { requireModule } from "@/server/rbac/guard";

/**
 * Guard subtree Berkas Klaim RM. Sengaja di `rm/` (bukan di `berkas-klaim/`) —
 * halaman lain di workspace ini (Verifikasi Klaim, Tindak Lanjut) memakai modul
 * RBAC-nya sendiri dan tidak boleh ikut mensyaratkan modul `berkas-klaim`.
 */
export default async function BerkasKlaimRmLayout({ children }: { children: React.ReactNode }) {
  await requireModule("berkas-klaim");
  return <>{children}</>;
}
