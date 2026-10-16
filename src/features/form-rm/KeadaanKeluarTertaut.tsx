import { Check, HeartPulse, Info, Link2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNilaiIsian } from "@/features/form-rm/isian/TandaAsal";
import { KEADAAN_KELUAR_OPTS } from "@/features/form-rm/ringkasan.constants";
import type { BacaKeluarSimrs } from "@/server/modules/form-rm/form-rm.types";
import type { StatusIsian } from "@/features/form-rm/isian.status";

/**
 * Keadaan Keluar RM.01 — kolom TERTAUT SIMRS (hanya baca): nilainya
 * `layanan.pasien_pulang.KEADAAN` (referensi 46), bukan pilihan petugas. Selama
 * DRAF = SIMRS terkini; FINAL = nilai yang dibekukan saat difinalkan. Panel di
 * bawahnya menampilkan cara & keadaan keluar persis seperti di SIMRS beserta
 * catatan bila keadaan tak punya pilihan di formulir atau label 48 jam janggal.
 */
export function KeadaanKeluarTertaut({
  nilai,
  status,
  tertaut,
  baca,
}: {
  /** Pilihan formulir yang ditampilkan ("" = tak ada yang tercentang). */
  nilai: string;
  status: StatusIsian;
  /** Isian sudah tertaut ke pendaftaran (punya NOPEN). */
  tertaut: boolean;
  /** Keluar menurut SIMRS (dibaca saat halaman dibuka); null bila isian belum tertaut. */
  baca: BacaKeluarSimrs | null;
}) {
  const keluar = baca?.status === "ada" ? baca.keluar : null;
  const draf = status === "DRAF";
  // Isian final: SIMRS bisa berubah sesudahnya — beri tahu, jangan ubah dokumen final diam-diam.
  const berubahSetelahFinal = !draf && baca?.status !== "gagal" && baca != null && (keluar?.nilaiForm ?? "") !== nilai;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span id="label-keadaan-keluar" className="text-xs font-medium text-fg-muted">
          Keadaan Keluar
        </span>
        <span
          title="Diambil dari data pasien pulang di SIMRS. Bila keliru, perbaiki di SIMRS."
          className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold leading-none text-brand-soft-fg"
        >
          <Link2 className="size-2.5" aria-hidden />
          Tertaut SIMRS
        </span>
      </div>

      <ul aria-labelledby="label-keadaan-keluar" data-kolom-tertaut="keadaanKeluar" className="flex flex-wrap gap-2">
        {KEADAAN_KELUAR_OPTS.map((o) => {
          const aktif = nilai === o;
          return (
            <li
              key={o}
              aria-current={aktif ? "true" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium",
                aktif ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border bg-surface-2/40 text-fg-subtle",
              )}
            >
              {aktif && <Check className="size-3.5" aria-hidden />}
              {o}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 space-y-2 rounded-[var(--radius-md)] border border-border bg-surface-2/40 p-3 text-xs text-fg-muted">
        {!tertaut ? (
          <p>Terisi dari SIMRS setelah isian ditautkan ke pendaftaran pasien.</p>
        ) : baca?.status === "gagal" ? (
          <Catatan nada="peringatan">SIMRS tidak dapat dibaca saat ini. Ditampilkan nilai terakhir yang tersimpan.</Catatan>
        ) : baca?.status === "kosong" ? (
          <p>
            {draf
              ? "Pasien belum dipulangkan di SIMRS. Keadaan keluar terisi otomatis setelah kepulangan pasien dicatat di SIMRS."
              : "SIMRS kini tidak mencatat kepulangan pasien ini."}
          </p>
        ) : keluar ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>Cara keluar</dt>
            <dd className="font-medium text-fg">{keluar.cara?.label ?? "—"}</dd>
            <dt>Keadaan keluar</dt>
            <dd className="font-medium text-fg">{keluar.keadaan?.label ?? "—"}</dd>
            <dt>Dipulangkan</dt>
            <dd className="font-medium tabular-nums text-fg">{formatNilaiIsian(keluar.waktu)}</dd>
          </dl>
        ) : null}

        {keluar?.tanpaPilihan && draf && (
          <Catatan nada="info">
            Keadaan &ldquo;{keluar.keadaan?.label}&rdquo; tidak ada pada pilihan formulir RM.01, jadi tidak ada kotak yang
            dicentang.
          </Catatan>
        )}
        {keluar?.selisih48 && (
          <Catatan nada="peringatan">
            SIMRS mencatat &ldquo;{keluar.keadaan?.label}&rdquo;, padahal pasien keluar {keluar.selisih48.jam} jam setelah
            pendaftaran (sesuai waktu: &ldquo;{keluar.selisih48.sesuaiWaktu}&rdquo;). Formulir mengikuti catatan SIMRS —
            perbaiki data pasien pulang di SIMRS bila keliru.
          </Catatan>
        )}
        {keluar?.meninggal && draf && (
          <Catatan nada="info" ikon={HeartPulse}>
            Pasien meninggal menurut SIMRS. Lengkapi <b>Sebab Kematian</b> (halaman 2) di bawah.
          </Catatan>
        )}
        {!draf && (
          <p>
            Nilai dari SIMRS saat isian difinalkan.
            {berubahSetelahFinal &&
              ` SIMRS kini mencatat "${keluar?.keadaan?.label ?? "belum pulang"}" — buka koreksi lalu finalkan ulang untuk memperbaruinya.`}
          </p>
        )}
        <p className="text-fg-subtle">Hanya baca. Perubahan dilakukan di SIMRS (data pasien pulang).</p>
      </div>
    </div>
  );
}

function Catatan({
  nada,
  ikon,
  children,
}: {
  nada: "info" | "peringatan";
  ikon?: typeof Info;
  children: React.ReactNode;
}) {
  const Ikon = ikon ?? (nada === "peringatan" ? TriangleAlert : Info);
  // Teks memakai warna teks (kontras AA); warna status hanya pada ikon.
  return (
    <p data-catatan={nada} className={cn("flex items-start gap-1.5", nada === "peringatan" ? "text-fg" : "text-fg-muted")}>
      <Ikon className={cn("mt-px size-3.5 shrink-0", nada === "peringatan" ? "text-warning" : "text-fg-subtle")} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
