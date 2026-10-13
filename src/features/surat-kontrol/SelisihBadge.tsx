import { cn } from "@/lib/cn";

/** Selisih jadwal SIMRS terhadap rencana BPJS, mis. "+2 hari" / "−7 hari". */
export function SelisihBadge({ hari, className }: { hari: number; className?: string }) {
  if (hari === 0) return null;
  return (
    <span
      className={cn("inline-flex items-center rounded-full bg-danger-soft px-1.5 py-px font-mono text-[10px] font-semibold text-danger tabular", className)}
      title={`Jadwal SIMRS ${Math.abs(hari)} hari ${hari > 0 ? "sesudah" : "sebelum"} tanggal rencana BPJS`}
    >
      {hari > 0 ? "+" : "−"}
      {Math.abs(hari)} hari
    </span>
  );
}
