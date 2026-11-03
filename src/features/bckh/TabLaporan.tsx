"use client";

import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Download, ExternalLink, Lock, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { downloadFromEndpoint } from "@/lib/download";
import { useAsyncData } from "@/lib/useAsyncData";
import { tanggalPanjang } from "@/server/modules/bckh/bckh.aturan";
import type { LaporanResult, StatusBulanDto } from "@/server/modules/bckh/bckh.types";
import type { HakBckh } from "./tab";
import { KartuPersetujuan } from "./KartuPersetujuan";
import { KertasLaporan } from "./KertasLaporan";
import { PengaturanModal } from "./PengaturanModal";
import { PemilihBulan, bulanBawaan } from "./ui";

/**
 * Pratinjau & unduh Laporan Kinerja Harian (PDF 1:1 dokumen contoh) + kartu
 * persetujuan & tanda tangan bulan terpilih. Pengajuan aktif → pratinjau & PDF =
 * snapshot yang diajukan (bertanda tangan); catatan bulan itu terkunci.
 */
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
  const [versiAju, setVersiAju] = useState(0);
  const q = new URLSearchParams({ bulan, ...(u ? { u } : {}) });
  const { result: lap, loading, error, reload } = useAsyncData<LaporanResult>(
    () => apiGet<LaporanResult>(`/api/bckh/laporan?${q}`),
    [bulan, u, segar, versiAtur, versiAju],
  );
  // Status persetujuan bulan ini: pengajuan aktif → pratinjau = snapshot yang diajukan + TTD.
  const { result: aju, reload: muatAju } = useAsyncData<StatusBulanDto>(
    () => apiGet<StatusBulanDto>(`/api/bckh/pengajuan?${q}`),
    [bulan, u, segar, versiAtur, versiAju],
  );
  const aktif = aju?.bulan === bulan ? aju.aktif : null;
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
        <div className={cn("grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_18rem]", loading && "opacity-60")}>
          <div className="min-w-0 space-y-2">
            {aktif && (
              <p className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-xs text-fg-muted">
                <Lock className="size-3.5 shrink-0" aria-hidden />
                Pratinjau sesuai yang diajukan {new Date(aktif.diajukanAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} — catatan bulan ini terkunci.
              </p>
            )}
            <KertasLaporan lap={aktif?.isi ?? lap} ttd={aktif?.ttd} />
          </div>
          <aside className="order-first grid content-start gap-4 @xl:grid-cols-2 @5xl:order-none @5xl:grid-cols-1">
            <KartuPersetujuan
              status={aju?.bulan === bulan ? aju : null}
              lap={lap}
              bolehAjukan={lap.milikSendiri && hak.ubah}
              onUbahProfil={onUbahProfil}
              onBerubah={() => {
                setVersiAju((n) => n + 1);
                void muatAju();
              }}
            />
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
                        {onIsi && !aktif && (
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
