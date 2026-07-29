import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BedDouble,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  FileCheck,
  FileText,
  FileWarning,
  Printer,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TurunanCollapse } from "@/components/report/TurunanCollapse";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { getBerkasDetail } from "@/server/modules/berkas-klaim/berkas-klaim.service";
import type {
  DokumenBerkas,
  DokumenStatus,
  KategoriKunjungan,
} from "@/server/modules/berkas-klaim/berkas-klaim.types";

export const metadata = { title: "Detail Berkas Klaim · ReportHub RSB" };
export const dynamic = "force-dynamic";

const KATEGORI_TONE: Record<KategoriKunjungan, "brand" | "accent" | "warning"> = {
  "Rawat Inap": "brand",
  "Rawat Jalan Klinik": "accent",
  IGD: "warning",
};

const DOC_ICON: Record<DokumenBerkas["icon"], LucideIcon> = {
  "rekam-medis": FileText,
  triase: Activity,
  sep: ShieldCheck,
  spri: BedDouble,
  bukti: FileCheck,
  cppt: ClipboardList,
  resume: ClipboardCheck,
};

const STATUS_META: Record<
  DokumenStatus,
  { label: string; tone: "success" | "danger" | "warning" | "brand"; card: string; icon: string }
> = {
  ADA: {
    label: "Tersedia",
    tone: "success",
    card: "border-success/40 bg-success-soft",
    icon: "bg-success/15 text-success",
  },
  TIDAK: {
    label: "Belum ada",
    tone: "danger",
    card: "border-danger/40 bg-danger-soft",
    icon: "bg-danger/15 text-danger",
  },
  PENDING: {
    label: "Belum terhubung",
    tone: "warning",
    card: "border-warning/40 bg-warning-soft",
    icon: "bg-warning/15 text-warning",
  },
  NA: {
    label: "Tidak berlaku",
    tone: "brand",
    card: "border-border bg-surface opacity-70",
    icon: "bg-surface-2 text-fg-subtle",
  },
};

export default async function BerkasDetailPage({
  params,
}: {
  params: Promise<{ nopen: string }>;
}) {
  const { nopen } = await params;
  const detail = await getBerkasDetail(nopen);

  if (!detail) {
    return (
      <FadeIn className="space-y-6">
        <BackLink />
        <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
            <FileWarning className="size-7" />
          </div>
          <h1 className="text-lg font-semibold text-fg">Berkas tidak ditemukan</h1>
          <p className="mt-1 max-w-md text-sm text-fg-muted">
            NOPEN <span className="font-mono">{nopen}</span> tidak ditemukan atau pendaftarannya
            tidak aktif.
          </p>
        </Card>
      </FadeIn>
    );
  }

  const ada = detail.dokumen.filter((d) => d.status === "ADA").length;
  const perlu = detail.dokumen.filter((d) => d.status === "TIDAK").length;

  return (
    <FadeIn className="space-y-6">
      <BackLink />

      <PageHeader
        title={detail.nama}
        description={`No. RM ${detail.norm} · NOPEN ${detail.nopen}`}
      />

      {/* Ringkasan pasien */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <Badge tone={KATEGORI_TONE[detail.kategori]}>{detail.kategori}</Badge>
              <span className="text-fg-muted">
                {detail.jenisKelamin}
                {detail.umur ? ` · ${detail.umur}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 text-fg">
              <DoorOpen className="size-4 text-fg-subtle" />
              {detail.ruangUtama}
            </div>
            <div className="flex items-center gap-2 text-fg-muted">
              <span className="text-fg">Masuk {formatDateTime(detail.masuk)}</span>
              {detail.keluar && <span>· Keluar {formatDateTime(detail.keluar)}</span>}
            </div>
          </div>
          <div className="flex gap-4">
            <Metric label="Dokumen siap" value={ada} tone="text-success" />
            <Metric label="Perlu dilengkapi" value={perlu} tone="text-danger" />
          </div>
        </div>

        {detail.turunan.length > 0 && (
          <div className="mt-4">
            <TurunanCollapse turunan={detail.turunan} />
          </div>
        )}
      </Card>

      {/* Grid kartu dokumen */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-subtle">
          Dokumen Berkas Klaim
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {detail.dokumen.map((doc) => (
            <DokumenCard key={doc.key} doc={doc} />
          ))}
        </div>
        <p className="mt-3 text-xs text-fg-subtle">
          Kartu hijau berarti datanya sudah ada &amp; siap dicetak. <span className="text-warning">SEP</span> dan{" "}
          <span className="text-warning">Bukti Pelayanan</span> belum terhubung (perlu pemetaan BPJS lebih lanjut).
        </p>
      </div>
    </FadeIn>
  );
}

function DokumenCard({ doc }: { doc: DokumenBerkas }) {
  const meta = STATUS_META[doc.status];
  const Icon = DOC_ICON[doc.icon];
  const canPrint = doc.status === "ADA" && !!doc.printHref;

  return (
    <div className={cn("flex flex-col rounded-[var(--radius-lg)] border p-4 shadow-xs", meta.card)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]", meta.icon)}>
            <Icon className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg">{doc.label}</p>
            <p className="truncate text-xs text-fg-muted">{doc.keterangan}</p>
          </div>
        </div>
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </div>

      {canPrint ? (
        <Link
          href={doc.printHref as string}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-brand bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          <Printer className="size-4" />
          Cetak
        </Link>
      ) : (
        <div className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm font-medium text-fg-subtle">
          {doc.status === "PENDING" ? "Segera" : doc.status === "NA" ? "—" : "Belum tersedia"}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="text-right">
      <div className={cn("text-2xl font-bold tabular", tone)}>{value}</div>
      <div className="text-xs text-fg-muted">{label}</div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/berkas-klaim/rm"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
    >
      <ArrowLeft className="size-4" />
      Kembali ke daftar
    </Link>
  );
}
