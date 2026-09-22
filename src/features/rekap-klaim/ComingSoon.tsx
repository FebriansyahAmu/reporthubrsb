import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Badge } from "@/components/ui/Badge";

/** Placeholder halaman modul Rekap Klaim yang fiturnya menyusul (per sesi). */
export function ComingSoon({
  title,
  description,
  sesi,
}: {
  title: string;
  description: string;
  sesi: string;
}) {
  return (
    <FadeIn className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface-2/40 px-5 py-16 text-center">
        <p className="text-sm font-medium text-fg">Fitur sedang dikembangkan</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-fg-muted">
          Akan tersedia pada {sesi}.
        </p>
        <span className="mt-3 inline-flex">
          <Badge tone="neutral">Segera</Badge>
        </span>
      </div>
    </FadeIn>
  );
}
