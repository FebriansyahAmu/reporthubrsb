import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  DoorOpen,
  FileHeart,
  FileSignature,
  FileText,
  FileWarning,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { getFormRmHeader, formRmExists } from "@/server/modules/form-rm/form-rm.service";
import { EDUKASI_JENIS } from "@/features/form-rm/edukasi.constants";
import { CONSENT_JENIS } from "@/features/form-rm/consent.constants";

export const metadata = { title: "Detail Form RM · ReportHub RSB" };
export const dynamic = "force-dynamic";

type FormCardData = {
  key: string;
  kode: string;
  label: string;
  icon: LucideIcon;
  desc: string;
  href?: string;
  terisi?: boolean;
};

export default async function FormRmDetailPage({
  params,
}: {
  params: Promise<{ nopen: string }>;
}) {
  const { nopen } = await params;
  const header = await getFormRmHeader(nopen);

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

  const [edukasiTerisi, consentTerisi] = await Promise.all([
    formRmExists(nopen, EDUKASI_JENIS).catch(() => false),
    formRmExists(nopen, CONSENT_JENIS).catch(() => false),
  ]);

  const forms: FormCardData[] = [
    {
      key: "edukasi",
      kode: "RM.21",
      label: "Edukasi Pasien & Keluarga Terintegrasi",
      icon: GraduationCap,
      desc: "Persiapan edukasi, kebutuhan & catatan edukasi pasien/keluarga.",
      href: `/form-rm/${nopen}/edukasi`,
      terisi: edukasiTerisi,
    },
    {
      key: "ringkasan",
      kode: "RM.01",
      label: "Ringkasan Masuk & Keluar",
      icon: FileText,
      desc: "Ringkasan data masuk dan keluar rawat inap.",
    },
    {
      key: "consent",
      kode: "RM.03",
      label: "Persetujuan Umum (General Consent)",
      icon: FileHeart,
      desc: "Persetujuan umum rawat inap pasien.",
      href: `/form-rm/${nopen}/consent`,
      terisi: consentTerisi,
    },
  ];

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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {forms.map((f) => (
            <FormCard key={f.key} form={f} />
          ))}
        </div>
        <p className="mt-3 text-xs text-fg-subtle">
          Form diisi sendiri oleh admisi/petugas dan disimpan ke ReportHub (SIMRS tetap
          read-only). RM.01 menyusul.
        </p>
      </div>
    </FadeIn>
  );
}

function FormCard({ form }: { form: FormCardData }) {
  const Icon = form.icon;
  const available = !!form.href;

  return (
    <div
      className={cn(
        "flex flex-col rounded-[var(--radius-lg)] border p-4 shadow-xs",
        available
          ? form.terisi
            ? "border-success/40 bg-success-soft"
            : "border-border bg-surface"
          : "border-border bg-surface opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
              form.terisi ? "bg-success/15 text-success" : "bg-brand-soft text-brand-soft-fg",
            )}
          >
            <Icon className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg">
              <span className="font-mono text-xs text-fg-subtle">{form.kode}</span> · {form.label}
            </p>
            <p className="truncate text-xs text-fg-muted">{form.desc}</p>
          </div>
        </div>
        {available ? (
          <Badge tone={form.terisi ? "success" : "brand"} dot>
            {form.terisi ? "Terisi" : "Kosong"}
          </Badge>
        ) : (
          <Badge tone="warning">Segera</Badge>
        )}
      </div>

      {available ? (
        <Link
          href={form.href as string}
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-brand bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          <FileSignature className="size-4" />
          {form.terisi ? "Lihat / Edit" : "Isi Form"}
          <ArrowRight className="size-4" />
        </Link>
      ) : (
        <div className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm font-medium text-fg-subtle">
          Segera hadir
        </div>
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
