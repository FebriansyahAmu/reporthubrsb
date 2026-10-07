import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { requireAnyModule } from "@/server/rbac/guard";

/** Gerbang Form RM: modul semua kategori ATAU salah satu modul kategori. */
export default async function FormRmLayout({ children }: { children: React.ReactNode }) {
  await requireAnyModule(MODUL_AKSES_FORM_RM);
  return <>{children}</>;
}
