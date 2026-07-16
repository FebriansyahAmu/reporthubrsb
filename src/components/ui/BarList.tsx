import { cn } from "@/lib/cn";

/** Daftar bar horizontal satu-hue (teal) — mudah dibaca, tanpa warna pelangi. */
export function BarList({
  items,
  className,
}: {
  items: { label: string; jumlah: number }[];
  className?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.jumlah));
  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-fg">{item.label}</span>
            <span className="font-medium text-fg-muted tabular">{item.jumlah}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
              style={{ width: `${(item.jumlah / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
