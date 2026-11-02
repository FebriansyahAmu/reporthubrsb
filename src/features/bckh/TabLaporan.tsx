"use client";

import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Download, ExternalLink, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { downloadFromEndpoint } from "@/lib/download";
import { useAsyncData } from "@/lib/useAsyncData";
import { tanggalPanjang } from "@/server/modules/bckh/bckh.aturan";
import type { LaporanResult } from "@/server/modules/bckh/bckh.types";
import type { HakBckh } from "./tab";
import { PengaturanModal } from "./PengaturanModal";
import { PemilihBulan, bulanBawaan, labelBulan } from "./ui";

/** Pratinjau & unduh Laporan Kinerja Harian (PDF 1:1 dokumen contoh). */
export function TabLaporan({
  u,
  hariIni,
  hak,
  segar,
  onIsi,
  onUbahProfil,
}: {
  u: string | null;
  hariIni: string;
  hak: HakBckh;
  segar: number;
  onIsi?: (tanggal: string) => void;
  onUbahProfil?: () => void;
}) {
  const toast = useToast();
  const [bulan, setBulan] = useState(() => bulanBawaan(hariIni));
  const [unduh, setUnduh] = useState(false);
  const [atur, setAtur] = useState(false);
  const [versiAtur, setVersiAtur] = useState(0);
  const q = new URLSearchParams({ bulan, ...(u ? { u } : {}) });
  const { result: lap, loading, error, reload } = useAsyncData<LaporanResult>(
    () => apiGet<LaporanResult>(`/api/bckh/laporan?${q}`),
    [bulan, u, segar, versiAtur],
  );
  const urlPdf = `/api/bckh/laporan/pdf?${q}`;

  const unduhPdf = async () => {
    setUnduh(true);
    try {
      const { filename } = await downloadFromEndpoint(`${urlPdf}&unduh=1`, `BCKH_${bulan}.pdf`);
      toast.success("Laporan diunduh", filename);
    } catch (e) {
      toast.error("Gagal mengunduh laporan", e instanceof Error ? e.message : undefined);
    } finally {
      setUnduh(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <PemilihBulan bulan={bulan} onChange={setBulan} maks={hariIni.slice(0, 7)} />
        {/* Sempit: tombol mengisi selebar kolom (rapi dua/tiga sejajar); lebar: rata kanan. */}
        <div className="flex w-full flex-wrap gap-2 @2xl:ml-auto @2xl:w-auto">
          {hak.atur && (
            <Button variant="ghost" size="sm" className="flex-1 @2xl:flex-none" icon={<Settings2 className="size-4" />} onClick={() => setAtur(true)}>
              Pengaturan<span className="hidden @md:inline"> laporan</span>
            </Button>
          )}
          {hak.cetak && (
            <>
              <a
                href={urlPdf}
                target="_blank"
                rel="noopener"
                className="inline-flex h-8 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] border border-border bg-surface px-3 text-[13px] font-medium text-fg transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring @2xl:flex-none"
              >
                <ExternalLink className="size-4" aria-hidden />
                <span className="@md:hidden">Cetak</span>
                <span className="hidden @md:inline">Buka untuk cetak</span>
              </a>
              <Button size="sm" className="flex-1 @2xl:flex-none" icon={<Download className="size-4" />} loading={unduh} onClick={() => void unduhPdf()} disabled={!lap}>
                Unduh PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {error && !lap ? (
        <ErrorState onRetry={reload} />
      ) : !lap ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className={cn("grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_17rem]", loading && "opacity-60")}>
          <Kertas lap={lap} />
          <aside className="order-first grid content-start gap-4 @xl:grid-cols-2 @5xl:order-none @5xl:grid-cols-1">
            <section className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-fg">Kelengkapan</h3>
              {lap.kurang.length === 0 ? (
                <p className="mt-2 flex items-start gap-2 text-sm text-success">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Siap dicetak
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {lap.kurang.map((k) => (
                    <li key={k} className="flex items-start gap-2 text-sm text-warning">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {k}
                    </li>
                  ))}
                </ul>
              )}
              {onUbahProfil && lap.kurang.some((k) => /profil/.test(k)) && (
                <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={onUbahProfil}>
                  Lengkapi profil
                </Button>
              )}
              <dl className="mt-4 space-y-2 border-t border-border pt-3 text-xs">
                <Ttd label="Yang melaporkan" nama={lap.profil.namaTtd} />
                <Ttd label="Atasan langsung" nama={lap.profil.atasanNama} nip={lap.profil.atasanNip} />
                <Ttd label="Mengetahui" nama={lap.pengaturan.mengetahuiNama} nip={lap.pengaturan.mengetahuiNip} />
              </dl>
            </section>

            <section className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-fg">Hari kerja belum diisi</h3>
              {lap.hariKerjaKosong.length === 0 ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-fg-muted">
                  <Check className="size-4 text-success" aria-hidden />
                  Tidak ada
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-fg-muted">Hari tanpa catatan tidak tercetak di laporan.</p>
                  <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                    {lap.hariKerjaKosong.map((t) => (
                      <li key={t} className="flex items-center justify-between gap-2 text-sm text-fg">
                        {tanggalPanjang(t).replace(/ \d{4}$/, "")}
                        {onIsi && (
                          <button
                            type="button"
                            onClick={() => onIsi(t)}
                            aria-label={`Isi ${tanggalPanjang(t)}`}
                            className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-brand transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                          >
                            <Plus className="size-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </aside>
        </div>
      )}

      {hak.atur && (
        <PengaturanModal
          open={atur}
          onClose={() => setAtur(false)}
          onTersimpan={() => {
            setAtur(false);
            setVersiAtur((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function Ttd({ label, nama, nip }: { label: string; nama: string; nip?: string }) {
  return (
    <div>
      <dt className="text-fg-subtle">{label}</dt>
      <dd className={cn("font-medium", nama ? "text-fg" : "italic text-warning")}>{nama || "Belum diisi"}</dd>
      {nip && <dd className="text-fg-muted tabular">NIP. {nip}</dd>}
    </div>
  );
}

/**
 * Pratinjau bergaya kertas (Times, seperti PDF) — isi sama dengan PDF. Kertas
 * sempit (ponsel) → tiap baris tabel jadi blok bertumpuk (NO · HARI/TANGGAL,
 * catatan, target, KET) agar tak perlu digulir menyamping.
 */
function Kertas({ lap }: { lap: LaporanResult }) {
  const th = "border border-black px-1.5 py-1 font-bold";
  // overflow-wrap:anywhere → kata/URL panjang tak melebarkan tabel melewati kertas.
  const td = "border border-black px-1.5 py-1 align-top [overflow-wrap:anywhere]";
  return (
    <div className="min-w-0 rounded-[var(--radius-md)] border border-border bg-[#e9eef2] p-2 @md:p-5">
      <div className="@container mx-auto max-w-[46rem] bg-white p-3 text-black shadow-sm @md:p-8">
        <p className="mb-1 text-center font-[Arial,Helvetica,sans-serif] text-sm font-bold">LAPORAN KINERJA HARIAN</p>
        <p className="mb-4 text-center font-[Arial,Helvetica,sans-serif] text-xs font-bold">
          TAHUN {lap.tahun} · ( BULAN {lap.namaBulan.toUpperCase()} ) · {lap.profil.namaLengkap}
        </p>
        <ol data-pratinjau="ringkas" className="border border-black font-[Times_New_Roman,Times,serif] text-[13px] leading-snug @[32rem]:hidden">
          {lap.baris.length === 0 ? (
            <li className="px-3 py-6 text-center italic text-neutral-500">Belum ada catatan pada {labelBulan(lap.bulan)}.</li>
          ) : (
            lap.baris.map((b) => (
              <li key={b.tanggal} className="border-t border-black px-2.5 py-2 first:border-t-0">
                <p className="flex items-baseline justify-between gap-2 font-bold">
                  <span>
                    {b.no}. {b.hariTanggal}
                  </span>
                  {b.target && <span className="shrink-0 text-[11px]">✓ {b.target}</span>}
                </p>
                <ul className="mt-1">
                  {b.catatan.map((c, i) => (
                    <li key={i} className="grid grid-cols-[0.9rem_1fr] pl-1">
                      <span>-</span>
                      <span className="min-w-0 [overflow-wrap:anywhere]">{c}</span>
                    </li>
                  ))}
                </ul>
                {b.ket && <p className="mt-1 text-[12px] [overflow-wrap:anywhere]">KET: {b.ket}</p>}
              </li>
            ))
          )}
        </ol>
        <div className="hidden @[32rem]:block">
          <table data-pratinjau="tabel" className="w-full border-collapse font-[Times_New_Roman,Times,serif] text-[13px] leading-snug">
            <thead>
              <tr>
                <th rowSpan={2} className={cn(th, "w-8")}>NO</th>
                <th rowSpan={2} className={cn(th, "w-28 text-left")}>HARI / TANGGAL</th>
                <th rowSpan={2} className={th}>CATATAN KINERJA</th>
                <th colSpan={2} className={th}>TARGET</th>
                <th rowSpan={2} className={cn(th, "w-20")}>KET</th>
              </tr>
              <tr>
                <th className={cn(th, "w-16")}>PROSES</th>
                <th className={cn(th, "w-16")}>SELESAI</th>
              </tr>
            </thead>
            <tbody>
              {lap.baris.length === 0 ? (
                <tr>
                  <td colSpan={6} className={cn(td, "py-6 text-center italic text-neutral-500")}>
                    Belum ada catatan pada {labelBulan(lap.bulan)}.
                  </td>
                </tr>
              ) : (
                lap.baris.map((b) => (
                  <tr key={b.tanggal}>
                    <td className={cn(td, "text-center")}>{b.no}.</td>
                    <td className={td}>{b.hariTanggal}</td>
                    <td className={cn(td, "align-middle")}>
                      <ul>
                        {b.catatan.map((c, i) => (
                          <li key={i} className="grid grid-cols-[1.1rem_1fr] pl-4">
                            <span>-</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className={cn(td, "text-center align-middle")}>{b.target === "PROSES" ? "✓" : ""}</td>
                    <td className={cn(td, "text-center align-middle")}>{b.target === "SELESAI" ? "✓" : ""}</td>
                    <td className={cn(td, "text-center align-middle")}>{b.ket}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
