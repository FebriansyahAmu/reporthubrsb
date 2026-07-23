import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { TASK_META, type AntreanBpjs } from "@/lib/types";

/** Pelacak 7-task ringkas: titik + konektor. Hijau=selesai, kuning(pulse)=berjalan, abu=belum. */
export function TaskTracker({ antrean }: { antrean: AntreanBpjs }) {
  const currentIdx = antrean.currentTaskId ? antrean.currentTaskId - 1 : -1;

  return (
    <div className="flex items-center" role="img" aria-label="Progres task antrean">
      {antrean.tasks.map((task, idx) => {
        const done = !!task.waktu;
        const isCurrent = idx === currentIdx;
        const meta = TASK_META[idx];
        const nextDone = idx < 6 && !!antrean.tasks[idx + 1].waktu;

        return (
          <div key={task.taskId} className="flex items-center">
            <span
              title={`${meta.kode} · ${meta.nama}${task.waktu ? ` — ${formatTime(task.waktu)}` : " — belum tercatat"}`}
              className={cn(
                "relative flex size-[18px] items-center justify-center rounded-full text-[9px] font-semibold transition-colors",
                done && "bg-brand text-brand-fg",
                isCurrent && "border-2 border-warning bg-warning-soft text-warning",
                !done && !isCurrent && "border border-border bg-surface-2 text-fg-subtle",
              )}
            >
              {done ? (
                <Check className="size-3" strokeWidth={3} />
              ) : (
                task.taskId
              )}
              {isCurrent && (
                <span className="absolute inline-flex size-full animate-ping rounded-full border-2 border-warning opacity-60" />
              )}
            </span>
            {idx < 6 && (
              <span
                className={cn(
                  "h-0.5 w-3 sm:w-4",
                  nextDone ? "bg-brand" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
