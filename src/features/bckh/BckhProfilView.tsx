"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, BookOpenText, Building2, Camera, FileText, Flame, History, IdCard, LayoutList, Pencil, Plus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatNumber } from "@/lib/format";
import type { KegiatanRutin, ProfilDto, ProfilResult } from "@/server/modules/bckh/bckh.types";
import { AvatarModal } from "./AvatarModal";
import { CatatDrawer } from "./CatatDrawer";
import { ProfilModal } from "./ProfilModal";
import { TabDasbor } from "./TabDasbor";
import { TabIkhtisar } from "./TabIkhtisar";
import { TabKegiatan } from "./TabKegiatan";
import { TabLaporan } from "./TabLaporan";
import { TabLog } from "./TabLog";
import { TAB_BCKH, type HakBckh, type TabBckh } from "./tab";
import { AvatarBckh, Penghitung } from "./ui";

/** `lanjutan` = sambungan label yang hanya tampil bila bar tab lebar ("Log" → "Log Pengisian"). */
const INFO_TAB: Record<TabBckh, { label: string; lanjutan?: string; ikon: typeof BookOpenText }> = {
  ikhtisar: { label: "Summary", ikon: BookOpenText },
  kegiatan: { label: "Kegiatan", ikon: LayoutList },
  log: { label: "Log", lanjutan: " Pengisian", ikon: History },
  dasbor: { label: "Dasbor", ikon: BarChart3 },
  laporan: { label: "Laporan", ikon: FileText },
};

/**
 * Halaman profil BCKH ala profil GitHub: sidebar identitas + tab (Summary,
 * Kegiatan, Log Pengisian, Dasbor, Laporan). `targetId` null = profil sendiri;
 * selain itu hanya-lihat (pemegang `bckh.tim`). Tab disimpan di `?tab=`.
 *
 * Responsif tanpa gulir menyamping: sidebar identitas di kiri hanya mulai
 * `xl` (di bawahnya jadi kepala profil di atas); kolom isi adalah container —
 * bar tab & isi tab menyesuaikan LEBAR KOLOM (bukan layar), sehingga tetap pas
 * baik di ponsel maupun di laptop bersidebar.
 */
export function BckhProfilView({ targetId, hak, tabAwal }: { targetId: string | null; hak: HakBckh; tabAwal: TabBckh }) {
  const [tab, setTab] = useState<TabBckh>(tabAwal);
  const [tahun, setTahun] = useState<number | null>(null);
  const [segar, setSegar] = useState(0);
  const [sorot, setSorot] = useState<string | null>(null);
  const [catat, setCatat] = useState<{ tanggal: string; tambahan: KegiatanRutin | null } | null>(null);
  const [ubahProfil, setUbahProfil] = useState(false);
  const [ubahAvatar, setUbahAvatar] = useState(false);
  const [bulanKegiatan, setBulanKegiatan] = useState<string | null>(null);

  const u = targetId ? `&u=${encodeURIComponent(targetId)}` : "";
  const { result, loading, error, reload } = useAsyncData<ProfilResult>(
    () => apiGet<ProfilResult>(`/api/bckh/profil?${tahun ? `tahun=${tahun}` : ""}${u}`),
    [tahun, targetId, segar],
  );
  const bolehCatat = !!result?.milikSendiri && hak.ubah;

  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === "ikhtisar") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
  }, [tab]);

  const bukaCatat = useCallback(
    (tanggal?: string, tambahan?: KegiatanRutin | null) => {
      if (!result) return;
      setCatat({ tanggal: tanggal ?? result.hariIni, tambahan: tambahan ?? null });
    },
    [result],
  );

  const tersimpan = (tanggal: string) => {
    setCatat(null);
    setSorot(tanggal);
    setSegar((n) => n + 1);
    // Tahun grafik ikut tanggal yang disimpan bila di luar rentang tampil.
    if (result && (tanggal < result.rentang.dari || tanggal > result.rentang.sampai)) setTahun(Number(tanggal.slice(0, 4)));
  };

  if (error && !result) return <ErrorState onRetry={reload} />;
  const profil = result?.profil;
  const bolehUbahAvatar = !!result?.milikSendiri && hak.ubah;

  return (
    <div className={cn("grid gap-6 xl:grid-cols-[17.5rem_minmax(0,1fr)] xl:gap-8", bolehCatat && "pb-20 sm:pb-0")}>
      <aside className="min-w-0">
        {profil ? (
          <SidebarProfil
            profil={profil}
            avatar={result.avatar}
            streak={result.streak}
            milikSendiri={result.milikSendiri}
            bolehUbah={hak.ubah}
            onUbah={() => setUbahProfil(true)}
            onUbahAvatar={bolehUbahAvatar ? () => setUbahAvatar(true) : undefined}
          />
        ) : (
          <div className="flex items-center gap-4 sm:gap-5 xl:block">
            <Skeleton className="size-20 shrink-0 rounded-full sm:size-24 xl:size-[17.5rem]" />
            <div className="flex-1 space-y-2 xl:mt-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        )}
      </aside>

      <div className="@container min-w-0">
        <div className="sticky top-0 z-10 -mx-1 mb-5 flex items-end gap-2 border-b border-border bg-bg/95 px-1 backdrop-blur supports-[backdrop-filter]:bg-bg/80 @3xl:gap-3">
          {/* Sempit: 5 kolom sama lebar (ikon di atas label pendek); lebar: tab sebaris ala GitHub. Tak pernah menggulir menyamping. */}
          <nav aria-label="Bagian profil" className="-mb-px grid min-w-0 flex-1 grid-cols-5 @3xl:flex @3xl:gap-1">
            {TAB_BCKH.map((t) => {
              const { label, lanjutan, ikon: Ikon } = INFO_TAB[t];
              const aktif = tab === t;
              const hitung = t === "kegiatan" ? result?.hariTercatat : undefined;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-current={aktif ? "page" : undefined}
                  className={cn(
                    "group relative flex min-w-0 flex-col items-center justify-center gap-1.5 border-b-2 px-0.5 pb-2 pt-2.5 text-xs leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring",
                    "@3xl:shrink-0 @3xl:flex-row @3xl:gap-2 @3xl:px-3 @3xl:py-3 @3xl:text-sm @3xl:leading-normal",
                    aktif ? "border-brand-ring font-semibold text-fg" : "border-transparent text-fg-muted hover:border-border-strong hover:text-fg",
                  )}
                >
                  <Ikon className={cn("size-[18px] shrink-0 @3xl:size-4", aktif ? "text-fg" : "text-fg-subtle group-hover:text-fg-muted")} aria-hidden />
                  <span className="max-w-full truncate">
                    {label}
                    {lanjutan && <span className="hidden @3xl:inline">{lanjutan}</span>}
                  </span>
                  {hitung !== undefined && hitung > 0 && (
                    // Sempit: lencana di pojok kanan atas ikon; lebar: penghitung sebaris ala GitHub.
                    <Penghitung
                      n={formatNumber(hitung)}
                      className="absolute left-[calc(50%+0.35rem)] top-1 px-1 py-0 text-[10px] leading-4 @3xl:static @3xl:px-1.5 @3xl:py-px @3xl:text-[11px] @3xl:leading-normal"
                    />
                  )}
                </button>
              );
            })}
          </nav>
          {bolehCatat && (
            <Button size="sm" className="mb-2 hidden shrink-0 px-2.5 sm:inline-flex @3xl:px-3" icon={<Plus className="size-4" />} onClick={() => bukaCatat()} aria-label="Catat kegiatan" title="Catat kegiatan">
              <span className="hidden @3xl:inline">Catat kegiatan</span>
            </Button>
          )}
        </div>

        {tab === "ikhtisar" && (
          <TabIkhtisar
            data={result}
            loading={loading}
            tahun={tahun}
            onTahun={setTahun}
            sorot={sorot}
            onPilihHari={bolehCatat ? (t) => bukaCatat(t) : undefined}
            onPakaiRutin={bolehCatat ? (r) => bukaCatat(undefined, r) : undefined}
            onLihatBulan={(b) => {
              setBulanKegiatan(b);
              setTab("kegiatan");
            }}
          />
        )}
        {tab === "kegiatan" && result && (
          <TabKegiatan
            u={targetId}
            hariIni={result.hariIni}
            bulanAwal={bulanKegiatan ?? result.hariIni.slice(0, 7)}
            segar={segar}
            onUbah={bolehCatat ? (t) => bukaCatat(t) : undefined}
          />
        )}
        {tab === "log" && <TabLog u={targetId} segar={segar} />}
        {tab === "dasbor" && result && <TabDasbor u={targetId} hariIni={result.hariIni} segar={segar} />}
        {tab === "laporan" && result && (
          <TabLaporan
            u={targetId}
            hariIni={result.hariIni}
            hak={hak}
            segar={segar}
            onIsi={bolehCatat ? (t) => bukaCatat(t) : undefined}
            onUbahProfil={result.milikSendiri && hak.ubah ? () => setUbahProfil(true) : undefined}
          />
        )}
      </div>

      {bolehCatat && result && (
        <>
          <CatatDrawer
            open={!!catat}
            tanggalAwal={catat?.tanggal ?? result.hariIni}
            tambahanAwal={catat?.tambahan}
            hariIni={result.hariIni}
            rutin={result.rutin}
            onClose={() => setCatat(null)}
            onTersimpan={tersimpan}
          />
          <button
            type="button"
            onClick={() => bukaCatat()}
            aria-label="Catat kegiatan"
            className="fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-full bg-brand text-brand-fg shadow-md transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 sm:hidden"
          >
            <Plus className="size-6" />
          </button>
        </>
      )}
      {result?.milikSendiri && hak.ubah && (
        <>
          <ProfilModal
            open={ubahProfil}
            profil={result.profil}
            onClose={() => setUbahProfil(false)}
            onTersimpan={() => {
              setUbahProfil(false);
              setSegar((n) => n + 1);
            }}
          />
          <AvatarModal
            open={ubahAvatar}
            userId={result.profil.userId}
            versi={result.avatar}
            nama={result.profil.namaLengkap}
            onClose={() => setUbahAvatar(false)}
            onTersimpan={() => {
              setUbahAvatar(false);
              setSegar((n) => n + 1);
            }}
          />
        </>
      )}
    </div>
  );
}

/**
 * Identitas profil. `xl`: kolom kiri ala GitHub (foto besar → nama → tombol →
 * meta → streak). Di bawahnya jadi kepala profil: ponsel = foto + nama sebaris,
 * sisanya bertumpuk; `sm`–`xl` = foto di kiri merentang tiga baris, tombol di
 * kanan nama, meta & streak di bawah nama.
 */
function SidebarProfil({
  profil,
  avatar,
  streak,
  milikSendiri,
  bolehUbah,
  onUbah,
  onUbahAvatar,
}: {
  profil: ProfilDto;
  avatar: string | null;
  streak: ProfilResult["streak"];
  milikSendiri: boolean;
  bolehUbah: boolean;
  onUbah: () => void;
  onUbahAvatar?: () => void;
}) {
  const kurang = milikSendiri && (!profil.jabatan || !profil.atasanNama);
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-6 xl:sticky xl:top-6 xl:block">
      <FotoProfil
        userId={profil.userId}
        versi={avatar}
        nama={profil.namaLengkap}
        onUbah={onUbahAvatar}
        className="size-20 sm:row-span-3 sm:size-24 sm:self-start xl:aspect-square xl:h-auto xl:w-full xl:max-w-[17.5rem]"
      />
      <div className="min-w-0 xl:mt-4">
        <h1 className="text-xl font-semibold leading-tight tracking-tight text-fg sm:text-[1.4rem] xl:text-[1.6rem]">{profil.namaLengkap}</h1>
        <p className="truncate text-base font-light text-fg-muted xl:text-xl">{profil.username}</p>
        {profil.jabatan ? (
          <p className="mt-1.5 text-sm text-fg sm:text-[15px] xl:mt-3">{profil.jabatan}</p>
        ) : (
          milikSendiri && <p className="mt-1.5 text-sm italic text-fg-subtle xl:mt-3">Jabatan belum diisi</p>
        )}
      </div>

      {milikSendiri && bolehUbah && (
        <Button
          variant="secondary"
          size="sm"
          className="col-span-2 w-full sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:w-auto sm:self-start xl:mt-4 xl:w-full"
          icon={<Pencil className="size-3.5" />}
          onClick={onUbah}
        >
          Ubah profil laporan
        </Button>
      )}

      <div className="col-span-2 min-w-0 sm:col-start-2 xl:mt-3">
        {kurang && (
          <p className="mb-2.5 rounded-[var(--radius-sm)] bg-warning-soft px-3 py-2 text-xs text-warning">
            Lengkapi jabatan & atasan langsung agar laporan siap dicetak.
          </p>
        )}
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-fg-muted xl:block xl:space-y-2">
          {profil.unit && <Meta ikon={Building2}>{profil.unit}</Meta>}
          <Meta ikon={IdCard}>{profil.nip ? `NIP. ${profil.nip}` : "NIP -"}</Meta>
          {profil.atasanNama && (
            <Meta ikon={UserCheck}>
              <span className="text-fg-subtle">Atasan</span> {profil.atasanNama}
            </Meta>
          )}
        </ul>
      </div>

      <div className="col-span-2 border-t border-border pt-3 sm:col-start-2 sm:border-t-0 sm:pt-0 xl:mt-5 xl:border-t xl:pt-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg">
          <Flame className={cn("size-4", streak.sekarang > 0 ? "text-[#e8794a]" : "text-fg-subtle")} aria-hidden />
          <span>
            <b className="font-semibold tabular">{streak.sekarang}</b> hari berturut-turut
          </span>
          <span className="hidden text-xs text-fg-muted sm:inline xl:hidden">
            · terpanjang <b className="font-semibold tabular text-fg">{streak.terpanjang}</b> hari
          </span>
        </p>
        <p className="mt-1 hidden pl-6 text-xs text-fg-muted xl:block">
          Terpanjang <b className="font-semibold tabular text-fg">{streak.terpanjang}</b> hari · akhir pekan tanpa catatan tidak memutus
        </p>
      </div>
    </div>
  );
}

/** Foto profil; milik sendiri → bisa diklik untuk mengganti (lencana kamera ala tombol "Edit" GitHub). */
function FotoProfil({ userId, versi, nama, onUbah, className }: { userId: string; versi: string | null; nama: string; onUbah?: () => void; className?: string }) {
  const gambar = <AvatarBckh userId={userId} versi={versi} label={`Foto profil ${nama}`} className="size-full border border-border shadow-xs" />;
  if (!onUbah) return <div className={cn("shrink-0", className)}>{gambar}</div>;
  return (
    <button
      type="button"
      onClick={onUbah}
      aria-label="Ubah foto profil"
      title="Ubah foto profil"
      className={cn(
        "group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className,
      )}
    >
      {gambar}
      <span aria-hidden className="absolute inset-0 rounded-full bg-fg/0 transition-colors group-hover:bg-fg/10" />
      <span
        aria-hidden
        className="absolute bottom-0 right-0 grid size-7 place-items-center rounded-full border border-border bg-surface text-fg-muted shadow-sm transition-colors group-hover:border-border-strong group-hover:text-fg sm:size-8 xl:bottom-[7%] xl:right-[7%] xl:size-10"
      >
        <Camera className="size-3.5 sm:size-4 xl:size-[18px]" />
      </span>
    </button>
  );
}

function Meta({ ikon: Ikon, children }: { ikon: typeof Building2; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 items-start gap-2">
      <Ikon className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}
