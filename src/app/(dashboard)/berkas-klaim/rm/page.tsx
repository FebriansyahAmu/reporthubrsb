import { cookies } from "next/headers";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { BerkasKlaimRMView } from "@/features/berkas-klaim/BerkasKlaimRMView";
import { adaParamFilter, COOKIE_FILTER_RM, uraiFilterRm } from "@/features/berkas-klaim/filter-rm";
import { tanggalHariIniWita } from "@/lib/format";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";

export const metadata = { title: "Berkas Klaim RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/** Nilai cookie = query string ber-`encodeURIComponent`; dekode bila parser belum melakukannya. */
function bacaCookie(v: string | undefined): string | null {
  if (!v) return null;
  if (!v.includes("%3D")) return v;
  try {
    return decodeURIComponent(v);
  } catch {
    return null;
  }
}

export default async function BerkasKlaimRMPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [sp, jar, ruangan] = await Promise.all([searchParams, cookies(), getRuanganKunjunganList().catch(() => [])]);
  const hariIni = tanggalHariIniWita();
  // URL berparameter = sumber kebenaran; tanpa parameter (kembali dari detail / menu
  // samping) → pulihkan filter terakhir dari cookie sesi (lihat filter-rm.ts).
  const simpanan = adaParamFilter(sp) ? null : bacaCookie(jar.get(COOKIE_FILTER_RM)?.value);
  const awal = simpanan ? uraiFilterRm(new URLSearchParams(simpanan), hariIni) : uraiFilterRm(sp, hariIni);

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Berkas Klaim RM"
        description="Pasien yang sudah selesai/final — siap dirakit berkas klaimnya. Pilih pasien untuk membuka kelengkapan dokumen (Rekam Medis, Triase, SEP, SPRI, Bukti Pelayanan, CPPT, Resume Pulang) dan cetak."
      />
      <BerkasKlaimRMView ruanganOptions={ruangan} hariIni={hariIni} awal={awal} dipulihkan={!!simpanan} />
    </FadeIn>
  );
}
