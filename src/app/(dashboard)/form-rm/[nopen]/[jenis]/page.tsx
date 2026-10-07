import { notFound, redirect } from "next/navigation";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { definisiDariJenisLama } from "@/features/form-rm/registry";
import { requireAnyModule } from "@/server/rbac/guard";
import { hakFormRm } from "@/server/modules/form-rm/form-rm.akses";
import { nopenSchema } from "@/server/modules/form-rm/isian.schema";
import { cariIsianAktif } from "@/server/modules/form-rm/isian.cari";

export const dynamic = "force-dynamic";

/**
 * Rute lama `/form-rm/<nopen>/<jenis>` (sebelum isian v2) → halaman isian aktif,
 * atau ke profil pasien bila belum ada / kategorinya tak boleh dilihat (ID
 * isian kategori lain tak pernah dibocorkan). Tidak membuat isian.
 */
export default async function RuteLamaForm({ params }: { params: Promise<{ nopen: string; jenis: string }> }) {
  const user = await requireAnyModule(MODUL_AKSES_FORM_RM);
  const { nopen, jenis } = await params;
  const def = definisiDariJenisLama(jenis);
  if (!def || !nopenSchema.safeParse(nopen).success) notFound();
  const id = (await hakFormRm(user)).boleh(def.kategori, "view") ? await cariIsianAktif(def.kode, nopen) : null;
  redirect(id ? `/form-rm/isian/${id}` : `/form-rm/pasien/${nopen}`);
}
