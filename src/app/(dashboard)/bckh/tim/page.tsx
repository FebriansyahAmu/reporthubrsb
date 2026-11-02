import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { TimView } from "@/features/bckh/TimView";
import { tanggalHariIniWita } from "@/lib/format";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = {
  title: "BCKH Tim · AuditTrail RS BOLTIM",
};
export const dynamic = "force-dynamic";

/** Tim BCKH (atasan): ringkasan pengisian per pegawai — `bckh.tim:view`, unduh laporan `bckh.tim:print`. */
export default async function BckhTimPage() {
  const user = await requireModule("bckh.tim");
  const cetak = await hasModule(user, "bckh.tim", "print");
  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Tim"
        description="Pantau pengisian Buku Catatan Kegiatan Harian pegawai: kepatuhan hari kerja, jumlah kegiatan, dan aktivitas 5 minggu terakhir. Buka profil pegawai untuk melihat catatan dan laporannya (hanya-lihat)."
      />
      <TimView hariIni={tanggalHariIniWita()} bolehCetak={cetak} />
    </FadeIn>
  );
}
