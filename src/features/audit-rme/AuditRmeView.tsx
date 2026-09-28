"use client";

import { useState } from "react";
import { Award, History, LayoutGrid, LineChart, ListFilter, MapPinned } from "lucide-react";
import { cn } from "@/lib/cn";
import { AuditDashboardView } from "./AuditDashboardView";
import { EksporProvider } from "./Ekspor";
import { KepatuhanPetugasView } from "./KepatuhanPetugasView";
import { LogAktivitasView } from "./LogAktivitasView";
import { PapanKunjunganView } from "./PapanKunjunganView";
import { PetaRuanganView } from "./PetaRuanganView";
import { RiwayatEksporDrawer } from "./RiwayatEksporDrawer";

type Tab = "papan" | "petugas" | "peta" | "log" | "tren";

const TABS: { key: Tab; label: string; icon: typeof ListFilter }[] = [
  { key: "papan", label: "Papan Kunjungan", icon: LayoutGrid },
  { key: "petugas", label: "Kepatuhan Petugas", icon: Award },
  { key: "peta", label: "Peta Ruangan", icon: MapPinned },
  { key: "log", label: "Log Aktivitas", icon: ListFilter },
  { key: "tren", label: "Tren Log", icon: LineChart },
];

const VIEW: Record<Tab, () => React.ReactNode> = {
  papan: () => <PapanKunjunganView />,
  petugas: () => <KepatuhanPetugasView />,
  peta: () => <PetaRuanganView />,
  log: () => <LogAktivitasView />,
  tren: () => <AuditDashboardView />,
};

/** `bolehEkspor` = izin `audit-rme:print` (dicek di server page). */
export function AuditRmeView({ bolehEkspor }: { bolehEkspor: boolean }) {
  const [tab, setTab] = useState<Tab>("papan");
  const [riwayat, setRiwayat] = useState(false);

  return (
    <EksporProvider boleh={bolehEkspor}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Tampilan Audit Trail RME" className="inline-flex max-w-full overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
            {TABS.map((it) => {
              const Icon = it.icon;
              const active = tab === it.key;
              return (
                <button
                  key={it.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(it.key)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    active ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
                  )}
                >
                  <Icon className="size-4" />
                  {it.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setRiwayat(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <History className="size-4" /> Riwayat ekspor
          </button>
        </div>

        {VIEW[tab]()}
      </div>
      <RiwayatEksporDrawer open={riwayat} onClose={() => setRiwayat(false)} />
    </EksporProvider>
  );
}
