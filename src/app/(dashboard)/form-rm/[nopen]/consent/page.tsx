import Link from "next/link";
import { ArrowLeft, FileWarning } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Card } from "@/components/ui/Card";
import { ConsentFormView } from "@/features/form-rm/ConsentFormView";
import { getConsentContext } from "@/server/modules/form-rm/form-rm.service";

export const metadata = { title: "General Consent (RM.03) · ReportHub RSB" };
export const dynamic = "force-dynamic";

export default async function ConsentFormPage({
  params,
}: {
  params: Promise<{ nopen: string }>;
}) {
  const { nopen } = await params;
  const ctx = await getConsentContext(nopen);

  if (!ctx) {
    return (
      <FadeIn className="space-y-6">
        <BackLink nopen={nopen} />
        <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
            <FileWarning className="size-7" />
          </div>
          <h1 className="text-lg font-semibold text-fg">Pasien tidak ditemukan</h1>
          <p className="mt-1 max-w-md text-sm text-fg-muted">
            NOPEN <span className="font-mono">{nopen}</span> tidak ditemukan atau tidak aktif.
          </p>
        </Card>
      </FadeIn>
    );
  }

  return (
    <FadeIn className="space-y-6">
      <BackLink nopen={nopen} />
      <PageHeader
        title="Persetujuan Umum Rawat Inap (General Consent)"
        description={`RM.03 · ${ctx.header.nama} · No. RM ${ctx.header.norm}`}
      />
      <ConsentFormView nopen={nopen} header={ctx.header} initialSaved={ctx.saved} />
    </FadeIn>
  );
}

function BackLink({ nopen }: { nopen: string }) {
  return (
    <Link
      href={`/form-rm/${nopen}`}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
    >
      <ArrowLeft className="size-4" />
      Kembali ke detail
    </Link>
  );
}
