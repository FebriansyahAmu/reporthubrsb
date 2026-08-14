"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Lanjutkan",
  tone = "brand",
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "brand" | "danger";
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      dismissible={!busy}
      icon={
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${
            tone === "danger" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-soft-fg"
          }`}
        >
          <AlertTriangle className="size-4.5" />
        </div>
      }
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Batal
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-fg-muted">{description}</p>
        {error && (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
