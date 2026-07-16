import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "./Card";
import { AnimatedNumber } from "./AnimatedNumber";

type Tone = "brand" | "success" | "accent" | "danger" | "neutral";

const toneStyles: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  accent: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-2 text-fg-muted",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  loading = false,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: Tone;
  loading?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <div className={cn("flex size-8 items-center justify-center rounded-[var(--radius-md)]", toneStyles[tone])}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-fg tabular">
        {loading ? <span className="text-fg-subtle">—</span> : <AnimatedNumber value={value} />}
      </p>
    </Card>
  );
}
