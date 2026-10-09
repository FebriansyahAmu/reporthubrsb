import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, DoorOpen, FileWarning } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { DAFTAR_KATEGORI, KATEGORI_FORM, MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { kelengkapanDari } from "@/features/form-rm/kelengkapan";
import { LABEL_JENIS_KUNJUNGAN, type DefinisiForm } from "@/features/form-rm/registry";
import { TAMPILAN_FORM } from "@/features/form-rm/tampilan";
import { BukaIsianButton } from "@/features/form-rm/isian/BukaIsianButton";
import { StatusIsianBadge } from "@/features/form-rm/isian/StatusIsianBadge";
import { requireAnyModule } from "@/server/rbac/guard";
import { formBoleh, hakFormRm } from "@/server/modules/form-rm/form-rm.akses";
import { jenisEpisode } from "@/server/modules/form-rm/form-rm.pasien";
import { getFormRmHeader } from "@/server/modules/form-rm/form-rm.service";
import { nopenSchema } from "@/server/modules/form-rm/isian.schema";
import { isianAktifPerNopen, isianBerulangPerNopen } from "@/server/modules/form-rm/isian.cari";
import type { IsianBerulang, RingkasIsian } from "@/server/modules/form-rm/isian.types";

export const metadata = { title: "Formulir Pasien · Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

/**
 * Alur pasien lebih dulu (PRD §6.2): semua form yang boleh dilihat untuk satu
 * episode, dikelompokkan per kategori, beserta status dan tanda wajib.
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
    <FadeIn className="space-y-6">
      <BackLink />

      <PageHeader title={header.nama} description={`No. RM ${header.norm} · NOPEN ${header.nopen}`} />

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 text-sm">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {[...jenis].sort((x, y) => x - y).map((j) => (
                <Badge key={j} tone={j === 2 ? "warning" : j === 3 ? "brand" : "neutral"}>
                  {LABEL_JENIS_KUNJUNGAN[j]}
                </Badge>
              ))}
              <span className="text-fg-muted">
                {header.jenisKelamin}
                {header.umur ? ` · ${header.umur}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 text-fg">
              <DoorOpen className="size-4 text-fg-subtle" />
              {header.ruang}
            </div>
            {/* header.masuk = jam dinding SIMGOS di field UTC → buang "Z" agar tak digeser zona waktu. */}
            <div className="text-fg">Masuk {formatDateTime(header.masuk.slice(0, 19))}</div>
          </div>
          <RingkasKelengkapan lengkap={k.lengkap} final={k.final} total={k.total} />
        </div>
      </Card>

      {kategori.map(({ kat, forms: daftar }) => (
        <section key={kat} aria-labelledby={`kat-${kat}`}>
          <h2 id={`kat-${kat}`} className="mb-3 text-sm font-semibold text-fg">
            {KATEGORI_FORM[kat].label}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {daftar.map((def) =>
              def.berulang ? (
                <FormBerulangCard
                  key={def.kode}
                  def={def}
                  nopen={nopen}
                  daftar={berulang[def.kode] ?? []}
                  wajib={wajib.has(def.kode)}
                  bolehBuat={hak.boleh(def.kategori, "create")}
                />
              ) : (
                <FormCard
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
      ))}

      <p className="text-xs text-fg-subtle">
        Form diisi petugas dan disimpan ke AuditTrail RS BOLTIM (SIMRS tetap read-only). Isian FINAL terkunci; koreksi hanya
        oleh pengelola rekam medis. Form wajib ditentukan dari jenis kunjungan episode.
      </p>
    </FadeIn>
  );
}

function RingkasKelengkapan({ lengkap, final, total }: { lengkap: boolean; final: number; total: number }) {
  if (total === 0) return <Badge tone="neutral">Tidak ada form wajib</Badge>;
  if (lengkap) {
    return (
      <Badge tone="success">
        <CheckCircle2 className="size-3.5" /> Lengkap — {total} form wajib final
      </Badge>
    );
  }
  return (
    <Badge tone="warning">
      {final}/{total} form wajib final
    </Badge>
  );
}

function FormCard({
  def,
  nopen,
  isian,
  wajib,
  bolehBuat,
}: {
  def: DefinisiForm;
  nopen: string;
  isian: RingkasIsian | undefined;
  wajib: boolean;
  bolehBuat: boolean;
}) {
  const t = TAMPILAN_FORM[def.kode];
  const Icon = t.ikon;
  const final = isian?.status === "FINAL";

  return (
    <div
      className={cn(
        "flex flex-col rounded-[var(--radius-lg)] border p-4 shadow-xs",
        final ? "border-success/40 bg-success-soft" : "border-border bg-surface",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
              final ? "bg-success/15 text-success" : "bg-brand-soft text-brand-soft-fg",
            )}
          >
            <Icon className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg">
              <span className="font-mono text-xs text-fg-subtle">{def.kode}</span> · {t.label}
            </p>
            <p className="truncate text-xs text-fg-muted">{wajib ? "Wajib untuk episode ini" : "Tidak wajib untuk episode ini"}</p>
          </div>
        </div>
        {isian ? <StatusIsianBadge status={isian.status} /> : <Badge tone="neutral">Belum ada</Badge>}
      </div>

      {isian ? (
        <Link
          href={`/form-rm/isian/${isian.id}`}
          className="mt-4 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-brand bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          {final ? "Lihat Isian" : "Lanjutkan Isian"}
          <ArrowRight className="size-4" />
        </Link>
      ) : bolehBuat ? (
        <BukaIsianButton kode={def.kode} nopen={nopen} />
      ) : (
        <p className="mt-4 rounded-[var(--radius-md)] border border-dashed border-border px-3 py-2 text-center text-xs text-fg-subtle">
          Belum diisi
        </p>
      )}
    </div>
  );
}

/**
 * Form berulang (mis. RM.22 per tindakan, RM.33 per rujukan): semua isian aktif
 * pasien, masing-masing dengan pembedanya (`ringkasIsian`: tindakan/tujuan +
 * keputusan), dan tombol menambah isian baru. Selebar dua kolom agar judul tak
 * terpotong.
 */
function FormBerulangCard({
  def,
  nopen,
  daftar,
  wajib,
  bolehBuat,
}: {
  def: DefinisiForm;
  nopen: string;
  daftar: IsianBerulang[];
  wajib: boolean;
  bolehBuat: boolean;
}) {
  const t = TAMPILAN_FORM[def.kode];
  const Icon = t.ikon;
  const final = daftar.filter((x) => x.status === "FINAL").length;
  const satuan = t.berulang?.satuan ?? "kejadian";

  return (
    <div
      id={`form-${def.kode}`}
      className="flex scroll-mt-24 flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs sm:col-span-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand-soft-fg">
            <Icon className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-fg">
              <span className="font-mono text-xs text-fg-subtle">{def.kode}</span> · {t.label}
            </p>
            <p className="text-xs text-fg-muted">
              Satu isian per {satuan} · {wajib ? "Wajib untuk episode ini" : (t.berulang?.bila ?? "Tidak wajib")}
            </p>
          </div>
        </div>
        {daftar.length > 0 ? (
          <Badge tone={final === daftar.length ? "success" : "warning"}>
            {final}/{daftar.length} final
          </Badge>
        ) : (
          <Badge tone="neutral">Belum ada</Badge>
        )}
      </div>

      {daftar.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-[var(--radius-md)] border border-border">
          {daftar.map((x) => (
            <li key={x.id}>
              <Link
                href={`/form-rm/isian/${x.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 transition-colors hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring"
              >
                <span className="font-mono text-xs text-fg-subtle">#{x.urutan}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{x.judul}</span>
                {x.lencana && <Badge tone={x.lencana.nada}>{x.lencana.label}</Badge>}
                <StatusIsianBadge status={x.status} />
                <span className="text-xs text-fg-subtle">{formatDateTime(x.updatedAt)}</span>
                <ArrowRight className="size-4 text-fg-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {bolehBuat ? (
        <BukaIsianButton
          kode={def.kode}
          nopen={nopen}
          label={daftar.length > 0 ? `Tambah isian (${satuan} lain)` : "Isi Form"}
          varian={daftar.length > 0 ? "kedua" : "utama"}
          className="mt-3 self-start"
        />
      ) : (
        daftar.length === 0 && (
          <p className="mt-4 rounded-[var(--radius-md)] border border-dashed border-border px-3 py-2 text-center text-xs text-fg-subtle">
            Belum diisi
          </p>
        )
      )}
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
