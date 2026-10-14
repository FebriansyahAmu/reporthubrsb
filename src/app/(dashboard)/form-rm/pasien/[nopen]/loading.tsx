import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Fallback saat profil pasien Form RM memuat header pasien (SIMGOS). Kehadiran
 * loading.tsx membatasi biaya prefetch/navigasi Next.js (hanya shell statis ini).
 * Rute ini tak pernah `redirect()` / `notFound()` — keduanya jadi meta-tag
 * berstatus 200 di bawah boundary loading. Bentuk = tata letak halaman (sampul +
 * pita kelengkapan, grid kartu ber-container query) agar tak melompat saat tampil.
 */
export default function Loading() {
  return (
    <div className="@container space-y-6">
      <Skeleton className="h-5 w-40 rounded" />

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 @4xl:flex-row @4xl:items-start @4xl:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-7 w-64 max-w-full rounded" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 @xl:flex @xl:flex-wrap">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-12 rounded" />
                  <Skeleton className="h-4 w-24 rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-bg p-4 @4xl:w-[24rem] @4xl:shrink-0">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-48 rounded" />
          </div>
        </div>
      </Card>

      <div className="pt-2">
        <Skeleton className="mb-3 h-4 w-48 rounded" />
        <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @5xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-10 rounded-[var(--radius-md)]" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                </div>
              </div>
              <Skeleton className="mt-4 h-5 w-28 rounded-full" />
              <Skeleton className="mt-4 h-10 w-full rounded-[var(--radius-md)]" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
