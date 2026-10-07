import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { ConsentFormView } from "@/features/form-rm/ConsentFormView";
import { EdukasiFormView } from "@/features/form-rm/EdukasiFormView";
import { RingkasanFormView } from "@/features/form-rm/RingkasanFormView";
import { TriaseFormView } from "@/features/form-rm/TriaseFormView";
import { KATEGORI_FORM, MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { NotFoundError } from "@/server/lib/errors";
import { requireAnyModule } from "@/server/rbac/guard";
import { bacaKebutuhanEdukasi, bacaTriaseSimrs } from "@/server/modules/form-rm/form-rm.service";
import { aktorHalaman } from "@/server/modules/form-rm/isian.jaga";
import { ID_RE } from "@/server/modules/form-rm/isian.schema";
import { bacaIsian, identitasIsian } from "@/server/modules/form-rm/isian.service";
import type { FormRmHeader, KebutuhanEdukasiSimrs, TriaseSimrs } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

export const metadata = { title: "Isian Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/**
 * Halaman isian — satu URL per isian (PRD §8.4). Pembukaan dicatat di audit;
 * hak dicek per kategori form (kategori tak terlihat → 404 seragam).
 */
export default async function IsianPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAnyModule(MODUL_AKSES_FORM_RM);
  const { id } = await params;
  if (!ID_RE.test(id)) notFound();

  const aktor = await aktorHalaman(user);
  const isian = await bacaIsian(id, aktor).catch((e: unknown) => {
    if (e instanceof NotFoundError) return null;
    throw e;
  });
  if (!isian) notFound();

  // Rujukan SIMRS baca-saja (bukan isi isian): dibaca langsung tiap halaman dibuka.
  const [header, rujukan] = await Promise.all([
    identitasIsian(isian),
    isian.kode === "RM.04"
      ? bacaTriaseSimrs(isian.nopen).then((triase) => ({ triase, edukasi: null }))
      : isian.kode === "RM.21"
        ? bacaKebutuhanEdukasi(isian.nopen).then((edukasi) => ({ triase: null, edukasi }))
        : { triase: null, edukasi: null },
  ]);
  const { hak } = aktor;
  const izin: IzinIsian = {
    ubah: hak.boleh(isian.kategori, "update"),
    kelola: hak.kelola,
    buat: hak.boleh(isian.kategori, "create"),
    cetak: hak.boleh(isian.kategori, "print"),
  };

  return (
    <FadeIn className="space-y-6">
      <nav aria-label="Kembali" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium">
        <Link
          href={`/form-rm/f/${isian.kode}`}
          className="inline-flex items-center gap-1.5 text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          Pasien {isian.kode}
        </Link>
        <Link
          href={`/form-rm/pasien/${isian.nopen}`}
          className="inline-flex items-center gap-1.5 text-fg-muted transition-colors hover:text-fg"
        >
          <UserRound className="size-4" />
          Semua formulir pasien ini
        </Link>
      </nav>
      <PageHeader
        title={isian.judul}
        description={`${isian.kode} · ${KATEGORI_FORM[isian.kategori].label} · ${header.nama} · No. RM ${header.norm}`}
      />
      <TampilanForm isian={isian} header={header} izin={izin} rujukan={rujukan} />
    </FadeIn>
  );
}

type RujukanSimrs = { triase: TriaseSimrs | null; edukasi: KebutuhanEdukasiSimrs | null };

/**
 * Tampilan per kode form. Dipilih di server → hanya komponen form yang dipakai
 * yang dikirim ke browser. `key` memuat rev: state klien disegarkan bila isian
 * berubah dari luar (navigasi ulang).
 */
function TampilanForm({
  isian,
  header,
  izin,
  rujukan,
}: {
  isian: IsianForm;
  header: FormRmHeader;
  izin: IzinIsian;
  rujukan: RujukanSimrs;
}) {
  const key = `${isian.id}:${isian.rev}`;
  switch (isian.kode) {
    case "RM.04":
      return <TriaseFormView key={key} isian={isian} header={header} izin={izin} simrs={rujukan.triase} />;
    case "RM.21":
      return <EdukasiFormView key={key} isian={isian} header={header} izin={izin} kebutuhan={rujukan.edukasi} />;
    case "RM.01":
      return <RingkasanFormView key={key} isian={isian} header={header} izin={izin} />;
    case "RM.03":
      return <ConsentFormView key={key} isian={isian} header={header} izin={izin} />;
  }
}
