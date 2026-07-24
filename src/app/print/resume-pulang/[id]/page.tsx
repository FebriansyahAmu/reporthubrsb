import Link from "next/link";
import { FileWarning } from "lucide-react";
import { getResumeMedis } from "@/server/modules/resume-medis/resume-medis.service";
import { ResumePulangDocument } from "@/features/resume-pulang/ResumePulangDocument";
import { PrintToolbar } from "@/components/report/PrintToolbar";

export const metadata = { title: "Resume Pulang · ReportHub RSB" };

export default async function ResumePulangPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dto = await getResumeMedis(id);

  if (!dto) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
          <FileWarning className="size-7" />
        </div>
        <h1 className="text-lg font-semibold text-fg">Resume pulang tidak ditemukan</h1>
        <p className="mt-1 max-w-md text-sm text-fg-muted">
          Data untuk ID ini tidak tersedia.
        </p>
        <Link
          href="/laporan/resume-pulang"
          className="mt-6 inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          Kembali ke daftar
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Kertas F4 (215 × 330 mm), dokumen ringkas 1 halaman. */}
      <style>{`@media print { @page { size: 215mm 330mm; margin: 12mm 12mm 14mm 12mm; } }`}</style>
      <PrintToolbar
        title={`Resume Pulang · ${dto.pasien.nama}`}
        subtitle={dto.pasien.norm ?? undefined}
        backHref="/laporan/resume-pulang"
      />
      <ResumePulangDocument dto={dto} />
    </>
  );
}
