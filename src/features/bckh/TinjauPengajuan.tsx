"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Ban, CircleX, Download, MessageSquareQuote, PenLine, ShieldAlert, ShieldCheck } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet, apiPost, pesanGalat } from "@/lib/api-client";
import { MAKS_ALASAN } from "@/server/modules/bckh/bckh.constants";
import type { PengajuanDetailDto } from "@/server/modules/bckh/bckh.types";
import { Tahapan } from "./KartuPersetujuan";
import { KertasLaporan } from "./KertasLaporan";
import { TtdBckh } from "./TtdBckh";
import { AvatarBckh, KELAS_TEXTAREA, LencanaPengajuan, labelBulan } from "./ui";

type Mode = null | "setujui" | "tolak" | "batalkan";

/**
 * Panel tinjau pengajuan (drawer kanan; layar penuh di ponsel): kertas laporan
 * SNAPSHOT yang diajukan + TTD yang sudah ada, tahapan, catatan pegawai. Penanda
 * tangan yang mendapat giliran → "Setujui & tanda tangani" (TTD) / "Tolak" (alasan);
 * laporan disetujui → penanda tangannya bisa "Batalkan persetujuan".
 */
export function TinjauPengajuan({
  id,
  bolehCetak,
  onClose,
  onBerubah,
}: {
  id: string | null;
  bolehCetak: boolean;
  onClose: () => void;
  onBerubah: () => void;
}) {
  const toast = useToast();
  const [p, setP] = useState<PengajuanDetailDto | null>(null);
  const [galat, setGalat] = useState(false);
  const [coba, setCoba] = useState(0);
  const [mode, setMode] = useState<Mode>(null);
  const [ttd, setTtd] = useState("");
  const [alasan, setAlasan] = useState("");
  const [kirim, setKirim] = useState(false);

  useEffect(() => {
    if (!id) return;
    const ac = new AbortController();
    /* eslint-disable react-hooks/set-state-in-effect -- reset panel tiap pengajuan dibuka */
    setP(null);
    setGalat(false);
    setMode(null);
    setTtd("");
    setAlasan("");
    /* eslint-enable react-hooks/set-state-in-effect */
    apiGet<PengajuanDetailDto>(`/api/bckh/persetujuan/${id}`, { signal: ac.signal })
      .then(setP)
      .catch(() => !ac.signal.aborted && setGalat(true));
    return () => ac.abort();
  }, [id, coba]);

  const jalankan = async () => {
    if (!p || !mode) return;
    setKirim(true);
    try {
      if (mode === "setujui") {
        const baru = await apiPost<PengajuanDetailDto>(`/api/bckh/persetujuan/${p.id}/setujui`, { ttd });
        toast.success(baru.status === "DISETUJUI" ? "Laporan disahkan" : "Laporan disetujui", baru.status === "DISETUJUI" ? `Kode verifikasi ${baru.kode}.` : "Diteruskan ke penanda tangan Mengetahui.");
        setP(baru);
      } else {
        await apiPost(`/api/bckh/persetujuan/${p.id}/${mode}`, { alasan });
        toast.success(mode === "tolak" ? "Laporan ditolak" : "Persetujuan dibatalkan", "Pegawai dapat memperbaiki catatannya lalu mengajukan ulang.");
        setCoba((c) => c + 1);
      }
      setMode(null);
      onBerubah();
    } catch (e) {
      toast.error("Tindakan gagal", pesanGalat(e));
    } finally {
      setKirim(false);
    }
  };

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      size="xl"
      title={p ? `Laporan ${labelBulan(p.bulan)} — ${p.pegawai.nama}` : "Tinjau laporan"}
      header={
        p ? (
          <div className="flex min-w-0 items-center gap-3">
            <AvatarBckh userId={p.pegawai.id} versi={p.pegawai.avatar} className="size-10 shrink-0 border border-border" label="" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">{p.pegawai.nama}</p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
                <span>Laporan {labelBulan(p.bulan)}</span>
                <LencanaPengajuan status={p.status} />
              </p>
            </div>
          </div>
        ) : undefined
      }
    >
      {galat && !p ? (
        <div className="p-5">
          <ErrorState onRetry={() => setCoba((c) => c + 1)} />
        </div>
      ) : !p ? (
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Skeleton className="h-[28rem] w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="@container">
          {/* Lebar: kertas di kolom utama, tahapan & tindakan di kanan; sempit: tindakan di atas kertas. */}
          <div className="grid gap-5 p-4 @md:p-5 @3xl:grid-cols-[minmax(0,1fr)_18rem]">
            <KertasLaporan lap={p.isi} ttd={p.ttd} className="@3xl:order-first" />
            <aside className="order-first space-y-4 @3xl:order-none @3xl:sticky @3xl:top-0 @3xl:self-start">
              <section className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
                <h3 className="text-sm font-semibold text-fg">Tahapan</h3>
                <Tahapan p={p} />
              </section>

              <section className="rounded-[var(--radius-md)] border border-border bg-surface p-4 text-xs">
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-fg-subtle">Hari tercatat</dt>
                    <dd className="text-lg font-semibold tabular text-fg">{p.ringkas.hari}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-subtle">Kegiatan</dt>
                    <dd className="text-lg font-semibold tabular text-fg">{p.ringkas.kegiatan}</dd>
                  </div>
                </dl>
                <p className={cn("mt-3 flex items-start gap-1.5", p.isiUtuh ? "text-success" : "text-danger")}>
                  {p.isiUtuh ? <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden /> : <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />}
                  {p.isiUtuh ? `Isi utuh sejak diajukan · kode ${p.kode}` : "Isi tidak cocok dengan sidik saat diajukan — jangan disetujui, hubungi admin."}
                </p>
                {p.catatan && (
                  <blockquote className="mt-3 flex gap-2 rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2 text-fg [overflow-wrap:anywhere]">
                    <MessageSquareQuote className="mt-px size-3.5 shrink-0 text-fg-subtle" aria-hidden />
                    {p.catatan}
                  </blockquote>
                )}
                {p.alasan && (
                  <p className="mt-3 rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-fg [overflow-wrap:anywhere]">
                    <b className="font-semibold">Alasan:</b> {p.alasan}
                    {p.diakhiriOleh && <span className="text-fg-muted"> — {p.diakhiriOleh}</span>}
                  </p>
                )}
                {bolehCetak && (
                  <a
                    href={`/api/bckh/laporan/pdf?${new URLSearchParams({ bulan: p.bulan, u: p.pegawai.id })}`}
                    target="_blank"
                    rel="noopener"
                    className="mt-3 inline-flex items-center gap-1.5 font-medium text-brand hover:underline"
                  >
                    <Download className="size-3.5" aria-hidden />
                    Buka PDF
                  </a>
                )}
              </section>

              {(p.aksi.setujui || p.aksi.batalkan) && (
                <Tindakan
                  p={p}
                  mode={mode}
                  setMode={setMode}
                  ttd={ttd}
                  setTtd={setTtd}
                  alasan={alasan}
                  setAlasan={setAlasan}
                  kirim={kirim}
                  onJalankan={() => void jalankan()}
                />
              )}
            </aside>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Tindakan({
  p,
  mode,
  setMode,
  ttd,
  setTtd,
  alasan,
  setAlasan,
  kirim,
  onJalankan,
}: {
  p: PengajuanDetailDto;
  mode: Mode;
  setMode: (m: Mode) => void;
  ttd: string;
  setTtd: (s: string) => void;
  alasan: string;
  setAlasan: (s: string) => void;
  kirim: boolean;
  onJalankan: () => void;
}) {
  const peran = p.status === "MENUNGGU_MENGETAHUI" ? "Mengetahui" : "Atasan langsung";
  return (
    <section className="rounded-[var(--radius-md)] border border-brand/30 bg-brand-soft/40 p-4" aria-label="Tindakan">
      {mode === null && p.aksi.setujui && (
        <div className="space-y-2">
          <p className="text-xs text-fg-muted">Laporan ini menunggu tanda tangan Anda sebagai <b className="font-semibold text-fg">{peran}</b>.</p>
          <Button size="sm" className="w-full" icon={<PenLine className="size-4" />} onClick={() => setMode("setujui")} disabled={!p.isiUtuh}>
            Setujui & tanda tangani
          </Button>
          <Button variant="secondary" size="sm" className="w-full" icon={<CircleX className="size-4" />} onClick={() => setMode("tolak")}>
            Tolak
          </Button>
        </div>
      )}
      {mode === null && p.aksi.batalkan && (
        <div className="space-y-2">
          <p className="text-xs text-fg-muted">Laporan ini sudah disahkan. Batalkan bila ternyata perlu diperbaiki — catatan pegawai akan terbuka lagi.</p>
          <Button variant="secondary" size="sm" className="w-full" icon={<Ban className="size-4" />} onClick={() => setMode("batalkan")}>
            Batalkan persetujuan
          </Button>
        </div>
      )}

      {mode === "setujui" && (
        <div className="space-y-3">
          <TtdBckh label={`Tanda tangan Anda (${peran})`} value={ttd} onChange={setTtd} konteks={`Laporan ${labelBulan(p.bulan)} — ${p.pegawai.nama}`} />
          <p className="text-[11px] text-fg-muted">Dengan menandatangani, Anda menyetujui isi laporan seperti pada pratinjau.</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setMode(null)} disabled={kirim}>
              Batal
            </Button>
            <Button size="sm" className="flex-1" loading={kirim} disabled={!ttd} onClick={onJalankan}>
              Setujui
            </Button>
          </div>
        </div>
      )}

      {(mode === "tolak" || mode === "batalkan") && (
        <div className="space-y-3">
          <label htmlFor="tinjau-alasan" className="block text-xs font-medium text-fg-muted">
            {mode === "tolak" ? "Alasan menolak (dibaca pegawai)" : "Alasan membatalkan persetujuan"}
          </label>
          <textarea
            id="tinjau-alasan"
            rows={3}
            maxLength={MAKS_ALASAN}
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder={mode === "tolak" ? "Mis. kegiatan tanggal 12 belum sesuai surat tugas" : "Mis. ada kegiatan yang perlu dikoreksi"}
            className={KELAS_TEXTAREA}
            autoFocus
          />
          <p className="flex items-start gap-1.5 text-[11px] text-warning">
            <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
            Catatan {labelBulan(p.bulan)} pegawai terbuka lagi untuk diperbaiki.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setMode(null)} disabled={kirim}>
              Batal
            </Button>
            <Button variant="danger" size="sm" className="flex-1" loading={kirim} disabled={!alasan.trim()} onClick={onJalankan}>
              {mode === "tolak" ? "Tolak" : "Batalkan"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
