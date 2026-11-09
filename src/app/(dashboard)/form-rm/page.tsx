import Link from "next/link";
import { History, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { KatalogFormRm, type ItemKatalog } from "@/features/form-rm/KatalogFormRm";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { layananDariParam } from "@/features/form-rm/layanan";
import { labelSasaran } from "@/features/form-rm/registry";
import { filterAwalRiwayat, queryRiwayat, tambahHari } from "@/features/form-rm/riwayat";
import { PindahDataLama } from "@/features/form-rm/isian/PindahDataLama";
import { tanggalHariIniWita } from "@/lib/format";
import { requireAnyModule } from "@/server/rbac/guard";
import { formBoleh, hakFormRm } from "@/server/modules/form-rm/form-rm.akses";
import { hitungBelumTertaut, hitungDraf } from "@/server/modules/form-rm/isian.cari";
import { hitungDataLamaTertunda } from "@/server/modules/form-rm/isian.lama";

export const metadata = { title: "Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

const KELAS_TOMBOL =
  "inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm font-medium text-fg shadow-xs transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring";

/**
 * Katalog Form RM (PRD §6.1, §16 "Katalog baru"): form yang boleh dilihat, per
 * kategori, dengan filter layanan, hitungan draf, dan isian belum tertaut.
 * Registri di memori + satu kelompok query hitungan.
 */
export default async function KatalogFormRmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, sp] = await Promise.all([requireAnyModule(MODUL_AKSES_FORM_RM), searchParams]);
  const hak = await hakFormRm(user);
  const forms = formBoleh(hak);
  const [draf, belumTertaut, dataLama] = await Promise.all([
    hitungDraf(forms.map((d) => d.kode), user.id),
    hitungBelumTertaut(forms.filter((d) => d.tanpaPendaftaran).map((d) => d.kode)),
    // Hanya pengelola RM yang melihat & memicu pemindahan data lama.
    hak.kelola ? hitungDataLamaTertunda().catch(() => 0) : 0,
  ]);
  const items: ItemKatalog[] = forms.map((d) => ({
    kode: d.kode,
    kategori: d.kategori,
    sasaran: labelSasaran(d.sasaran),
    jenis: [...d.sasaran.jenis],
    ruangan: d.sasaran.ruangan?.map((r) => r.nama) ?? [],
    wajib: [...d.wajibUntuk],
    draf: draf[d.kode] ?? { saya: 0, semua: 0 },
    belumTertaut: belumTertaut[d.kode] ?? 0,
  }));

  // "Lihat draf saya" → Riwayat: draf buatan saya, setahun terakhir (draf bisa sudah lama).
  const hariIni = tanggalHariIniWita();
  const drafSaya = queryRiwayat(
    { ...filterAwalRiwayat(hariIni), dari: tambahHari(hariIni, -365), status: "DRAF", saya: true },
    hariIni,
    false,
  );
  const awalLayanan = layananDariParam(Array.isArray(sp.layanan) ? sp.layanan[0] : sp.layanan);

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Katalog Formulir"
        description="Pilih formulir, lalu pilih pasien. Identitas dan data SIMRS terisi otomatis; isian FINAL terkunci dan tercatat di riwayat."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/form-rm/riwayat" className={KELAS_TOMBOL}>
              <History className="size-4" />
              Riwayat pengisian
            </Link>
            <Link href="/form-rm/pasien" className={KELAS_TOMBOL}>
              <Users className="size-4" />
              Mulai dari pasien
            </Link>
          </div>
        }
      />
      {dataLama > 0 && <PindahDataLama jumlah={dataLama} />}
      <KatalogFormRm items={items} awalLayanan={awalLayanan} tautan={{ drafSaya: `/form-rm/riwayat?${drafSaya}` }} />
    </FadeIn>
  );
}
