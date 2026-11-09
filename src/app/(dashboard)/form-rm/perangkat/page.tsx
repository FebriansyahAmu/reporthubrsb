import { FadeIn } from "@/components/motion/Motion";
import { MODUL_PERANGKAT_TTD } from "@/features/form-rm/kategori";
import { PerangkatTtdView } from "@/features/form-rm/ttd-siaga/PerangkatTtdView";
import { hasModule, requireModule } from "@/server/rbac/guard";
import { daftarPerangkat, opsiRuanganPerangkat } from "@/server/modules/ttd-siaga/perangkat.service";

export const metadata = { title: "Perangkat TTD · Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/**
 * Pengelola perangkat TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md §5.1, §5.7) —
 * `form-rm.perangkat`. Halaman ini tidak membuka formulir/isian apa pun.
 */
export default async function PerangkatTtdPage() {
  const user = await requireModule(MODUL_PERANGKAT_TTD);
  const [buat, ubah, cabut, items, ruangan] = await Promise.all([
    hasModule(user, MODUL_PERANGKAT_TTD, "create"),
    hasModule(user, MODUL_PERANGKAT_TTD, "update"),
    hasModule(user, MODUL_PERANGKAT_TTD, "delete"),
    daftarPerangkat(),
    opsiRuanganPerangkat(),
  ]);

  return (
    <FadeIn className="space-y-6">
      <PerangkatTtdView awal={items} ruangan={ruangan} izin={{ buat, ubah, cabut }} />
    </FadeIn>
  );
}
