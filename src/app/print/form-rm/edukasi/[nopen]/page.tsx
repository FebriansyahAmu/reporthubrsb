import Link from "next/link";
import { FileWarning } from "lucide-react";
import { getEdukasiContext } from "@/server/modules/form-rm/form-rm.service";
import { EdukasiDocument } from "@/features/form-rm/EdukasiDocument";
import { PrintToolbar } from "@/components/report/PrintToolbar";

export const metadata = { title: "Cetak Edukasi RM.21 · ReportHub RSB" };
export const dynamic = "force-dynamic";

export default async function EdukasiPrintPage({
  params,
}: {
  params: Promise<{ nopen: string }>;
}) {
  const { nopen } = await params;
  const ctx = await getEdukasiContext(nopen);

  if (!ctx || !ctx.saved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
          <FileWarning className="size-7" />
        </div>
        <h1 className="text-lg font-semibold text-fg">Form Edukasi belum diisi</h1>
        <p className="mt-1 max-w-md text-sm text-fg-muted">
          Isi dan simpan formulir RM.21 dulu sebelum mencetak.
        </p>
        <Link
          href={`/form-rm/${nopen}/edukasi`}
          className="mt-6 inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          Buka form
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* F4 landscape untuk tabel edukasi yang lebar. */}
      <style>{`@media print { @page { size: 330mm 215mm; margin: 8mm; } }`}</style>
      <PrintToolbar
        title={`Edukasi RM.21 · ${ctx.header.nama}`}
        subtitle={ctx.header.norm}
        backHref={`/form-rm/${nopen}/edukasi`}
      />
      <EdukasiDocument header={ctx.header} data={ctx.saved.data} />
    </>
  );
}
