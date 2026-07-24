import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Card, CardHeader } from "@/components/ui/Card";
import { PasienResumeList } from "@/components/report/PasienResumeList";
import { getResumeMedisList } from "@/server/modules/resume-medis/resume-medis.service";

export const metadata = { title: "Resume Medis · ReportHub RSB" };

export default async function ResumeMedisListPage() {
  const list = await getResumeMedisList();

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Cetak Resume Medis"
        description="Resume medis lengkap (SP medicalrecord.CetakMR2). Pilih pasien untuk melihat & mencetak."
      />

      <Card className="overflow-hidden">
        <CardHeader title="Daftar Pasien" subtitle={`${list.length} data simulasi`} />
        <PasienResumeList items={list} printBasePath="/print/resume-medis" />
      </Card>
    </FadeIn>
  );
}
