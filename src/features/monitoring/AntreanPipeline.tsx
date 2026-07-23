import { cn } from "@/lib/cn";
import { TASK_META, type TaskId } from "@/lib/types";
import type { PipelineStage } from "@/lib/mock/bpjs";

/** Distribusi posisi antrean per tahap (berdasarkan task terakhir yang selesai). */
export function AntreanPipeline({
  pipeline,
  activeTahap,
  onSelect,
  loading,
}: {
  pipeline: PipelineStage[];
  activeTahap: number | "ALL";
  onSelect: (tahap: number) => void;
  loading?: boolean;
}) {
  const max = Math.max(1, ...pipeline.map((p) => p.jumlah));

  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
      {pipeline.map((stage, idx) => {
        const meta = TASK_META[idx];
        const isLast = stage.taskId === (7 as TaskId);
        const active = activeTahap === stage.taskId;
        const intensity = stage.jumlah / max;

        return (
          <div key={stage.taskId} className="flex min-w-0 flex-1 items-stretch">
            <button
              type="button"
              onClick={() => onSelect(stage.taskId)}
              aria-pressed={active}
              className={cn(
                "group relative flex min-w-[92px] flex-1 flex-col justify-between rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                active
                  ? "border-brand bg-brand-soft"
                  : "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold",
                    isLast ? "bg-success-soft text-success" : "bg-surface-2 text-fg-muted",
                  )}
                >
                  {meta.kode}
                </span>
                <span
                  className={cn(
                    "text-lg font-semibold tabular",
                    loading ? "text-fg-subtle" : active ? "text-brand" : "text-fg",
                  )}
                >
                  {loading ? "—" : stage.jumlah}
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] font-medium text-fg">
                {isLast ? "Selesai" : meta.nama}
              </p>
              {/* meter intensitas */}
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn("h-full rounded-full", isLast ? "bg-success" : "bg-brand")}
                  style={{ width: loading ? "0%" : `${Math.max(6, intensity * 100)}%` }}
                />
              </div>
            </button>
            {idx < pipeline.length - 1 && (
              <div className="flex items-center px-0.5 text-fg-subtle" aria-hidden>
                <svg viewBox="0 0 8 12" className="h-3 w-2" fill="none">
                  <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
