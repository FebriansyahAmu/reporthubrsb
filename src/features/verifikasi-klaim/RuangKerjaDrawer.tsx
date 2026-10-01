"use client";

import { useState } from "react";
import { ArrowRight, GitMerge, History, Info, Lock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiGet, apiPost, pesanGalat } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDateTime, formatUkuran } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import { getAturanKoding } from "@/server/modules/verifikasi-klaim/koding.rules";
import {
  KATEGORI_LABEL,
  STATUS_META,
  type AksiPaket,
  type AksiTahap2,
  type StatusVerifikasi,
} from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { labelAturan } from "@/server/modules/verifikasi-klaim/verifikasi.rules";
import type { RiwayatItem, RuangKerjaKlaim } from "@/server/modules/verifikasi-klaim/verifikasi.types";
import { PanelKelengkapan, type KirimKeputusan } from "./PanelKelengkapan";
import { PanelKoding, type KirimKoding } from "./PanelKoding";
import { PanelPaket, type KirimPaket } from "./PanelPaket";
import { StatusVerifikasiBadge } from "./status-ui";

type Tab = "kelengkapan" | "koding" | "paket" | "riwayat";

/** Tab bawaan mengikuti tahap berkas: setelah Lolos RM di Koding, setelah lolos klaim di Paket. */
const TAB_TAHAP: Record<StatusVerifikasi, Tab> = {
  BELUM_DIPERIKSA: "kelengkapan",
  TIDAK_LENGKAP: "kelengkapan",
  LOLOS_RM: "koding",
  KOREKSI_KODING: "koding",
  LOLOS_KLAIM: "paket",
  FINAL: "paket",
};

/** Status di mana tab Paket aktif. */
const STATUS_PAKET: readonly StatusVerifikasi[] = ["LOLOS_KLAIM", "FINAL"];

const PESAN_KODING: Record<AksiTahap2, [string, string]> = {
  AJUKAN_KOREKSI: ["Usulan koreksi terkirim", "Tindak lanjut & notifikasi dikirim ke penerap di SIMRS."],
  LOLOSKAN_KLAIM: ["Klaim diloloskan", "Berkas siap dipaketkan (Tahap final)."],
  KEMBALIKAN_KE_RM: ["Berkas dikembalikan ke Tahap 1", "Verifikator RM diberi tahu."],
};

const PESAN_PAKET: Record<AksiPaket, [string, string]> = {
  KUNCI_FINAL: ["Paket dikunci FINAL", "Berkas klaim siap dicetak / dikirim."],
  BUKA_KUNCI: ["Kunci FINAL dibuka", "Paket dapat disusun & digabung ulang; pengunci diberi tahu."],
};

/**
 * Ruang kerja satu berkas (PRD §6.3) — panel samping. Data SELALU dicek segar
 * dari SIMRS saat dibuka / "Cek ulang". Keputusan dikirim dengan versi berkas;
 * bila bentrok (409) data dimuat ulang.
 */
export function RuangKerjaDrawer({
  nopen,
  onClose,
  onBerubah,
}: {
  nopen: string | null;
  onClose: () => void;
  /** Dipanggil setelah keputusan tersimpan (antrean dimuat ulang). */
  onBerubah: () => void;
}) {
  const toast = useToast();
  // null = belum dipilih pengguna → tab bawaan menurut status berkas.
  const [tabPilihan, setTabPilihan] = useState<Tab | null>(null);
  const [terbaru, setTerbaru] = useState<RuangKerjaKlaim | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const { result, loading, error, reload } = useAsyncData<RuangKerjaKlaim | null>(
    () => (nopen ? apiGet<RuangKerjaKlaim>(`/api/berkas-klaim/verifikasi/${nopen}`) : Promise.resolve(null)),
    [nopen],
  );
  // Respons keputusan menggantikan hasil muat sampai "Cek ulang" berikutnya.
  const data = terbaru && terbaru.snapshot.nopen === nopen ? terbaru : result;
  const paketAktif = !!data && data.izin.paket && STATUS_PAKET.includes(data.status);
  const bawaan: Tab = data ? TAB_TAHAP[data.status] : "kelengkapan";
  const tabDipilih: Tab = tabPilihan ?? (bawaan === "paket" && !paketAktif ? "koding" : bawaan);
  const tab: Tab = tabDipilih === "paket" && !paketAktif ? "koding" : tabDipilih;

  function cekUlang() {
    setTerbaru(null);
    reload();
  }

  function tutup() {
    setTerbaru(null);
    setTabPilihan(null);
    onClose();
  }

  /** Kirim keputusan (Tahap 1 / 2) dengan penanganan konflik versi yang sama. */
  async function putuskan(url: string, body: unknown, sukses: [string, string]): Promise<boolean> {
    setMengirim(true);
    try {
      const r = await apiPost<RuangKerjaKlaim>(url, body);
      setTerbaru(r);
      toast.success(...sukses);
      onBerubah();
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.code === "CONFLICT") {
        toast.warning("Berkas sudah diubah pengguna lain", "Data terbaru dimuat ulang — periksa kembali sebelum memutuskan.");
        cekUlang();
        onBerubah();
      } else {
        toast.error("Keputusan gagal disimpan", pesanGalat(e));
      }
      return false;
    } finally {
      setMengirim(false);
    }
  }

  const kirim: KirimKeputusan = async (body) =>
    !!nopen &&
    putuskan(
      `/api/berkas-klaim/verifikasi/${nopen}/keputusan`,
      body,
      body.aksi === "LOLOSKAN_RM"
        ? ["Berkas diloloskan ke Tahap 2", "Keputusan tercatat di riwayat berkas."]
        : ["Berkas ditandai tidak lengkap", "Tindak lanjut & notifikasi terkirim ke penanggung jawab."],
    );

  const kirimKoding: KirimKoding = async (body) =>
    !!nopen && putuskan(`/api/berkas-klaim/koding/${nopen}/keputusan`, body, PESAN_KODING[body.aksi]);

  const kirimPaket: KirimPaket = async (body) =>
    !!nopen && putuskan(`/api/berkas-klaim/paket/${nopen}/keputusan`, body, PESAN_PAKET[body.aksi]);

  const s = data?.snapshot;
  return (
    <Drawer
      open={!!nopen}
      onClose={tutup}
      size="xl"
      title={s ? `Berkas klaim ${s.nama}` : "Berkas klaim"}
      header={
        s && data ? (
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-fg">{s.nama}</h2>
              <StatusVerifikasiBadge status={data.status} />
              {data.versi != null && <span className="text-[11px] text-fg-subtle">versi {data.versi}</span>}
            </div>
            <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-fg-muted">
              <span>RM {s.norm}</span>
              <span className="font-mono">NOPEN {s.nopen}</span>
              <span>{KATEGORI_LABEL[s.kategori]}{s.ruang ? ` · ${s.ruang}` : ""}</span>
              <span>Pulang {s.pulang ? formatDateTime(s.pulang) : "—"}</span>
              <span>SEP {s.fakta.sep?.nomor ?? "—"}</span>
            </p>
          </div>
        ) : (
          <Skeleton className="h-10 w-72 rounded" />
        )
      }
    >
      <div className="flex min-h-full flex-col">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-bg/95 px-5 py-2 backdrop-blur">
          <div role="tablist" aria-label="Ruang kerja berkas" className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1">
            <TabButton aktif={tab === "kelengkapan"} onClick={() => setTabPilihan("kelengkapan")}>
              Kelengkapan
            </TabButton>
            <TabButton aktif={tab === "koding"} onClick={() => setTabPilihan("koding")}>
              Koding
              {data && data.cekKoding.gagal > 0 && (
                <span className="ml-1.5 rounded-full bg-danger-soft px-1.5 text-[11px] text-danger" aria-label={`${data.cekKoding.gagal} aturan koding gagal`}>
                  {data.cekKoding.gagal}
                </span>
              )}
            </TabButton>
            <TabButton
              aktif={tab === "paket"}
              onClick={() => setTabPilihan("paket")}
              disabled={!paketAktif}
              title={paketAktif ? undefined : data && !data.izin.paket ? "Butuh izin Paket Klaim / Coder" : "Tersedia setelah klaim diloloskan coder"}
            >
              Paket Klaim
              {data?.status === "FINAL" && <Lock className="ml-1 inline size-3" aria-label="terkunci" />}
            </TabButton>
            <TabButton aktif={tab === "riwayat"} onClick={() => setTabPilihan("riwayat")}>
              Riwayat{data ? ` (${data.riwayat.length})` : ""}
            </TabButton>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            icon={<RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />}
            onClick={cekUlang}
            disabled={loading || mengirim}
          >
            <span className="hidden sm:inline">Cek ulang dari SIMRS</span>
            <span className="sm:hidden">Cek ulang</span>
          </Button>
        </div>

        {error && !data ? (
          <ErrorState onRetry={cekUlang} />
        ) : !data || (loading && !terbaru) ? (
          <MemuatRuangKerja />
        ) : (
          <>
            {(data.digabungKe || !data.final) && (
              <div className="mx-5 mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
                {data.digabungKe ? <GitMerge className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden />}
                {data.digabungKe
                  ? `Episode ini digabung ke klaim Rawat Inap NOPEN ${data.digabungKe} — dokumennya ikut paket RI dan diputuskan di sana.`
                  : "Episode belum final (masih ada kunjungan yang belum keluar) — belum bisa diputuskan."}
              </div>
            )}
            {tab === "kelengkapan" ? (
              <PanelKelengkapan key={`${data.snapshot.nopen}:${data.versi ?? 0}`} data={data} kirim={kirim} mengirim={mengirim} />
            ) : tab === "koding" ? (
              <PanelKoding key={`${data.snapshot.nopen}:${data.versi ?? 0}`} data={data} kirim={kirimKoding} mengirim={mengirim} />
            ) : tab === "paket" ? (
              <PanelPaket
                key={`${data.snapshot.nopen}:${data.versi ?? 0}`}
                nopen={data.snapshot.nopen}
                kirim={kirimPaket}
                mengirim={mengirim}
                onBerubah={onBerubah}
              />
            ) : (
              <PanelRiwayat items={data.riwayat} />
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}

function TabButton({
  aktif,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { aktif: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={aktif}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[var(--radius-md)] px-3 py-1.5 text-[13px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:cursor-not-allowed disabled:opacity-45",
        aktif ? "bg-brand-soft text-brand-soft-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function MemuatRuangKerja() {
  return (
    <div className="space-y-2 px-5 py-4" aria-busy="true" aria-label="Memeriksa data SIMRS">
      <p className="text-xs text-fg-subtle">Memeriksa data terbaru di SIMRS…</p>
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-md)]" />
      ))}
    </div>
  );
}

const DATA_LABEL: Record<string, string> = { item: "Item", gagal: "Pemeriksaan gagal", aturan: "Item" };
/** Label kunci aturan Tahap 1 / Tahap 2 / item tindak lanjut. */
const labelKunci = (k: string) => getAturanKoding(k)?.label ?? labelAturan(k);

type InfoPaketRiwayat = { versi: number; hash: string; halaman: number; ukuran: number };
const infoPaket = (p: unknown): InfoPaketRiwayat | null =>
  p && typeof p === "object" && typeof (p as InfoPaketRiwayat).hash === "string" ? (p as InfoPaketRiwayat) : null;

const buktiOleh = (b: unknown) => (b && typeof b === "object" && typeof (b as { oleh?: unknown }).oleh === "string" ? (b as { oleh: string }).oleh : null);
const buktiPada = (b: unknown) => (b && typeof b === "object" && typeof (b as { pada?: unknown }).pada === "string" ? (b as { pada: string }).pada : null);

/** Linimasa riwayat berkas (terbaru di atas). */
function PanelRiwayat({ items }: { items: readonly RiwayatItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-fg-muted">
        <History className="size-6 text-fg-subtle" aria-hidden />
        Belum ada keputusan untuk berkas ini.
      </div>
    );
  }
  return (
    <ol className="space-y-3 px-5 py-4">
      {items.map((r) => {
        const d = r.data ?? {};
        const pk = infoPaket(d.paket);
        return (
          <li key={r.id} className="relative rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-fg">{r.label}</span>
              {r.dariStatus && r.keStatus && r.dariStatus !== r.keStatus && (
                <span className="flex items-center gap-1 text-xs text-fg-muted">
                  {STATUS_META[r.dariStatus].label}
                  <ArrowRight className="size-3" aria-hidden />
                  {STATUS_META[r.keStatus].label}
                </span>
              )}
              {d.override === true && <Badge tone="warning">Diloloskan dengan alasan</Badge>}
              {d.massal === true && <Badge tone="brand">Massal</Badge>}
              {d.revisi === true && <Badge tone="brand">Revisi usulan</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-fg-subtle">
              {r.olehNama ?? "—"} · {formatDateTime(r.createdAt)}
            </p>
            {r.catatan && <p className="mt-1.5 text-xs italic text-fg-muted">“{r.catatan}”</p>}
            {(["item", "gagal", "aturan"] as const).map((k) =>
              Array.isArray(d[k]) && (d[k] as string[]).length > 0 ? (
                <p key={k} className="mt-1 text-xs text-fg-muted">
                  {DATA_LABEL[k]}: {(d[k] as string[]).map(labelKunci).join(", ")}
                </p>
              ) : null,
            )}
            {Array.isArray(d.perubahan) && d.perubahan.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-fg-muted">
                {(d.perubahan as string[]).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
            {pk && (
              <p className="mt-1 text-xs text-fg-muted">
                Paket v{pk.versi} · {pk.halaman} halaman · {formatUkuran(pk.ukuran)} ·{" "}
                <span className="font-mono text-[11px]" title={pk.hash}>
                  SHA-256 {pk.hash.slice(0, 16)}…
                </span>
              </p>
            )}
            {typeof d.nama === "string" && <p className="mt-1 truncate text-xs text-fg-muted">Sisipan: {d.nama}</p>}
            {buktiOleh(d.bukti) && (
              <p className="mt-1 text-xs text-fg-muted">
                Diterapkan di SIMRS oleh {buktiOleh(d.bukti)}
                {buktiPada(d.bukti) && ` pada ${formatDateTime(buktiPada(d.bukti)!)}`}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
