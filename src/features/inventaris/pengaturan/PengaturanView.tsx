"use client";

import { useState } from "react";
import { Boxes, DoorOpen, Layers, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { RefManager, type RefColumnDef, type RefFieldDef, type RefRow } from "./RefManager";

type Tab = {
  key: string;
  label: string;
  icon: typeof Boxes;
  entity: string;
  singular: string;
  columns: RefColumnDef[];
  fields: RefFieldDef[];
  emptyHint?: string;
  inlineFields?: string[];
};

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";

const TONE_OPTIONS = [
  { value: "success", label: "Hijau — kondisi baik" },
  { value: "warning", label: "Kuning — perhatian" },
  { value: "danger", label: "Merah — buruk/rusak berat" },
  { value: "brand", label: "Biru" },
  { value: "accent", label: "Aksen" },
  { value: "neutral", label: "Netral/abu" },
];

const mono = (v: unknown) => <span className="font-mono text-xs font-semibold text-fg">{String(v ?? "")}</span>;

const TABS: Tab[] = [
  {
    key: "satuan",
    label: "Satuan",
    icon: Boxes,
    entity: "satuan",
    singular: "satuan",
    columns: [{ key: "nama", header: "Nama Satuan" }],
    fields: [
      { name: "nama", label: "Nama Satuan", type: "text", required: true, placeholder: "mis. Unit, Buah, Set", colSpan: 2 },
    ],
    emptyHint: "mis. Unit, Buah, Set",
  },
  {
    key: "kondisi",
    label: "Kondisi",
    icon: ShieldCheck,
    entity: "kondisi",
    singular: "kondisi",
    columns: [
      {
        key: "nama",
        header: "Kondisi",
        render: (row: RefRow) => (
          <Badge tone={(String(row.tone) as BadgeTone) || "neutral"} dot>
            {String(row.nama)}
          </Badge>
        ),
      },
      { key: "kode", header: "Kode", render: (row) => mono(row.kode) },
    ],
    fields: [
      { name: "nama", label: "Nama Kondisi", type: "text", required: true, placeholder: "mis. Baik" },
      { name: "kode", label: "Kode", type: "text", required: true, placeholder: "mis. B / RR / RB", uppercase: true },
      {
        name: "tone",
        label: "Warna Badge",
        type: "select",
        options: TONE_OPTIONS,
        colSpan: 2,
        help: "Warna label kondisi di seluruh modul (hijau=baik, kuning=perhatian, merah=rusak berat).",
      },
    ],
  },
  {
    key: "sumber-anggaran",
    label: "Sumber Anggaran",
    icon: Wallet,
    entity: "sumber-anggaran",
    singular: "sumber anggaran",
    columns: [
      { key: "singkatan", header: "Singkatan", render: (row) => mono(row.singkatan) },
      { key: "nama", header: "Nama Lengkap" },
    ],
    fields: [
      { name: "singkatan", label: "Singkatan", type: "text", required: true, placeholder: "mis. DAK" },
      { name: "nama", label: "Nama Lengkap", type: "text", required: true, placeholder: "mis. Dana Alokasi Khusus" },
    ],
  },
  {
    key: "kategori",
    label: "Kategori",
    icon: Layers,
    entity: "kategori",
    singular: "kategori",
    columns: [
      { key: "nama", header: "Nama Kategori" },
      { key: "kode", header: "Kode", render: (row) => (row.kode ? mono(row.kode) : <span className="text-fg-subtle">—</span>) },
    ],
    fields: [
      { name: "nama", label: "Nama Kategori", type: "text", required: true, placeholder: "mis. Alat Kesehatan" },
      { name: "kode", label: "Kode (opsional)", type: "text", placeholder: "mis. ALKES", uppercase: true },
    ],
  },
  {
    key: "ruangan",
    label: "Ruangan",
    icon: DoorOpen,
    entity: "ruangan",
    singular: "ruangan",
    columns: [
      { key: "kodePrefix", header: "Prefix", render: (row) => mono(row.kodePrefix) },
      { key: "nama", header: "Nama Ruangan" },
      { key: "pjNama", header: "Penanggung Jawab" },
      { key: "pjNip", header: "NIP" },
    ],
    fields: [
      {
        name: "kodePrefix",
        label: "Kode Prefix",
        type: "text",
        required: true,
        placeholder: "mis. ICU",
        uppercase: true,
        help: "Dipakai auto-generate kode barang (mis. ICU → ICU-001) & kop KIR.",
      },
      { name: "nama", label: "Nama Ruangan", type: "text", required: true, placeholder: "mis. ICU (Intensive Care Unit)", colSpan: 2 },
      { name: "pjNama", label: "Nama Penanggung Jawab", type: "text", placeholder: "mis. dr. Roynald Maramis" },
      { name: "pjNip", label: "NIP Penanggung Jawab", type: "text", placeholder: "mis. 198310272019031003" },
    ],
    inlineFields: ["pjNama", "pjNip"],
    emptyHint: "PJ & NIP bisa diedit langsung di kolomnya",
  },
];

export function PengaturanView({ canManage }: { canManage: boolean }) {
  const [active, setActive] = useState<string>(TABS[0].key);
  const tab = TABS.find((t) => t.key === active) ?? TABS[0];

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5 rounded-[var(--radius-lg)] border border-border bg-surface-2/50 p-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-[var(--radius-md)] px-3.5 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                isActive
                  ? "bg-surface text-fg shadow-xs ring-1 ring-border"
                  : "text-fg-muted hover:bg-surface hover:text-fg",
              )}
            >
              <Icon className={cn("size-4", isActive ? "text-brand" : "text-fg-subtle")} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Manager entitas aktif */}
      <RefManager
        key={tab.key}
        entity={tab.entity}
        title={tab.label}
        singular={tab.singular}
        columns={tab.columns}
        fields={tab.fields}
        canManage={canManage}
        emptyHint={tab.emptyHint}
        inlineFields={tab.inlineFields}
      />
    </div>
  );
}
