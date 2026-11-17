"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, DoorOpen, History } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Field";
import { Combobox, type ComboboxGroup, type ComboboxOption } from "@/components/ui/Combobox";
import { EmptyState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { cn } from "@/lib/cn";
import type { Frekuensi } from "@/server/modules/inventaris/checklist.schema";
import { fetchChecklistRefs, type ChecklistRefs } from "./checklist.client";
import { ChecklistPanel } from "./ChecklistPanel";
import { RiwayatPanel } from "./RiwayatPanel";
import { pilihRuanganAwal } from "./ruangan-awal";

type ViewMode = "checklist" | "riwayat";

/**
 * Ruangan terakhir dipakai — per AKUN di peramban ini (PC bangsal kerap dipakai
 * bergantian). Kenyamanan saja: boleh hilang, tak pernah dibaca server.
 */
const kunciTerakhir = (userId: string) => `rh:inv-checklist-ruangan:${userId}`;

function bacaTerakhir(userId: string): string | null {
  try {
    return window.localStorage.getItem(kunciTerakhir(userId));
  } catch {
    return null;
  }
}

function simpanTerakhir(userId: string, id: string) {
  try {
    window.localStorage.setItem(kunciTerakhir(userId), id);
  } catch {
    /* mode privat / penyimpanan diblokir — abaikan */
  }
}

export function ChecklistView({ canCreate, userId }: { canCreate: boolean; canUpdate: boolean; userId: string }) {
  const [ruanganId, setRuanganId] = useState("");
  const [siap, setSiap] = useState(false);
  const [frekuensi, setFrekuensi] = useState<Frekuensi>("HARIAN");
  const [view, setView] = useState<ViewMode>("checklist");

  const refsState = useAsyncData<ChecklistRefs>(() => fetchChecklistRefs(), []);
  const refs = refsState.result;
  // Pilihan awal sekali setelah refs tiba (refs hanya ada di klien → aman membaca URL/storage).
  if (refs && !siap) {
    setSiap(true);
    setRuanganId(
      pilihRuanganAwal(refs, {
        dariUrl: new URLSearchParams(window.location.search).get("ruangan"),
        terakhir: bacaTerakhir(userId),
      }),
    );
  }

  // Ruangan terpilih → URL (bisa dibagikan / dimuat ulang) + ingatan peramban.
  useEffect(() => {
    if (!siap) return;
    const url = new URL(window.location.href);
    if (ruanganId) url.searchParams.set("ruangan", ruanganId);
    else url.searchParams.delete("ruangan");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
    if (ruanganId) simpanTerakhir(userId, ruanganId);
  }, [ruanganId, siap, userId]);

  const saya = useMemo(() => new Set(refs?.ruanganSaya ?? []), [refs]);
  const opsi = useMemo<ComboboxGroup[]>(() => {
    const ke = (r: ChecklistRefs["ruangan"][number]): ComboboxOption => ({ value: r.id, label: r.nama, badge: r.kodePrefix });
    const semua = refs?.ruangan ?? [];
    const milik = semua.filter((r) => saya.has(r.id)).map(ke);
    const lain = semua.filter((r) => !saya.has(r.id)).map(ke);
    return milik.length
      ? [
          { label: "Ruangan saya", options: milik },
          { label: "Ruangan lain", options: lain },
        ]
      : [{ label: "", options: lain }];
  }, [refs, saya]);

  return (
    <div className="space-y-4">
      {/* Toolbar: ruangan + mode tampilan */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <Label htmlFor="cl-ruangan">Ruangan</Label>
            <div className="lg:max-w-md">
              <Combobox
                id="cl-ruangan"
                value={ruanganId}
                onChange={setRuanganId}
                options={opsi}
                icon={<DoorOpen />}
                disabled={!refs}
                placeholder={refs ? "Ketik nama atau kode ruangan…" : "Memuat ruangan…"}
                emptyText="Tidak ada ruangan yang cocok."
              />
            </div>
            {refs && saya.size === 0 && (
              <p className="mt-1.5 text-xs text-fg-subtle">
                Akun Anda belum dipetakan ke ruangan. Pengelola dapat mengaturnya di Pengaturan › Ruangan › Petugas.
              </p>
            )}
          </div>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </Card>

      {!ruanganId ? (
        <Card className="overflow-hidden">
          <EmptyState title="Pilih ruangan" description="Ketik nama atau kode ruangan di atas untuk melihat checklist pemeliharaan atau riwayatnya." />
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
