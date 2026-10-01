"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  Eye,
  FileStack,
  FileText,
  GripVertical,
  ImageIcon,
  Info,
  Lock,
  LockOpen,
  Paperclip,
  Printer,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiDelete, apiGet, apiPost, apiUpload, pesanGalat } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDateTime, formatUkuran } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import {
  kunciItem,
  pindah,
  samaSusunan,
  selaraskan,
  susunanAktif,
  susunanAwal,
  type BarisSusunan,
} from "@/server/modules/verifikasi-klaim/paket.susunan";
import { BATAS, type AksiPaket } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import type { ItemManifest, KomponenPaket, LampiranItem, PaketKlaim } from "@/server/modules/verifikasi-klaim/verifikasi.types";

export type KirimPaket = (body: { aksi: AksiPaket; versi: number; paketVersi?: number; catatan?: string }) => Promise<boolean>;

const TERIMA = "application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg";

/**
 * Tab Paket Klaim (Tahap final, PRD §6.3-3): susunan komponen report SIMRS +
 * sisipan (seret / naik-turun, aktif-nonaktif, pratinjau per dokumen) → unggah
 * sisipan → Gabungkan → pratinjau PDF gabungan → Cetak / Unduh → Kunci FINAL.
 * Saat FINAL susunan terkunci; coder dapat membuka kunci dengan alasan.
 * Di-remount (key) setiap versi berkas berubah → data paket dimuat ulang.
 */
export function PanelPaket({
  nopen,
  kirim,
  mengirim,
  onBerubah,
}: {
  nopen: string;
  kirim: KirimPaket;
  mengirim: boolean;
  /** Antrean dimuat ulang (ringkasan paket berubah). */
  onBerubah: () => void;
}) {
  const toast = useToast();
  const { result, loading, error, reload } = useAsyncData<PaketKlaim>(() => apiGet<PaketKlaim>(`/api/berkas-klaim/paket/${nopen}`), [nopen]);
  const [terbaru, setTerbaru] = useState<PaketKlaim | null>(null);
  const data = terbaru ?? result;
  /** Susunan hasil edit pengguna (null = ikuti susunan dari server). */
  const [edit, setEdit] = useState<BarisSusunan[] | null>(null);
  const [sibuk, setSibuk] = useState<null | "gabung" | "unggah" | "hapus">(null);
  const [detik, setDetik] = useState(0);
  const [lihat, setLihat] = useState(false);
  const [keterangan, setKeterangan] = useState("");
  const [hapus, setHapus] = useState<LampiranItem | null>(null);
  const [konfirmKunci, setKonfirmKunci] = useState(false);
  const [buka, setBuka] = useState(false);
  const [seret, setSeret] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [jatuhBerkas, setJatuhBerkas] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sibuk !== "gabung") return;
    const id = setInterval(() => setDetik((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [sibuk]);

  const awal = useMemo(() => (data ? susunanAwal(data.komponen, data.lampiran, data.paket) : []), [data]);
  const baris = useMemo(() => (edit ? selaraskan(edit, awal) : awal), [edit, awal]);
  const aktif = useMemo(() => susunanAktif(baris), [baris]);
  const komponen = useMemo(() => new Map((data?.komponen ?? []).map((k) => [k.key, k])), [data]);
  const lampiran = useMemo(() => new Map((data?.lampiran ?? []).map((l) => [l.id, l])), [data]);

  if (error && !data) return <ErrorState onRetry={reload} />;
  if (!data || (loading && !terbaru && !result)) return <MemuatPaket />;

  const final = data.statusBerkas === "FINAL";
  const paket = data.paket;
  const berubah = !final && (!paket || !samaSusunan(aktif, paket.manifest.items));
  const rentang = new Map((paket?.manifest.items ?? []).map((i) => [kunciItem(i), i]));
  const tidakTersedia = data.komponen.filter((k) => !k.tersedia);
  const bisaSusun = data.izin.susun && !mengirim && sibuk === null;
  const sisaSlot = data.batas.lampiranMaks - data.lampiran.length;

  const ubah = (f: (b: BarisSusunan[]) => BarisSusunan[]) => setEdit(f(baris));

  /* ---------------------------------------------------------- aksi server */

  function bentrok(e: unknown): boolean {
    if (e instanceof ApiError && e.status === 409 && e.code === "CONFLICT") {
      toast.warning("Paket sudah diubah pengguna lain", "Data terbaru dimuat ulang — periksa kembali.");
      setTerbaru(null);
      setEdit(null);
      reload();
      return true;
    }
    return false;
  }

  async function unggah(files: File[]) {
    if (!data || !data.izin.susun || files.length === 0) return;
    if (sisaSlot <= 0) return void toast.warning("Sisipan penuh", `Maksimal ${data.batas.lampiranMaks} sisipan per berkas.`);
    if (files.length > sisaSlot) toast.warning("Sebagian berkas dilewati", `Hanya ${sisaSlot} sisipan lagi yang bisa diunggah.`);
    setSibuk("unggah");
    let berhasil = 0;
    try {
      for (const f of files.slice(0, sisaSlot)) {
        if (f.size > data.batas.ukuranMaks) {
          toast.error(`${f.name} tidak diunggah`, `Ukuran melebihi ${formatUkuran(data.batas.ukuranMaks)}.`);
          continue;
        }
        const fd = new FormData();
        fd.append("berkas", f);
        if (keterangan.trim()) fd.append("keterangan", keterangan.trim());
        try {
          setTerbaru(await apiUpload<PaketKlaim>(`/api/berkas-klaim/paket/${nopen}/lampiran`, fd));
          berhasil++;
        } catch (e) {
          if (bentrok(e)) return;
          toast.error(`${f.name} tidak diunggah`, pesanGalat(e));
        }
      }
      if (berhasil > 0) {
        setKeterangan("");
        toast.success(`${berhasil} sisipan diunggah`, "Atur posisinya di susunan, lalu gabungkan paket.");
      }
    } finally {
      setSibuk(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function hapusSisipan(l: LampiranItem) {
    setSibuk("hapus");
    try {
      setTerbaru(await apiDelete<PaketKlaim>(`/api/berkas-klaim/paket/${nopen}/lampiran/${l.id}`));
      setHapus(null);
      toast.success("Sisipan dihapus", l.nama);
    } catch (e) {
      if (!bentrok(e)) toast.error("Sisipan gagal dihapus", pesanGalat(e));
    } finally {
      setSibuk(null);
    }
  }

  async function gabung(segar: boolean) {
    if (!data || aktif.length === 0) return;
    setDetik(0);
    setSibuk("gabung");
    try {
      const r = await apiPost<PaketKlaim>(`/api/berkas-klaim/paket/${nopen}/gabung`, { versi: data.versiBerkas, susunan: aktif, segar });
      const sama = !!paket && r.paket?.versi === paket.versi;
      setTerbaru(r);
      setEdit(null);
      setLihat(true);
      toast.success(
        sama ? "Paket tidak berubah" : `Paket v${r.paket?.versi} digabung`,
        `${r.paket?.halaman ?? 0} halaman · periksa pratinjau sebelum mengunci FINAL.`,
      );
      onBerubah();
    } catch (e) {
      if (!bentrok(e)) toast.error("Penggabungan gagal", pesanGalat(e));
    } finally {
      setSibuk(null);
    }
  }

  async function kunci() {
    if (!data?.paket) return;
    if (await kirim({ aksi: "KUNCI_FINAL", versi: data.versiBerkas, paketVersi: data.paket.versi })) setKonfirmKunci(false);
  }

  /* ------------------------------------------------------- seret & lepas */

  const lepasBaris = () => {
    if (seret !== null && target !== null && seret !== target) ubah((b) => pindah(b, seret, target));
    setSeret(null);
    setTarget(null);
  };

  const infoBaris = (b: BarisSusunan | ItemManifest): InfoBaris => {
    if (b.tipe === "komponen") {
      const k: KomponenPaket | undefined = komponen.get(b.key);
      const m = "label" in b ? b : null;
      return { label: k?.label ?? m?.label ?? b.key, keterangan: k?.keterangan ?? m?.keterangan ?? null, jenis: "komponen", meta: "SIMRS", pratinjau: `/print/paket/${nopen}?k=${encodeURIComponent(b.key)}` };
    }
    const l = lampiran.get(b.id);
    const m = "label" in b ? b : null;
    return {
      label: l?.nama ?? m?.label ?? "Sisipan",
      keterangan: l?.keterangan ?? m?.keterangan ?? null,
      jenis: l?.mime.startsWith("image/") ? "gambar" : "pdf",
      meta: l ? `${l.mime === "application/pdf" ? `PDF · ${l.halaman} hal` : "Gambar · 1 hal"} · ${formatUkuran(l.ukuran)}` : "Sisipan",
      pratinjau: l ? `/print/paket/${nopen}?l=${l.id}` : null,
      lampiran: l,
    };
  };

  const daftar = final && paket ? paket.manifest.items : baris;

  return (
    // flex-1: isi kolom drawer setinggi layar → bilah aksi menempel di bawah walau isi pendek.
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-5 px-5 py-4">
        <StatusPaket data={data} berubah={berubah} />

        {/* Susunan */}
        <section aria-labelledby="pk-susunan">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="pk-susunan" className="text-sm font-semibold text-fg">
              {final ? "Isi paket terkunci" : "Susunan paket"}
            </h3>
            <p className="text-xs text-fg-muted">
              {final
                ? `${paket?.manifest.items.length ?? 0} dokumen · ${paket?.halaman ?? 0} halaman`
                : `${aktif.length} dari ${baris.length} dokumen diikutkan${data.izin.susun ? " · seret atau pakai panah untuk mengatur urutan" : ""}`}
            </p>
          </div>
          {daftar.length === 0 ? (
            <p className="rounded-[var(--radius-lg)] border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted">
              Belum ada dokumen SIMRS yang tersedia untuk berkas ini. Unggah sisipan untuk menyusun paket.
            </p>
          ) : (
            <ol className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface" aria-label="Urutan dokumen paket">
              {daftar.map((b, i) => {
                const info = infoBaris(b);
                const r = rentang.get(kunciItem(b));
                const aktifB = "aktif" in b ? b.aktif : true;
                return (
                  <BarisDokumen
                    key={kunciItem(b)}
                    no={i + 1}
                    info={info}
                    aktif={aktifB}
                    rentang={!berubah && r ? r : null}
                    bisaEdit={bisaSusun && !final}
                    pertama={i === 0}
                    terakhir={i === daftar.length - 1}
                    target={target === i && seret !== null && seret !== i}
                    sedangDiseret={seret === i}
                    onToggle={() => ubah((xs) => xs.map((x, j) => (j === i ? { ...x, aktif: !x.aktif } : x)))}
                    onNaik={() => ubah((xs) => pindah(xs, i, i - 1))}
                    onTurun={() => ubah((xs) => pindah(xs, i, i + 1))}
                    onHapus={info.lampiran && data.izin.susun && !final ? () => setHapus(info.lampiran!) : undefined}
                    seret={{
                      onDragStart: (e) => {
                        setSeret(i);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(i));
                      },
                      onDragOver: (e) => {
                        if (seret === null) return;
                        e.preventDefault();
                        if (target !== i) setTarget(i);
                      },
                      onDrop: (e) => {
                        if (seret === null) return;
                        e.preventDefault();
                        lepasBaris();
                      },
                      onDragEnd: () => {
                        setSeret(null);
                        setTarget(null);
                      },
                    }}
                  />
                );
              })}
            </ol>
          )}
          {!final && tidakTersedia.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-fg-muted" aria-label="Dokumen SIMRS yang tidak tersedia">
              {tidakTersedia.map((k) => (
                <li key={k.key} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
                  <span>
                    <span className="font-medium text-fg">{k.label}</span> tidak ikut — {k.alasan}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Unggah sisipan */}
        {data.izin.susun && !final && (
          <section aria-labelledby="pk-sisipan">
            <h3 id="pk-sisipan" className="mb-2 text-sm font-semibold text-fg">
              Sisipkan dokumen tambahan
            </h3>
            <div
              onDragOver={(e) => {
                if (seret !== null || !e.dataTransfer.types.includes("Files")) return;
                e.preventDefault();
                setJatuhBerkas(true);
              }}
              onDragLeave={() => setJatuhBerkas(false)}
              onDrop={(e) => {
                if (seret !== null || e.dataTransfer.files.length === 0) return;
                e.preventDefault();
                setJatuhBerkas(false);
                void unggah([...e.dataTransfer.files]);
              }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed px-4 py-5 text-center transition-colors",
                jatuhBerkas ? "border-brand bg-brand-soft/40" : "border-border bg-surface-2/40",
              )}
            >
              <Upload className="size-5 text-fg-subtle" aria-hidden />
              <p className="text-sm text-fg">
                Seret berkas PDF / JPG / PNG ke sini, atau{" "}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={!bisaSusun || sisaSlot <= 0}
                  className="font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-50"
                >
                  pilih berkas
                </button>
              </p>
              <p className="text-[11px] text-fg-subtle">
                Maks {formatUkuran(data.batas.ukuranMaks)} per berkas · {data.lampiran.length}/{data.batas.lampiranMaks} sisipan · PDF berkata sandi tidak didukung ·
                foto HP diputar otomatis
              </p>
              <input
                ref={fileRef}
                type="file"
                accept={TERIMA}
                multiple
                className="sr-only"
                aria-label="Pilih berkas sisipan"
                onChange={(e) => void unggah([...(e.target.files ?? [])])}
              />
              <label className="mt-1 flex w-full max-w-md items-center gap-2 text-xs text-fg-muted">
                <span className="shrink-0">Keterangan</span>
                <input
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  maxLength={255}
                  placeholder="Opsional, mis. Hasil lab rujukan luar"
                  className="h-8 min-w-0 flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40"
                />
              </label>
              {sibuk === "unggah" && <p className="text-xs text-brand">Mengunggah…</p>}
            </div>
          </section>
        )}

        {/* Pratinjau PDF gabungan */}
        {paket && (
          <section aria-labelledby="pk-pratinjau">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 id="pk-pratinjau" className="text-sm font-semibold text-fg">
                Pratinjau PDF gabungan
              </h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" icon={<Eye className="size-4" aria-hidden />} onClick={() => setLihat((v) => !v)} aria-expanded={lihat}>
                  {lihat ? "Sembunyikan" : "Tampilkan"}
                </Button>
                <a
                  href={`/print/paket/${nopen}`}
                  target="_blank"
                  rel="noopener"
                  className="rounded-[var(--radius-md)] px-2 py-1 text-[13px] font-medium text-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                >
                  Buka di tab baru
                </a>
              </div>
            </div>
            {lihat && (
              <iframe
                key={`${paket.versi}-${paket.hash}`}
                src={`/api/berkas-klaim/paket/${nopen}/pdf?mode=lihat&v=${paket.versi}-${paket.hash.slice(0, 12)}`}
                title={`Pratinjau paket klaim v${paket.versi}`}
                className="h-[70vh] w-full rounded-[var(--radius-lg)] border border-border bg-[#3f4245]"
              />
            )}
          </section>
        )}
      </div>

      {/* Aksi */}
      {(data.izin.susun || (paket && data.izin.cetak) || data.izin.bukaKunci) && (
        <div className="sticky bottom-0 space-y-2 border-t border-border bg-surface px-5 py-4 shadow-[0_-4px_12px_-8px_rgb(0_0_0/0.15)]">
          {sibuk === "gabung" && (
            <p className="text-xs text-brand" role="status">
              Mengambil {aktif.filter((i) => i.tipe === "komponen").length} dokumen dari SIMRS & menggabung… {detik} dtk
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {data.izin.bukaKunci && (
              <Button variant="ghost" icon={<LockOpen className="size-4" aria-hidden />} onClick={() => setBuka(true)} disabled={mengirim} className="mr-auto">
                Buka kunci
              </Button>
            )}
            {paket && data.izin.cetak && (
              <>
                <a
                  href={`/print/paket/${nopen}?mode=cetak`}
                  target="_blank"
                  rel="noopener"
                  className={cn(TAUTAN_TOMBOL, berubah && "opacity-60")}
                  title={berubah ? "Mencetak paket terakhir yang digabung (susunan di layar belum digabung)" : undefined}
                >
                  <Printer className="size-4" aria-hidden />
                  Cetak
                </a>
                <a href={`/api/berkas-klaim/paket/${nopen}/pdf?mode=unduh`} className={cn(TAUTAN_TOMBOL, berubah && "opacity-60")}>
                  <Download className="size-4" aria-hidden />
                  Unduh
                </a>
              </>
            )}
            {data.izin.susun && (
              <Button
                variant={berubah ? "primary" : "secondary"}
                icon={berubah ? <FileStack className="size-4" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
                onClick={() => gabung(!berubah)}
                loading={sibuk === "gabung"}
                disabled={!bisaSusun || aktif.length === 0}
                title={berubah ? undefined : "Susunan sama — ambil ulang dokumen terbaru dari SIMRS"}
              >
                {berubah ? (
                  `Gabungkan (${aktif.length})`
                ) : (
                  <>
                    <span className="sm:hidden">Gabung ulang</span>
                    <span className="hidden sm:inline">Gabung ulang dari SIMRS</span>
                  </>
                )}
              </Button>
            )}
            {data.izin.susun && paket && (
              <Button
                variant={berubah ? "secondary" : "primary"}
                icon={<Lock className="size-4" aria-hidden />}
                onClick={() => setKonfirmKunci(true)}
                disabled={!data.izin.kunci || berubah || mengirim || sibuk !== null}
                title={berubah ? "Gabungkan dulu susunan terbaru" : undefined}
              >
                Kunci FINAL
              </Button>
            )}
          </div>
          {berubah && paket && data.izin.susun && (
            <p className="text-right text-[11px] text-fg-subtle">Susunan di layar belum digabung — gabungkan sebelum mengunci FINAL.</p>
          )}
        </div>
      )}

      <Modal
        open={!!hapus}
        onClose={() => setHapus(null)}
        title="Hapus sisipan?"
        description={hapus?.nama}
        icon={<Trash2 className="mt-0.5 size-5 text-danger" aria-hidden />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setHapus(null)} disabled={sibuk === "hapus"}>
              Batal
            </Button>
            <Button variant="danger" loading={sibuk === "hapus"} onClick={() => hapus && hapusSisipan(hapus)}>
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">
          Sisipan dikeluarkan dari daftar & susunan. Paket yang sudah digabung tetap memuatnya sampai digabung ulang. Jejaknya tercatat di riwayat.
        </p>
      </Modal>

      <Modal
        open={konfirmKunci}
        onClose={() => setKonfirmKunci(false)}
        title={`Kunci paket v${paket?.versi ?? ""} sebagai FINAL?`}
        description={paket ? `${paket.halaman} halaman · ${formatUkuran(paket.ukuran)} · SHA-256 ${paket.hash.slice(0, 16)}…` : undefined}
        icon={<Lock className="mt-0.5 size-5 text-brand" aria-hidden />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setKonfirmKunci(false)} disabled={mengirim}>
              Batal
            </Button>
            <Button loading={mengirim} icon={<Lock className="size-4" aria-hidden />} onClick={kunci}>
              Kunci FINAL
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">
          PDF yang Anda pratinjau menjadi paket final berkas ini. Setelah dikunci, sisipan & susunan tidak bisa diubah; membuka kunci hanya oleh
          coder dengan alasan tertulis.
        </p>
      </Modal>

      <BukaKunciModal open={buka} onClose={() => setBuka(false)} mengirim={mengirim} kirim={(catatan) => kirim({ aksi: "BUKA_KUNCI", versi: data.versiBerkas, catatan })} />
    </div>
  );
}

const TAUTAN_TOMBOL =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/* -------------------------------------------------------------- bagian */

function StatusPaket({ data, berubah }: { data: PaketKlaim; berubah: boolean }) {
  const p = data.paket;
  if (data.statusBerkas === "FINAL" && p) {
    return (
      <Banner tone="success" icon={<CheckCircle2 className="size-4 text-success" aria-hidden />} judul={`Paket FINAL terkunci — versi ${p.versi}`}>
        {p.halaman} halaman · {formatUkuran(p.ukuran)} · digabung {p.dibuatOlehNama ?? "—"} {formatDateTime(p.digabungPada)}
        <span className="mt-0.5 block font-mono text-[11px] text-fg-subtle" title={p.hash}>
          SHA-256 {p.hash}
        </span>
      </Banner>
    );
  }
  if (data.statusBerkas !== "LOLOS_KLAIM") {
    return (
      <Banner tone="neutral" icon={<Info className="size-4 text-fg-subtle" aria-hidden />} judul="Paket disusun setelah klaim diloloskan coder">
        Berkas ini belum berstatus Siap Final.
      </Banner>
    );
  }
  if (!p) {
    return (
      <Banner tone="neutral" icon={<FileStack className="size-4 text-fg-subtle" aria-hidden />} judul="Paket belum digabung">
        Atur urutan dokumen, sisipkan dokumen tambahan bila perlu, lalu Gabungkan. Dokumen diambil langsung dari report SIMRS.
        {!data.izin.susun && " Menyusun paket membutuhkan izin Paket Klaim (buat)."}
      </Banner>
    );
  }
  return berubah ? (
    <Banner tone="warning" icon={<AlertTriangle className="size-4 text-warning" aria-hidden />} judul={`Susunan berubah sejak paket v${p.versi} digabung`}>
      Gabungkan ulang agar PDF sesuai susunan di layar sebelum mengunci FINAL.
    </Banner>
  ) : (
    <Banner tone="accent" icon={<FileStack className="size-4 text-accent" aria-hidden />} judul={`Draf paket v${p.versi} siap diperiksa`}>
      {p.halaman} halaman · {formatUkuran(p.ukuran)} · digabung {p.dibuatOlehNama ?? "—"} {formatDateTime(p.digabungPada)}
      {p.manifest.durasiMs > 0 && ` (${(p.manifest.durasiMs / 1000).toFixed(1).replace(".", ",")} dtk)`}
    </Banner>
  );
}

const TONE_BANNER = {
  success: "border-success/30 bg-success-soft/60",
  warning: "border-warning/30 bg-warning-soft/60",
  accent: "border-accent/30 bg-accent-soft/50",
  neutral: "border-border bg-surface-2/60",
} as const;

function Banner({ tone, icon, judul, children }: { tone: keyof typeof TONE_BANNER; icon: React.ReactNode; judul: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-[var(--radius-lg)] border px-4 py-3", TONE_BANNER[tone])}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-fg">{judul}</h3>
      </div>
      <div className="mt-0.5 text-xs text-fg-muted">{children}</div>
    </section>
  );
}

type InfoBaris = {
  label: string;
  keterangan: string | null;
  jenis: "komponen" | "pdf" | "gambar";
  meta: string;
  pratinjau: string | null;
  lampiran?: LampiranItem;
};

function BarisDokumen({
  no,
  info,
  aktif,
  rentang,
  bisaEdit,
  pertama,
  terakhir,
  target,
  sedangDiseret,
  onToggle,
  onNaik,
  onTurun,
  onHapus,
  seret,
}: {
  no: number;
  info: InfoBaris;
  aktif: boolean;
  rentang: ItemManifest | null;
  bisaEdit: boolean;
  pertama: boolean;
  terakhir: boolean;
  target: boolean;
  sedangDiseret: boolean;
  onToggle: () => void;
  onNaik: () => void;
  onTurun: () => void;
  onHapus?: () => void;
  seret: Pick<React.LiHTMLAttributes<HTMLLIElement>, "onDragStart" | "onDragOver" | "onDrop" | "onDragEnd">;
}) {
  const Ikon = info.jenis === "komponen" ? FileText : info.jenis === "gambar" ? ImageIcon : Paperclip;
  return (
    <li
      draggable={bisaEdit}
      {...(bisaEdit ? seret : {})}
      className={cn(
        "flex items-center gap-2 border-b border-border px-3 py-2.5 last:border-b-0 sm:gap-3",
        !aktif && "bg-surface-2/50",
        target && "shadow-[inset_0_2px_0_var(--brand)]",
        sedangDiseret && "opacity-50",
      )}
    >
      {bisaEdit && <GripVertical className="hidden size-4 shrink-0 cursor-grab text-fg-subtle sm:block" aria-hidden />}
      <span className={cn("w-5 shrink-0 text-right text-xs tabular", aktif ? "text-fg-muted" : "text-fg-subtle")}>{no}</span>
      {bisaEdit && (
        <input
          type="checkbox"
          checked={aktif}
          onChange={onToggle}
          aria-label={`${aktif ? "Keluarkan" : "Ikutkan"} ${info.label}`}
          className="size-4 shrink-0 accent-[var(--brand)]"
        />
      )}
      <Ikon className={cn("size-4 shrink-0", info.jenis === "komponen" ? "text-brand" : "text-accent")} aria-hidden />
      <div className={cn("min-w-0 flex-1", !aktif && "opacity-60")}>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-medium text-fg">{info.label}</span>
          {info.jenis !== "komponen" && <Badge tone="accent" className="px-1.5 py-0 text-[10px]">Sisipan</Badge>}
          {!aktif && <span className="text-[11px] text-fg-subtle">tidak diikutkan</span>}
        </p>
        <p className="truncate text-[11px] text-fg-subtle" title={info.keterangan ?? undefined}>
          {[info.meta, info.keterangan, rentang ? `hal. ${rentang.awal}${rentang.halaman > 1 ? `–${rentang.awal + rentang.halaman - 1}` : ""}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        {info.pratinjau && (
          <a
            href={info.pratinjau}
            target="_blank"
            rel="noopener"
            aria-label={`Pratinjau ${info.label}`}
            title="Pratinjau"
            className={IKON}
          >
            <Eye className="size-4" aria-hidden />
          </a>
        )}
        {bisaEdit && (
          <>
            <button type="button" onClick={onNaik} disabled={pertama} aria-label={`Naikkan ${info.label}`} title="Naikkan" className={IKON}>
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={onTurun} disabled={terakhir} aria-label={`Turunkan ${info.label}`} title="Turunkan" className={IKON}>
              <ArrowDown className="size-4" aria-hidden />
            </button>
          </>
        )}
        {onHapus && (
          <button type="button" onClick={onHapus} aria-label={`Hapus sisipan ${info.label}`} title="Hapus sisipan" className={cn(IKON, "hover:text-danger")}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}

const IKON =
  "rounded-full p-1.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:pointer-events-none disabled:opacity-30";

function BukaKunciModal({
  open,
  onClose,
  mengirim,
  kirim,
}: {
  open: boolean;
  onClose: () => void;
  mengirim: boolean;
  kirim: (catatan: string) => Promise<boolean>;
}) {
  const [alasan, setAlasan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  async function kirimAlasan() {
    if (alasan.trim().length < BATAS.ALASAN_MIN) return setGalat(`Tulis alasan membuka kunci, min. ${BATAS.ALASAN_MIN} karakter.`);
    setGalat(null);
    if (await kirim(alasan.trim())) onClose();
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buka kunci paket FINAL?"
      description="Berkas kembali ke Siap Final; paket dapat disusun & digabung ulang."
      icon={<LockOpen className="mt-0.5 size-5 text-warning" aria-hidden />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mengirim}>
            Batal
          </Button>
          <Button loading={mengirim} icon={<LockOpen className="size-4" aria-hidden />} onClick={kirimAlasan}>
            Buka kunci
          </Button>
        </>
      }
    >
      <label htmlFor="pk-alasan" className="mb-1.5 block text-xs font-medium text-fg-muted">
        Alasan (wajib, tercatat di riwayat & dikirim ke pengunci)
      </label>
      <textarea
        id="pk-alasan"
        rows={3}
        maxLength={BATAS.CATATAN_MAKS}
        value={alasan}
        onChange={(e) => setAlasan(e.target.value)}
        placeholder="mis. Hasil lab susulan perlu disisipkan"
        className="w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40"
      />
      {galat && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {galat}
        </p>
      )}
    </Modal>
  );
}

function MemuatPaket() {
  return (
    <div className="space-y-2 px-5 py-4" aria-busy="true" aria-label="Memuat paket klaim">
      <p className="text-xs text-fg-subtle">Memeriksa dokumen yang tersedia di SIMRS…</p>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-md)]" />
      ))}
    </div>
  );
}
