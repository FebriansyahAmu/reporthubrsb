import Link from "next/link";
import { ArrowLeft, FileWarning } from "lucide-react";
import { FadeIn } from "@/components/motion/Motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import { KartuForm, KartuFormBerulang } from "@/features/form-rm/KartuFormPasien";
import { PitaKelengkapan } from "@/features/form-rm/PitaKelengkapan";
import { DAFTAR_KATEGORI, KATEGORI_FORM, MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { kelengkapanDari } from "@/features/form-rm/kelengkapan";
import { LABEL_JENIS_KUNJUNGAN } from "@/features/form-rm/registry";
import { requireAnyModule } from "@/server/rbac/guard";
import { formBoleh, hakFormRm } from "@/server/modules/form-rm/form-rm.akses";
import { jenisEpisode } from "@/server/modules/form-rm/form-rm.pasien";
import { getFormRmHeader } from "@/server/modules/form-rm/form-rm.service";
import { nopenSchema } from "@/server/modules/form-rm/isian.schema";
import { isianAktifPerNopen, isianBerulangPerNopen } from "@/server/modules/form-rm/isian.cari";

export const metadata = { title: "Formulir Pasien · Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/**
 * Alur pasien lebih dulu (PRD §6.2): semua form yang boleh dilihat untuk satu
 * episode, dikelompokkan per kategori, beserta status dan tanda wajib. Kartu
 * berwarna menurut status (kuning = draf belum final, hijau = final); grid
 * mengikuti lebar konten (container query), bukan lebar layar.
 */
export default async function ProfilPasienFormRm({ params }: { params: Promise<{ nopen: string }> }) {
  const user = await requireAnyModule(MODUL_AKSES_FORM_RM);
  const { nopen } = await params;
  const header = nopenSchema.safeParse(nopen).success ? await getFormRmHeader(nopen) : null;

  if (!header) {
    return (
      <FadeIn className="space-y-6">
        <BackLink />
        <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
            <FileWarning className="size-7" />
          </div>
          <h1 className="text-lg font-semibold text-fg">Pasien tidak ditemukan</h1>
          <p className="mt-1 max-w-md text-sm text-fg-muted">
            NOPEN <span className="font-mono">{nopen}</span> tidak ditemukan atau pendaftarannya tidak aktif.
          </p>
        </Card>
      </FadeIn>
    );
  }

  const hak = await hakFormRm(user);
  const forms = formBoleh(hak);
  const [isian, berulang, jenis] = await Promise.all([
    isianAktifPerNopen([nopen], forms.map((d) => d.kode)).then((m) => m.get(nopen) ?? {}),
    isianBerulangPerNopen(nopen, forms),
    jenisEpisode(nopen),
  ]);
  const k = kelengkapanDari(isian, forms, jenis);
  const wajib = new Set(k.formulir.filter((f) => f.wajib).map((f) => f.kode));
  const kategori = DAFTAR_KATEGORI.map((kat) => ({ kat, forms: forms.filter((d) => d.kategori === kat) })).filter(
    (g) => g.forms.length > 0,
  );

  return (
    <FadeIn className="@container space-y-6">
      <BackLink />

      {/* Sampul "map rekam medis": identitas episode + pita kelengkapan form wajib. */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 @4xl:flex-row @4xl:items-start @4xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {[...jenis].sort((x, y) => x - y).map((j) => (
                <Badge key={j} tone={j === 2 ? "warning" : j === 3 ? "brand" : "neutral"}>
                  {LABEL_JENIS_KUNJUNGAN[j]}
                </Badge>
              ))}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-fg">{header.nama}</h1>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm @xl:flex @xl:flex-wrap">
              <DataPasien label="No. RM" nilai={header.norm} />
              <DataPasien label="NOPEN" nilai={header.nopen} />
              <DataPasien label="Pasien" nilai={header.umur ? `${header.jenisKelamin}, ${header.umur}` : header.jenisKelamin} />
              <DataPasien label="Ruang" nilai={header.ruang} />
              {/* header.masuk = jam dinding SIMGOS di field UTC → buang "Z" agar tak digeser zona waktu. */}
              <DataPasien label="Masuk" nilai={formatDateTime(header.masuk.slice(0, 19))} />
            </dl>
          </div>
          <PitaKelengkapan formulir={k.formulir.filter((f) => f.wajib)} />
        </div>
      </Card>

      {kategori.map(({ kat, forms: daftar }) => {
        const KatIkon = KATEGORI_FORM[kat].ikon;
        return (
          <section key={kat} aria-labelledby={`kat-${kat}`} className="pt-2">
            <div className="mb-3 flex items-center gap-2.5">
              <KatIkon className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              <h2 id={`kat-${kat}`} className="text-sm font-semibold text-fg">
                {KATEGORI_FORM[kat].label}
              </h2>
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span className="text-xs tabular-nums text-fg-subtle">{daftar.length} form</span>
            </div>
            <div className="grid grid-cols-1 items-start gap-3 @xl:grid-cols-2 @5xl:grid-cols-3">
              {daftar.map((def) =>
                def.berulang ? (
                  <KartuFormBerulang
                    key={def.kode}
                    def={def}
                    nopen={nopen}
                    daftar={berulang[def.kode] ?? []}
                    wajib={wajib.has(def.kode)}
                    bolehBuat={hak.boleh(def.kategori, "create")}
                  />
                ) : (
                  <KartuForm
                    key={def.kode}
                    def={def}
                    nopen={nopen}
                    isian={isian[def.kode]}
                    wajib={wajib.has(def.kode)}
                    bolehBuat={hak.boleh(def.kategori, "create")}
                  />
                ),
              )}
            </div>
          </section>
        );
      })}

      <p className="text-xs text-fg-subtle">
        Form diisi petugas dan disimpan ke AuditTrail RS BOLTIM (SIMRS tetap read-only). Isian final terkunci; koreksi hanya
        oleh pengelola rekam medis. Form wajib ditentukan dari jenis kunjungan episode.
      </p>
    </FadeIn>
  );
}

function DataPasien({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums wrap-break-word text-fg">{nilai || "-"}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/form-rm/pasien"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
    >
      <ArrowLeft className="size-4" />
      Kembali ke daftar pasien
    </Link>
  );
}
