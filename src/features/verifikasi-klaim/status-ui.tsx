import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  FileCheck2,
  FileX2,
  Lock,
  PenLine,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { STATUS_META, type StatusVerifikasi } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import type { StatusHasil } from "@/server/modules/verifikasi-klaim/verifikasi.types";

/** Visual status verifikasi & hasil cek — status tak pernah hanya warna (ikon + teks). */

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";

export const STATUS_UI: Record<StatusVerifikasi, { icon: LucideIcon; tone: BadgeTone }> = {
  BELUM_DIPERIKSA: { icon: CircleDashed, tone: "neutral" },
  TIDAK_LENGKAP: { icon: FileX2, tone: "danger" },
  LOLOS_RM: { icon: ClipboardCheck, tone: "brand" },
  KOREKSI_KODING: { icon: PenLine, tone: "warning" },
  LOLOS_KLAIM: { icon: FileCheck2, tone: "accent" },
  FINAL: { icon: Lock, tone: "success" },
};

export function StatusVerifikasiBadge({ status, className }: { status: StatusVerifikasi; className?: string }) {
  const { icon: Icon, tone } = STATUS_UI[status];
  return (
    <Badge tone={tone} className={cn("whitespace-nowrap", className)}>
      <Icon className="size-3.5" aria-hidden />
      {STATUS_META[status].label}
    </Badge>
  );
}

export const HASIL_UI: Record<StatusHasil, { icon: LucideIcon; warna: string; label: string }> = {
  lolos: { icon: CheckCircle2, warna: "text-success", label: "Lolos" },
  gagal: { icon: XCircle, warna: "text-danger", label: "Gagal" },
  peringatan: { icon: AlertTriangle, warna: "text-warning", label: "Peringatan" },
};

export function HasilIcon({ status, className }: { status: StatusHasil; className?: string }) {
  const { icon: Icon, warna, label } = HASIL_UI[status];
  return <Icon className={cn("size-4 shrink-0", warna, className)} aria-label={label} role="img" />;
}
