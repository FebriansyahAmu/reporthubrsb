import Link from "next/link";
import { FileWarning } from "lucide-react";
import { getTriaseContext } from "@/server/modules/form-rm/form-rm.service";
import { TriaseDocument } from "@/features/form-rm/TriaseDocument";
import { PrintToolbar } from "@/components/report/PrintToolbar";

export const metadata = { title: "Cetak Triase RM.04 · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function TriasePrintPage({
  params,
}: {
  params: Promise<{ nopen: string }>;
}) {
  const { nopen } = await params;
  const ctx = await getTriaseContext(nopen, { simrs: false });

  if (!ctx || !ctx.saved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
          <FileWarning className="size-7" />
        </div>
        <h1 className="text-lg font-semibold text-fg">Triase RM.04 belum diisi</h1>
        <p className="mt-1 max-w-md text-sm text-fg-muted">
          Isi dan simpan formulir RM.04 dulu sebelum mencetak.
        </p>
        <Link
          href={`/form-rm/${nopen}/triase`}
          className="mt-6 inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          Buka form
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* F4 potret — rasio kotak formulir RM.04 asli (215 × 330 mm, margin 8 mm). */}
      <style>{`@media print { @page { size: 215mm 330mm; margin: 8mm; } }`}</style>
      <PrintToolbar
        title={`Triase RM.04 · ${ctx.header.nama}`}
        subtitle={ctx.header.norm}
        backHref={`/form-rm/${nopen}/triase`}
      />
      <TriaseDocument header={ctx.header} data={ctx.saved.data} />
    </>
  );
}
