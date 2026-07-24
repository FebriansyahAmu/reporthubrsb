import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Card, CardHeader } from "@/components/ui/Card";
import { PasienResumeList } from "@/components/report/PasienResumeList";
import { getResumeMedisList } from "@/server/modules/resume-medis/resume-medis.service";

export const metadata = { title: "Resume Pulang · ReportHub RSB" };

export default async function ResumePulangListPage() {
  const list = await getResumeMedisList();

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Cetak Resume Pulang"
        description="Ringkasan pulang untuk pasien — versi ringkas dari resume medis (diagnosa, obat pulang, anjuran, kontrol)."
      />

      <Card className="overflow-hidden">
        <CardHeader title="Daftar Pasien" subtitle={`${list.length} data simulasi`} />
        <PasienResumeList items={list} printBasePath="/print/resume-pulang" />
      </Card>
    </FadeIn>
  );
}
