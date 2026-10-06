import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Fallback saat halaman detail Form RM memuat header pasien (SIMGOS). Kehadiran
 * loading.tsx membatasi biaya prefetch/navigasi Next.js (hanya shell statis ini).
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-36 rounded" />

      <div className="space-y-2">
        <Skeleton className="h-7 w-56 rounded" />
        <Skeleton className="h-4 w-48 rounded" />
      </div>

      <Card className="p-5">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-4 w-48 rounded" />
        </div>
      </Card>

      <div>
        <Skeleton className="mb-3 h-4 w-44 rounded" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-2.5">
                <Skeleton className="size-9 rounded-[var(--radius-md)]" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                </div>
              </div>
              <Skeleton className="mt-4 h-9 w-full rounded-[var(--radius-md)]" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
