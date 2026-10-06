import { notFound, redirect } from "next/navigation";
import { definisiDariJenisLama } from "@/features/form-rm/registry";
import { nopenSchema } from "@/server/modules/form-rm/isian.schema";
import { cariIsianAktif } from "@/server/modules/form-rm/isian.cari";

export const dynamic = "force-dynamic";

/**
 * Rute lama `/form-rm/<nopen>/<jenis>` (sebelum isian v2) → halaman isian aktif,
 * atau ke formulir pasien bila belum ada. Tidak membuat isian (GET tanpa efek).
 */
export default async function RuteLamaForm({ params }: { params: Promise<{ nopen: string; jenis: string }> }) {
  const { nopen, jenis } = await params;
  const def = definisiDariJenisLama(jenis);
  if (!def || !nopenSchema.safeParse(nopen).success) notFound();
  const id = await cariIsianAktif(def.kode, nopen);
  redirect(id ? `/form-rm/isian/${id}` : `/form-rm/${nopen}`);
}
