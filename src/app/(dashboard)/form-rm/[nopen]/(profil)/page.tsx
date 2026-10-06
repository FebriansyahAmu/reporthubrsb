import Link from "next/link";
import { ArrowLeft, ArrowRight, DoorOpen, FileWarning } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { DEFINISI_FORM, type DefinisiForm } from "@/features/form-rm/registry";
import { TAMPILAN_FORM } from "@/features/form-rm/tampilan";
import { BukaIsianButton } from "@/features/form-rm/isian/BukaIsianButton";
import { StatusIsianBadge } from "@/features/form-rm/isian/StatusIsianBadge";
import { hasModule, requireModule } from "@/server/rbac/guard";
import { getFormRmHeader } from "@/server/modules/form-rm/form-rm.service";
import { nopenSchema } from "@/server/modules/form-rm/isian.schema";
import { isianAktifPerNopen } from "@/server/modules/form-rm/isian.cari";
import type { RingkasIsian } from "@/server/modules/form-rm/isian.types";

export const metadata = { title: "Detail Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function FormRmDetailPage({
  params,
}: {
  params: Promise<{ nopen: string }>;
}) {
  const user = await requireModule("form-rm", "view");
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
            NOPEN <span className="font-mono">{nopen}</span> tidak ditemukan atau pendaftarannya
            tidak aktif.
          </p>
        </Card>
      </FadeIn>
    );
  }

  const [isian, bolehBuat] = await Promise.all([
    isianAktifPerNopen([nopen]).then((m) => m.get(nopen) ?? {}),
    hasModule(user, "form-rm", "create"),
  ]);

  return (
    <FadeIn className="space-y-6">
      <BackLink />

      <PageHeader
        title={header.nama}
        description={`No. RM ${header.norm} · NOPEN ${header.nopen}`}
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 text-sm">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge tone="warning">IGD</Badge>
              <span className="text-fg-muted">
                {header.jenisKelamin}
                {header.umur ? ` · ${header.umur}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 text-fg">
              <DoorOpen className="size-4 text-fg-subtle" />
              {header.ruang}
            </div>
            <div className="text-fg-muted">
              <span className="text-fg">Masuk {formatDateTime(header.masuk)}</span>
            </div>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-subtle">
          Formulir Rekam Medis
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {DEFINISI_FORM.map((def) => (
            <FormCard key={def.kode} def={def} nopen={nopen} isian={isian[def.kode]} bolehBuat={bolehBuat} />
          ))}
        </div>
        <p className="mt-3 text-xs text-fg-subtle">
          Form diisi petugas dan disimpan ke AuditTrail RS BOLTIM (SIMRS tetap read-only). Isian
          FINAL terkunci; koreksi hanya oleh pengelola rekam medis.
        </p>
      </div>
    </FadeIn>
  );
}

function FormCard({
  def,
  nopen,
  isian,
  bolehBuat,
}: {
  def: DefinisiForm;
  nopen: string;
  isian: RingkasIsian | undefined;
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
            <p className="truncate text-xs text-fg-muted">{t.keterangan}</p>
          </div>
        </div>
        {isian ? <StatusIsianBadge status={isian.status} /> : <Badge tone="neutral">Belum ada</Badge>}
      </div>

      {isian ? (
        <Link
          href={`/form-rm/isian/${isian.id}`}
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-brand bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
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

function BackLink() {
  return (
    <Link
      href="/form-rm"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
    >
      <ArrowLeft className="size-4" />
      Kembali ke daftar
    </Link>
  );
}
