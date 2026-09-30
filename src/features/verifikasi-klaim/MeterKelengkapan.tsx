import { cn } from "@/lib/cn";

/**
 * Meter kelengkapan tersegmen: lolos · peringatan · gagal (proporsional, celah
 * 2px) + angka "lolos/total". Warna selalu didampingi angka & label aksesibel.
 */
export function MeterKelengkapan({
  lolos,
  peringatan,
  gagal,
  total,
  className,
}: {
  lolos: number;
  peringatan: number;
  gagal: number;
  total: number;
  className?: string;
}) {
  const segmen = [
    { n: lolos, warna: "bg-success" },
    { n: peringatan, warna: "bg-warning" },
    { n: gagal, warna: "bg-danger" },
  ].filter((s) => s.n > 0);
  const label = `${lolos} dari ${total} pemeriksaan lolos${gagal ? `, ${gagal} gagal` : ""}${peringatan ? `, ${peringatan} peringatan` : ""}`;
  return (
    <div className={cn("flex items-center gap-2", className)} role="img" aria-label={label} title={label}>
      <div className="flex h-1.5 w-20 gap-0.5 overflow-hidden rounded-full bg-surface-2">
        {segmen.map((s, i) => (
          <span key={i} className={cn("h-full first:rounded-l-full last:rounded-r-full", s.warna)} style={{ flexGrow: s.n }} />
        ))}
      </div>
      <span className={cn("text-xs font-medium tabular", gagal ? "text-danger" : "text-fg-muted")}>
        {lolos}/{total}
      </span>
    </div>
  );
}
