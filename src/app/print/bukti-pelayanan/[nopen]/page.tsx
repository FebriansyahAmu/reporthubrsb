import Link from "next/link";
import { FileWarning } from "lucide-react";
import { PrintToolbar } from "@/components/report/PrintToolbar";
import { BuktiPelayananDocument } from "@/features/berkas-klaim/BuktiPelayananDocument";
import { getBuktiPelayananReport } from "@/server/modules/berkas-klaim/berkas-klaim.bukti-report.service";

export const metadata = { title: "Bukti Pelayanan JKN-KIS · ReportHub RSB" };
export const dynamic = "force-dynamic";

export default async function BuktiPelayananPrintPage({
  params,
}: {
  params: Promise<{ nopen: string }>;
}) {
  const { nopen } = await params;
  const data = /^\d{6,12}$/.test(nopen) ? await getBuktiPelayananReport(nopen) : null;

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
          <FileWarning className="size-7" />
        </div>
        <h1 className="text-lg font-semibold text-fg">Bukti Pelayanan tidak tersedia</h1>
        <p className="mt-1 max-w-md text-sm text-fg-muted">
          NOPEN <span className="font-mono">{nopen}</span> tidak ditemukan atau pendaftarannya
          tidak aktif.
        </p>
        <Link
          href={`/berkas-klaim/rm/${nopen}`}
          className="mt-6 inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          Kembali ke detail berkas
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Kertas F4 / Folio (215 × 330 mm), margin kiri 2 cm, lainnya 1 cm. */}
      <style>{`@media print { @page { size: 215mm 330mm; margin: 10mm 10mm 10mm 20mm; } }`}</style>
      <PrintToolbar
        title={`Bukti Pelayanan · ${data.namaPenderita}`}
        subtitle={`NOPEN ${data.nopen}`}
        backHref={`/berkas-klaim/rm/${data.nopen}`}
      />
      <BuktiPelayananDocument data={data} />
    </>
  );
}
