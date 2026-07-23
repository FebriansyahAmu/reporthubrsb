import { Check, Clock, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTime, formatDurasi } from "@/lib/format";
import {
  SEGMEN_LABEL,
  TASK_META,
  type AntreanBpjs,
  type TaskId,
} from "@/lib/types";

/** Timeline vertikal detail 7 task: waktu tiap task + durasi antar-task (tunggu/layan). */
export function TaskTimeline({
  antrean,
  onEditTask,
}: {
  antrean: AntreanBpjs;
  onEditTask?: (taskId: TaskId) => void;
}) {
  const currentIdx = antrean.currentTaskId ? antrean.currentTaskId - 1 : -1;

  return (
    <ol className="relative">
      {antrean.tasks.map((task, idx) => {
        const done = !!task.waktu;
        const isCurrent = idx === currentIdx;
        const meta = TASK_META[idx];

        // durasi ke task berikutnya (segmen idx: T_{idx+1} → T_{idx+2})
        const next = antrean.tasks[idx + 1];
        const segMenit =
          task.waktu && next?.waktu
            ? Math.round((+new Date(next.waktu) - +new Date(task.waktu)) / 60000)
            : null;
        const isWait = idx % 2 === 0; // T1→T2 tunggu, T2→T3 layan, dst.

        return (
          <li key={task.taskId} className="flex gap-3 pb-1">
            {/* Rail */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[10px] font-semibold",
                  done && "bg-brand text-brand-fg",
                  isCurrent && "border-2 border-warning bg-warning-soft text-warning",
                  !done && !isCurrent && "border border-border bg-surface-2 text-fg-subtle",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : task.taskId}
              </span>
              {idx < 6 && (
                <span
                  className={cn(
                    "w-0.5 flex-1",
                    next?.waktu ? "bg-brand" : "bg-border",
                  )}
                />
              )}
            </div>

            {/* Konten */}
            <div className="flex-1 pb-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-fg">
                  {meta.kode} · {meta.nama}
                </span>
                {done ? (
                  <span className="inline-flex items-center gap-1 text-xs text-fg-muted tabular">
                    <Clock className="size-3" /> {formatTime(task.waktu)}
                  </span>
                ) : isCurrent ? (
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                    Menunggu · tertahan {formatDurasi(antrean.menitTertahan)}
                  </span>
                ) : (
                  <span className="text-xs text-fg-subtle">Belum tercatat</span>
                )}

                {onEditTask && (
                  <button
                    type="button"
                    onClick={() => onEditTask(task.taskId)}
                    className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                  >
                    <Pencil className="size-3" />
                    {done ? "Ubah" : "Isi waktu"}
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-xs text-fg-muted">{meta.deskripsi}</p>

              {segMenit != null && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-[11px]">
                  <span className="text-fg-subtle">{SEGMEN_LABEL[idx]}</span>
                  <span
                    className={cn(
                      "font-medium tabular",
                      isWait ? "text-accent" : "text-fg",
                    )}
                  >
                    {formatDurasi(segMenit)}
                  </span>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
