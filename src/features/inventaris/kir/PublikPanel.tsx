"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  EyeOff,
  ExternalLink,
  Power,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/lib/useAsyncData";
import { downloadFromEndpoint } from "@/lib/download";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  fetchTautanPublik,
  labelQrUrl,
  ubahTautanPublik,
  type AksiTautan,
  type StatusTautan,
  type TautanPublik,
} from "./kir.client";

type RuanganInfo = { id: string; nama: string; kodePrefix: string };

const STATUS: Record<StatusTautan, { label: string; tone: "neutral" | "success" | "warning" }> = {
  BELUM: { label: "Belum diterbitkan", tone: "neutral" },
  AKTIF: { label: "Aktif", tone: "success" },
  NONAKTIF: { label: "Nonaktif", tone: "warning" },
};

const KONFIRMASI: Record<AksiTautan, { judul: string; isi: string; tombol: string; bahaya?: boolean }> = {
  TERBITKAN: {
    judul: "Terbitkan QR publik?",
    isi: "Siapa pun yang memindai QR ruangan ini dapat melihat nama barang, kondisi, dan tahun perolehannya tanpa login.",
    tombol: "Terbitkan",
  },
  NONAKTIFKAN: {
    judul: "Nonaktifkan tautan publik?",
    isi: "Label QR yang sudah tertempel berhenti berfungsi sampai tautan diaktifkan kembali.",
    tombol: "Nonaktifkan",
    bahaya: true,
  },
  AKTIFKAN: {
    judul: "Aktifkan kembali tautan publik?",
    isi: "Label QR yang sama (yang sudah tertempel) berfungsi lagi.",
    tombol: "Aktifkan",
  },
  GANTI: {
    judul: "Ganti tautan publik?",
    isi: "Tautan baru dibuat dan SEMUA label QR lama ruangan ini berhenti berfungsi permanen. Cetak & tempel ulang label baru. Gunakan bila label lama hilang atau tautannya tersebar.",
    tombol: "Ganti tautan",
    bahaya: true,
  },
};

/**
 * Panel QR publik ruangan (tab di KIR & BAST): terbitkan / nonaktifkan /
 * aktifkan / ganti tautan, unduh QR, cetak label. Pasang dengan
 * `key={ruangan.id}` agar state tereset saat ganti ruangan.
 */
export function PublikPanel({
  ruangan,
  canUpdate,
  onBerubah,
}: {
  ruangan: RuanganInfo;
  canUpdate: boolean;
  /** Status tautan berubah → induk menyegarkan daftar ruangan. */
  onBerubah: () => void;
}) {
  const toast = useToast();
  const muat = useAsyncData<TautanPublik>(() => fetchTautanPublik(ruangan.id), [ruangan.id]);
  const [terbaru, setTerbaru] = useState<TautanPublik | null>(null);
  const tautan = terbaru ?? muat.result;

  const [tanya, setTanya] = useState<AksiTautan | null>(null);
  const [proses, setProses] = useState(false);
  const [qr, setQr] = useState("");
  const [tersalin, setTersalin] = useState(false);
  const [mencetak, setMencetak] = useState(false);

  const url = tautan?.url ?? null;
  useEffect(() => {
    if (!url) return;
    let batal = false;
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "Q" })
      .then((d) => !batal && setQr(d))
      .catch(() => !batal && setQr(""));
    return () => {
      batal = true;
    };
  }, [url]);

  async function jalankan(aksi: AksiTautan) {
    setProses(true);
    try {
      setTerbaru(await ubahTautanPublik(ruangan.id, aksi));
      setTanya(null);
      onBerubah();
      toast.success("Tautan publik diperbarui", `${ruangan.nama}: ${KONFIRMASI[aksi].tombol.toLowerCase()} berhasil.`);
    } catch (e) {
      toast.error("Gagal memperbarui tautan", e instanceof Error ? e.message : undefined);
      muat.reload();
      setTerbaru(null);
      setTanya(null);
    } finally {
      setProses(false);
    }
  }

  async function salin() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 1800);
    } catch {
      toast.error("Tidak bisa menyalin", "Salin manual dari kolom tautan.");
    }
  }

  function unduhPng() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `QR-Publik_${ruangan.kodePrefix}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function cetakLabel() {
    setMencetak(true);
    try {
      await downloadFromEndpoint(labelQrUrl(ruangan.id), `Label-QR_${ruangan.kodePrefix}.pdf`);
      toast.success("Label QR diunduh", "Cetak di kertas A6 / stiker, lalu tempel di ruangan.");
    } catch (e) {
      toast.error("Gagal membuat label", e instanceof Error ? e.message : undefined);
    } finally {
      setMencetak(false);
    }
  }

  const status = tautan?.status ?? "BELUM";
  const aktif = status === "AKTIF";

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
            <QrCode className="size-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-fg">QR Publik Ruangan</h3>
            <p className="text-xs text-fg-muted">Pindai QR → daftar barang {ruangan.nama} tanpa login.</p>
          </div>
        </div>
        {tautan && <Badge tone={STATUS[status].tone} dot>{STATUS[status].label}</Badge>}
      </div>

      {muat.loading && !tautan ? (
        <div className="grid gap-5 p-5 md:grid-cols-[13rem_1fr]">
          <Skeleton className="aspect-square w-full rounded-[var(--radius-lg)]" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="h-9 w-1/2 rounded" />
          </div>
        </div>
      ) : muat.error && !tautan ? (
        <ErrorState onRetry={muat.reload} />
      ) : tautan ? (
        <div className="grid gap-5 p-5 md:grid-cols-[13rem_minmax(0,1fr)]">
          {/* QR */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-full overflow-hidden rounded-[var(--radius-lg)] border border-border bg-white p-3 shadow-xs">
              {status !== "BELUM" && qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr}
                  alt={`QR publik ${ruangan.nama}`}
                  className={cn("aspect-square w-full [image-rendering:pixelated]", !aktif && "opacity-25 grayscale")}
                />
              ) : (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed border-border text-fg-subtle">
                  <QrCode className="size-10" aria-hidden />
                  <span className="text-xs">{status === "BELUM" ? "Belum diterbitkan" : "Origin belum diatur"}</span>
                </div>
              )}
              {status === "NONAKTIF" && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warning px-3 py-1 text-xs font-semibold text-white shadow-sm">
                    <EyeOff className="size-3.5" aria-hidden /> Nonaktif
                  </span>
                </span>
              )}
            </div>
            <p className="text-center text-xs font-medium text-fg-muted">
              <span className="font-mono">{ruangan.kodePrefix}</span> · {ruangan.nama}
            </p>
          </div>

          {/* Info & aksi */}
          <div className="min-w-0 space-y-4">
            {!tautan.asalDiatur && (
              <Peringatan>
                Origin publik server belum diatur (<code className="font-mono">PUBLIC_APP_ORIGIN</code> di <code className="font-mono">.env</code>).
                QR tidak bisa dibuat sampai admin server mengaturnya.
              </Peringatan>
            )}

            {status === "BELUM" ? (
              <div className="space-y-3">
                <p className="text-sm text-fg">
                  Terbitkan QR agar siapa pun di ruangan ini bisa memindai label dan melihat daftar barangnya — tanpa akun.
                </p>
                {canUpdate ? (
                  <Button icon={<QrCode className="size-4" />} onClick={() => setTanya("TERBITKAN")}>
                    Terbitkan QR Publik
                  </Button>
                ) : (
                  <p className="text-xs text-fg-muted">Menerbitkan QR memerlukan izin ubah KIR & BAST.</p>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="tautan-publik" className="mb-1.5 block text-xs font-medium text-fg-muted">
                    Tautan publik
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="tautan-publik"
                      readOnly
                      value={url ?? "—"}
                      onFocus={(e) => e.currentTarget.select()}
                      className="h-10 min-w-0 flex-1 rounded-[var(--radius-md)] border border-border bg-surface-2/50 px-3 font-mono text-xs text-fg focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40"
                    />
                    <Button variant="secondary" size="md" onClick={salin} disabled={!url} icon={tersalin ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}>
                      {tersalin ? "Tersalin" : "Salin"}
                    </Button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-fg-subtle">
                    Diterbitkan {formatDateTime(tautan.dibuatPada)}{tautan.dibuatOleh ? ` oleh ${tautan.dibuatOleh}` : ""}
                    {tautan.diubahPada !== tautan.dibuatPada && ` · diubah ${formatDateTime(tautan.diubahPada)}${tautan.diubahOleh ? ` oleh ${tautan.diubahOleh}` : ""}`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button icon={<Printer className="size-4" />} onClick={cetakLabel} loading={mencetak} disabled={!aktif || !url}>
                    Cetak Label (PDF)
                  </Button>
                  <Button variant="secondary" icon={<Download className="size-4" />} onClick={unduhPng} disabled={!aktif || !qr}>
                    Unduh PNG
                  </Button>
                  {aktif && url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                    >
                      <ExternalLink className="size-4" aria-hidden /> Buka halaman publik
                    </a>
                  )}
                </div>

                {canUpdate && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-4">
                    <span className="mr-1 text-xs font-medium text-fg-subtle">Kelola:</span>
                    {aktif ? (
                      <Button variant="secondary" size="sm" icon={<Power className="size-4" />} onClick={() => setTanya("NONAKTIFKAN")}>
                        Nonaktifkan
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" icon={<Power className="size-4" />} onClick={() => setTanya("AKTIFKAN")}>
                        Aktifkan kembali
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => setTanya("GANTI")}>
                      Ganti tautan
                    </Button>
                  </div>
                )}
              </>
            )}

            <DataPublik />
          </div>
        </div>
      ) : null}

      {tanya && (
        <Modal
          open
          onClose={proses ? () => {} : () => setTanya(null)}
          size="sm"
          title={KONFIRMASI[tanya].judul}
          description={`${ruangan.kodePrefix} · ${ruangan.nama}`}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setTanya(null)} disabled={proses}>
                Batal
              </Button>
              <Button variant={KONFIRMASI[tanya].bahaya ? "danger" : "primary"} size="sm" loading={proses} onClick={() => jalankan(tanya)}>
                {KONFIRMASI[tanya].tombol}
              </Button>
            </div>
          }
        >
          <p className="text-sm leading-relaxed text-fg-muted">{KONFIRMASI[tanya].isi}</p>
        </Modal>
      )}
    </Card>
  );
}

/** Transparansi: apa yang terlihat & tidak terlihat oleh publik. */
function DataPublik() {
  const tampil = ["Nama barang", "Kondisi", "Tahun perolehan", "Jumlah unit"];
  const sembunyi = ["Kode barang", "Harga", "Merk & no. seri", "Penanggung jawab"];
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface-2/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-fg">
        <ShieldCheck className="size-3.5 text-brand" aria-hidden /> Yang terlihat oleh publik
      </p>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {tampil.map((t) => (
          <li key={t} className="flex items-center gap-1.5 text-fg">
            <Check className="size-3.5 shrink-0 text-success" aria-hidden /> {t}
          </li>
        ))}
        {sembunyi.map((t) => (
          <li key={t} className="flex items-center gap-1.5 text-fg-subtle">
            <X className="size-3.5 shrink-0" aria-hidden /> {t} <span className="sr-only">(tidak ditampilkan)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Peringatan({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs text-warning">
      <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  );
}
