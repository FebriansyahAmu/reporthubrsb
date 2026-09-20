import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

/** Placeholder rapi untuk fitur inventaris yang belum dibangun (per roadmap sesi). */
export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-[var(--radius-lg)] bg-brand-soft text-brand">
        <Icon className="size-7" />
      </div>
      <div className="mb-2">
        <Badge tone="warning" dot>
          Segera hadir
        </Badge>
      </div>
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-fg-muted">{description}</p>
    </Card>
  );
}
