"use client";

import { Ban, CalendarClock, MapPin, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { BadgeTone } from "@/server/modules/audit-rme/audit.constants";
import {
  JENIS_KUNJUNGAN,
  KATEGORI,
  KATEGORI_KEYS,
  STATUS_KUNJUNGAN_LABEL,
  type KategoriKey,
} from "@/server/modules/audit-rme/kunjungan.constants";
import type { KategoriStat, KunjunganCard } from "./audit.client";

const AVATAR_TONE: Record<BadgeTone, string> = {
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent",
  neutral: "bg-surface-2 text-fg-muted",
};

const dtFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
/** `YYYY-MM-DDTHH:mm:ss` jam dinding WITA → "24 Sep 10.12" (tanpa geser TZ). */
export const fmtWaktu = (s: string | null) => (s ? dtFmt.format(new Date(s)) : "—");

function initials(nama: string | null): string {
  const parts = (nama ?? "?").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function KunjunganCardView({ k, onOpen }: { k: KunjunganCard; onOpen?: () => void }) {
  const tone = (k.jenis.id != null ? JENIS_KUNJUNGAN[k.jenis.id]?.tone : undefined) ?? "neutral";
  const wajib = new Set(k.kelengkapan.wajib);
  const batal = k.status === "BATAL";

  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs transition-shadow hover:shadow-md",
        onOpen && "cursor-pointer hover:border-brand/40",
        batal && "border-danger/30 bg-danger-soft/20",
      )}
    >
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Buka jejak kunjungan ${k.pasien.nama ?? ""} — ${k.ruangan.nama}`}
          className="absolute inset-0 z-1 rounded-[var(--radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        />
      )}
      {/* Identitas pasien */}
      <header className="flex items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold", AVATAR_TONE[tone])} aria-hidden>
          {initials(k.pasien.nama)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={cn("truncate text-sm font-semibold text-fg", batal && "line-through decoration-danger/60")} title={k.pasien.nama ?? undefined}>
            {k.pasien.nama ?? "Tanpa nama"}
          </h3>
          <p className="mt-0.5 text-xs text-fg-muted">
            <span className="font-mono">RM {k.norm}</span>
            {k.pasien.jenisKelamin && <> · {k.pasien.jenisKelamin}</>}
            {k.pasien.umur != null && <> · {k.pasien.umur} th</>}
          </p>
        </div>
        <Badge tone={tone} className="shrink-0 px-2">{k.jenis.short}</Badge>
      </header>

      {/* Lokasi & waktu */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
        <span className="inline-flex min-w-0 max-w-full items-center gap-1" title={k.ruangan.grupNama ?? undefined}>
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{k.ruangan.nama}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3.5" />
          {fmtWaktu(k.masuk)}
        </span>
        {k.jenis.id === 3 && (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">Hari ke-{k.hariRawat}</span>
        )}
        {k.status !== "SELESAI" && (
          <Badge tone={batal ? "danger" : "accent"} dot className="px-2 py-0 text-[11px]">
            {STATUS_KUNJUNGAN_LABEL[k.status]}
          </Badge>
        )}
      </div>

      {/* Pip kategori */}
      <div className="mt-3 grid grid-cols-5 gap-1.5" role="list" aria-label="Input per kategori">
        {KATEGORI_KEYS.map((key) => (
          <KategoriPip key={key} kategori={key} stat={k.kategori[key]} wajib={wajib.has(key)} />
        ))}
      </div>

      {/* Petugas & kelengkapan */}
      <div className="min-h-3 flex-1" aria-hidden />
      <footer className="flex items-end justify-between gap-3 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-fg">
            <UsersRound className="size-3.5 text-fg-muted" />
            {k.petugas.total} petugas
            {k.totalBatal > 0 && (
              <span className="inline-flex items-center gap-0.5 text-danger" title={`${k.totalBatal} input dibatalkan/dihapus`}>
                · <Ban className="size-3" /> {k.totalBatal} batal
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-fg-muted">
            {k.petugas.profesi.length ? k.petugas.profesi.map((p) => `${p.label} ${p.n}`).join(" · ") : "Belum ada input"}
          </p>
        </div>
        <KelengkapanMeter wajib={k.kelengkapan.wajib} terpenuhi={k.kelengkapan.terpenuhi} persen={k.kelengkapan.persen} />
      </footer>
    </article>
  );
}

/** Status & teks aksesibel satu pip kategori (dipakai kartu & baris ringkas). */
function pipInfo(kategori: KategoriKey, stat: KategoriStat, wajib: boolean) {
  const meta = KATEGORI[kategori];
  const rujukan = stat.aktif === 0 ? stat.rujukan : null;
  const terisi = stat.aktif > 0 || !!rujukan;
  const kurang = wajib && !terisi;
  const detail = [
    `${meta.label}: ${stat.aktif} input aktif`,
    rujukan ? `dipenuhi asesmen ${rujukan.jenisShort} ${rujukan.ruangan} (${rujukan.jamSebelum} jam sebelum masuk)` : null,
    stat.batal ? `${stat.batal} batal/dihapus` : null,
    stat.petugas ? `${stat.petugas} petugas` : null,
    meta.perEpisode ? "dihitung per episode (NOPEN)" : null,
    terisi ? "terisi" : kurang ? "belum diisi (wajib)" : "tidak wajib",
  ]
    .filter(Boolean)
    .join(" · ");
  const box = cn(
    terisi && !rujukan && "border-success/25 bg-success-soft",
    rujukan && "border-dashed border-success/50 bg-success-soft/50",
    kurang && "border-danger/30 bg-danger-soft",
    !terisi && !kurang && "border-border bg-surface-2/60",
  );
  // Dipenuhi dari leg lain → tampil asal (mis. "IGD"), bukan angka input ruangan ini.
  const value = rujukan ? rujukan.jenisShort : terisi ? stat.aktif : kurang ? 0 : "–";
  const valueTone = rujukan ? "text-success text-xs" : terisi ? "text-fg" : kurang ? "text-danger" : "text-fg-subtle";
  return { meta, terisi, kurang, detail, box, value, valueTone };
}

/** Pip mini (mode ringkas): kotak kecil berisi angka + tanda batal. */
export function MiniPip({ kategori, stat, wajib }: { kategori: KategoriKey; stat: KategoriStat; wajib: boolean }) {
  const p = pipInfo(kategori, stat, wajib);
  return (
    <span
      title={p.detail}
      aria-label={p.detail}
      className={cn("relative inline-flex h-8 w-10 items-center justify-center rounded-md border text-sm font-semibold tabular", p.box, p.valueTone)}
    >
      {p.value}
      {stat.batal > 0 && (
        <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white ring-2 ring-surface">
          {stat.batal}
        </span>
      )}
    </span>
  );
}

function KategoriPip({ kategori, stat, wajib }: { kategori: KategoriKey; stat: KategoriStat; wajib: boolean }) {
  const { meta, terisi, kurang, detail, box, value, valueTone } = pipInfo(kategori, stat, wajib);

  return (
    <div
      role="listitem"
      title={detail}
      aria-label={detail}
      className={cn("flex min-h-14.5 flex-col items-center justify-center rounded-[var(--radius-md)] border px-1 py-1.5 text-center", box)}
    >
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wide",
          terisi ? "text-success" : kurang ? "text-danger" : "text-fg-subtle",
        )}
      >
        {meta.short}
        {meta.perEpisode && <sup className="ml-px">e</sup>}
      </span>
      <span className={cn("text-base font-semibold leading-tight tabular", valueTone)}>{value}</span>
      {stat.batal > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-danger">
          <Ban className="size-2.5" />
          {stat.batal}
        </span>
      )}
    </div>
  );
}

export function KelengkapanMeter({ wajib, terpenuhi, persen }: { wajib: KategoriKey[]; terpenuhi: KategoriKey[]; persen: number | null }) {
  if (persen == null) {
    return <span className="shrink-0 text-[11px] text-fg-subtle">Kelengkapan tak dinilai</span>;
  }
  const done = new Set(terpenuhi);
  const tone = persen === 100 ? "bg-success" : persen >= 60 ? "bg-warning" : "bg-danger";
  return (
    <div className="shrink-0 text-right" title={`Kelengkapan ${terpenuhi.length} dari ${wajib.length} kategori wajib`}>
      <p className="text-[11px] text-fg-muted">
        Lengkap <b className="tabular text-fg">{terpenuhi.length}/{wajib.length}</b>
      </p>
      <div className="mt-1 flex gap-0.5" aria-hidden>
        {wajib.map((k) => (
          <span key={k} className={cn("h-1.5 w-4 rounded-full", done.has(k) ? tone : "bg-border-strong/50")} />
        ))}
      </div>
    </div>
  );
}
