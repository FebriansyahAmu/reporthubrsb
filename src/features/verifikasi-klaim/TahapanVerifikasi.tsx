import { ArrowRight, ClipboardCheck, FileCheck, FileStack, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { MODUL_VERIFIKASI } from "@/server/modules/verifikasi-klaim/verifikasi.constants";

export type TahapInfo = {
  key: string;
  no: string;
  icon: LucideIcon;
  judul: string;
  deskripsi: string;
  /** Stage pembangunan (PRD §8). */
  stage: string;
  akses: boolean;
};

export const TAHAPAN: Omit<TahapInfo, "akses">[] = [
  {
    key: MODUL_VERIFIKASI.RM,
    no: "1",
    icon: ClipboardCheck,
    judul: "Kelengkapan Berkas RM",
    deskripsi: "Cek otomatis dari SIMRS (SEP, diagnosa, resume, CPPT, triase, SPRI, penunjang, tagihan) → loloskan atau kirim tindak lanjut.",
    stage: "V1",
  },
  {
    key: MODUL_VERIFIKASI.KLAIM,
    no: "2",
    icon: FileCheck,
    judul: "Verifikasi Klaim / Coder",
    deskripsi: "Usulan koreksi diagnosa & prosedur dengan aturan INA-CBG; status “sudah diterapkan di SIMRS” terdeteksi otomatis.",
    stage: "V2",
  },
  {
    key: MODUL_VERIFIKASI.PAKET,
    no: "3",
    icon: FileStack,
    judul: "Paket Klaim Final",
    deskripsi: "Gabung seluruh dokumen klaim, sisipkan dokumen tambahan, gabung ulang, cetak & kunci FINAL.",
    stage: "V3",
  },
];

/** Pita tiga tahap verifikasi — penanda akses pengguna per tahap (kerangka Stage V0). */
export function TahapanVerifikasi({ tahap }: { tahap: TahapInfo[] }) {
  return (
    <ol className="grid grid-cols-1 gap-3 lg:grid-cols-3" aria-label="Tahapan verifikasi klaim">
      {tahap.map((t, i) => {
        const Icon = t.icon;
        return (
          <li
            key={t.key}
            className={cn(
              "relative flex flex-col rounded-[var(--radius-lg)] border bg-surface p-4 shadow-xs",
              t.akses ? "border-brand/30" : "border-border",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
                  t.akses ? "bg-brand-soft text-brand" : "bg-surface-2 text-fg-subtle",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {t.akses ? (
                  <Badge tone="success" dot>Akses Anda</Badge>
                ) : (
                  <Badge tone="neutral">Tanpa akses</Badge>
                )}
                <Badge tone="neutral">Stage {t.stage}</Badge>
              </div>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-fg">
              <span className="text-fg-subtle">Tahap {t.no} · </span>
              {t.judul}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">{t.deskripsi}</p>
            {i < tahap.length - 1 && (
              <ArrowRight
                className="absolute -right-2.5 top-1/2 hidden size-4 -translate-y-1/2 rounded-full bg-surface text-fg-subtle lg:block"
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
