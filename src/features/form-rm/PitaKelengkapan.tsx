import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { NADA_STATUS } from "@/features/form-rm/KartuFormPasien";
import { hitungPerStatus, jangkarForm } from "@/features/form-rm/profil";
import type { KodeForm } from "@/features/form-rm/registry";
import { TAMPILAN_FORM } from "@/features/form-rm/tampilan";
import type { StatusFormPasien } from "@/server/modules/form-rm/form-rm.types";

const LEGENDA: { status: StatusFormPasien; label: string }[] = [
  { status: "FINAL", label: "Final" },
  { status: "DRAF", label: "Draf" },
  { status: "KOSONG", label: "Belum diisi" },
];

/**
 * Pita kelengkapan form WAJIB episode: satu segmen per form (warna = status,
 * kode di bawahnya, status lengkap untuk pembaca layar), menaut ke kartunya.
 * Legenda menyebut jumlah per status, jadi warna bukan satu-satunya penanda.
 */
export function PitaKelengkapan({ formulir }: { formulir: { kode: KodeForm; status: StatusFormPasien }[] }) {
  const total = formulir.length;
  const n = hitungPerStatus(formulir);
  const lengkap = total > 0 && n.FINAL === total;

  return (
    <section
      aria-labelledby="pita-kelengkapan"
      className="rounded-[var(--radius-md)] border border-border bg-bg p-4 @4xl:w-[24rem] @4xl:shrink-0"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="pita-kelengkapan" className="text-sm font-semibold text-fg">
          Form wajib
        </h2>
        {total > 0 &&
          (lengkap ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              Lengkap
            </span>
          ) : (
            <p className="text-sm text-fg-muted">
              <span className="font-semibold tabular-nums text-fg">{n.FINAL}</span> dari {total} final
            </p>
          ))}
      </div>

      {total === 0 ? (
        <p className="mt-2 text-sm text-fg-muted">Tidak ada form wajib untuk jenis kunjungan episode ini.</p>
      ) : (
        <>
          <ol className="mt-3 flex gap-1.5">
            {formulir.map((f) => {
              const nada = NADA_STATUS[f.status];
              const label = TAMPILAN_FORM[f.kode].label;
              return (
                <li key={f.kode} className="min-w-0 flex-1">
                  <a
                    href={`#${jangkarForm(f.kode)}`}
                    title={`${f.kode} ${label}: ${nada.label}`}
                    className="group block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                  >
                    <span className={cn("block h-2 rounded-full transition-opacity group-hover:opacity-75", nada.segmen)} aria-hidden />
                    <span className="mt-1.5 block truncate text-[11px] font-medium tabular-nums text-fg-muted group-hover:text-fg">
                      {f.kode}
                    </span>
                    <span className="sr-only">
                      {label}: {nada.label}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted" aria-label="Jumlah form wajib per status">
            {LEGENDA.map(({ status, label }) => (
              <li key={status} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", NADA_STATUS[status].segmen)} aria-hidden />
                {label}
                <span className="font-semibold tabular-nums text-fg">{n[status]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
