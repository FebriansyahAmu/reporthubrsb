import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitMerge, UserRound } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { ConsentFormView } from "@/features/form-rm/ConsentFormView";
import { EdukasiFormView } from "@/features/form-rm/EdukasiFormView";
import { FormDeklaratifView } from "@/features/form-rm/FormDeklaratifView";
import { RingkasanFormView } from "@/features/form-rm/RingkasanFormView";
import { Rm22FormView } from "@/features/form-rm/Rm22FormView";
import { Rm33FormView } from "@/features/form-rm/Rm33FormView";
import { Rm41FormView } from "@/features/form-rm/Rm41FormView";
import { Rm50FormView } from "@/features/form-rm/Rm50FormView";
import { Rm70FormView } from "@/features/form-rm/Rm70FormView";
import { TriaseFormView } from "@/features/form-rm/TriaseFormView";
import { KATEGORI_FORM, MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { NotFoundError } from "@/server/lib/errors";
import { requireAnyModule } from "@/server/rbac/guard";
import { bacaKebutuhanEdukasi, bacaKeluarSimrs, bacaTriaseSimrs } from "@/server/modules/form-rm/form-rm.service";
import { aktorHalaman } from "@/server/modules/form-rm/isian.jaga";
import { ID_RE, nopenSchema } from "@/server/modules/form-rm/isian.schema";
import { bacaIsian, episodeSimrsIsian, identitasIsian, tertautTerkini } from "@/server/modules/form-rm/isian.service";
import type { EpisodeRingkas } from "@/server/modules/form-rm/rantai.inti";
import { konteksIsian, ringkasEpisode } from "@/server/modules/form-rm/rantai.service";
import type { BacaKeluarSimrs, FormRmHeader, KebutuhanEdukasiSimrs, TriaseSimrs } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

export const metadata = { title: "Isian Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/**
 * Halaman isian — satu URL per isian (PRD §8.4). Pembukaan dicatat di audit;
 * hak dicek per kategori form (kategori tak terlihat → 404 seragam).
 */
export default async function IsianPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dari?: string | string[] }>;
}) {
  const user = await requireAnyModule(MODUL_AKSES_FORM_RM);
  const { id } = await params;
  if (!ID_RE.test(id)) notFound();
  const { dari } = await searchParams;

  const aktor = await aktorHalaman(user);
  const tersimpan = await bacaIsian(id, aktor).catch((e: unknown) => {
    if (e instanceof NotFoundError) return null;
    throw e;
  });
  if (!tersimpan) notFound();

  // Form berlanjut IGD → RI: konteks (episode tempat isian dibuka) hanya anggota rantai;
  // rujukan & kolom tertaut SIMRS dari episode terakhir rantai (rawat inap).
  const [rantai, nopenSimrs] = await Promise.all([
    konteksIsian(tersimpan, typeof dari === "string" && nopenSchema.safeParse(dari).success ? dari : null),
    episodeSimrsIsian(tersimpan),
  ]);

  // Rujukan SIMRS baca-saja (bukan isi isian): dibaca langsung tiap halaman dibuka.
  // Isian belum tertaut belum punya pendaftaran → tanpa rujukan.
  const tanpaRujukan: RujukanSimrs = { triase: null, edukasi: null, keluar: null };
  const [header, rujukan, episodeRantai] = await Promise.all([
    identitasIsian(tersimpan),
    !tersimpan.tertaut
      ? tanpaRujukan
      : tersimpan.kode === "RM.04"
        ? bacaTriaseSimrs(nopenSimrs).then((triase) => ({ ...tanpaRujukan, triase }))
        : tersimpan.kode === "RM.21"
          ? bacaKebutuhanEdukasi(nopenSimrs).then((edukasi) => ({ ...tanpaRujukan, edukasi }))
          : tersimpan.kode === "RM.01"
            ? bacaKeluarSimrs(nopenSimrs).then((keluar) => ({ ...tanpaRujukan, keluar }))
            : tanpaRujukan,
    rantai.lanjutan.length > 0 ? ringkasEpisode([tersimpan.nopen, ...rantai.lanjutan.map((l) => l.nopen)]) : null,
  ]);
  // Kolom tertaut SIMRS (mis. Keadaan Keluar RM.01) berisi nilai SIMRS terkini selama DRAF.
  const isian = await tertautTerkini(tersimpan, header);
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
        {isian.tertaut && (
          <Link
            href={`/form-rm/pasien/${rantai.konteks}`}
            className="inline-flex items-center gap-1.5 text-fg-muted transition-colors hover:text-fg"
          >
            <UserRound className="size-4" />
            Semua formulir pasien ini
          </Link>
        )}
      </nav>
      <PageHeader
        title={isian.judul}
        description={`${isian.kode} · ${KATEGORI_FORM[isian.kategori].label} · ${header.nama} · ${
          isian.tertaut ? `No. RM ${header.norm}` : "belum tertaut ke pasien terdaftar"
        }`}
      />
      {episodeRantai && <PitaBerlanjut episode={episodeRantai} konteks={rantai.konteks} />}
      <TampilanForm isian={isian} header={header} izin={izin} rujukan={rujukan} />
    </FadeIn>
  );
}

/** Jam dinding SIMGOS di field UTC → buang "Z" agar tak digeser zona waktu. */
const jamMasuk = (e: EpisodeRingkas) => (e.masuk ? formatDateTime(e.masuk.slice(0, 19)) : "—");

/**
 * Pita isian bersama IGD → rawat inap (PRD Berlanjut §5.1–5.2). `episode[0]` =
 * episode akar (IGD), sisanya episode lanjutan (rawat inap).
 */
function PitaBerlanjut({ episode, konteks }: { episode: EpisodeRingkas[]; konteks: string }) {
  const [akar, ...lanjutan] = episode;
  const dariRi = konteks !== akar.nopen;
  return (
    <section
      aria-label="Isian bersama IGD dan rawat inap"
      className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-brand/25 bg-brand-soft/60 px-4 py-3 text-sm"
    >
      <GitMerge className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 space-y-0.5 text-fg-muted">
        <p className="font-semibold text-fg">Isian bersama IGD → Rawat Inap</p>
        <p>
          Dimulai di IGD {akar.ruang} · masuk {jamMasuk(akar)} (NOPEN <span className="font-mono">{akar.nopen}</span>), dilanjutkan
          di{" "}
          {lanjutan.map((l, i) => (
            <span key={l.nopen}>
              {i > 0 ? ", " : ""}
              {l.ruang} · masuk {jamMasuk(l)} (NOPEN <span className="font-mono">{l.nopen}</span>)
            </span>
          ))}
          . Perubahan dari kedua unit tersimpan di dokumen ini.
        </p>
        <p className="text-xs">Anda membuka dari {dariRi ? "rawat inap" : "IGD"}.</p>
      </div>
    </section>
  );
}

type RujukanSimrs = {
  triase: TriaseSimrs | null;
  edukasi: KebutuhanEdukasiSimrs | null;
  keluar: BacaKeluarSimrs | null;
};

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
      return <RingkasanFormView key={key} isian={isian} header={header} izin={izin} keluar={rujukan.keluar} />;
    case "RM.03":
      return <ConsentFormView key={key} isian={isian} header={header} izin={izin} />;
    case "RM.22":
      return <Rm22FormView key={key} isian={isian} header={header} izin={izin} />;
    case "RM.33":
      return <Rm33FormView key={key} isian={isian} header={header} izin={izin} />;
    case "RM.41":
      return <Rm41FormView key={key} isian={isian} header={header} izin={izin} />;
    case "RM.50":
      return <Rm50FormView key={key} isian={isian} header={header} izin={izin} />;
    case "RM.70":
      return <Rm70FormView key={key} isian={isian} header={header} izin={izin} />;
    default:
      // Form deklaratif: renderer generik dari struktur registri.
      return <FormDeklaratifView key={key} isian={isian} header={header} izin={izin} />;
  }
}
