import Link from "next/link";
import { ArrowRight, ChevronRight, CircleDashed, Eye, Lock, PencilLine, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { BukaIsianButton } from "@/features/form-rm/isian/BukaIsianButton";
import { LABEL_STATUS } from "@/features/form-rm/isian/StatusIsianBadge";
import { statusPasien } from "@/features/form-rm/kelengkapan";
import { jangkarForm, statusBerulang } from "@/features/form-rm/profil";
import type { DefinisiForm } from "@/features/form-rm/registry";
import { TAMPILAN_FORM } from "@/features/form-rm/tampilan";
import type { StatusFormPasien } from "@/server/modules/form-rm/form-rm.types";
import type { IsianBerulang, RingkasIsian } from "@/server/modules/form-rm/isian.types";

/**
 * Rupa per status di profil pasien Form RM: kartu berwarna (kuning = diisi tapi
 * belum final, hijau = final, putih = belum diisi), selalu disertai ikon + teks
 * agar status tak hanya dibaca dari warna. `segmen` dipakai pita kelengkapan.
 */
export const NADA_STATUS: Record<
  StatusFormPasien,
  { label: string; ikon: LucideIcon; kartu: string; wadahIkon: string; chip: string; ikonChip: string; segmen: string }
> = {
  KOSONG: {
    label: "Belum diisi",
    ikon: CircleDashed,
    kartu: "border-border bg-surface",
    wadahIkon: "bg-surface-2 text-fg-muted",
    chip: "bg-surface-2 ring-border",
    ikonChip: "text-fg-subtle",
    segmen: "bg-border-strong",
  },
  DRAF: {
    label: "Draf, belum final",
    ikon: PencilLine,
    kartu: "border-warning/45 bg-warning-soft",
    wadahIkon: "bg-warning/15 text-warning",
    chip: "bg-surface ring-warning/40",
    ikonChip: "text-warning",
    segmen: "bg-warning",
  },
  FINAL: {
    label: "Final",
    ikon: Lock,
    kartu: "border-success/40 bg-success-soft",
    wadahIkon: "bg-success/15 text-success",
    chip: "bg-surface ring-success/40",
    ikonChip: "text-success",
    segmen: "bg-success",
  },
};

/** Chip status: teks berwarna teks utama (bukan warna status) + ikon berwarna. */
function ChipStatus({ status, label, kecil = false }: { status: StatusFormPasien; label?: string; kecil?: boolean }) {
  const n = NADA_STATUS[status];
  const Ikon = n.ikon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold text-fg ring-1 ring-inset",
        kecil ? "px-2 py-px text-[11px]" : "px-2.5 py-0.5 text-xs",
        n.chip,
      )}
    >
      <Ikon className={cn(kecil ? "size-3" : "size-3.5", n.ikonChip)} aria-hidden />
      {label ?? n.label}
    </span>
  );
}

const TOMBOL =
  "inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring";
const TOMBOL_UTAMA = "border-brand bg-brand text-brand-fg hover:bg-brand-hover";
const TOMBOL_KEDUA = "border-border-strong bg-surface text-fg hover:border-brand/40 hover:text-brand";

/** Bingkai bersama kartu form: ikon, kode, tanda wajib, judul (maks 2 baris — tak dipotong di ponsel). */
function BingkaiKartu({
  def,
  status,
  wajib,
  keterangan,
  children,
}: {
  def: DefinisiForm;
  status: StatusFormPasien;
  wajib: boolean;
  keterangan?: string;
  children: React.ReactNode;
}) {
  const t = TAMPILAN_FORM[def.kode];
  const Ikon = t.ikon;
  const n = NADA_STATUS[status];
  const idJudul = `judul-${jangkarForm(def.kode)}`;
  return (
    <article
      id={jangkarForm(def.kode)}
      aria-labelledby={idJudul}
      data-status={status}
      className={cn(
        // Tanpa h-full: kartu tak diregangkan setinggi kartu form berulang di sebelahnya (blok kosong berwarna).
        "flex scroll-mt-24 flex-col rounded-[var(--radius-lg)] border p-4 shadow-xs",
        // Lompat dari pita kelengkapan (#form-RM.xx) → kartu tujuan ditandai.
        "target:ring-2 target:ring-brand-ring target:ring-offset-2 target:ring-offset-bg",
        n.kartu,
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]", n.wadahIkon)}>
          <Ikon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-semibold tabular-nums text-fg-subtle">{def.kode}</span>
            {wajib ? (
              <Badge tone="brand" className="px-2 py-0 text-[11px]">
                Wajib
              </Badge>
            ) : (
              <span className="text-[11px] text-fg-subtle">Tidak wajib</span>
            )}
          </div>
          {/* Multi-kolom: judul selalu setinggi 2 baris (2 × 22px leading-snug) → kartu sebaris sama tinggi & tombol sejajar. */}
          <h3 id={idJudul} className="mt-0.5 line-clamp-2 font-semibold leading-snug text-fg @xl:min-h-11" title={t.label}>
            {t.label}
          </h3>
          {keterangan && <p className="mt-1 text-xs text-fg-muted">{keterangan}</p>}
        </div>
      </div>
      {children}
    </article>
  );
}

function HanyaLihat() {
  return (
    <p className="rounded-[var(--radius-md)] border border-dashed border-border-strong px-3 py-2 text-center text-xs text-fg-muted">
      Anda hanya dapat melihat form ini.
    </p>
  );
}

/** Kartu form satu isian per episode (mis. RM.03, RM.04). */
export function KartuForm({
  def,
  nopen,
  isian,
  wajib,
  bolehBuat,
}: {
  def: DefinisiForm;
  nopen: string;
  isian: RingkasIsian | undefined;
  wajib: boolean;
  bolehBuat: boolean;
}) {
  const status = statusPasien(isian);
  return (
    <BingkaiKartu def={def} status={status} wajib={wajib}>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <ChipStatus status={status} />
        {isian && status !== "KOSONG" && (
          <span className="text-xs text-fg-muted">Diperbarui {formatDateTime(isian.updatedAt)}</span>
        )}
      </div>
      <div className="mt-auto pt-4">
        {isian && status === "DRAF" ? (
          <Link href={`/form-rm/isian/${isian.id}`} className={cn(TOMBOL, TOMBOL_UTAMA)}>
            <PencilLine className="size-4" aria-hidden />
            Lanjutkan isian
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : isian && status === "FINAL" ? (
          <Link href={`/form-rm/isian/${isian.id}`} className={cn(TOMBOL, TOMBOL_KEDUA)}>
            <Eye className="size-4" aria-hidden />
            Lihat isian
          </Link>
        ) : bolehBuat ? (
          <BukaIsianButton
            kode={def.kode}
            nopen={nopen}
            label="Isi form"
            varian={wajib ? "utama" : "kedua"}
            ikon="isi"
            className="w-full"
          />
        ) : (
          <HanyaLihat />
        )}
      </div>
    </BingkaiKartu>
  );
}

/**
 * Form berulang (RM.22 per tindakan, RM.33 per rujukan, RM.50 per transfusi):
 * semua isian aktif beserta pembedanya (`ringkasIsian`), dan tombol menambah
 * isian baru. Kartu kuning selama masih ada isian yang belum final.
 */
export function KartuFormBerulang({
  def,
  nopen,
  daftar,
  wajib,
  bolehBuat,
}: {
  def: DefinisiForm;
  nopen: string;
  daftar: IsianBerulang[];
  wajib: boolean;
  bolehBuat: boolean;
}) {
  const t = TAMPILAN_FORM[def.kode];
  const satuan = t.berulang?.satuan ?? "kejadian";
  const status = statusBerulang(daftar);
  const draf = daftar.filter((x) => x.status === "DRAF").length;
  const labelStatus = status === "DRAF" ? `${draf} draf, belum final` : status === "FINAL" ? "Semua final" : undefined;
  const keterangan = [!wajib && t.berulang?.bila, `Satu isian per ${satuan}.`].filter(Boolean).join(". ");

  return (
    <BingkaiKartu def={def} status={status} wajib={wajib} keterangan={keterangan}>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <ChipStatus status={status} label={labelStatus} />
        {daftar.length > 0 && <span className="text-xs tabular-nums text-fg-muted">{daftar.length} isian</span>}
      </div>

      {daftar.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label={`Isian ${def.kode}`}>
          {daftar.map((x) => (
            <li key={x.id}>
              <Link
                href={`/form-rm/isian/${x.id}`}
                className="group flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              >
                <span className="text-xs font-semibold tabular-nums text-fg-subtle">#{x.urutan}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{x.judul}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {x.lencana && (
                      <Badge tone={x.lencana.nada} className="px-2 py-px text-[11px]">
                        {x.lencana.label}
                      </Badge>
                    )}
                    <ChipStatus status={statusPasien(x)} label={LABEL_STATUS[x.status]} kecil />
                    <span className="text-[11px] text-fg-subtle">{formatDateTime(x.updatedAt)}</span>
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-fg-subtle transition-colors group-hover:text-brand" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(bolehBuat || daftar.length === 0) && (
        <div className="mt-auto pt-4">
          {bolehBuat ? (
            <BukaIsianButton
              kode={def.kode}
              nopen={nopen}
              label={daftar.length > 0 ? `Tambah isian (${satuan} lain)` : "Isi form"}
              varian={wajib && daftar.length === 0 ? "utama" : "kedua"}
              ikon={daftar.length > 0 ? "tambah" : "isi"}
              className="w-full"
            />
          ) : (
            <HanyaLihat />
          )}
        </div>
      )}
    </BingkaiKartu>
  );
}
