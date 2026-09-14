import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Fallback saat halaman detail Berkas Klaim memuat data SIMGOS (server component).
 * Kehadiran loading.tsx juga membatasi biaya prefetch/navigasi Next.js: hanya
 * shell statis ini yang di-prefetch, bukan render dinamis penuh.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-36 rounded" />

      <div className="space-y-2">
        <Skeleton className="h-7 w-64 rounded" />
        <Skeleton className="h-4 w-48 rounded" />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-12 w-16 rounded" />
            <Skeleton className="h-12 w-16 rounded" />
          </div>
        </div>
        <Skeleton className="mt-4 h-16 w-full rounded-[var(--radius-md)]" />
      </Card>

      <div>
        <Skeleton className="mb-3 h-4 w-48 rounded" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-2.5">
                <Skeleton className="size-9 rounded-[var(--radius-md)]" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
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
