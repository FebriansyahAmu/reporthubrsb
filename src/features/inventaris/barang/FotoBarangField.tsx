"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AlertCircle, Camera, ImagePlus, Loader2, Maximize2, Package, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatUkuran } from "@/lib/format";
import { cn } from "@/lib/cn";
import { FOTO_BARANG } from "@/server/modules/inventaris/barang.schema";
import { fotoBarangUrl, type BarangItem } from "./barang.client";
import { FotoTidakValid, gambarDari, siapkanFoto, type FotoSiap } from "./foto.olah";
import { FotoLightbox } from "./FotoLightbox";

export type FotoNilai =
  | { jenis: "kosong" }
  | { jenis: "tersimpan"; url: string; thumbUrl: string; unduhUrl: string }
  | { jenis: "baru"; siap: FotoSiap };

export const FOTO_KOSONG: FotoNilai = { jenis: "kosong" };

/** Nilai bingkai dari unit tersimpan. */
export const fotoDariItem = (b: Pick<BarangItem, "id" | "foto"> | null | undefined): FotoNilai =>
  b?.foto
    ? {
        jenis: "tersimpan",
        url: fotoBarangUrl(b.id, b.foto),
        thumbUrl: fotoBarangUrl(b.id, b.foto, { thumb: true }),
        unduhUrl: fotoBarangUrl(b.id, b.foto, { unduh: true }),
      }
    : FOTO_KOSONG;

/**
 * Bingkai foto barang: seret-lepas, tempel (Ctrl+V), pilih berkas, atau kamera
 * (perangkat sentuh). Foto dikompres di browser (`siapkanFoto`) lalu
 * dipratinjau; klik untuk layar penuh. Terkendali penuh lewat `value`/`onChange`
 * — induk yang memutuskan kapan foto benar-benar diunggah.
 */
export function FotoBarangField({
  value,
  onChange,
  judul,
  bolehTambah = true,
  bolehGanti = true,
  konfirmasiHapus = false,
  tempelGlobal = false,
  sibuk = null,
  className,
}: {
  value: FotoNilai;
  onChange: (v: FotoNilai) => void;
  /** Nama barang — teks alternatif & judul penampil. */
  judul: string;
  /** Boleh memasang foto saat belum ada. */
  bolehTambah?: boolean;
  /** Boleh mengganti / menghapus foto yang ada. */
  bolehGanti?: boolean;
  /** Minta konfirmasi sebelum menghapus (dipakai saat hapus = langsung tersimpan). */
  konfirmasiHapus?: boolean;
  /** Tangkap tempel gambar (Ctrl+V) di mana pun selama komponen tampil. */
  tempelGlobal?: boolean;
  /** Teks status saat induk sedang mengunggah/menghapus (mengunci kontrol). */
  sibuk?: string | null;
  /** Rasio/ukuran bingkai, mis. "aspect-video lg:aspect-square". */
  className?: string;
}) {
  const berkasRef = useRef<HTMLInputElement>(null);
  const kameraRef = useRef<HTMLInputElement>(null);
  const kedalamanSeret = useRef(0);
  const [proses, setProses] = useState(false);
  const [seret, setSeret] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [lihat, setLihat] = useState(false);
  const [tanyaHapus, setTanyaHapus] = useState(false);

  const terkunci = proses || !!sibuk;
  const ada = value.jenis !== "kosong";
  const bisaUnggah = ada ? bolehGanti : bolehTambah;

  // Cabut object URL pratinjau saat diganti / komponen dilepas.
  useEffect(() => {
    if (value.jenis !== "baru") return;
    const url = value.siap.preview;
    return () => URL.revokeObjectURL(url);
  }, [value]);

  async function terima(file: File | null | undefined) {
    if (!file || terkunci || !bisaUnggah) return;
    setGalat(null);
    setTanyaHapus(false);
    setProses(true);
    try {
      onChange({ jenis: "baru", siap: await siapkanFoto(file) });
    } catch (e) {
      setGalat(e instanceof FotoTidakValid ? e.message : "Foto gagal diproses. Coba foto lain.");
    } finally {
      setProses(false);
    }
  }

  const onTempel = useEffectEvent((e: ClipboardEvent) => {
    const f = gambarDari(e.clipboardData);
    if (!f) return;
    e.preventDefault();
    void terima(f);
  });
  useEffect(() => {
    if (!tempelGlobal) return;
    const h = (e: ClipboardEvent) => onTempel(e);
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, [tempelGlobal]);

  function pilih(kamera = false) {
    if (terkunci || !bisaUnggah) return;
    (kamera ? kameraRef : berkasRef).current?.click();
  }

  function hapus() {
    if (konfirmasiHapus && !tanyaHapus) return setTanyaHapus(true);
    setTanyaHapus(false);
    setGalat(null);
    onChange(FOTO_KOSONG);
  }

  const seretProps = bisaUnggah
    ? {
        onDragEnter: (e: React.DragEvent) => {
          if (!Array.from(e.dataTransfer.types).includes("Files")) return;
          e.preventDefault();
          kedalamanSeret.current += 1;
          setSeret(true);
        },
        onDragOver: (e: React.DragEvent) => {
          if (!Array.from(e.dataTransfer.types).includes("Files")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = terkunci ? "none" : "copy";
        },
        onDragLeave: () => {
          kedalamanSeret.current = Math.max(0, kedalamanSeret.current - 1);
          if (kedalamanSeret.current === 0) setSeret(false);
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          kedalamanSeret.current = 0;
          setSeret(false);
          const f = gambarDari(e.dataTransfer);
          if (f) void terima(f);
          else setGalat("Yang dilepas bukan berkas gambar.");
        },
      }
    : {};

  const src = value.jenis === "baru" ? value.siap.preview : value.jenis === "tersimpan" ? value.url : "";
  const bingkai = cn(
    "relative w-full overflow-hidden rounded-[var(--radius-lg)] transition-[border-color,background-color,box-shadow] duration-150",
    className ?? "aspect-4/3",
  );

  return (
    <div className="space-y-2">
      {ada ? (
        <div
          {...seretProps}
          className={cn(bingkai, "group border border-border bg-surface-2/70", seret && "border-brand ring-4 ring-brand-ring/25")}
        >
          {/* Latar "ambient": foto yang sama diburamkan mengisi sisa bingkai. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-45 blur-2xl" />
          <button
            type="button"
            onClick={() => setLihat(true)}
            className="absolute inset-0 flex cursor-zoom-in items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring"
            aria-label={`Lihat foto ${judul} layar penuh`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Foto ${judul}`} className="relative max-h-full max-w-full object-contain drop-shadow-md" />
          </button>

          {value.jenis === "baru" && (
            <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-fg shadow-xs">
              Belum disimpan
            </span>
          )}

          {/* Aksi: muncul saat hover/fokus; selalu tampil di perangkat sentuh. */}
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
            <AksiFoto label="Perbesar" onClick={() => setLihat(true)}>
              <Maximize2 className="size-3.5" />
            </AksiFoto>
            {bolehGanti && (
              <>
                <AksiFoto label="Ganti foto" onClick={() => pilih()} disabled={terkunci}>
                  <RefreshCw className="size-3.5" />
                </AksiFoto>
                <AksiFoto label="Hapus foto" onClick={hapus} disabled={terkunci} bahaya>
                  <Trash2 className="size-3.5" />
                </AksiFoto>
              </>
            )}
          </div>

          {value.jenis === "baru" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pb-2 pt-6 text-[11px] font-medium text-white">
              {value.siap.lebar}×{value.siap.tinggi} px · {formatUkuran(value.siap.foto.size)}
              {value.siap.ukuranAsli > value.siap.foto.size * 1.1 && (
                <span className="text-white/70"> (asli {formatUkuran(value.siap.ukuranAsli)})</span>
              )}
            </div>
          )}

          {tanyaHapus && (
            <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface/95 p-2 shadow-md backdrop-blur-sm">
              <p className="min-w-0 flex-1 text-xs font-medium text-fg">Hapus foto ini?</p>
              <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs" onClick={() => setTanyaHapus(false)}>
                Batal
              </Button>
              <Button size="sm" variant="danger" className="h-7 px-2.5 text-xs" onClick={hapus}>
                Hapus
              </Button>
            </div>
          )}

          {seret && <LapisSeret />}
          {(proses || sibuk) && <LapisProses teks={proses ? "Memproses foto…" : sibuk!} />}
        </div>
      ) : bolehTambah ? (
        <div
          {...seretProps}
          onClick={() => pilih()}
          className={cn(
            bingkai,
            "flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-4 text-center",
            seret ? "border-brand bg-brand-soft/60" : "border-border bg-surface-2/40 hover:border-brand/50 hover:bg-brand-soft/30",
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-surface text-brand shadow-xs ring-1 ring-border">
            <ImagePlus className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-fg">Tambah foto barang</p>
            <p className="mt-0.5 text-xs text-fg-muted">
              Seret ke sini, tempel <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd>, atau pilih
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="secondary" icon={<Upload className="size-3.5" />} onClick={() => pilih()} disabled={terkunci}>
              Pilih foto
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<Camera className="size-3.5" />}
              onClick={() => pilih(true)}
              disabled={terkunci}
              className="hidden pointer-coarse:inline-flex"
            >
              Kamera
            </Button>
          </div>
          {seret && <LapisSeret />}
          {(proses || sibuk) && <LapisProses teks={proses ? "Memproses foto…" : sibuk!} />}
        </div>
      ) : (
        <div className={cn(bingkai, "flex flex-col items-center justify-center gap-2 border border-border bg-surface-2/40 text-fg-subtle")}>
          <Package className="size-9" />
          <p className="text-xs">Belum ada foto</p>
        </div>
      )}

      {galat && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-danger">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          {galat}
        </p>
      )}

      <input
        ref={berkasRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void terima(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={kameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void terima(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {src && (
        <FotoLightbox
          open={lihat}
          src={src}
          judul={judul || "Foto barang"}
          subjudul={value.jenis === "baru" ? "Pratinjau — belum disimpan" : undefined}
          unduhUrl={value.jenis === "tersimpan" ? value.unduhUrl : undefined}
          onClose={() => setLihat(false)}
        />
      )}
    </div>
  );
}

/** Keterangan batas (ditampilkan di bawah bingkai oleh induk bila perlu). */
export const PETUNJUK_FOTO = `JPG, PNG, atau WebP (maks ${FOTO_BARANG.masukanMaks / 1024 / 1024} MB). Otomatis diperkecil ke ${FOTO_BARANG.sisiMaks} px & data lokasi (EXIF) dibuang.`;

function AksiFoto({
  label,
  onClick,
  children,
  disabled,
  bahaya,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  bahaya?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full bg-surface/90 text-fg shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:pointer-events-none disabled:opacity-50",
        bahaya ? "hover:bg-danger hover:text-white" : "hover:bg-surface hover:text-brand",
      )}
    >
      {children}
    </button>
  );
}

function LapisSeret() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-brand-soft/85 text-brand backdrop-blur-[2px]">
      <ImagePlus className="size-7" />
      <p className="text-sm font-semibold">Lepaskan untuk memakai foto ini</p>
    </div>
  );
}

function LapisProses({ teks }: { teks: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface/75 text-fg backdrop-blur-sm" aria-live="polite">
      <Loader2 className="size-6 animate-spin text-brand" />
      <p className="text-xs font-medium">{teks}</p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 rounded border border-border bg-surface px-1 py-px font-sans text-[10px] font-medium text-fg-muted shadow-[0_1px_0_var(--border)]">
      {children}
    </kbd>
  );
}
