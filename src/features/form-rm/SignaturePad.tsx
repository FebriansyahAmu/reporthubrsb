"use client";

import { useEffect, useRef, useState } from "react";
import SignaturePadLib from "signature_pad";
import {
  ArrowLeft,
  Camera,
  Check,
  Copy,
  Eraser,
  Loader2,
  PenLine,
  RotateCcw,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ImageCropper } from "@/features/form-rm/ImageCropper";
import {
  type CropRect,
  PHOTO_MAXDIM_DEFAULT,
  PHOTO_THRESHOLD_DEFAULT,
  captureVideoFrame,
  fileToDataUrl,
  processDrawing,
  processPhoto,
} from "@/features/form-rm/signature";

type Mode = "" | "draw" | "upload" | "camera" | "remote";
const DEFAULT_CROP: CropRect = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };

type RemoteSession = { token: string; qr: string; url: string };

/** Penangkap tanda tangan: pilih metode → gambar/unggah/kamera/via HP → crop & sesuaikan. */
export function SignaturePad({
  label,
  value,
  onChange,
  context = "",
  reuse = "",
}: {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
  /** Konteks (mis. nama pasien) yang tampil di HP saat TTD jarak jauh. */
  context?: string;
  /** TTD dari slot lain yang bisa dipakai ulang (sekali klik) bila slot ini kosong. */
  reuse?: string;
}) {
  const [editing, setEditing] = useState(!value);
  const [mode, setMode] = useState<Mode>("");
  const [error, setError] = useState<string | null>(null);

  // TTD jarak jauh (hand-off ke HP via QR).
  const [remote, setRemote] = useState<RemoteSession | null>(null);
  const [remoteErr, setRemoteErr] = useState<string | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);

  // Sumber (gambar/unggah/kamera) → crop + ambang + ukuran → hasil biner (preview).
  const [srcImage, setSrcImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRect>(DEFAULT_CROP);
  const [threshold, setThreshold] = useState(PHOTO_THRESHOLD_DEFAULT);
  const [maxDim, setMaxDim] = useState(PHOTO_MAXDIM_DEFAULT);
  const [preview, setPreview] = useState<string>("");

  // Gambar (pakai signature_pad — goresan halus, lebar mengikuti kecepatan).
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  // Kamera.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  const setupCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    padRef.current?.off(); // lepas instance lama bila canvas di-mount ulang
    // DPR-aware: perbesar buffer lalu skala konteks agar goresan tajam.
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(rect.width * ratio));
    c.height = Math.max(1, Math.round(150 * ratio));
    c.getContext("2d")?.scale(ratio, ratio);
    const pad = new SignaturePadLib(c, {
      penColor: "#000",
      backgroundColor: "#fff", // latar putih → crop/preview jelas, dibuang saat binarisasi
      minWidth: 0.7,
      maxWidth: 2.6,
    });
    pad.clear(); // wajib setelah resize agar isEmpty() akurat
    padRef.current = pad;
  };

  // Inisialisasi pad tiap kali kanvas gambar termuat (jangan bergantung `editing`:
  // setelah commit→hapus, editing bisa false padahal kanvas baru perlu di-setup).
  useEffect(() => {
    if (mode === "draw" && !srcImage) setupCanvas();
  }, [mode, srcImage]);

  // Proses ulang biner saat sumber/crop/ambang/ukuran berubah.
  useEffect(() => {
    if (!srcImage) return;
    let alive = true;
    void processPhoto(srcImage, threshold, maxDim, crop).then((out) => {
      if (alive) setPreview(out);
    });
    return () => {
      alive = false;
    };
  }, [srcImage, threshold, maxDim, crop]);

  // Kamera.
  const stopCam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };
  useEffect(() => {
    if (!editing || mode !== "camera" || srcImage) {
      stopCam();
      return;
    }
    let cancelled = false;
    const start = async () => {
      const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
      if (!md?.getUserMedia) {
        if (!cancelled) setCamError("Kamera tidak tersedia di perangkat/koneksi ini. Pakai Unggah Foto.");
        return;
      }
      try {
        const stream = await md.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) setCamError("Tidak bisa mengakses kamera (izin ditolak?). Pakai Unggah Foto.");
      }
    };
    void start();
    return () => {
      cancelled = true;
      stopCam();
    };
  }, [editing, mode, srcImage]);

  useEffect(
    () => () => {
      stopCam();
      padRef.current?.off();
    },
    [],
  );

  function clearDraw() {
    padRef.current?.clear();
    setError(null);
  }

  function resetCapture() {
    setSrcImage(null);
    setPreview("");
    setCrop(DEFAULT_CROP);
    setThreshold(PHOTO_THRESHOLD_DEFAULT);
    setMaxDim(PHOTO_MAXDIM_DEFAULT);
    setError(null);
    setRemote(null);
    setRemoteErr(null);
    setRemoteLoading(false);
  }

  /** Mulai TTD jarak jauh: minta sesi (token+QR) lalu tampilkan QR untuk discan HP. */
  async function startRemote() {
    resetCapture();
    setCamError(null);
    setMode("remote");
    setRemoteLoading(true);
    try {
      const res = await fetch("/api/sign/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, context }),
      });
      if (!res.ok) throw new Error("gagal");
      const { data } = (await res.json()) as { data: RemoteSession };
      setRemote({ token: data.token, qr: data.qr, url: data.url });
    } catch {
      setRemoteErr("Tidak bisa membuat sesi TTD. Coba lagi.");
    } finally {
      setRemoteLoading(false);
    }
  }

  // Poll status sesi TTD jarak jauh; saat HP mengirim → isi field otomatis.
  useEffect(() => {
    if (mode !== "remote" || !remote) return;
    let alive = true;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/sign/${remote.token}`);
        if (!res.ok || !alive) return;
        const { data } = (await res.json()) as {
          data: { status: string; payload: string | null };
        };
        if (!alive) return;
        if (data.status === "signed" && data.payload) {
          clearInterval(id);
          commit(data.payload);
        } else if (data.status === "expired") {
          clearInterval(id);
          setRemote(null);
          setRemoteErr("Sesi kadaluarsa. Buat QR baru.");
        }
      } catch {
        /* abaikan galat sesaat, lanjut poll */
      }
    }, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, remote]);
  function chooseMode(m: Mode) {
    resetCapture();
    setCamError(null);
    setMode(m);
  }
  /** Mulai tahap crop & sesuaikan dari sebuah gambar sumber. */
  function startSource(src: string) {
    setError(null);
    setCrop(DEFAULT_CROP);
    setThreshold(PHOTO_THRESHOLD_DEFAULT);
    setMaxDim(PHOTO_MAXDIM_DEFAULT);
    setSrcImage(src);
  }
  function commit(dataUrl: string) {
    if (!dataUrl) {
      setError("Tanda tangan kosong.");
      return;
    }
    setError(null);
    onChange(dataUrl);
    setEditing(false);
    setMode("");
    resetCapture();
  }
  /** Gambar (signature_pad): langsung PNG + hapus latar, tanpa crop/ambang. */
  async function drawUse() {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      setError("Gambar tanda tangan dulu.");
      return;
    }
    try {
      commit(await processDrawing(pad.toDataURL("image/png")));
    } catch {
      setError("Gagal memproses gambar.");
    }
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      startSource(await fileToDataUrl(f));
    } catch {
      setError("Gagal membaca berkas.");
    }
  }
  function snap() {
    const v = videoRef.current;
    if (!v) return;
    const shot = captureVideoFrame(v);
    if (!shot) {
      setError("Kamera belum siap, coba lagi.");
      return;
    }
    startSource(shot);
  }

  // -------- Tersimpan --------
  if (value && !editing) {
    return (
      <div>
        <p className="mb-1.5 text-xs font-medium text-fg-muted">{label}</p>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="h-14 max-w-[60%] rounded-[var(--radius-md)] border border-border bg-white object-contain px-2"
          />
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setMode("");
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
            >
              <PenLine className="size-3.5" /> Ubah
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setEditing(true);
                setMode("");
                resetCapture();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-danger hover:underline"
            >
              <Trash2 className="size-3.5" /> Hapus
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------- Tangkap --------
  const showAdjust = !!srcImage;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        {value && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setMode("");
              resetCapture();
            }}
            className="text-xs text-fg-subtle hover:text-fg"
          >
            Batal
          </button>
        )}
      </div>

      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-2">
        {/* 1) Pemilih metode */}
        {mode === "" && (
          <div className="space-y-2">
            {reuse && (
              <button
                type="button"
                onClick={() => commit(reuse)}
                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-brand/40 bg-brand-soft px-3 py-2 text-left transition-colors hover:border-brand/60"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={reuse}
                  alt="TTD sebelumnya"
                  className="h-9 w-16 shrink-0 rounded-[var(--radius-sm)] border border-border bg-white object-contain"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-brand-soft-fg">
                    <Copy className="size-3.5" /> Pakai TTD sebelumnya
                  </span>
                  <span className="block text-xs text-fg-muted">Salin tanda tangan yang tadi dibubuhkan</span>
                </span>
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <MethodBtn icon={<PenLine className="size-5" />} label="Gambar" onClick={() => chooseMode("draw")} />
              <MethodBtn icon={<Smartphone className="size-5" />} label="Via HP" onClick={startRemote} />
              <MethodBtn icon={<Upload className="size-5" />} label="Unggah" onClick={() => chooseMode("upload")} />
              <MethodBtn icon={<Camera className="size-5" />} label="Kamera" onClick={() => chooseMode("camera")} />
            </div>
          </div>
        )}

        {/* 2a) Gambar */}
        {mode === "draw" && !showAdjust && (
          <div>
            <BackBtn onClick={() => chooseMode("")} />
            <canvas
              ref={canvasRef}
              className="h-[150px] w-full touch-none rounded-[var(--radius-md)] border border-dashed border-border bg-white"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <SmallBtn onClick={clearDraw} icon={<Eraser className="size-3.5" />}>Bersihkan</SmallBtn>
              <PrimaryBtn onClick={drawUse} icon={<Check className="size-3.5" />}>Gunakan</PrimaryBtn>
            </div>
          </div>
        )}

        {/* 2b) Unggah */}
        {mode === "upload" && !showAdjust && (
          <div>
            <BackBtn onClick={() => chooseMode("")} />
            <label className="flex h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border bg-surface-2/40 text-center text-xs text-fg-muted hover:bg-surface-2">
              <Upload className="size-6 text-fg-subtle" />
              <span>Pilih / potret foto tanda tangan (kertas putih, cahaya cukup)</span>
              <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
            </label>
          </div>
        )}

        {/* 2c) Kamera langsung */}
        {mode === "camera" && !showAdjust && (
          <div>
            <BackBtn onClick={() => chooseMode("")} />
            {camError ? (
              <div className="flex h-[150px] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border bg-surface-2/40 px-3 text-center text-xs text-danger">
                {camError}
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-[180px] w-full rounded-[var(--radius-md)] border border-border bg-black object-cover"
                />
                <div className="mt-2 flex justify-center">
                  <PrimaryBtn onClick={snap} icon={<Camera className="size-3.5" />}>Ambil Foto</PrimaryBtn>
                </div>
              </>
            )}
          </div>
        )}

        {/* 3) Crop & sesuaikan (semua metode) */}
        {showAdjust && srcImage && (
          <div>
            <BackBtn onClick={() => chooseMode("")} />
            <p className="mb-1.5 text-[11px] text-fg-subtle">Seret kotak untuk memotong area tanda tangan.</p>
            <ImageCropper src={srcImage} crop={crop} onChange={setCrop} />

            <div className="mt-2 flex min-h-[64px] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border bg-white p-2">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Pratinjau hasil" className="max-h-14 object-contain" />
              ) : (
                <span className="text-xs text-fg-muted">Memproses…</span>
              )}
            </div>

            <Slider label="Hitam-putih (ambang)" min={60} max={220} value={threshold} onChange={setThreshold} />
            <Slider label="Ukuran" min={200} max={700} value={maxDim} onChange={setMaxDim} suffix="px" />

            <div className="mt-1 flex items-center justify-between gap-2">
              <SmallBtn onClick={resetCapture} icon={<RotateCcw className="size-3.5" />}>Ulangi</SmallBtn>
              <PrimaryBtn onClick={() => commit(preview)} disabled={!preview} icon={<Check className="size-3.5" />}>
                Gunakan
              </PrimaryBtn>
            </div>
          </div>
        )}

        {/* 4) Via HP — TTD jarak jauh (scan QR di HP) */}
        {mode === "remote" && (
          <div>
            <BackBtn onClick={() => chooseMode("")} />
            {remoteLoading ? (
              <div className="flex h-[180px] flex-col items-center justify-center gap-2 text-fg-muted">
                <Loader2 className="size-6 animate-spin" />
                <span className="text-xs">Menyiapkan sesi…</span>
              </div>
            ) : remoteErr ? (
              <div className="flex h-[180px] flex-col items-center justify-center gap-3 px-3 text-center">
                <p className="text-xs text-danger">{remoteErr}</p>
                <PrimaryBtn onClick={startRemote} icon={<RotateCcw className="size-3.5" />}>Coba lagi</PrimaryBtn>
              </div>
            ) : remote ? (
              <div className="flex flex-col items-center gap-2 py-1 text-center">
                <p className="text-xs text-fg-muted">Scan QR ini dengan HP untuk menandatangani.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={remote.qr}
                  alt="QR tanda tangan"
                  className="size-40 rounded-[var(--radius-md)] border border-border bg-white p-1.5"
                />
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand">
                  <Loader2 className="size-3.5 animate-spin" /> Menunggu tanda tangan dari HP…
                </p>
                <p className="max-w-full break-all text-[10px] text-fg-subtle">{remote.url}</p>
              </div>
            ) : null}
          </div>
        )}

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- sub-elements */

function MethodBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-2 py-4 text-xs font-medium text-fg-muted transition-colors hover:border-brand/50 hover:bg-brand-soft hover:text-brand-soft-fg"
    >
      <span className="text-fg-subtle">{icon}</span>
      {label}
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-fg-subtle hover:text-fg"
    >
      <ArrowLeft className="size-3.5" /> Ganti metode
    </button>
  );
}

function SmallBtn({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-2"
    >
      {icon}
      {children}
    </button>
  );
}

function PrimaryBtn({
  onClick,
  icon,
  disabled,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-brand bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg hover:bg-brand-hover disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
  suffix,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="mt-2">
      <label className="mb-1 flex items-center justify-between text-xs text-fg-muted">
        <span>{label}</span>
        <span className="tabular-nums">
          {value}
          {suffix ?? ""}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn("w-full accent-[var(--brand,#2563eb)]")}
      />
    </div>
  );
}
