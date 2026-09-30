"use client";

import { useMemo, useRef, useState } from "react";
import { BellRing, Check, CheckCircle2, Info, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { NumberedPagination } from "@/components/ui/NumberedPagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { apiGet, apiPost, pesanGalat } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber, formatRelatif } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import { BATAS, KATEGORI_LABEL, type Kategori } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import type { TindakLanjutBaris, TindakLanjutDaftar } from "@/server/modules/verifikasi-klaim/verifikasi.types";
import { StatusVerifikasiBadge } from "./status-ui";

type StatusTab = "OPEN" | "SELESAI";

const CARA: Record<string, string> = {
  OTOMATIS: "Selesai otomatis — data SIMRS lengkap",
  MANUAL: "Ditandai selesai",
  BATAL: "Dibatalkan verifikator",
};

/**
 * Tindak Lanjut Berkas (PRD §6.4): item yang harus dilengkapi penerima. Item
 * otomatis tertutup sendiri saat data SIMRS lengkap (dicek setiap halaman
 * dimuat / "Cek ulang"); item cek manual ditandai selesai di sini.
 */
export function TindakLanjutView() {
  const toast = useToast();
  const [status, setStatus] = useState<StatusTab>("OPEN");
  const [lingkup, setLingkup] = useState<"saya" | "semua">("saya");
  const [page, setPage] = useState(1);
  const [segar, setSegar] = useState(0);
  const segarRef = useRef(false);
  const [now] = useState(() => Date.now());
  const [selesai, setSelesai] = useState<TindakLanjutBaris | null>(null);

  const { result, loading, error, reload } = useAsyncData<TindakLanjutDaftar>(() => {
    const p = new URLSearchParams({ status, lingkup, page: String(page), pageSize: "25" });
    if (segarRef.current) p.set("segar", "1");
    segarRef.current = false;
    return apiGet<TindakLanjutDaftar>(`/api/berkas-klaim/tindak-lanjut?${p.toString()}`);
  }, [status, lingkup, page, segar]);

  function cekUlang() {
    segarRef.current = true;
    setSegar((n) => n + 1);
  }

  const grup = useMemo(() => {
    const m = new Map<string, TindakLanjutBaris[]>();
    for (const it of result?.items ?? []) m.set(it.nopen, [...(m.get(it.nopen) ?? []), it]);
    return [...m.entries()];
  }, [result]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Status tindak lanjut" className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface p-0.5">
            {(["OPEN", "SELESAI"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={status === s}
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
                className={cn(
                  "rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                  status === s ? "bg-brand-soft text-brand-soft-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {s === "OPEN" ? "Perlu dilengkapi" : "Selesai"}
                {result && (
                  <span className="ml-1.5 tabular text-fg-subtle">
                    {formatNumber(s === "OPEN" ? result.ringkasan.open : result.ringkasan.selesai)}
                  </span>
                )}
              </button>
            ))}
          </div>
          {result?.bolehSemua && (
            <div role="group" aria-label="Lingkup" className="flex gap-1.5">
              {(["saya", "semua"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lingkup === l}
                  onClick={() => {
                    setLingkup(l);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    lingkup === l ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border bg-surface text-fg-muted hover:bg-surface-2",
                  )}
                >
                  {l === "saya" ? "Untuk saya" : "Semua (verifikator)"}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />}
          onClick={cekUlang}
          disabled={loading}
        >
          Cek ulang dari SIMRS
        </Button>
      </div>

      {result && result.meta.ditutupOtomatis > 0 && (
        <div role="status" className="flex items-center gap-2 rounded-[var(--radius-md)] border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {formatNumber(result.meta.ditutupOtomatis)} item baru saja tertutup otomatis karena datanya sudah lengkap di SIMRS.
        </div>
      )}
      {result?.tanpaSasaranPribadi && result.lingkup === "saya" && (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/60 px-3 py-2 text-sm text-fg-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Akun Anda belum tertaut NIP atau akses ruangan SIMGOS, sehingga hanya item untuk peran Anda yang tampil. Masuk
          dengan akun SIMGOS atau lengkapi NIP di Master › Pengguna.
        </div>
      )}

      {error && !result ? (
        <Card className="p-0">
          <ErrorState onRetry={reload} />
        </Card>
      ) : !result ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : grup.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title={status === "OPEN" ? "Tidak ada yang perlu dilengkapi" : "Belum ada item selesai"}
            description={
              status === "OPEN"
                ? "Saat verifikator menandai berkas tidak lengkap, item yang menjadi tanggung jawab Anda atau ruangan Anda muncul di sini."
                : "Item yang sudah dilengkapi (otomatis dari SIMRS atau ditandai selesai) tampil di sini."
            }
          />
        </Card>
      ) : (
        <ul className={cn("space-y-3", loading && "opacity-60 transition-opacity")} aria-busy={loading}>
          {grup.map(([nopen, items]) => (
            <KartuPasien key={nopen} items={items} now={now} onSelesai={setSelesai} />
          ))}
        </ul>
      )}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <ShieldCheck className="size-3.5" aria-hidden />
            Lengkapi datanya di SIMRS — aplikasi ini hanya membaca dan menutup item secara otomatis.
          </p>
          <NumberedPagination page={page} totalPages={totalPages} onPageChange={setPage} disabled={loading} />
        </div>
      )}

      <SelesaiModal
        item={selesai}
        onClose={() => setSelesai(null)}
        onSukses={() => {
          toast.success("Item ditandai selesai", "Tercatat di riwayat berkas.");
          setSelesai(null);
          reload();
        }}
        onGagal={(m) => toast.error("Gagal menandai selesai", m)}
      />
    </div>
  );
}

function KartuPasien({
  items,
  now,
  onSelesai,
}: {
  items: TindakLanjutBaris[];
  now: number;
  onSelesai: (it: TindakLanjutBaris) => void;
}) {
  const p = items[0].pasien;
  return (
    <li>
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface-2/60 px-4 py-2.5">
          <span className="text-sm font-semibold text-fg">{p.nama ?? "—"}</span>
          <span className="text-xs text-fg-muted">RM {p.norm ?? "—"}</span>
          <span className="text-xs text-fg-muted">
            {KATEGORI_LABEL[p.kategori as Kategori] ?? p.kategori}
            {p.ruang ? ` · ${p.ruang}` : ""}
          </span>
          {p.tglPulang && <span className="text-xs text-fg-muted">Pulang {formatDate(p.tglPulang)}</span>}
          <StatusVerifikasiBadge status={items[0].statusKlaim} className="ml-auto" />
        </div>
        <ul className="divide-y divide-border">
          {items.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                  {t.status === "OPEN" ? (
                    <BellRing className="size-4 text-warning" aria-hidden />
                  ) : (
                    <CheckCircle2 className="size-4 text-success" aria-hidden />
                  )}
                  {t.label}
                  {t.manual && <Badge tone="neutral" className="px-1.5 py-0 text-[10px]">Cek manual</Badge>}
                </p>
                <p className="text-xs text-fg-muted">{t.pesan}</p>
                <p className="flex flex-wrap items-center gap-1 text-[11px] text-fg-subtle">
                  <UserRound className="size-3" aria-hidden />
                  Untuk {t.sasaranNama ?? t.sasaranRef} · diminta {t.dibuatOlehNama ?? "—"} {formatRelatif(t.createdAt, now)}
                </p>
                {t.catatan && <p className="text-xs italic text-fg-muted">Catatan verifikator: “{t.catatan}”</p>}
                {t.status !== "OPEN" && (
                  <p className="text-[11px] text-success">
                    {CARA[t.selesaiCara ?? ""] ?? t.status}
                    {t.selesaiAt && ` · ${formatRelatif(t.selesaiAt, now)}`}
                  </p>
                )}
                {t.status === "OPEN" && !t.manual && (
                  <p className="text-[11px] text-fg-subtle">
                    {t.aturan === "bukti"
                      ? "Isi Bukti Pelayanan di menu Berkas Klaim RM — item tertutup otomatis setelah diisi."
                      : "Lengkapi di SIMRS — item tertutup otomatis saat datanya ada."}
                  </p>
                )}
              </div>
              {t.bolehSelesai && (
                <Button size="sm" variant="secondary" icon={<Check className="size-4" aria-hidden />} onClick={() => onSelesai(t)}>
                  Tandai selesai
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </li>
  );
}

function SelesaiModal({
  item,
  onClose,
  onSukses,
  onGagal,
}: {
  item: TindakLanjutBaris | null;
  onClose: () => void;
  onSukses: () => void;
  onGagal: (pesan: string) => void;
}) {
  const [catatan, setCatatan] = useState("");
  const [kirim, setKirim] = useState(false);

  async function simpan() {
    if (!item) return;
    setKirim(true);
    try {
      await apiPost(`/api/berkas-klaim/tindak-lanjut/${item.id}/selesai`, { catatan: catatan.trim() || undefined });
      setCatatan("");
      onSukses();
    } catch (e) {
      onGagal(pesanGalat(e));
    } finally {
      setKirim(false);
    }
  }

  return (
    <Modal
      open={!!item}
      onClose={kirim ? () => {} : onClose}
      dismissible={!kirim}
      title="Tandai item selesai"
      description={item ? `${item.label} — ${item.pasien.nama ?? ""}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={kirim}>
            Batal
          </Button>
          <Button onClick={simpan} loading={kirim} icon={<Check className="size-4" aria-hidden />}>
            Tandai selesai
          </Button>
        </>
      }
    >
      <label htmlFor="tl-catatan" className="mb-1.5 block text-xs font-medium text-fg-muted">
        Catatan (opsional)
      </label>
      <textarea
        id="tl-catatan"
        rows={3}
        maxLength={BATAS.CATATAN_MAKS}
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        placeholder="Mis. tanda tangan DPJP sudah dilengkapi pada lembar resume."
        className="w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40"
      />
    </Modal>
  );
}
