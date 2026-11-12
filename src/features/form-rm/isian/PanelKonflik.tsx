"use client";

import { CircleAlert, Users, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatTime } from "@/lib/format";
import { labelKolom, ringkasNilai, slotTtd } from "@/features/form-rm/label-kolom";
import { nilaiDi } from "@/features/form-rm/gabung";
import { srcTtd } from "@/features/form-rm/skema";
import type { KonflikKolom } from "@/server/modules/form-rm/isian.types";
import type { KendaliIsian } from "./useIsian";

/**
 * Konflik per kolom (PRD Berlanjut IGD → RI §5.3 D): kolom yang sama diubah
 * petugas lain sebelum perubahan Anda tersimpan. Kolom lain sudah aman; simpan
 * otomatis jeda sampai setiap kolom di sini dipilih. Tidak merebut fokus —
 * konflik bisa muncul saat petugas sedang mengetik di kolom lain.
 */
export const ID_PANEL_KONFLIK = "panel-konflik-isian";

const LABEL_UNIT: Record<string, string> = { IGD: "IGD", RI: "Rawat Inap", RJ: "Rawat Jalan" };

/** "Ns. Budi (IGD · Triase, 10.42)" */
function siapa(k: KonflikKolom): string {
  const tempat = [k.unit ? (LABEL_UNIT[k.unit] ?? k.unit) : null, k.ruang].filter(Boolean).join(" · ");
  const rincian = [tempat, k.waktu ? formatTime(k.waktu) : null].filter(Boolean).join(", ");
  return `${k.oleh ?? "petugas lain"}${rincian ? ` (${rincian})` : ""}`;
}

export function PanelKonflik<T>({ kendali: k }: { kendali: KendaliIsian<T> }) {
  if (!k.gabung || k.bentrok.length === 0) return null;
  const ttd = slotTtd(k.def.kode, k.form);
  const banyak = k.bentrok.length > 1;

  return (
    <section
      id={ID_PANEL_KONFLIK}
      aria-labelledby={`${ID_PANEL_KONFLIK}-judul`}
      className="scroll-mt-24 rounded-[var(--radius-lg)] border border-warning/40 bg-warning-soft/70 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div className="min-w-0" aria-live="polite">
            <h2 id={`${ID_PANEL_KONFLIK}-judul`} className="text-sm font-semibold text-fg">
              {banyak ? `${k.bentrok.length} kolom juga diubah petugas lain` : "Kolom ini juga diubah petugas lain"}
            </h2>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              Perubahan Anda di kolom lain sudah aman. Pilih isi yang dipakai di bawah — simpan otomatis berjalan lagi setelah
              semuanya dipilih.
            </p>
          </div>
        </div>
        {banyak && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => k.pilihSemuaBentrok("mereka")} disabled={k.terkunci}>
              Pakai semua isi terbaru
            </Button>
            <Button size="sm" variant="secondary" onClick={() => k.pilihSemuaBentrok("saya")} disabled={k.terkunci}>
              Pakai semua milik saya
            </Button>
          </div>
        )}
      </div>

      <ul className="mt-4 space-y-3">
        {k.bentrok.map((b) => {
          const label = labelKolom(k.def.kode, b.p, k.form);
          const adalahTtd = ttd.has(b.p);
          const oleh = b.oleh ?? "petugas lain";
          return (
            <li key={b.p} className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
              <p className="text-sm font-semibold text-fg">{label}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Pilihan
                  judul="Milik Anda"
                  nilai={nilaiDi(k.form, b.p)}
                  ttd={adalahTtd}
                  tombol="Pakai milik saya"
                  labelTombol={`Pakai isi Anda untuk ${label}`}
                  onPilih={() => k.pilihBentrok(b.p, "saya")}
                  nonaktif={k.terkunci}
                />
                <Pilihan
                  judul={`Milik ${siapa(b)}`}
                  nilai={b.mereka}
                  ttd={adalahTtd}
                  tombol={`Pakai milik ${oleh}`}
                  labelTombol={`Pakai isi ${oleh} untuk ${label}`}
                  onPilih={() => k.pilihBentrok(b.p, "mereka")}
                  nonaktif={k.terkunci}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Pilihan({
  judul,
  nilai,
  ttd,
  tombol,
  labelTombol,
  onPilih,
  nonaktif,
}: {
  judul: string;
  nilai: unknown;
  ttd: boolean;
  tombol: string;
  labelTombol: string;
  onPilih: () => void;
  nonaktif: boolean;
}) {
  const gambar = ttd && typeof nilai === "string" && nilai !== "" ? srcTtd(nilai) : null;
  return (
    <div className="flex min-w-0 flex-col justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/40 p-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-fg-muted">{judul}</p>
        {gambar ? (
          // eslint-disable-next-line @next/next/no-img-element -- TTD: data-URL / API ber-hak, bukan aset statis
          <img src={gambar} alt="Tanda tangan" className="mt-1 h-16 w-auto max-w-full rounded border border-border bg-white object-contain" />
        ) : (
          <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-sm text-fg">
            {ttd ? "(belum ditandatangani)" : ringkasNilai(nilai)}
          </p>
        )}
      </div>
      <Button size="sm" variant="secondary" onClick={onPilih} disabled={nonaktif} aria-label={labelTombol} className="self-start">
        {tombol}
      </Button>
    </div>
  );
}

/** "Perubahan petugas lain ikut dimuat: Alamat, Telp / HP · 10.42" (mode gabung). */
export function PitaDariLain<T>({ kendali: k }: { kendali: KendaliIsian<T> }) {
  if (!k.gabung || !k.dariLain) return null;
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-brand/25 bg-brand-soft/60 px-3 py-2 text-[13px] text-brand-soft-fg"
    >
      <p className="flex min-w-0 items-start gap-2">
        <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Perubahan petugas lain ikut dimuat: <b>{k.dariLain.kolom.join(", ")}</b> · {formatTime(k.dariLain.waktu)}
        </span>
      </p>
      <button
        type="button"
        onClick={k.tutupDariLain}
        aria-label="Tutup pemberitahuan"
        className="rounded p-0.5 transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
