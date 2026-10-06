import { Ban, Lock, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { StatusIsian } from "@/features/form-rm/isian.status";

export const LABEL_STATUS: Record<StatusIsian, string> = { DRAF: "Draf", FINAL: "Final", BATAL: "Batal" };

const META = {
  DRAF: { tone: "warning", icon: PencilLine },
  FINAL: { tone: "success", icon: Lock },
  BATAL: { tone: "danger", icon: Ban },
} as const;

/** Status isian: warna + ikon + teks (tak hanya warna). */
export function StatusIsianBadge({ status }: { status: StatusIsian }) {
  const { tone, icon: Icon } = META[status];
  return (
    <Badge tone={tone}>
      <Icon className="size-3.5" aria-hidden />
      {LABEL_STATUS[status]}
    </Badge>
  );
}
