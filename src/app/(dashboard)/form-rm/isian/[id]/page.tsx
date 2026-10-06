import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { ConsentFormView } from "@/features/form-rm/ConsentFormView";
import { EdukasiFormView } from "@/features/form-rm/EdukasiFormView";
import { RingkasanFormView } from "@/features/form-rm/RingkasanFormView";
import { TriaseFormView } from "@/features/form-rm/TriaseFormView";
import { KATEGORI_FORM } from "@/features/form-rm/registry";
import { NotFoundError } from "@/server/lib/errors";
import { hasModule, requireModule } from "@/server/rbac/guard";
import { bacaTriaseSimrs } from "@/server/modules/form-rm/form-rm.service";
import { aktorHalaman } from "@/server/modules/form-rm/isian.jaga";
import { ID_RE } from "@/server/modules/form-rm/isian.schema";
import { bacaIsian, identitasIsian } from "@/server/modules/form-rm/isian.service";
import type { FormRmHeader, TriaseSimrs } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

export const metadata = { title: "Isian Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/** Halaman isian — satu URL per isian (PRD §8.4). Pembukaan dicatat di audit. */
export default async function IsianPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("form-rm", "view");
  const { id } = await params;
  if (!ID_RE.test(id)) notFound();

  const isian = await bacaIsian(id, await aktorHalaman(user)).catch((e: unknown) => {
    if (e instanceof NotFoundError) return null;
    throw e;
  });
  if (!isian) notFound();

  const [header, triaseSimrs, ubah, kelola, buat, cetak] = await Promise.all([
    identitasIsian(isian),
    isian.kode === "RM.04" ? bacaTriaseSimrs(isian.nopen) : null,
    hasModule(user, "form-rm", "update"),
    hasModule(user, "form-rm.kelola", "update"),
    hasModule(user, "form-rm", "create"),
    hasModule(user, "form-rm", "print"),
  ]);
  const izin: IzinIsian = { ubah, kelola, buat, cetak };

  return (
    <FadeIn className="space-y-6">
      <Link
        href={`/form-rm/${isian.nopen}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        Kembali ke formulir pasien
      </Link>
      <PageHeader
        title={isian.judul}
        description={`${isian.kode} · ${KATEGORI_FORM[isian.kategori]} · ${header.nama} · No. RM ${header.norm}`}
      />
      <TampilanForm isian={isian} header={header} izin={izin} triaseSimrs={triaseSimrs?.simrs ?? null} />
    </FadeIn>
  );
}

/**
 * Tampilan per kode form. Dipilih di server → hanya komponen form yang dipakai
 * yang dikirim ke browser. `key` memuat rev: state klien disegarkan bila isian
 * berubah dari luar (navigasi ulang).
 */
function TampilanForm({
  isian,
  header,
  izin,
  triaseSimrs,
}: {
  isian: IsianForm;
  header: FormRmHeader;
  izin: IzinIsian;
  triaseSimrs: TriaseSimrs | null;
}) {
  const key = `${isian.id}:${isian.rev}`;
  switch (isian.kode) {
    case "RM.04":
      return <TriaseFormView key={key} isian={isian} header={header} izin={izin} simrs={triaseSimrs} />;
    case "RM.21":
      return <EdukasiFormView key={key} isian={isian} header={header} izin={izin} />;
    case "RM.01":
      return <RingkasanFormView key={key} isian={isian} header={header} izin={izin} />;
    case "RM.03":
      return <ConsentFormView key={key} isian={isian} header={header} izin={izin} />;
  }
}
