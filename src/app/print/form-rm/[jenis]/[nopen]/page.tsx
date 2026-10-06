import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileWarning } from "lucide-react";
import { definisiDariJenisLama } from "@/features/form-rm/registry";
import { requireModule } from "@/server/rbac/guard";
import { nopenSchema } from "@/server/modules/form-rm/isian.schema";
import { cariIsianAktif } from "@/server/modules/form-rm/isian.cari";

export const metadata = { title: "Cetak Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/** Rute cetak lama `/print/form-rm/<jenis>/<nopen>` → cetak isian aktif. */
export default async function CetakRuteLama({ params }: { params: Promise<{ jenis: string; nopen: string }> }) {
  await requireModule("form-rm", "print");
  const { jenis, nopen } = await params;
  const def = definisiDariJenisLama(jenis);
  if (!def || !nopenSchema.safeParse(nopen).success) notFound();
  const id = await cariIsianAktif(def.kode, nopen);
  if (id) redirect(`/print/form-rm/isian/${id}`);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
        <FileWarning className="size-7" />
      </div>
      <h1 className="text-lg font-semibold text-fg">
        {def.judul} ({def.kode}) belum diisi
      </h1>
      <p className="mt-1 max-w-md text-sm text-fg-muted">Isi formulir ini dulu sebelum mencetak.</p>
      <Link
        href={`/form-rm/${nopen}`}
        className="mt-6 inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
      >
        Buka formulir pasien
      </Link>
    </div>
  );
}
