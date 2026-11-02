"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, RotateCcw, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useMeasure } from "@/components/charts/useMeasure";
import { cn } from "@/lib/cn";
import { apiDelete, apiUpload, pesanGalat } from "@/lib/api-client";
import { AVATAR } from "@/server/modules/bckh/bckh.constants";
import {
  AvatarTidakValid,
  ZOOM_MAKS,
  bingkaiAwal,
  dekodeAvatar,
  gambarDari,
  lukis,
  potongAvatar,
  rapikan,
  sisiTerlihat,
  type Bingkai,
  type SumberAvatar,
} from "./avatar.olah";
import { AvatarBckh } from "./ui";

/**
 * Ganti foto profil BCKH (ala "Edit profile picture" GitHub): pilih / seret /
 * tempel foto → atur bingkai persegi (geser, gulir/cubit untuk perbesar, atau
 * papan ketik) → simpan. Hapus foto = kembali ke identicon.
 */
export function AvatarModal({
  open,
  userId,
  versi,
  nama,
  onClose,
  onTersimpan,
}: {
  open: boolean;
  userId: string;
  versi: string | null;
  nama: string;
  onClose: () => void;
  onTersimpan: (versi: string | null) => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const sumberRef = useRef<SumberAvatar | null>(null);
  const [sumber, setSumber] = useState<SumberAvatar | null>(null);
  const [bingkai, setBingkai] = useState<Bingkai | null>(null);
  const [proses, setProses] = useState<"baca" | "simpan" | "hapus" | null>(null);
  const [yakinHapus, setYakinHapus] = useState(false);
  const [diseret, setDiseret] = useState(false);
  const sibuk = proses === "simpan" || proses === "hapus";

  useEffect(() => () => sumberRef.current?.tutup(), []);

  const gantiSumber = (s: SumberAvatar | null) => {
    sumberRef.current?.tutup();
    sumberRef.current = s;
    setSumber(s);
    setBingkai(s ? bingkaiAwal(s) : null);
  };

  const tutup = () => {
    if (sibuk) return;
    gantiSumber(null);
    setYakinHapus(false);
    onClose();
  };

  const pilih = async (file: File | null | undefined) => {
    if (!file || sibuk) return;
    setProses("baca");
    try {
      const s = await dekodeAvatar(file);
      if (s.lebar < 32 || s.tinggi < 32) {
        s.tutup();
        throw new AvatarTidakValid("Foto terlalu kecil (minimal 32 × 32 piksel).");
      }
      gantiSumber(s);
      setYakinHapus(false);
    } catch (e) {
      toast.error("Foto tidak dapat dipakai", e instanceof AvatarTidakValid ? e.message : "Format foto tidak dapat dibaca.");
    } finally {
      setProses(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const simpan = async () => {
    if (!sumber || !bingkai || sibuk) return;
    setProses("simpan");
    try {
      const berkas = await potongAvatar(sumber, bingkai);
      const fd = new FormData();
      fd.set("avatar", berkas, berkas.type === "image/webp" ? "avatar.webp" : "avatar.jpg");
      const r = await apiUpload<{ avatar: string }>("/api/bckh/avatar", fd);
      toast.success("Foto profil diperbarui");
      gantiSumber(null);
      onTersimpan(r.avatar);
    } catch (e) {
      toast.error("Foto profil tidak tersimpan", e instanceof AvatarTidakValid ? e.message : pesanGalat(e));
    } finally {
      setProses(null);
    }
  };

  const hapus = async () => {
    setProses("hapus");
    try {
      await apiDelete("/api/bckh/avatar");
      toast.success("Foto profil dihapus", "Avatar kembali ke pola bawaan.");
      setYakinHapus(false);
      onTersimpan(null);
    } catch (e) {
      toast.error("Foto profil tidak terhapus", pesanGalat(e));
    } finally {
      setProses(null);
    }
  };

  const footer = sumber ? (
    <>
      <Button variant="ghost" size="sm" className="mr-auto" icon={<ImagePlus className="size-4" />} onClick={() => inputRef.current?.click()} disabled={sibuk}>
        <span className="hidden sm:inline">Pilih foto lain</span>
        <span className="sm:hidden">Ganti</span>
      </Button>
      <Button variant="secondary" size="sm" onClick={() => gantiSumber(null)} disabled={sibuk}>
        Batal
      </Button>
      <Button size="sm" loading={proses === "simpan"} onClick={() => void simpan()}>
        Simpan foto
      </Button>
    </>
  ) : yakinHapus ? (
    <>
      <p className="mr-auto text-xs text-fg-muted">Hapus foto profil?</p>
      <Button variant="ghost" size="sm" onClick={() => setYakinHapus(false)} disabled={sibuk}>
        Batal
      </Button>
      <Button variant="danger" size="sm" loading={proses === "hapus"} onClick={() => void hapus()}>
        Ya, hapus foto
      </Button>
    </>
  ) : (
    <>
      {versi && (
        <Button variant="ghost" size="sm" className="mr-auto text-danger hover:text-danger" icon={<Trash2 className="size-4" />} onClick={() => setYakinHapus(true)}>
          Hapus foto
        </Button>
      )}
      <Button variant="secondary" size="sm" onClick={tutup}>
        Tutup
      </Button>
    </>
  );

  return (
    <Modal open={open} onClose={tutup} size="sm" title="Foto profil" description="Tampil di profil BCKH dan daftar Tim." footer={footer} dismissible={!sibuk}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Pilih foto profil"
        onChange={(e) => void pilih(e.target.files?.[0])}
      />
      {sumber && bingkai ? (
        <PemotongAvatar sumber={sumber} bingkai={bingkai} onBingkai={setBingkai} />
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDiseret(true);
          }}
          onDragLeave={() => setDiseret(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDiseret(false);
            void pilih(gambarDari(e.dataTransfer));
          }}
          onPaste={(e) => void pilih(gambarDari(e.clipboardData))}
          className={cn(
            "flex flex-col items-center gap-4 rounded-[var(--radius-md)] border-2 border-dashed px-4 py-6 text-center transition-colors",
            diseret ? "border-brand bg-brand-soft/60" : "border-border",
          )}
        >
          <AvatarBckh userId={userId} versi={versi} label={`Foto profil ${nama}`} className="size-32 border border-border shadow-xs" />
          <div className="space-y-2">
            <Button size="sm" icon={<ImagePlus className="size-4" />} loading={proses === "baca"} onClick={() => inputRef.current?.click()}>
              {versi ? "Ganti foto" : "Unggah foto"}
            </Button>
            <p className="text-xs text-fg-muted">atau seret / tempel foto ke sini</p>
          </div>
          <p className="max-w-[22rem] text-[11px] leading-relaxed text-fg-subtle">
            JPG, PNG, atau WebP hingga {AVATAR.masukanMaks / 1024 / 1024} MB. Foto dipotong persegi dan dikecilkan otomatis di perangkat Anda; data lokasi
            & metadata foto tidak ikut terkirim.
          </p>
        </div>
      )}
    </Modal>
  );
}

const LANGKAH_ZOOM = 1.15;

/** Bingkai potong persegi dengan masker lingkaran: seret = geser, gulir/cubit = perbesar. */
function PemotongAvatar({ sumber, bingkai, onBingkai }: { sumber: SumberAvatar; bingkai: Bingkai; onBingkai: (b: Bingkai) => void }) {
  const [ukurRef, lebar] = useMeasure<HTMLDivElement>();
  const kanvasRef = useRef<HTMLCanvasElement>(null);
  const bingkaiRef = useRef(bingkai);
  const penunjuk = useRef(new Map<number, { x: number; y: number }>());
  const gerak = useRef<{ bingkai: Bingkai; tengah: { x: number; y: number }; jarak: number } | null>(null);

  useEffect(() => {
    bingkaiRef.current = bingkai;
  }, [bingkai]);

  const ubah = (b: Bingkai) => onBingkai(rapikan(sumber, b));

  useEffect(() => {
    const c = kanvasRef.current;
    if (!c || lebar <= 0) return;
    const sisi = Math.round(lebar * Math.min(2, window.devicePixelRatio || 1));
    if (c.width !== sisi) {
      c.width = sisi;
      c.height = sisi;
    }
    const ctx = c.getContext("2d");
    if (ctx) lukis(ctx, sumber, bingkai, sisi);
  }, [sumber, bingkai, lebar]);

  // Gulir roda = perbesar (listener non-pasif agar halaman tak ikut tergulir).
  useEffect(() => {
    const el = ukurRef.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const b = bingkaiRef.current;
      onBingkai(rapikan(sumber, { ...b, zoom: b.zoom * Math.exp(-e.deltaY * 0.0015) }));
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [ukurRef, sumber, onBingkai]);

  /** Titik tengah & jarak semua penunjuk aktif (1 jari = geser, 2 jari = cubit). */
  const ukurPenunjuk = () => {
    const t = [...penunjuk.current.values()];
    const tengah = { x: t.reduce((s, p) => s + p.x, 0) / t.length, y: t.reduce((s, p) => s + p.y, 0) / t.length };
    const jarak = t.length > 1 ? Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y) : 0;
    return { tengah, jarak };
  };
  const mulaiGerak = () => {
    gerak.current = penunjuk.current.size ? { bingkai: bingkaiRef.current, ...ukurPenunjuk() } : null;
  };

  const perPiksel = (zoom: number) => sisiTerlihat(sumber, zoom) / Math.max(1, lebar);

  return (
    <div>
      <div
        ref={ukurRef}
        tabIndex={0}
        role="group"
        aria-label="Bingkai foto profil. Panah untuk menggeser, tambah atau kurang untuk memperbesar, 0 untuk mengatur ulang."
        className="relative mx-auto aspect-square w-full max-w-[18rem] cursor-grab touch-none select-none overflow-hidden rounded-[var(--radius-md)] bg-surface-2 outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          penunjuk.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          mulaiGerak();
        }}
        onPointerMove={(e) => {
          if (!penunjuk.current.has(e.pointerId) || !gerak.current) return;
          penunjuk.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const awal = gerak.current;
          const { tengah, jarak } = ukurPenunjuk();
          const zoom = awal.jarak > 0 && jarak > 0 ? awal.bingkai.zoom * (jarak / awal.jarak) : awal.bingkai.zoom;
          const k = perPiksel(zoom);
          ubah({ zoom, cx: awal.bingkai.cx - (tengah.x - awal.tengah.x) * k, cy: awal.bingkai.cy - (tengah.y - awal.tengah.y) * k });
        }}
        onPointerUp={(e) => {
          penunjuk.current.delete(e.pointerId);
          mulaiGerak();
        }}
        onPointerCancel={(e) => {
          penunjuk.current.delete(e.pointerId);
          mulaiGerak();
        }}
        onKeyDown={(e) => {
          const langkah = sisiTerlihat(sumber, bingkai.zoom) * 0.04;
          const geser: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
          if (geser[e.key]) ubah({ ...bingkai, cx: bingkai.cx + geser[e.key][0] * langkah, cy: bingkai.cy + geser[e.key][1] * langkah });
          else if (e.key === "+" || e.key === "=") ubah({ ...bingkai, zoom: bingkai.zoom * LANGKAH_ZOOM });
          else if (e.key === "-" || e.key === "_") ubah({ ...bingkai, zoom: bingkai.zoom / LANGKAH_ZOOM });
          else if (e.key === "0") onBingkai(bingkaiAwal(sumber));
          else return;
          e.preventDefault();
        }}
      >
        <canvas ref={kanvasRef} className="block size-full" aria-hidden />
        {/* Area di luar lingkaran diredupkan — yang tampil di profil hanya lingkaran. */}
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(11,54,88,0.5)] ring-2 ring-white/90" />
      </div>

      <div className="mx-auto mt-4 flex max-w-[18rem] items-center gap-1.5">
        <TombolIkon label="Perkecil" onClick={() => ubah({ ...bingkai, zoom: bingkai.zoom / LANGKAH_ZOOM })} disabled={bingkai.zoom <= 1}>
          <ZoomOut className="size-4" />
        </TombolIkon>
        <input
          type="range"
          min={1}
          max={ZOOM_MAKS}
          step={0.01}
          value={bingkai.zoom}
          onChange={(e) => ubah({ ...bingkai, zoom: Number(e.target.value) })}
          aria-label="Perbesaran foto"
          aria-valuetext={`${Math.round(bingkai.zoom * 100)}%`}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-brand"
        />
        <TombolIkon label="Perbesar" onClick={() => ubah({ ...bingkai, zoom: bingkai.zoom * LANGKAH_ZOOM })} disabled={bingkai.zoom >= ZOOM_MAKS}>
          <ZoomIn className="size-4" />
        </TombolIkon>
        <TombolIkon label="Atur ulang bingkai" onClick={() => onBingkai(bingkaiAwal(sumber))}>
          <RotateCcw className="size-4" />
        </TombolIkon>
      </div>
      <p className="mt-2 text-center text-[11px] text-fg-subtle">Seret untuk menggeser · gulir atau cubit untuk memperbesar</p>
    </div>
  );
}

function TombolIkon({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
    >
      {children}
    </button>
  );
}
