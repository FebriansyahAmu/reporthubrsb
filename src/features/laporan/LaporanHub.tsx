import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import {
  LAPORAN_CATALOG,
  LAPORAN_TERSEDIA,
  LAPORAN_TOTAL,
  type ReportItem,
} from "./catalog";

export function LaporanHub() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <Badge tone="brand">{LAPORAN_TERSEDIA} tersedia</Badge>
        <span>dari {LAPORAN_TOTAL} laporan terencana</span>
      </div>

      {LAPORAN_CATALOG.map((group) => (
        <section key={group.title}>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-fg">{group.title}</h2>
            <p className="text-xs text-fg-muted">{group.description}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => (
              <ReportCard key={item.title} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ReportCard({ item }: { item: ReportItem }) {
  const Icon = item.icon;
  const available = item.status === "tersedia" && item.href;

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-[var(--radius-md)]",
            available ? "bg-brand-soft text-brand" : "bg-surface-2 text-fg-subtle",
          )}
        >
          <Icon className="size-5" />
        </div>
        {available ? (
          <ArrowRight className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
        ) : (
          <Badge tone="neutral">Segera</Badge>
        )}
      </div>
      <div className="mt-3">
        <h3 className={cn("text-sm font-semibold", available ? "text-fg" : "text-fg-muted")}>
          {item.title}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">{item.description}</p>
      </div>
    </>
  );

  const base =
    "group flex flex-col rounded-[var(--radius-lg)] border p-4 transition-all";

  if (available) {
    return (
      <Link
        href={item.href!}
        className={cn(
          base,
          "border-border bg-surface hover:border-brand/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        )}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className={cn(base, "cursor-not-allowed border-dashed border-border bg-surface/60")} aria-disabled>
      {inner}
    </div>
  );
}
