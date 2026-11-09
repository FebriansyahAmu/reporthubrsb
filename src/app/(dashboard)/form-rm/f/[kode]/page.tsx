import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, ChevronRight, DatabaseZap, FileText, Link2Off, PencilLine } from "lucide-react";
import { FadeIn } from "@/components/motion/Motion";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatDateTime, tanggalHariIniWita } from "@/lib/format";
import { KATEGORI_FORM, MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { layananDariJenis, layananDariParam, TITIK_LAYANAN } from "@/features/form-rm/layanan";
import type { RuanganPemilih } from "@/features/form-rm/PemilihPasien";
import { definisiForm, JENIS_KUNJUNGAN, labelSasaran, type SasaranPasien } from "@/features/form-rm/registry";
import { uraiFilterRiwayat } from "@/features/form-rm/riwayat";
import { tabDetailDariParam } from "@/features/form-rm/tab-detail";
import { TabDetailForm } from "@/features/form-rm/TabDetailForm";
import { TAMPILAN_FORM } from "@/features/form-rm/tampilan";
import { BelumTertautPanel } from "@/features/form-rm/isian/BelumTertautPanel";
import { requireAnyModule } from "@/server/rbac/guard";
import { JENIS_KUNJUNGAN_KATEGORI } from "@/server/modules/kunjungan/kunjungan.types";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";
import { hakFormRm } from "@/server/modules/form-rm/form-rm.akses";
import { daftarBelumTertaut, drafSaya, statistikForm, type DrafSaya, type StatistikForm } from "@/server/modules/form-rm/isian.cari";

export const metadata = { title: "Detail Formulir · Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

const jendela = (jam: number) => (jam > 24 && jam % 24 === 0 ? `${jam / 24} hari` : `${jam} jam`);
const keteranganAktif = (s: SasaranPasien) =>
  `${labelSasaran(s)} yang masuk ${jendela(s.jendelaJam)} terakhir atau masih dilayani`;
const daftarDan = (s: readonly string[]) => (s.length > 1 ? `${s.slice(0, -1).join(", ")} & ${s[s.length - 1]}` : s.join(""));
const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Detail satu form (alur form lebih dulu, PRD §6.1, §16 "Halaman detail form"):
 * kepala form + ringkasan isian, tab Pilih pasien (filter layanan, status,
 * ruangan, cari) dan Riwayat pengisian form ini.
 */
export default async function DetailFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ kode: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, { kode }, sp] = await Promise.all([requireAnyModule(MODUL_AKSES_FORM_RM), params, searchParams]);
  const def = definisiForm(kode);
  if (!def) notFound();
  const hak = await hakFormRm(user);
  if (!hak.boleh(def.kategori, "view")) redirect("/403");

  const jenisDariKategori = new Map(JENIS_KUNJUNGAN.map((j) => [JENIS_KUNJUNGAN_KATEGORI[j], j]));
  const ruangSasaran = (id: string) => !def.sasaran.ruangan || def.sasaran.ruangan.some((r) => id.startsWith(r.id));
  const [ruangan, draf, belumTertaut, stat] = await Promise.all([
    getRuanganKunjunganList()
      .catch(() => [])
      .then((rs) =>
        rs.flatMap((r): RuanganPemilih[] => {
          const j = jenisDariKategori.get(r.kategori);
          return j && def.sasaran.jenis.includes(j) && ruangSasaran(r.id) ? [{ id: r.id, nama: r.nama, jenis: j }] : [];
        }),
      ),
    drafSaya(def, user.id),
    daftarBelumTertaut(def, user.id),
    statistikForm(def.kode, user.id),
  ]);
  const bolehBuat = hak.boleh(def.kategori, "create");
  const hariIni = tanggalHariIniWita();
  const layananAwal = layananDariParam(satu(sp.layanan));

  return (
    <FadeIn className="space-y-6">
      <nav aria-label="Lokasi halaman" className="flex min-w-0 items-center gap-1.5 text-sm text-fg-muted">
        <Link href="/form-rm" className="shrink-0 rounded-md font-medium transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
          Katalog formulir
        </Link>
        <ChevronRight className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
        <span className="truncate">{KATEGORI_FORM[def.kategori].label}</span>
        <ChevronRight className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
        <span aria-current="page" className="shrink-0 font-mono text-[13px] font-medium text-fg">
          {def.kode}
        </span>
      </nav>

      <KepalaForm kode={def.kode} stat={stat} />

      <TabDetailForm
        kode={def.kode}
        tabAwal={tabDetailDariParam(satu(sp.tab))}
        jumlahIsian={stat.total}
        sebelumDaftar={
          <>
            {draf.length > 0 && <DrafAnda draf={draf} />}
            {def.tanpaPendaftaran && (
              <BelumTertautPanel kode={def.kode} items={belumTertaut} sekarang={new Date().toISOString()} bolehBuat={bolehBuat} />
            )}
          </>
        }
        pasien={{
          keteranganAktif: keteranganAktif(def.sasaran),
          ruanganOptions: ruangan,
          bolehBuat,
          berulang: def.berulang,
          layananOpsi: [...def.sasaran.jenis],
          awalLayanan: layananAwal,
        }}
        riwayat={{ hariIni, awal: uraiFilterRiwayat(sp, hariIni, []) }}
      />
    </FadeIn>
  );
}

/** Kepala form: identitas formulir, sasaran, kertas, isi otomatis, dan ringkasan seluruh isiannya. */
function KepalaForm({ kode, stat }: { kode: string; stat: StatistikForm }) {
  const def = definisiForm(kode)!;
  const t = TAMPILAN_FORM[def.kode];
  const Ikon = t.ikon;
  const Kat = KATEGORI_FORM[def.kategori];
  const IkonKat = Kat.ikon;
  const wajib = def.wajibUntuk.map((j) => layananDariJenis(j)?.label ?? "");
  const kolomSimrs = def.simrs.reduce((n, b) => n + b.kolom.length, 0);
  const STAT = [
    { label: "Draf berjalan", nilai: stat.DRAF, titik: "bg-warning" },
    { label: "Final", nilai: stat.FINAL, titik: "bg-success" },
    { label: "Dibatalkan", nilai: stat.BATAL, titik: "bg-danger" },
    { label: "Draf Anda", nilai: stat.drafSaya, titik: "bg-brand" },
  ];

  return (
    <Card className="overflow-hidden rounded-xl">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand ring-1 ring-inset ring-brand/10">
          <Ikon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-border px-1.5 font-mono text-xs font-medium leading-6 text-fg-muted">{def.kode}</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-2/80 px-1.5 text-xs font-medium leading-6 text-fg-muted">
              <IkonKat className="size-3.5" aria-hidden />
              {Kat.label}
            </span>
            {wajib.length > 0 && (
              <span className="rounded-md bg-accent-soft px-1.5 text-xs font-medium leading-6 text-accent">Wajib {daftarDan(wajib)}</span>
            )}
            {t.berulang && (
              <span className="rounded-md border border-dashed border-border-strong px-1.5 text-xs font-medium leading-6 text-fg-muted">
                Satu isian per {t.berulang.satuan}
              </span>
            )}
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-fg sm:text-2xl">{t.label}</h1>
          {def.judul !== t.label && <p className="text-[13px] text-fg-subtle">Judul resmi: {def.judul}</p>}
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-fg-muted">
            {t.keterangan}{" "}
            {def.berulang
              ? `Pasien bisa punya lebih dari satu isian${t.berulang ? ` (${t.berulang.bila.toLowerCase()})` : ""}.`
              : "Pasien yang sudah punya isian langsung membuka isiannya."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-muted">
            <span className="flex flex-wrap items-center gap-1.5">
              {def.sasaran.jenis.map((j) => (
                <span key={j} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 font-medium leading-5">
                  <span className={cn("size-1.5 rounded-full", TITIK_LAYANAN[j])} aria-hidden />
                  {layananDariJenis(j)?.label}
                </span>
              ))}
              {def.sasaran.ruangan && <span className="text-fg-subtle">Hanya {daftarDan(def.sasaran.ruangan.map((r) => r.nama))}</span>}
            </span>
            <span className="inline-flex items-center gap-1">
              <FileText className="size-3.5 text-fg-subtle" aria-hidden />
              Kertas {def.kertas.ukuran} {def.kertas.orientasi}
            </span>
            {kolomSimrs > 0 && (
              <span className="inline-flex items-center gap-1">
                <DatabaseZap className="size-3.5 text-fg-subtle" aria-hidden />
                {kolomSimrs} kolom terisi otomatis dari SIMRS
              </span>
            )}
            {def.tanpaPendaftaran && (
              <span className="inline-flex items-center gap-1">
                <Link2Off className="size-3.5 text-fg-subtle" aria-hidden />
                Bisa diisi sebelum pasien terdaftar
              </span>
            )}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4" aria-label="Ringkasan seluruh isian formulir ini">
        {STAT.map((s) => (
          <div key={s.label} className="bg-surface px-5 py-3">
            <dt className="flex items-center gap-1.5 text-xs text-fg-muted">
              <span className={cn("size-1.5 rounded-full", s.titik)} aria-hidden />
              {s.label}
            </dt>
            <dd className="mt-0.5 text-xl font-semibold text-fg tabular">{s.nilai}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Draf form ini yang dibuat pengguna — melanjutkan pekerjaan tanpa mencari pasien lagi. */
function DrafAnda({ draf }: { draf: DrafSaya[] }) {
  return (
    <Card className="overflow-hidden rounded-xl">
      <section aria-labelledby="draf-anda">
        <header className="flex items-center gap-2 px-4 pt-3.5">
          <PencilLine className="size-4 text-warning" aria-hidden />
          <h2 id="draf-anda" className="text-sm font-semibold text-fg">
            Lanjutkan draf Anda
          </h2>
          <span className="rounded-full bg-warning-soft px-1.5 text-[11px] font-semibold leading-[1.125rem] text-warning tabular">
            {draf.length}
          </span>
        </header>
        <ul className="flex gap-2.5 overflow-x-auto px-4 pb-4 pt-3">
          {draf.map((d) => (
            <li key={d.id} className="shrink-0">
              <Link
                href={`/form-rm/isian/${d.id}`}
                className="group flex h-full w-64 items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-xs transition-[border-color,box-shadow] hover:border-warning/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{d.namaPasien}</span>
                  {d.ringkas && <span className="block truncate text-xs text-fg">{d.ringkas}</span>}
                  <span className="block truncate text-xs text-fg-muted">
                    RM {d.norm}
                    {d.ruang ? ` · ${d.ruang}` : ""}
                  </span>
                  <span className="mt-1 block text-[11px] text-fg-subtle">Diubah {formatDateTime(d.updatedAt)}</span>
                </span>
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Card>
  );
}
