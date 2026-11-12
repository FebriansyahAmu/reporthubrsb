"use client";

import { Ban, CircleAlert, Lock, Users, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatTime } from "@/lib/format";
import { tempatUnit } from "@/features/form-rm/aliran-isian";
import { labelKolom, ringkasNilai, slotTtd } from "@/features/form-rm/label-kolom";
import { nilaiDi } from "@/features/form-rm/gabung";
import { srcTtd, ttdSah } from "@/features/form-rm/skema";
import type { KonflikKolom } from "@/server/modules/form-rm/isian.types";
import type { KendaliIsian } from "./useIsian";

/**
 * Konflik per kolom (PRD Berlanjut IGD → RI §5.3 D): kolom yang sama diubah
 * petugas lain sebelum perubahan Anda tersimpan. Kolom lain sudah aman; simpan
 * otomatis jeda sampai setiap kolom di sini dipilih. Tidak merebut fokus —
 * konflik bisa muncul saat petugas sedang mengetik di kolom lain.
 */
export const ID_PANEL_KONFLIK = "panel-konflik-isian";

/** "Ns. Budi (IGD · Triase, 10.42)" */
function siapa(k: KonflikKolom): string {
  const rincian = [tempatUnit(k.unit, k.ruang), k.waktu ? formatTime(k.waktu) : null].filter(Boolean).join(", ");
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
  // Pertahanan berlapis: hanya referensi TTD / PNG data-URL yang menjadi `src` gambar.
  const gambar = ttd && typeof nilai === "string" && ttdSah(nilai) ? srcTtd(nilai) : null;
  return (
    <div className="flex min-w-0 flex-col justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/40 p-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-fg-muted">{judul}</p>
        {gambar ? (
          // eslint-disable-next-line @next/next/no-img-element -- TTD: data-URL / API ber-hak, bukan aset statis
          <img src={gambar} alt="Tanda tangan" className="mt-1 h-16 w-auto max-w-full rounded border border-border bg-white object-contain" />
        ) : (
          <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-sm text-fg">
            {ttd ? (nilai ? "(format tanda tangan tidak dikenal)" : "(belum ditandatangani)") : ringkasNilai(nilai)}
          </p>
        )}
      </div>
      <Button size="sm" variant="secondary" onClick={onPilih} disabled={nonaktif} aria-label={labelTombol} className="self-start">
        {tombol}
      </Button>
    </div>
  );
}

/**
 * "Ns. Budi (IGD · Triase) mengubah: Alamat, Telp / HP · 10.42" (aliran langsung),
 * atau "Perubahan petugas lain ikut dimuat: …" bila pengubahnya tak diketahui.
 */
export function PitaDariLain<T>({ kendali: k }: { kendali: KendaliIsian<T> }) {
  if (!k.gabung || !k.dariLain) return null;
  const { kolom, lebih, waktu, oleh } = k.dariLain;
  const daftar = (
    <>
      <b>{kolom.join(", ")}</b>
      {lebih > 0 && <> dan {lebih} kolom lain</>}
    </>
  );
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-brand/25 bg-brand-soft/60 px-3 py-2 text-[13px] text-brand-soft-fg"
    >
      <p className="flex min-w-0 items-start gap-2">
        <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {oleh.length > 0 ? (
            <>
              {oleh.join(", ")} mengubah: {daftar}
            </>
          ) : (
            <>Perubahan petugas lain ikut dimuat: {daftar}</>
          )}{" "}
          · {formatTime(waktu)}
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

/**
 * Isian difinalkan / dibatalkan petugas lain saat masih dibuka di sini (PRD §5.3 E):
 * layar sudah terkunci; kolom yang belum sempat tersimpan disebutkan agar bisa
 * disampaikan ke pengelola rekam medis (koreksi lewat Buka koreksi).
 */
export function PitaTertinggal<T>({ kendali: k }: { kendali: KendaliIsian<T> }) {
  const t = k.tertinggal;
  if (!k.gabung || !t) return null;
  const final = t.status === "FINAL";
  const Ikon = final ? Lock : Ban;
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-2.5 text-[13px] text-warning"
    >
      <div className="flex min-w-0 items-start gap-2">
        <Ikon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold">
            Isian baru saja {final ? "difinalkan" : "dibatalkan"}
            {t.oleh ? ` oleh ${t.oleh}` : " di tempat lain"} — layar ini terkunci.
          </p>
          {t.kolom.length > 0 ? (
            <p>
              Perubahan Anda yang belum tersimpan: <b>{t.kolom.join(", ")}</b>.{" "}
              {final ? "Sampaikan ke pengelola rekam medis bila perlu dikoreksi lewat Buka koreksi." : ""}
            </p>
          ) : (
            <p>Semua perubahan Anda sudah tersimpan sebelumnya.</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={k.tutupTertinggal}
        aria-label="Tutup pemberitahuan"
        className="rounded p-0.5 transition-colors hover:bg-warning-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
