"use client";

import { useState } from "react";
import { ArrowRight, Info, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { formatTime, isoToTimeInput, timeInputToIso } from "@/lib/format";
import { TASK_META, type TaskId } from "@/lib/types";

export type EditTarget = {
  antreanId: string;
  namaPasien: string;
  noAntrean: string;
  tanggal: string;
  taskId: TaskId;
  currentWaktu: string | null;
};

/** Konfirmasi box untuk mengubah / mengisi waktu sebuah task antrean. */
export function EditTaskDialog({
  target,
  onConfirm,
  onCancel,
}: {
  target: EditTarget | null;
  onConfirm: (iso: string) => void;
  onCancel: () => void;
}) {
  const [time, setTime] = useState("");

  // Inisialisasi nilai saat target berganti (pola render-phase, bebas efek).
  const targetKey = target ? `${target.antreanId}:${target.taskId}` : null;
  const [seen, setSeen] = useState<string | null>(null);
  if (target && targetKey !== seen) {
    setSeen(targetKey);
    setTime(target.currentWaktu ? isoToTimeInput(target.currentWaktu) : "");
  }

  const meta = target ? TASK_META[target.taskId - 1] : null;
  const changed =
    !!target &&
    !!time &&
    (target.currentWaktu ? isoToTimeInput(target.currentWaktu) !== time : true);

  function handleConfirm() {
    if (!target || !time) return;
    onConfirm(timeInputToIso(target.tanggal, time));
  }

  return (
    <Modal
      open={!!target}
      onClose={onCancel}
      title="Ubah Waktu Task"
      description={meta ? `${meta.kode} · ${meta.nama}` : undefined}
      icon={
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
          <Pencil className="size-4" />
        </div>
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Batal
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!changed}>
            Simpan Perubahan
          </Button>
        </>
      }
    >
      {target && meta && (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-md)] bg-surface-2 px-3 py-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-fg-muted">Pasien</span>
              <span className="font-medium text-fg">{target.namaPasien}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-fg-muted">No. Antrean</span>
              <span className="font-medium text-fg tabular">{target.noAntrean}</span>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label>Waktu sebelumnya</Label>
              <div className="flex h-10 items-center rounded-[var(--radius-md)] border border-dashed border-border px-3 text-sm text-fg-muted tabular">
                {target.currentWaktu ? formatTime(target.currentWaktu) : "Belum tercatat"}
              </div>
            </div>
            <ArrowRight className="mb-2.5 size-4 shrink-0 text-fg-subtle" />
            <div className="flex-1">
              <Label htmlFor="waktu-task">Waktu baru</Label>
              <Input
                id="waktu-task"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-fg-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Koreksi waktu dikirim ke Antrean RS BPJS (updatewaktu). Tidak mengubah data
            SIMGOS.
          </p>
        </div>
      )}
    </Modal>
  );
}
