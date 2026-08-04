import { Download } from "lucide-react";

export const metadata = { title: "Pratinjau Dokumen · ReportHub RSB" };
export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  "resume-medis": "Resume Medis",
  sep: "SEP (Surat Eligibilitas Peserta)",
  cppt: "CPPT (Catatan Medik)",
  spri: "SPRI (Surat Rencana Rawat Inap)",
};

/**
 * Viewer PDF: meng-embed report resmi SIMGOS lewat <iframe> (sub-resource),
 * sehingga tampil PREVIEW di tab — tidak dicegat download manager (IDM) yang
 * biasanya hanya mengambil-alih navigasi top-level bertipe application/pdf.
 */
export default async function ReportViewerPage({
  params,
}: {
  params: Promise<{ report: string; nopen: string }>;
}) {
  const { report, nopen } = await params;
  const src = `/api/print/simgos/${report}/${nopen}`;
  const label = LABEL[report] ?? "Dokumen";

  return (
    <div className="flex h-dvh flex-col bg-[#3f4245]">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
        <span className="truncate text-sm font-medium text-fg">
          {label} <span className="font-mono text-fg-muted">· {nopen}</span>
        </span>
        <a
          href={`${src}?dl=1`}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <Download className="size-4" />
          Unduh
        </a>
      </div>

      <iframe
        src={src}
        title={`${label} — ${nopen}`}
        className="min-h-0 w-full flex-1 border-0"
      />

      <noscript>
        <div className="p-4 text-center text-sm text-fg">
          <a href={src} className="text-brand underline">
            Buka dokumen
          </a>
        </div>
      </noscript>
    </div>
  );
}
