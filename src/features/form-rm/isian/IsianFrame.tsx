"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  CircleAlert,
  DatabaseZap,
  FilePlus2,
  History,
  Lock,
  LockOpen,
  Printer,
  RefreshCcwDot,
  RotateCw,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiPost, pesanGalat } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { statusAsal } from "@/features/form-rm/asal";
import type { AksiIsian } from "@/features/form-rm/isian.status";
import type { IsianForm } from "@/server/modules/form-rm/isian.types";
import { AksiIsianDialog } from "./AksiIsianDialog";
import { KunciIsian } from "./kunci";
import { MuatUlangSimrs } from "./MuatUlangSimrs";
import { RiwayatIsianDrawer } from "./RiwayatIsianDrawer";
import { StatusIsianBadge } from "./StatusIsianBadge";
import { AsalIsianProvider } from "./TandaAsal";
import { PitaTautan } from "./TautanIsian";
import type { KendaliIsian } from "./useIsian";

const PESAN_BERHASIL: Record<AksiIsian, string> = {
  FINALKAN: "Isian difinalkan dan dikunci",
  BUKA_KOREKSI: "Isian dibuka untuk koreksi",
  BATALKAN: "Isian dibatalkan",
};
/** Isian belum tertaut yang dibatalkan = ditutup karena pasien tak pernah didaftarkan. */
const PESAN_DITUTUP = "Isian ditutup tanpa pendaftaran";

/**
 * Bingkai halaman isian (dipakai keempat form): pemberitahuan status, konteks
 * kunci kolom, bilah aksi bawah (simpan / finalkan / koreksi / batalkan /
 * riwayat / cetak), dialog alasan, dan panel riwayat. Tampilan form cukup
 * merender kolomnya di dalam <BidangIsian>.
 */
export function IsianFrame<T>({
  kendali: k,
  aksen,
  children,
}: {
  kendali: KendaliIsian<T>;
  /** Ringkasan kecil di kiri bilah aksi (mis. kategori triase). */
  aksen?: React.ReactNode;
  children: React.ReactNode;
}) {
  const toast = useToast();
  const [dialog, setDialog] = useState<AksiIsian | null>(null);
  const [riwayat, setRiwayat] = useState(false);
  const [simrs, setSimrs] = useState(false);
  const { isian } = k;

  const bukaDialog = (aksi: AksiIsian) => {
    k.tutupGalat();
    setDialog(aksi);
  };
  const berhasil = (aksi: AksiIsian) => {
    setDialog(null);
    toast.success(aksi === "BATALKAN" && !isian.tertaut ? PESAN_DITUTUP : PESAN_BERHASIL[aksi]);
  };
  // Perbandingan dihitung server atas isi TERSIMPAN → simpan dulu perubahan di layar.
  async function bukaSimrs() {
    k.tutupGalat();
    if (k.kotor && !(await k.simpan())) return;
    setSimrs(true);
  }

  return (
    <AsalIsianProvider value={{ asal: isian.asal, data: k.form }}>
      <div className="space-y-5 pb-28">
        <PemberitahuanStatus kendali={k} onRiwayat={() => setRiwayat(true)} />
        <PitaTautan kendali={k} />
        <RingkasAsal kendali={k} onMuatUlang={bukaSimrs} />
        <KunciIsian terkunci={k.terkunci}>{children}</KunciIsian>

        <BilahAksi kendali={k} aksen={aksen} onAksi={bukaDialog} onRiwayat={() => setRiwayat(true)} />

        <AksiIsianDialog kendali={k} aksi={dialog} onTutup={() => setDialog(null)} onBerhasil={berhasil} />
        {simrs && <MuatUlangSimrs kendali={k} onTutup={() => setSimrs(false)} />}
        <RiwayatIsianDrawer open={riwayat} onClose={() => setRiwayat(false)} isianId={isian.id} rev={isian.rev} />
      </div>
    </AsalIsianProvider>
  );
}

/* ------------------------------------------------------------ asal SIMRS */

/** Ringkasan kolom dari SIMRS + tombol "Muat ulang dari SIMRS" (DRAF, tertaut & berizin ubah). */
function RingkasAsal<T>({ kendali: k, onMuatUlang }: { kendali: KendaliIsian<T>; onMuatUlang: () => void }) {
  const paths = Object.keys(k.isian.asal);
  const bolehMuat = k.isian.status === "DRAF" && k.izin.ubah && k.isian.tertaut;
  if (paths.length === 0 && !bolehMuat) return null;
  const diubah = paths.filter((p) => statusAsal(k.isian.asal, k.form, p) === "diubah").length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-brand/25 bg-brand-soft/60 px-3 py-2 text-[13px] text-brand-soft-fg">
      <p className="flex min-w-0 items-start gap-2">
        <DatabaseZap className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {paths.length > 0 ? (
            <>
              <b>{paths.length} kolom</b> terisi otomatis dari SIMRS
              {diubah > 0 && <> · {diubah} sudah diubah petugas</>}. Kolom bertanda <b>SIMRS</b> perlu diperiksa sebelum
              difinalkan.
            </>
          ) : (
            <>Belum ada kolom yang terisi dari SIMRS.</>
          )}
        </span>
      </p>
      {bolehMuat && (
        <Button
          size="sm"
          variant="secondary"
          icon={<RefreshCcwDot className="size-4" />}
          onClick={onMuatUlang}
          disabled={k.sibuk !== null}
          loading={k.sibuk === "simpan"}
        >
          Muat ulang dari SIMRS
        </Button>
      )}
    </div>
  );
}

/* --------------------------------------------------------- pemberitahuan */

function PemberitahuanStatus<T>({ kendali: k, onRiwayat }: { kendali: KendaliIsian<T>; onRiwayat: () => void }) {
  const { isian, izin } = k;
  if (k.galat?.konflik) {
    return (
      <Pita nada="warning" ikon={<CircleAlert className="mt-0.5 size-4 shrink-0" />}>
        <span>
          Isian ini sudah diubah di tempat lain sejak Anda membukanya. Muat ulang untuk melihat versi terbaru — perubahan
          Anda yang belum disimpan akan hilang.
        </span>
        <Button size="sm" variant="secondary" icon={<RotateCw className="size-4" />} onClick={() => window.location.reload()}>
          Muat ulang
        </Button>
      </Pita>
    );
  }
  if (isian.status === "FINAL") {
    return (
      <Pita nada="success" ikon={<Lock className="mt-0.5 size-4 shrink-0" />}>
        <span>
          Isian <b>FINAL</b>
          {isian.difinalkanAt ? ` sejak ${formatDateTime(isian.difinalkanAt)}` : ""} — terkunci. Koreksi hanya oleh
          pengelola rekam medis melalui <b>Buka koreksi</b>.
        </span>
      </Pita>
    );
  }
  if (isian.status === "BATAL") {
    return (
      <Pita nada="danger" ikon={<Ban className="mt-0.5 size-4 shrink-0" />}>
        <span>
          {isian.tertaut ? (
            <>
              Isian ini <b>dibatalkan</b> dan tidak berlaku.
            </>
          ) : (
            <>
              Isian ini <b>ditutup tanpa pendaftaran</b> — pasien tidak pernah ditautkan.
            </>
          )}{" "}
          Alasannya tercatat di{" "}
          <button type="button" onClick={onRiwayat} className="font-semibold underline underline-offset-2">
            riwayat
          </button>
          .
        </span>
        {izin.buat && isian.tertaut && <BuatIsianBaru isian={isian} />}
      </Pita>
    );
  }
  if (!izin.ubah) {
    return (
      <Pita nada="neutral" ikon={<Lock className="mt-0.5 size-4 shrink-0" />}>
        <span>Anda hanya dapat melihat isian ini.</span>
      </Pita>
    );
  }
  return null;
}

const NADA_PITA = {
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/40 bg-warning-soft text-warning",
  danger: "border-danger/30 bg-danger-soft text-danger",
  neutral: "border-border bg-surface-2/60 text-fg-muted",
} as const;

function Pita({ nada, ikon, children }: { nada: keyof typeof NADA_PITA; ikon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-[var(--radius-md)] border px-3 py-2.5 text-[13px] ${NADA_PITA[nada]}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">{ikon}<div className="min-w-0">{children}</div></div>
    </div>
  );
}

function BuatIsianBaru({ isian }: { isian: IsianForm }) {
  const router = useRouter();
  const toast = useToast();
  const [sibuk, setSibuk] = useState(false);
  async function buat() {
    setSibuk(true);
    try {
      const r = await apiPost<{ isian: IsianForm }>("/api/form-rm/isian", { kode: isian.kode, nopen: isian.nopen });
      router.push(`/form-rm/isian/${r.isian.id}`);
    } catch (e) {
      toast.error("Gagal membuat isian baru", pesanGalat(e));
      setSibuk(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" loading={sibuk} icon={<FilePlus2 className="size-4" />} onClick={buat}>
      Buat isian baru
    </Button>
  );
}

/* -------------------------------------------------------------- bilah aksi */

function BilahAksi<T>({
  kendali: k,
  aksen,
  onAksi,
  onRiwayat,
}: {
  kendali: KendaliIsian<T>;
  aksen?: React.ReactNode;
  onAksi: (aksi: AksiIsian) => void;
  onRiwayat: () => void;
}) {
  const { isian, izin } = k;
  const draf = isian.status === "DRAF";
  const bolehBatal = draf ? izin.ubah : isian.status === "FINAL" && izin.kelola;

  return (
    <div
      role="region"
      aria-label="Aksi isian"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:left-64"
    >
      {/* Ponsel: status di baris sendiri di atas tombol (chip skor/kategori tak cukup ruang di samping
          tombol dan dulu menindihnya). Layar lebar: satu baris, sisi kiri terpotong — tak pernah menindih. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-3 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5 overflow-hidden text-xs text-fg-muted">
          <span className="shrink-0">
            <StatusIsianBadge status={isian.status} />
          </span>
          {aksen && <span className="shrink-0">{aksen}</span>}
          <span className="min-w-0 truncate" aria-live="polite">
            <TeksSimpan kendali={k} />
          </span>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          <Button variant="ghost" size="md" icon={<History className="size-4" />} onClick={onRiwayat} title="Riwayat isian">
            <span className="hidden lg:inline">Riwayat</span>
          </Button>
          {izin.cetak && (
            <Link
              href={`/print/form-rm/isian/${isian.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title={k.kotor ? "Cetak memakai data yang terakhir disimpan" : "Cetak isian"}
              className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <Printer className="size-4" />
              <span className="hidden sm:inline">Cetak</span>
            </Link>
          )}
          {bolehBatal && (
            <Button
              variant="ghost"
              icon={<Ban className="size-4" />}
              onClick={() => onAksi("BATALKAN")}
              disabled={k.sibuk !== null}
              className="text-danger hover:text-danger"
              title={isian.tertaut ? "Batalkan isian" : "Tutup isian (pasien tidak didaftarkan)"}
            >
              <span className="hidden xl:inline">{isian.tertaut ? "Batalkan" : "Tutup"}</span>
            </Button>
          )}
          {draf && izin.ubah && (
            <>
              <Button
                variant="secondary"
                onClick={() => void k.simpan()}
                loading={k.sibuk === "simpan"}
                disabled={k.sibuk !== null}
                icon={<Save className="size-4" />}
                title="Simpan draf (Ctrl+S)"
              >
                <span className="hidden sm:inline">Simpan</span>
              </Button>
              <Button onClick={() => onAksi("FINALKAN")} disabled={k.sibuk !== null} icon={<Lock className="size-4" />}>
                Finalkan
              </Button>
            </>
          )}
          {isian.status === "FINAL" && izin.kelola && (
            <Button variant="secondary" onClick={() => onAksi("BUKA_KOREKSI")} disabled={k.sibuk !== null} icon={<LockOpen className="size-4" />}>
              Buka koreksi
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TeksSimpan<T>({ kendali: k }: { kendali: KendaliIsian<T> }) {
  const { isian } = k;
  if (k.sibuk === "simpan" || k.menyimpanOtomatis) return <span>Menyimpan…</span>;
  if (k.sibuk === "simrs") return <span>Menerapkan data SIMRS…</span>;
  if (k.galat && !k.galat.konflik) {
    return (
      <span className="inline-flex items-center gap-1 text-danger">
        {k.galat.pesan}
        <button type="button" onClick={k.tutupGalat} aria-label="Tutup pesan" className="rounded p-0.5 hover:bg-danger-soft">
          <X className="size-3" />
        </button>
      </span>
    );
  }
  if (k.tertunda) return <span>Perubahan akan disimpan otomatis…</span>;
  if (k.kotor) return <span className="text-warning">Ada perubahan belum disimpan</span>;
  if (isian.status !== "DRAF") return <span>Diperbarui {formatDateTime(isian.updatedAt)}</span>;
  if (isian.rev === 1) return <span>Draf baru — belum diubah</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-success">
      <Check className="size-3.5" />
      Tersimpan · {formatDateTime(isian.updatedAt)}
    </span>
  );
}
