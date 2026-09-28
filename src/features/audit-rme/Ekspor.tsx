"use client";

import { createContext, useContext, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PopoverPanel } from "@/components/ui/Popover";
import { useToast } from "@/components/ui/Toast";
import { LAPORAN_LABEL, type FormatEkspor, type LaporanEkspor } from "@/server/modules/audit-rme/ekspor.constants";
import { unduhEkspor, type EksporParams } from "./audit.client";

/** Izin `audit-rme:print` bagi seluruh tab & panel modul — tanpa izin, tombol ekspor tidak dirender. */
const BolehEkspor = createContext(false);

export function EksporProvider({ boleh, children }: { boleh: boolean; children: React.ReactNode }) {
  return <BolehEkspor.Provider value={boleh}>{children}</BolehEkspor.Provider>;
}

const FORMAT: { key: FormatEkspor; label: string; sub: string; icon: typeof FileText }[] = [
  { key: "xlsx", label: "Excel (.xlsx)", sub: "Lengkap dengan lembar rincian — untuk diolah", icon: FileSpreadsheet },
  { key: "pdf", label: "PDF", sub: "Siap cetak, dengan kolom tanda tangan", icon: FileText },
];

/**
 * Tombol "Ekspor" (menu Excel/PDF) untuk satu laporan. `params` = filter layar
 * yang sedang tampil, sehingga berkas berisi persis data yang dilihat.
 */
export function EksporMenu({ laporan, params, disabled }: { laporan: LaporanEkspor; params: EksporParams; disabled?: boolean }) {
  const boleh = useContext(BolehEkspor);
  const toast = useToast();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<FormatEkspor | null>(null);
  if (!boleh) return null;

  async function unduh(format: FormatEkspor) {
    setOpen(false);
    setBusy(format);
    try {
      const { namaBerkas, kode } = await unduhEkspor(laporan, format, params);
      toast.success("Ekspor siap", `${namaBerkas}${kode ? ` · No. ${kode}` : ""}`);
    } catch (e) {
      toast.error("Gagal mengekspor", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button
        ref={setAnchor}
        variant="secondary"
        size="sm"
        icon={<Download className="size-4" />}
        loading={!!busy}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy ? "Menyiapkan…" : "Ekspor"}
        {!busy && <ChevronDown className="size-3.5 opacity-60" aria-hidden />}
      </Button>
      <PopoverPanel anchor={anchor} open={open} onClose={() => setOpen(false)} align="end" matchWidth={false} className="w-72">
        <div role="menu" aria-label={`Ekspor ${LAPORAN_LABEL[laporan]}`}>
          <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold text-fg-muted">{LAPORAN_LABEL[laporan]}</p>
          {FORMAT.map((f) => (
            <button
              key={f.key}
              type="button"
              role="menuitem"
              onClick={() => unduh(f.key)}
              className="flex w-full items-start gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
              <f.icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">{f.label}</span>
                <span className="block text-[11px] text-fg-muted">{f.sub}</span>
              </span>
            </button>
          ))}
          <p className="mt-1 flex items-start gap-1.5 border-t border-border px-2.5 pt-2 pb-1.5 text-[11px] leading-snug text-fg-muted">
            <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
            Berisi data pasien. Setiap ekspor tercatat (siapa, kapan, filter) di Riwayat ekspor.
          </p>
        </div>
      </PopoverPanel>
    </>
  );
}
