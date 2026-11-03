"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarCheck2, Download, FileClock, ListChecks, PenLine, Search, UserCheck } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { formatRelatif } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import { ambangTingkat, hariDalamMinggu, persen, tambahHari, tanggalPanjang, tingkat } from "@/server/modules/bckh/bckh.aturan";
import { LABEL_STATUS, type StatusPengajuan } from "@/server/modules/bckh/bckh.constants";
import type { HariDto, PegawaiSayaDto, PegawaiSayaResult } from "@/server/modules/bckh/bckh.types";
import { AvatarBckh, BadgeStatus, LencanaPengajuan, PemilihBulan, TitikKategori, bulanBawaan, labelBulan } from "./ui";

const WARNA = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"] as const;

type Saring = "semua" | "belum" | "menunggu" | "disetujui" | "ditolak";
const SARING: { k: Saring; label: string; cocok: (s: StatusPengajuan | null) => boolean }[] = [
  { k: "semua", label: "Semua", cocok: () => true },
  { k: "belum", label: "Belum diajukan", cocok: (s) => s === null || s === "DITARIK" },
  { k: "menunggu", label: "Menunggu", cocok: (s) => s === "MENUNGGU_ATASAN" || s === "MENUNGGU_MENGETAHUI" },
  { k: "disetujui", label: "Disetujui", cocok: (s) => s === "DISETUJUI" },
  { k: "ditolak", label: "Ditolak / batal", cocok: (s) => s === "DITOLAK" || s === "DIBATALKAN" },
];

/** Lebar ≥ 1024 px → detail di panel kanan; lebih sempit → detail di drawer. */
function useLebar() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

/**
 * "Pegawai saya" (atasan / direktur): daftar bawahan dengan kepatuhan & status
 * laporan bulan terpilih (cari + saring), dan panel detail pegawai terpilih —
 * identitas, angka kunci, grafik 5 minggu, status laporan, kegiatan terakhir,
 * tautan profil lengkap (hanya-lihat).
 */
export function PegawaiSaya({ hariIni, bolehCetak, segar, onTinjau }: { hariIni: string; bolehCetak: boolean; segar: number; onTinjau: (id: string) => void }) {
  const [bulan, setBulan] = useState(() => bulanBawaan(hariIni));
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState<Saring>("semua");
  const [pilih, setPilih] = useState<string | null>(null);
  const [kini] = useState(() => Date.now());
  const lebar = useLebar();
  const { result, loading, error, reload } = useAsyncData<PegawaiSayaResult>(() => apiGet<PegawaiSayaResult>(`/api/bckh/persetujuan/pegawai?bulan=${bulan}`), [bulan, segar]);

  const semua = useMemo(() => result?.pegawai ?? [], [result]);
  const ambang = useMemo(() => ambangTingkat(semua.flatMap((a) => a.mini)), [semua]);
  const hitung = useMemo(() => Object.fromEntries(SARING.map((s) => [s.k, semua.filter((a) => s.cocok(a.pengajuan?.status ?? null)).length])) as Record<Saring, number>, [semua]);
  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const cocok = SARING.find((s) => s.k === saring)!.cocok;
    return semua.filter((a) => cocok(a.pengajuan?.status ?? null) && (!q || `${a.nama} ${a.username} ${a.jabatan} ${a.unit}`.toLowerCase().includes(q)));
  }, [semua, cari, saring]);
  // Panel lebar: selalu ada yang terpilih (pertama di daftar) agar panel tak kosong.
  const terpilih = daftar.find((a) => a.userId === pilih) ?? (lebar ? daftar[0] : undefined) ?? null;

  const detail = terpilih && <DetailPegawai a={terpilih} bulan={bulan} hariIni={hariIni} ambang={ambang} kini={kini} bolehCetak={bolehCetak} onTinjau={onTinjau} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <PemilihBulan bulan={bulan} onChange={setBulan} maks={hariIni.slice(0, 7)} className="self-start" />
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, jabatan, unit…" className="pl-9" aria-label="Cari pegawai" />
        </div>
      </div>
      <div role="radiogroup" aria-label={`Status laporan ${labelBulan(bulan)}`} className="flex flex-wrap gap-1.5">
        {SARING.map((s) => (
          <button
            key={s.k}
            type="button"
            role="radio"
            aria-checked={saring === s.k}
            onClick={() => setSaring(s.k)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
              saring === s.k ? "border-fg bg-fg text-white" : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
            )}
          >
            {s.label}
            <span className={cn("rounded-full px-1.5 text-[11px] tabular", saring === s.k ? "bg-white/20" : "bg-surface-2")}>{hitung[s.k] ?? 0}</span>
          </button>
        ))}
      </div>

      {error && !result ? (
        <ErrorState onRetry={reload} />
      ) : !result ? (
        <Skeleton className="h-80 w-full" />
      ) : semua.length === 0 ? (
        <EmptyState
          title="Belum ada pegawai bawahan"
          description="Pegawai muncul di sini setelah memilih akun Anda sebagai atasan langsung di profil laporan BCKH-nya."
        />
      ) : (
        <div className={cn("grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]", loading && "opacity-60")}>
          <ul className="divide-y divide-border self-start overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface" aria-label="Pegawai">
            {daftar.length === 0 && <li className="px-4 py-8 text-center text-sm text-fg-muted">Tidak ada pegawai yang cocok.</li>}
            {daftar.map((a) => {
              const p = persen(a.hariKerjaTerisi, a.hariKerja);
              const aktif = terpilih?.userId === a.userId;
              return (
                <li key={a.userId}>
                  <button
                    type="button"
                    onClick={() => setPilih(a.userId)}
                    aria-current={aktif && lebar ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring",
                      aktif && lebar ? "bg-brand-soft/60 shadow-[inset_3px_0_0_var(--brand)]" : "hover:bg-surface-2",
                    )}
                  >
                    <AvatarBckh userId={a.userId} versi={a.avatar} className="size-10 shrink-0 border border-border" label="" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-fg">{a.nama}</span>
                      <span className="block truncate text-xs text-fg-muted">{[a.jabatan, a.unit].filter(Boolean).join(" · ") || a.username}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {a.pengajuan ? <LencanaPengajuan status={a.pengajuan.status} /> : <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg-subtle">Belum diajukan</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular text-fg">{p === null ? "—" : `${p}%`}</span>
                      <span className="block text-[10px] text-fg-subtle">kepatuhan</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {lebar ? (
            <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">{detail}</div>
          ) : (
            <Drawer open={!!pilih && !!terpilih} onClose={() => setPilih(null)} size="md" title={terpilih?.nama ?? "Pegawai"}>
              <div className="p-4">{detail}</div>
            </Drawer>
          )}
        </div>
      )}
      {result && !result.mengetahui && semua.length > 0 && (
        <p className="text-xs text-fg-subtle">
          <UserCheck className="mr-1 inline size-3.5" aria-hidden />
          Pegawai yang memilih Anda sebagai atasan langsung, ditambah yang masih punya pengajuan aktif kepada Anda.
        </p>
      )}
    </div>
  );
}

function DetailPegawai({
  a,
  bulan,
  hariIni,
  ambang,
  kini,
  bolehCetak,
  onTinjau,
}: {
  a: PegawaiSayaDto;
  bulan: string;
  hariIni: string;
  ambang: [number, number, number];
  kini: number;
  bolehCetak: boolean;
  onTinjau: (id: string) => void;
}) {
  const p = persen(a.hariKerjaTerisi, a.hariKerja);
  const awalMini = tambahHari(hariIni, -(a.mini.length - 1));
  const status = a.pengajuan?.status ?? null;
  const menunggu = status === "MENUNGGU_ATASAN" || status === "MENUNGGU_MENGETAHUI";

  return (
    <article className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface" aria-label={`Detail ${a.nama}`}>
      <header className="flex items-center gap-4 border-b border-border bg-gradient-to-b from-surface-2/70 to-surface px-4 py-4 sm:px-5">
        <AvatarBckh userId={a.userId} versi={a.avatar} className="size-16 shrink-0 border border-border shadow-xs" label={`Foto ${a.nama}`} />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-tight text-fg [overflow-wrap:anywhere]">{a.nama}</h3>
          <p className="text-sm text-fg-muted">{a.jabatan || <span className="italic text-fg-subtle">Jabatan belum diisi</span>}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-subtle">
            {a.unit && <span>{a.unit}</span>}
            <span>{a.bawahanLangsung ? "Bawahan langsung" : "Lewat Mengetahui"}</span>
          </p>
        </div>
      </header>

      <div className="space-y-5 p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-3 @container sm:grid-cols-4">
          <Angka label="Kepatuhan" nilai={p === null ? "—" : `${p}%`} nada={(p ?? 0) >= 80 ? "baik" : (p ?? 0) >= 50 ? "sedang" : "kurang"} />
          <Angka label="Hari kerja terisi" nilai={`${a.hariKerjaTerisi}/${a.hariKerja}`} />
          <Angka label="Kegiatan" nilai={String(a.kegiatan)} />
          <Angka label="Terakhir mengisi" nilai={a.terakhirMengisi ? formatRelatif(a.terakhirMengisi, kini) : "—"} kecil />
        </dl>

        <section>
          <h4 className="mb-2 text-xs font-medium text-fg-muted">Aktivitas 5 minggu terakhir</h4>
          <div className="grid w-fit grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label={`${a.mini.reduce((s, n) => s + n, 0)} kegiatan dalam 5 minggu terakhir`}>
            {Array.from({ length: (hariDalamMinggu(awalMini) + 6) % 7 }, (_, i) => (
              <span key={`k${i}`} className="size-3.5" />
            ))}
            {a.mini.map((n, i) => (
              <span key={i} title={`${n} kegiatan · ${tanggalPanjang(tambahHari(awalMini, i))}`} className={cn("size-3.5 rounded-[3px] ring-1 ring-inset ring-black/[0.05]", WARNA[tingkat(n, ambang)])} />
            ))}
          </div>
        </section>

        <section className="rounded-[var(--radius-md)] border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <FileClock className="size-4 text-fg-subtle" aria-hidden />
              Laporan {labelBulan(bulan)}
            </h4>
            {status ? <LencanaPengajuan status={status} /> : <span className="text-xs text-fg-subtle">Belum diajukan</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {a.pengajuan && (
              <button
                type="button"
                onClick={() => onTinjau(a.pengajuan!.id)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                  menunggu ? "bg-brand text-brand-fg hover:bg-brand-hover" : "border border-border text-fg hover:bg-surface-2",
                )}
              >
                {menunggu ? <PenLine className="size-4" aria-hidden /> : <ListChecks className="size-4" aria-hidden />}
                {menunggu ? "Tinjau pengajuan" : "Lihat pengajuan"}
              </button>
            )}
            {bolehCetak && (
              <a
                href={`/api/bckh/laporan/pdf?${new URLSearchParams({ bulan, u: a.userId })}`}
                target="_blank"
                rel="noopener"
                className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-border px-3 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              >
                <Download className="size-4" aria-hidden />
                PDF
              </a>
            )}
          </div>
        </section>

        <KegiatanTerakhir userId={a.userId} hariIni={hariIni} />

        <Link
          href={`/bckh/persetujuan/pegawai/${encodeURIComponent(a.username)}`}
          className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border py-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          Buka profil BCKH lengkap
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

function Angka({ label, nilai, nada, kecil }: { label: string; nilai: string; nada?: "baik" | "sedang" | "kurang"; kecil?: boolean }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-surface-2/60 px-3 py-2.5">
      <dt className="text-[11px] text-fg-subtle">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 font-semibold tabular",
          kecil ? "text-sm" : "text-lg",
          nada === "baik" ? "text-success" : nada === "sedang" ? "text-warning" : nada === "kurang" ? "text-danger" : "text-fg",
        )}
      >
        {nilai}
      </dd>
    </div>
  );
}

/** 7 hari terakhir pegawai (catatan + kegiatan) — dimuat saat panel dibuka. */
function KegiatanTerakhir({ userId, hariIni }: { userId: string; hariIni: string }) {
  const [hari, setHari] = useState<HariDto[] | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset saat ganti pegawai
    setHari(null);
    const q = new URLSearchParams({ dari: tambahHari(hariIni, -6), sampai: hariIni, u: userId });
    apiGet<HariDto[]>(`/api/bckh/hari?${q}`, { signal: ac.signal })
      .then((h) => setHari([...h].sort((a, b) => b.tanggal.localeCompare(a.tanggal))))
      .catch(() => !ac.signal.aborted && setHari([]));
    return () => ac.abort();
  }, [userId, hariIni]);

  return (
    <section>
      <h4 className="mb-2 flex items-center gap-2 text-xs font-medium text-fg-muted">
        <CalendarCheck2 className="size-3.5" aria-hidden />
        7 hari terakhir
      </h4>
      {!hari ? (
        <Skeleton className="h-24 w-full" />
      ) : hari.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-border px-3 py-4 text-center text-xs text-fg-subtle">Tidak ada catatan dalam 7 hari terakhir.</p>
      ) : (
        <ol className="space-y-2">
          {hari.map((h) => (
            <li key={h.tanggal} className="rounded-[var(--radius-md)] border border-border px-3 py-2">
              <p className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-fg">{tanggalPanjang(h.tanggal).replace(/ \d{4}$/, "")}</span>
                <BadgeStatus status={h.status} />
              </p>
              {h.kegiatan.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {h.kegiatan.slice(0, 4).map((k) => (
                    <li key={k.id} className="flex min-w-0 items-start gap-2 text-[13px] text-fg">
                      <TitikKategori kategori={k.kategori} className="mt-1.5 size-2" />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{k.uraian}</span>
                    </li>
                  ))}
                  {h.kegiatan.length > 4 && <li className="pl-4 text-xs text-fg-subtle">+{h.kegiatan.length - 4} kegiatan lain</li>}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-fg-subtle">{LABEL_STATUS[h.status]}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
