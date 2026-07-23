import Link from "next/link";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { getResumeMedisList } from "@/lib/mock/resume-medis";

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
        <Table>
          <THead>
            <TH>No. RM</TH>
            <TH>Pasien</TH>
            <TH>Jenis</TH>
            <TH>Diagnosa Utama</TH>
            <TH>DPJP</TH>
            <TH align="right">Aksi</TH>
          </THead>
          <TBody>
            {list.map((r) => (
              <TR key={r.id}>
                <TD>
                  <span className="font-mono text-xs text-fg-muted">{r.norm}</span>
                </TD>
                <TD>
                  <div className="flex flex-col">
                    <span className="font-medium text-fg">{r.nama}</span>
                    <span className="text-xs text-fg-muted">{r.jenisKelamin}</span>
                  </div>
                </TD>
                <TD>
                  <Badge tone={r.jenisPelayanan === "Rawat Inap" ? "brand" : "neutral"}>
                    {r.jenisPelayanan}
                  </Badge>
                </TD>
                <TD>
                  <span className="text-sm">{r.diagnosa.replace(/^-\s*/, "")}</span>
                </TD>
                <TD>
                  <span className="text-sm text-fg-muted">{r.dpjp}</span>
                </TD>
                <TD align="right">
                  <Link
                    href={`/print/resume-medis/${r.id}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-fg transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    <Printer className="size-4 text-fg-muted" />
                    Lihat & Cetak
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </FadeIn>
  );
}
