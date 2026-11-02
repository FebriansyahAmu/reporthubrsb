"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, BookOpenText, Building2, FileText, Flame, History, IdCard, LayoutList, Pencil, Plus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatNumber } from "@/lib/format";
import type { KegiatanRutin, ProfilDto, ProfilResult } from "@/server/modules/bckh/bckh.types";
import { CatatDrawer } from "./CatatDrawer";
import { ProfilModal } from "./ProfilModal";
import { TabDasbor } from "./TabDasbor";
import { TabIkhtisar } from "./TabIkhtisar";
import { TabKegiatan } from "./TabKegiatan";
import { TabLaporan } from "./TabLaporan";
import { TabLog } from "./TabLog";
import { TAB_BCKH, type HakBckh, type TabBckh } from "./tab";
import { Identicon, Penghitung } from "./ui";

const INFO_TAB: Record<TabBckh, { label: string; ikon: typeof BookOpenText }> = {
  ikhtisar: { label: "Ikhtisar", ikon: BookOpenText },
  kegiatan: { label: "Kegiatan", ikon: LayoutList },
  log: { label: "Log Pengisian", ikon: History },
  dasbor: { label: "Dasbor", ikon: BarChart3 },
  laporan: { label: "Laporan", ikon: FileText },
};

/**
 * Halaman profil BCKH ala profil GitHub: sidebar identitas + tab (Ikhtisar,
 * Kegiatan, Log Pengisian, Dasbor, Laporan). `targetId` null = profil sendiri;
 * selain itu hanya-lihat (pemegang `bckh.tim`). Tab disimpan di `?tab=`.
 */
export function BckhProfilView({ targetId, hak, tabAwal }: { targetId: string | null; hak: HakBckh; tabAwal: TabBckh }) {
  const [tab, setTab] = useState<TabBckh>(tabAwal);
  const [tahun, setTahun] = useState<number | null>(null);
  const [segar, setSegar] = useState(0);
  const [sorot, setSorot] = useState<string | null>(null);
  const [catat, setCatat] = useState<{ tanggal: string; tambahan: KegiatanRutin | null } | null>(null);
  const [ubahProfil, setUbahProfil] = useState(false);
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

  return (
    <div className="grid gap-6 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-8">
      <aside className="min-w-0">
        {profil ? (
          <SidebarProfil
            profil={profil}
            streak={result.streak}
            milikSendiri={result.milikSendiri}
            bolehUbah={hak.ubah}
            onUbah={() => setUbahProfil(true)}
          />
        ) : (
          <div className="flex items-center gap-4 lg:block">
            <Skeleton className="size-20 rounded-full lg:size-64" />
            <div className="flex-1 space-y-2 lg:mt-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        )}
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-10 -mx-1 mb-5 flex items-end gap-3 border-b border-border bg-bg/95 px-1 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
          <nav aria-label="Bagian profil" className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {TAB_BCKH.map((t) => {
              const { label, ikon: Ikon } = INFO_TAB[t];
              const aktif = tab === t;
              const hitung = t === "kegiatan" ? result?.hariTercatat : undefined;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-current={aktif ? "page" : undefined}
                  className={cn(
                    "group inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring",
                    aktif ? "border-brand-ring font-semibold text-fg" : "border-transparent text-fg-muted hover:border-border-strong hover:text-fg",
                  )}
                >
                  <Ikon className={cn("size-4", aktif ? "text-fg" : "text-fg-subtle group-hover:text-fg-muted")} aria-hidden />
                  {label}
                  {hitung !== undefined && hitung > 0 && <Penghitung n={formatNumber(hitung)} />}
                </button>
              );
            })}
          </nav>
          {bolehCatat && (
            <Button size="sm" className="mb-2 hidden shrink-0 sm:inline-flex" icon={<Plus className="size-4" />} onClick={() => bukaCatat()}>
              Catat kegiatan
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
        <ProfilModal
          open={ubahProfil}
          profil={result.profil}
          onClose={() => setUbahProfil(false)}
          onTersimpan={() => {
            setUbahProfil(false);
            setSegar((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function SidebarProfil({
  profil,
  streak,
  milikSendiri,
  bolehUbah,
  onUbah,
}: {
  profil: ProfilDto;
  streak: ProfilResult["streak"];
  milikSendiri: boolean;
  bolehUbah: boolean;
  onUbah: () => void;
}) {
  const kurang = milikSendiri && (!profil.jabatan || !profil.atasanNama);
  return (
    <div className="lg:sticky lg:top-6">
      <div className="flex items-center gap-4 lg:block">
        <Identicon seed={profil.userId} label={`Avatar ${profil.namaLengkap}`} className="size-20 shrink-0 border border-border shadow-xs lg:size-full lg:max-w-[17.5rem]" />
        <div className="min-w-0 lg:mt-4">
          <h1 className="text-xl font-semibold leading-tight tracking-tight text-fg lg:text-[1.6rem]">{profil.namaLengkap}</h1>
          <p className="truncate text-base font-light text-fg-muted lg:text-xl">{profil.username}</p>
        </div>
      </div>

      {profil.jabatan ? (
        <p className="mt-3 text-[15px] text-fg">{profil.jabatan}</p>
      ) : (
        milikSendiri && <p className="mt-3 text-sm italic text-fg-subtle">Jabatan belum diisi</p>
      )}

      {milikSendiri && bolehUbah && (
        <Button variant="secondary" size="sm" className="mt-4 w-full" icon={<Pencil className="size-3.5" />} onClick={onUbah}>
          Ubah profil laporan
        </Button>
      )}
      {kurang && (
        <p className="mt-2 rounded-[var(--radius-sm)] bg-warning-soft px-3 py-2 text-xs text-warning">
          Lengkapi jabatan & atasan langsung agar laporan siap dicetak.
        </p>
      )}

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-fg-muted lg:mt-4 lg:block lg:space-y-2">
        {profil.unit && <Meta ikon={Building2}>{profil.unit}</Meta>}
        <Meta ikon={IdCard}>{profil.nip ? `NIP. ${profil.nip}` : "NIP -"}</Meta>
        {profil.atasanNama && (
          <Meta ikon={UserCheck}>
            <span className="text-fg-subtle">Atasan</span> {profil.atasanNama}
          </Meta>
        )}
      </ul>

      <div className="mt-3 border-t border-border pt-3 lg:mt-5 lg:pt-4">
        <p className="flex items-center gap-2 text-sm text-fg">
          <Flame className={cn("size-4", streak.sekarang > 0 ? "text-[#e8794a]" : "text-fg-subtle")} aria-hidden />
          <span>
            <b className="font-semibold tabular">{streak.sekarang}</b> hari berturut-turut
          </span>
        </p>
        <p className="mt-1 hidden pl-6 text-xs text-fg-muted lg:block">
          Terpanjang <b className="font-semibold tabular text-fg">{streak.terpanjang}</b> hari · akhir pekan tanpa catatan tidak memutus
        </p>
      </div>
    </div>
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
