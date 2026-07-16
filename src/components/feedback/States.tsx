import { AlertTriangle, Inbox, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

function Shell({
  icon: Icon,
  iconClass,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  iconClass?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className={`mb-4 flex size-12 items-center justify-center rounded-full ${iconClass ?? "bg-surface-2 text-fg-subtle"}`}>
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title = "Tidak ada data",
  description = "Coba ubah rentang tanggal atau kata kunci pencarian.",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return <Shell icon={Inbox} title={title} description={description} action={action} />;
}

export function ErrorState({
  title = "Gagal memuat data",
  description = "Terjadi kesalahan saat mengambil data. Silakan coba lagi.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Shell
      icon={AlertTriangle}
      iconClass="bg-danger-soft text-danger"
      title={title}
      description={description}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Coba lagi
          </Button>
        ) : undefined
      }
    />
  );
}
