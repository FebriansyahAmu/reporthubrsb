import { MODUL_AKSES_FORM_RM, MODUL_PERANGKAT_TTD } from "@/features/form-rm/kategori";
import { TtdSayaProvider } from "@/features/form-rm/isian/TtdSayaProvider";
import { canAny, requireAnyModule } from "@/server/rbac/guard";

/**
 * Gerbang ruang kerja Form RM: modul semua kategori, salah satu modul kategori,
 * ATAU pengelola perangkat TTD. Gerbang ini hanya lapis pertama — SETIAP halaman
 * di bawahnya menjaga dirinya sendiri (formulir/isian: `MODUL_AKSES_FORM_RM`;
 * Perangkat TTD: `MODUL_PERANGKAT_TTD`), sehingga pengelola perangkat tetap
 * tidak bisa membuka formulir.
 */
const GERBANG = [...MODUL_AKSES_FORM_RM, MODUL_PERANGKAT_TTD];

export default async function FormRmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAnyModule(GERBANG);
  // "Tanda tangan saya" hanya untuk pengguna yang boleh membuka formulir.
  const aksesForm = await canAny(user.role, MODUL_AKSES_FORM_RM, "view");
  return aksesForm ? <TtdSayaProvider>{children}</TtdSayaProvider> : <>{children}</>;
}
