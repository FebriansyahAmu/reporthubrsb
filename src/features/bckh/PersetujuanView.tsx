"use client";

import { useEffect, useState } from "react";
import { ArrowRight, History, Inbox, MessageSquareQuote, PenLine, UsersRound } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { NumberedPagination } from "@/components/ui/NumberedPagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { formatRelatif } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import type { KotakMasukResult, PengajuanDto } from "@/server/modules/bckh/bckh.types";
import { langkahPengajuan } from "./KartuPersetujuan";
import { PegawaiSaya } from "./PegawaiSaya";
import type { TabPersetujuan } from "./tab";
import { TinjauPengajuan } from "./TinjauPengajuan";
import { AvatarBckh, LencanaPengajuan, Penghitung, labelBulan } from "./ui";

/** `pendek` = label bila kolom sempit (tab jadi 3 kolom berikon, tak pernah menggulir). */
const INFO_TAB: Record<TabPersetujuan, { label: string; pendek: string; ikon: typeof Inbox }> = {
  menunggu: { label: "Perlu tanda tangan", pendek: "Tanda tangan", ikon: Inbox },
  riwayat: { label: "Riwayat", pendek: "Riwayat", ikon: History },
  pegawai: { label: "Pegawai saya", pendek: "Pegawai", ikon: UsersRound },
};

/**
 * Menu atasan "Pegawai & Persetujuan" (PRD §15.4): kotak pengajuan yang menunggu
 * tanda tangan penampil, riwayat yang pernah ditujukan kepadanya, dan daftar
 * pegawai bawahan (master–detail). `?tab=` & `?buka=<id>` (panel tinjau) di URL.
 */
export function PersetujuanView({
  hariIni,
  tabAwal,
  bukaAwal,
  menungguAwal,
  bolehCetak,
}: {
  hariIni: string;
  tabAwal: TabPersetujuan;
  bukaAwal: string | null;
  menungguAwal: number;
  bolehCetak: boolean;
}) {
  const [tab, setTab] = useState<TabPersetujuan>(tabAwal);
  const [buka, setBuka] = useState<string | null>(bukaAwal);
  const [segar, setSegar] = useState(0);
  const [menunggu, setMenunggu] = useState<number>(menungguAwal);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === "menunggu") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    if (buka) url.searchParams.set("buka", buka);
    else url.searchParams.delete("buka");
    window.history.replaceState(null, "", url);
  }, [tab, buka]);

  return (
    <div className="@container space-y-5">
      <nav aria-label="Bagian persetujuan" className="grid grid-cols-3 border-b border-border @xl:flex @xl:gap-1">
        {(Object.keys(INFO_TAB) as TabPersetujuan[]).map((t) => {
          const { label, pendek, ikon: Ikon } = INFO_TAB[t];
          const aktif = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={aktif ? "page" : undefined}
              aria-label={label}
              className={cn(
                "relative -mb-px flex min-w-0 flex-col items-center justify-center gap-1.5 border-b-2 px-1 pb-2 pt-2.5 text-xs leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring",
                "@xl:shrink-0 @xl:flex-row @xl:gap-2 @xl:px-3 @xl:py-3 @xl:text-sm @xl:leading-normal",
                aktif ? "border-brand-ring font-semibold text-fg" : "border-transparent text-fg-muted hover:border-border-strong hover:text-fg",
              )}
            >
              <Ikon className={cn("size-[18px] shrink-0 @xl:size-4", aktif ? "text-fg" : "text-fg-subtle")} aria-hidden />
              <span className="max-w-full truncate">
                <span className="@xl:hidden">{pendek}</span>
                <span className="hidden @xl:inline">{label}</span>
              </span>
              {t === "menunggu" && menunggu > 0 && (
                <Penghitung
                  n={menunggu}
                  className="absolute left-[calc(50%+0.4rem)] top-1 bg-warning-soft px-1 py-0 text-[10px] leading-4 text-warning @xl:static @xl:px-1.5 @xl:py-px @xl:text-[11px] @xl:leading-normal"
                />
              )}
            </button>
          );
        })}
      </nav>

      {tab === "pegawai" ? (
        <PegawaiSaya hariIni={hariIni} bolehCetak={bolehCetak} segar={segar} onTinjau={setBuka} />
      ) : (
        <KotakMasuk key={tab} tab={tab} segar={segar} onMenunggu={setMenunggu} onTinjau={setBuka} />
      )}

      <TinjauPengajuan id={buka} bolehCetak={bolehCetak} onClose={() => setBuka(null)} onBerubah={() => setSegar((n) => n + 1)} />
    </div>
  );
}

function KotakMasuk({
  tab,
  segar,
  onMenunggu,
  onTinjau,
}: {
  tab: "menunggu" | "riwayat";
  segar: number;
  onMenunggu: (n: number) => void;
  onTinjau: (id: string) => void;
}) {
  const [halaman, setHalaman] = useState(1);
  const [kini] = useState(() => Date.now());
  const { result, loading, error, reload } = useAsyncData<KotakMasukResult>(
    () => apiGet<KotakMasukResult>(`/api/bckh/persetujuan?tab=${tab}&halaman=${halaman}`),
    [tab, halaman, segar],
  );
  useEffect(() => {
    if (result) onMenunggu(result.menunggu);
  }, [result, onMenunggu]);

  if (error && !result) return <ErrorState onRetry={reload} />;
  if (!result) return <Skeleton className="h-64 w-full" />;
  if (result.total === 0) {
    return tab === "menunggu" ? (
      <EmptyState title="Tidak ada laporan yang menunggu tanda tangan Anda" description="Laporan yang diajukan pegawai bawahan muncul di sini. Lihat tab Pegawai saya untuk memantau pengisian mereka." />
    ) : (
      <EmptyState title="Belum ada riwayat" description="Laporan yang pernah Anda setujui, tolak, atau yang ditarik pegawai tercatat di sini." />
    );
  }

  return (
    <div className="space-y-4">
      {tab === "menunggu" ? (
        <ul className={cn("grid gap-3 @3xl:grid-cols-2", loading && "opacity-60")} aria-label="Laporan menunggu tanda tangan">
          {result.item.map((p) => (
            <KartuMenunggu key={p.id} p={p} kini={kini} onTinjau={() => onTinjau(p.id)} />
          ))}
        </ul>
      ) : (
        <ul className={cn("divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface", loading && "opacity-60")} aria-label="Riwayat persetujuan">
          {result.item.map((p) => (
            <BarisRiwayat key={p.id} p={p} kini={kini} onTinjau={() => onTinjau(p.id)} />
          ))}
        </ul>
      )}
      {result.jumlahHalaman > 1 && (
        <div className="flex justify-center">
          <NumberedPagination page={result.halaman} totalPages={result.jumlahHalaman} onPageChange={setHalaman} disabled={loading} />
        </div>
      )}
    </div>
  );
}

function KartuMenunggu({ p, kini, onTinjau }: { p: PengajuanDto; kini: number; onTinjau: () => void }) {
  const langkah = langkahPengajuan(p);
  return (
    <li className="group flex flex-col rounded-[var(--radius-md)] border border-border bg-surface p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-3">
        <AvatarBckh userId={p.pegawai.id} versi={p.pegawai.avatar} className="size-11 shrink-0 border border-border" label="" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{p.pegawai.nama}</p>
          <p className="truncate text-xs text-fg-muted">{p.pegawai.jabatan || p.pegawai.username}</p>
        </div>
        <LencanaPengajuan status={p.status} className="shrink-0" />
      </div>

      <p className="mt-3 text-base font-semibold text-fg">Laporan {labelBulan(p.bulan)}</p>
      <p className="mt-0.5 text-xs tabular text-fg-muted">
        {p.ringkas.hari} hari · {p.ringkas.kegiatan} kegiatan · diajukan {formatRelatif(p.diajukanAt, kini)}
      </p>

      {/* Jejak tahapan ringkas: titik per penanda tangan. */}
      <ol className="mt-3 flex items-center gap-1.5" aria-label="Tahapan">
        {langkah.map((s, i) => (
          <li key={s.peran} className="flex items-center gap-1.5">
            <span
              title={`${s.judul}${s.nama ? ` — ${s.nama}` : ""}`}
              className={cn(
                "size-2.5 rounded-full",
                s.keadaan === "selesai" ? "bg-success" : s.keadaan === "kini" ? "bg-warning ring-4 ring-warning/20" : "bg-border-strong",
              )}
            />
            <span className={cn("text-[11px]", s.keadaan === "kini" ? "font-semibold text-fg" : "text-fg-subtle")}>{s.judul}</span>
            {i < langkah.length - 1 && <span className="h-px w-3 bg-border-strong" aria-hidden />}
          </li>
        ))}
      </ol>

      {p.catatan && (
        <p className="mt-3 flex gap-2 rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2 text-xs text-fg [overflow-wrap:anywhere]">
          <MessageSquareQuote className="mt-px size-3.5 shrink-0 text-fg-subtle" aria-hidden />
          <span className="line-clamp-3">{p.catatan}</span>
        </p>
      )}

      <button
        type="button"
        onClick={onTinjau}
        className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring sm:self-start"
      >
        <PenLine className="size-4" aria-hidden />
        Tinjau & tanda tangani
      </button>
    </li>
  );
}

function BarisRiwayat({ p, kini, onTinjau }: { p: PengajuanDto; kini: number; onTinjau: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onTinjau}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring"
      >
        <AvatarBckh userId={p.pegawai.id} versi={p.pegawai.avatar} className="size-9 shrink-0 border border-border" label="" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-fg">
            {p.pegawai.nama} <span className="font-normal text-fg-muted">· Laporan {labelBulan(p.bulan)}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
            <LencanaPengajuan status={p.status} />
            <span>{formatRelatif(p.diubahAt, kini)}</span>
            {p.status === "DISETUJUI" && <span className="font-mono">kode {p.kode}</span>}
          </span>
        </span>
        <ArrowRight className="size-4 text-fg-subtle" aria-hidden />
      </button>
    </li>
  );
}
