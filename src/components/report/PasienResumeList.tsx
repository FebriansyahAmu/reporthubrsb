import Link from "next/link";
import { Printer } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { ResumeMedisRingkas } from "@/lib/mock/resume-medis";

/**
 * Daftar pasien untuk report berbasis SP CetakMR2 (Resume Medis / Resume Pulang).
 * `printBasePath` menentukan template mana yang dibuka.
 */
export function PasienResumeList({
  items,
  printBasePath,
}: {
  items: ResumeMedisRingkas[];
  printBasePath: string;
}) {
  return (
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
        {items.map((r) => (
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
                href={`${printBasePath}/${r.id}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-fg transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <Printer className="size-4 text-fg-muted" />
                Lihat &amp; Cetak
              </Link>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
