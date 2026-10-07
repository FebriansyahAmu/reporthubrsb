import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, PencilLine } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";
import { KATEGORI_FORM, MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { PemilihPasien } from "@/features/form-rm/PemilihPasien";
import { definisiForm, labelSasaran, type SasaranPasien } from "@/features/form-rm/registry";
import { TAMPILAN_FORM } from "@/features/form-rm/tampilan";
import { requireAnyModule } from "@/server/rbac/guard";
import { JENIS_KUNJUNGAN_KATEGORI } from "@/server/modules/kunjungan/kunjungan.types";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";
import { hakFormRm } from "@/server/modules/form-rm/form-rm.akses";
import { drafSaya, type DrafSaya } from "@/server/modules/form-rm/isian.cari";

export const metadata = { title: "Pilih Pasien · Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

const jendela = (jam: number) => (jam > 24 && jam % 24 === 0 ? `${jam / 24} hari` : `${jam} jam`);
const keteranganAktif = (s: SasaranPasien) =>
  `${labelSasaran(s)} yang masuk ${jendela(s.jendelaJam)} terakhir atau masih dilayani`;

/** Pemilih pasien untuk satu form (alur form lebih dulu, PRD §6.1). */
export default async function PemilihPasienPage({ params }: { params: Promise<{ kode: string }> }) {
  const user = await requireAnyModule(MODUL_AKSES_FORM_RM);
  const def = definisiForm((await params).kode);
  if (!def) notFound();
  const hak = await hakFormRm(user);
  if (!hak.boleh(def.kategori, "view")) redirect("/403");

  const kategoriSasaran = new Set(def.sasaran.jenis.map((j) => JENIS_KUNJUNGAN_KATEGORI[j]));
  const [ruangan, draf] = await Promise.all([
    getRuanganKunjunganList()
      .catch(() => [])
      .then((rs) => rs.filter((r) => kategoriSasaran.has(r.kategori)).map((r) => ({ id: r.id, nama: r.nama }))),
    drafSaya(def.kode, user.id),
  ]);
  const t = TAMPILAN_FORM[def.kode];

  return (
    <FadeIn className="space-y-6">
      <Link
        href="/form-rm"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        Katalog formulir
      </Link>
      <PageHeader
        title={`${def.kode} · ${t.label}`}
        description={`${KATEGORI_FORM[def.kategori].label} — pilih pasien untuk mengisi formulir ini. Pasien yang sudah punya isian langsung membuka isiannya.`}
      />
      {draf.length > 0 && <DrafAnda draf={draf} />}
      <PemilihPasien
        kode={def.kode}
        keteranganAktif={keteranganAktif(def.sasaran)}
        ruanganOptions={ruangan}
        bolehBuat={hak.boleh(def.kategori, "create")}
      />
    </FadeIn>
  );
}

/** Draf form ini yang dibuat pengguna — melanjutkan pekerjaan tanpa mencari pasien lagi. */
function DrafAnda({ draf }: { draf: DrafSaya[] }) {
  return (
    <Card className="overflow-hidden">
      <section aria-labelledby="draf-anda">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <PencilLine className="size-4 text-warning" />
          <h2 id="draf-anda" className="text-sm font-semibold text-fg">
            Draf Anda
          </h2>
          <span className="text-xs text-fg-muted">— belum difinalkan, terbaru dulu</span>
        </header>
        <ul className="flex gap-2 overflow-x-auto p-3">
          {draf.map((d) => (
            <li key={d.id} className="shrink-0">
              <Link
                href={`/form-rm/isian/${d.id}`}
                className="group flex min-h-14 w-64 items-center gap-3 rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft/50 px-3 py-2 transition-colors hover:border-warning/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{d.namaPasien}</span>
                  <span className="block truncate text-xs text-fg-muted">
                    {d.norm}
                    {d.ruang ? ` · ${d.ruang}` : ""}
                  </span>
                  <span className="block text-[11px] text-fg-subtle">Diubah {formatDateTime(d.updatedAt)}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-fg-subtle group-hover:text-fg" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Card>
  );
}
