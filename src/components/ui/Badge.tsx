import { cn } from "@/lib/cn";
import { STATUS_LABEL, type KunjunganStatus } from "@/lib/types";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-muted ring-border",
  brand: "bg-brand-soft text-brand-soft-fg ring-brand/20",
  success: "bg-success-soft text-success ring-success/20",
  warning: "bg-warning-soft text-warning ring-warning/20",
  danger: "bg-danger-soft text-danger ring-danger/20",
  accent: "bg-accent-soft text-accent ring-accent/20",
};

const dotColor: Record<Tone, string> = {
  neutral: "bg-fg-subtle",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  accent: "bg-accent",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dotColor[tone])} aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<KunjunganStatus, Tone> = {
  SELESAI: "success",
  DALAM_PROSES: "accent",
  BARU: "neutral",
  BATAL: "danger",
};

/** Badge status kunjungan — warna + titik (tidak mengandalkan warna saja). */
export function StatusBadge({ status }: { status: KunjunganStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
