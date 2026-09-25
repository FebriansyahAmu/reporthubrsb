"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, DoorOpen, History } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { EmptyState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { cn } from "@/lib/cn";
import type { Frekuensi } from "@/server/modules/inventaris/checklist.schema";
import { fetchChecklistRefs, type ChecklistRefs } from "./checklist.client";
import { ChecklistPanel } from "./ChecklistPanel";
import { RiwayatPanel } from "./RiwayatPanel";

type ViewMode = "checklist" | "riwayat";

export function ChecklistView({ canCreate }: { canCreate: boolean; canUpdate: boolean }) {
  const [ruanganId, setRuanganId] = useState("");
  const [frekuensi, setFrekuensi] = useState<Frekuensi>("HARIAN");
  const [view, setView] = useState<ViewMode>("checklist");

  const refsState = useAsyncData<ChecklistRefs>(() => fetchChecklistRefs(), []);
  const refs = refsState.result;
  if (refs && !ruanganId && refs.ruangan[0]) setRuanganId(refs.ruangan[0].id);

  const ruanganOpts = useMemo<SelectOption[]>(
    () => (refs?.ruangan ?? []).map((r) => ({ value: r.id, label: `${r.kodePrefix} — ${r.nama}` })),
    [refs],
  );

  return (
    <div className="space-y-4">
      {/* Toolbar: ruangan + mode tampilan */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <Label htmlFor="cl-ruangan">Ruangan</Label>
            <div className="flex items-center gap-2">
              <DoorOpen className="size-4 shrink-0 text-fg-subtle" />
              <div className="min-w-0 flex-1 lg:max-w-md">
                <Select id="cl-ruangan" value={ruanganId} onChange={setRuanganId} options={ruanganOpts} placeholder="Pilih ruangan…" />
              </div>
            </div>
          </div>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </Card>

      {!ruanganId ? (
        <Card className="overflow-hidden">
          <EmptyState title="Pilih ruangan" description="Pilih ruangan terlebih dahulu untuk melihat checklist pemeliharaan atau riwayatnya." />
        </Card>
      ) : view === "checklist" ? (
        <ChecklistPanel key={ruanganId} ruanganId={ruanganId} frekuensi={frekuensi} setFrekuensi={setFrekuensi} refs={refs} canCreate={canCreate} />
      ) : (
        <RiwayatPanel key={ruanganId} ruanganId={ruanganId} frekuensi={frekuensi} setFrekuensi={setFrekuensi} />
      )}
    </div>
  );
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const items: { key: ViewMode; label: string; icon: typeof ClipboardCheck }[] = [
    { key: "checklist", label: "Checklist", icon: ClipboardCheck },
    { key: "riwayat", label: "Riwayat", icon: History },
  ];
  return (
    <div className="inline-flex shrink-0 rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
      {items.map((it) => {
        const Icon = it.icon;
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
              active ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
