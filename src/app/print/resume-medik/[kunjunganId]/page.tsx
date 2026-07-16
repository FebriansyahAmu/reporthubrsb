import Link from "next/link";
import { FileWarning } from "lucide-react";
import { getResumeMedik } from "@/lib/mock/data";
import { ResumeDocument } from "@/features/resume-medik/ResumeDocument";
import { PrintToolbar } from "@/features/resume-medik/PrintToolbar";

export const metadata = { title: "Resume Medik · ReportHub RSB" };

export default async function ResumeMedikPrintPage({
  params,
}: {
  params: Promise<{ kunjunganId: string }>;
}) {
  const { kunjunganId } = await params;
  const resume = await getResumeMedik(kunjunganId);

  if (!resume) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
          <FileWarning className="size-7" />
        </div>
        <h1 className="text-lg font-semibold text-fg">Resume medik tidak tersedia</h1>
        <p className="mt-1 max-w-md text-sm text-fg-muted">
          Kunjungan tidak ditemukan atau statusnya belum{" "}
          <span className="font-medium text-fg">Selesai</span>. Resume medik hanya bisa
          dicetak untuk kunjungan yang sudah selesai.
        </p>
        <Link
          href="/laporan/resume-medik"
          className="mt-6 inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          Kembali ke pencarian
        </Link>
      </div>
    );
  }

  return (
    <>
      <PrintToolbar nomorKunjungan={resume.kunjungan.nomorKunjungan} />
      <ResumeDocument resume={resume} />
    </>
  );
}
