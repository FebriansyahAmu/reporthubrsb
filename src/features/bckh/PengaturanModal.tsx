"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { History, RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { apiGet, apiPut, pesanGalat } from "@/lib/api-client";
import { PENGATURAN_BAWAAN, type PengaturanLaporan } from "@/server/modules/bckh/bckh.constants";
import { PemilihAkun, usePenyetuju } from "./PemilihAkun";

type PengaturanDto = PengaturanLaporan & { mengetahuiId: string | null; tersimpan: boolean; diubahOleh: string | null; diubahAt: string | null };
type Isian = PengaturanLaporan & { mengetahuiId: string | null };
type Kunci = keyof PengaturanLaporan;

const BIDANG: Record<Kunci, { label: string; maks: number }> = {
  kop1: { label: "Kop baris 1", maks: 120 },
  kop2: { label: "Kop baris 2", maks: 120 },
  instansi1: { label: "Kotak instansi baris 1", maks: 120 },
  instansi2: { label: "Kotak instansi baris 2", maks: 120 },
  mengetahuiJabatan: { label: "Jabatan", maks: 191 },
  mengetahuiNama: { label: "Nama", maks: 191 },
  mengetahuiNip: { label: "NIP", maks: 40 },
};
const KOP: Kunci[] = ["kop1", "kop2", "instansi1", "instansi2"];
const MENGETAHUI: Kunci[] = ["mengetahuiJabatan", "mengetahuiNama", "mengetahuiNip"];

/**
 * Pengaturan laporan GLOBAL — kop sampul & penandatangan "Mengetahui" (akun direktur
 * tujuan tahap kedua persetujuan). Pratinjau sampul & blok TTD berubah langsung saat
 * mengetik; bidang yang berubah ditandai; tiap bidang bisa dikembalikan ke bawaan.
 * `bckh.pengaturan:update`, diaudit.
 */
export function PengaturanModal({ open, onClose, onTersimpan }: { open: boolean; onClose: () => void; onTersimpan: () => void }) {
  const toast = useToast();
  const [awal, setAwal] = useState<PengaturanDto | null>(null);
  const [isi, setIsi] = useState<Isian | null>(null);
  const [simpan, setSimpan] = useState(false);
  const akun = usePenyetuju(open);

  useEffect(() => {
    if (!open) return;
    let batal = false;
    apiGet<PengaturanDto>("/api/bckh/pengaturan")
      .then((d) => {
        if (batal) return;
        setAwal(d);
        setIsi({ ...pilihTeks(d), mengetahuiId: d.mengetahuiId });
      })
      .catch((e) => !batal && toast.error("Gagal memuat pengaturan", pesanGalat(e)));
    return () => {
      batal = true;
    };
  }, [open, toast]);

  const berubah = useMemo(() => {
    if (!awal || !isi) return [] as string[];
    const k = (Object.keys(BIDANG) as Kunci[]).filter((x) => awal[x] !== isi[x]) as string[];
    if (awal.mengetahuiId !== isi.mengetahuiId) k.push("mengetahuiId");
    return k;
  }, [awal, isi]);

  const kirim = async () => {
    if (!isi) return;
    setSimpan(true);
    try {
      await apiPut("/api/bckh/pengaturan", isi);
      toast.success("Pengaturan laporan disimpan", "Berlaku untuk laporan semua pegawai.");
      onTersimpan();
    } catch (e) {
      toast.error("Pengaturan tidak tersimpan", pesanGalat(e));
    } finally {
      setSimpan(false);
    }
  };

  const ubah = (k: Kunci, v: string) => setIsi((s) => s && { ...s, [k]: v });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Pengaturan laporan"
      description={`Kop sampul & penandatangan "Mengetahui" — berlaku untuk laporan semua pegawai.`}
      footer={
        <>
          <p className="mr-auto hidden min-w-0 truncate text-xs text-fg-subtle sm:block" aria-live="polite">
            {berubah.length ? `${berubah.length} perubahan belum disimpan` : awal?.tersimpan && awal.diubahAt ? (
              <span className="inline-flex items-center gap-1.5">
                <History className="size-3.5" aria-hidden />
                Terakhir diubah {awal.diubahOleh ?? "-"} · {new Date(awal.diubahAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            ) : (
              "Masih memakai nilai bawaan dokumen contoh."
            )}
          </p>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" loading={simpan} disabled={!isi || (awal?.tersimpan && berubah.length === 0)} onClick={() => void kirim()}>
            Simpan pengaturan
          </Button>
        </>
      }
    >
      {!isi || !awal ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="h-80 animate-pulse rounded-[var(--radius-md)] bg-surface-2" />
          <div className="hidden h-80 animate-pulse rounded-[var(--radius-md)] bg-surface-2 lg:block" />
        </div>
      ) : (
        <form
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]"
          onSubmit={(e) => {
            e.preventDefault();
            void kirim();
          }}
        >
          <div className="min-w-0 space-y-6">
            <Bagian judul="Kop sampul" keterangan="Dua baris di bawah logo, lalu kotak abu-abu nama instansi.">
              <div className="grid gap-3 sm:grid-cols-2">
                {KOP.map((k) => (
                  <BidangTeks key={k} k={k} nilai={isi[k]} awal={awal[k]} onUbah={ubah} />
                ))}
              </div>
            </Bagian>

            <Bagian judul={`Penandatangan "Mengetahui"`} keterangan="Tahap kedua persetujuan: laporan yang diajukan sampai Mengetahui masuk ke akun ini setelah atasan menandatangani.">
              <PemilihAkun
                label="Akun direktur"
                akun={akun}
                nilai={isi.mengetahuiId}
                kosong="Belum dipilih — pegawai hanya bisa mengajukan sampai atasan"
                onPilih={(a) =>
                  setIsi((s) =>
                    s && {
                      ...s,
                      mengetahuiId: a?.id ?? null,
                      ...(a ? { mengetahuiNama: a.namaTtd, mengetahuiNip: a.nip, ...(a.jabatan ? { mengetahuiJabatan: a.jabatan.toUpperCase() } : {}) } : {}),
                    },
                  )
                }
                bantuan="Memilih akun mengisi nama, NIP & jabatan di bawah (tetap bisa disesuaikan untuk cetak)."
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {MENGETAHUI.map((k) => (
                  <BidangTeks key={k} k={k} nilai={isi[k]} awal={awal[k]} onUbah={ubah} lebar={k === "mengetahuiJabatan"} />
                ))}
              </div>
            </Bagian>
          </div>

          <Pratinjau isi={isi} />
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
}

const pilihTeks = (d: PengaturanLaporan): PengaturanLaporan => Object.fromEntries((Object.keys(BIDANG) as Kunci[]).map((k) => [k, d[k]])) as PengaturanLaporan;

function Bagian({ judul, keterangan, children }: { judul: string; keterangan: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-fg">{judul}</h3>
      <p className="mb-3 mt-0.5 text-xs text-fg-muted">{keterangan}</p>
      {children}
    </section>
  );
}

/** Bidang dengan penanda "diubah" (belum disimpan), penghitung karakter & kembalikan bawaan. */
function BidangTeks({ k, nilai, awal, onUbah, lebar }: { k: Kunci; nilai: string; awal: string; onUbah: (k: Kunci, v: string) => void; lebar?: boolean }) {
  const { label, maks } = BIDANG[k];
  const diubah = nilai !== awal;
  const bawaan = PENGATURAN_BAWAAN[k];
  return (
    <div className={cn("min-w-0", lebar && "sm:col-span-2")}>
      <div className="mb-1.5 flex items-center gap-2">
        <label htmlFor={`atur-${k}`} className="text-xs font-medium text-fg-muted">
          {label}
        </label>
        {diubah && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden />
            diubah
          </span>
        )}
        {nilai !== bawaan && (
          <button
            type="button"
            onClick={() => onUbah(k, bawaan)}
            title={`Kembalikan ke bawaan: ${bawaan}`}
            aria-label={`Kembalikan ${label} ke bawaan`}
            className="ml-auto inline-flex items-center gap-1 rounded px-1 text-[11px] text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <RotateCcw className="size-3" aria-hidden />
            bawaan
          </button>
        )}
      </div>
      <div className="relative">
        <Input id={`atur-${k}`} value={nilai} maxLength={maks} onChange={(e) => onUbah(k, e.target.value)} className={cn("pr-12", diubah && "border-brand/50")} />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] tabular text-fg-subtle">
          {nilai.length}/{maks}
        </span>
      </div>
    </div>
  );
}

/** Pratinjau langsung: sampul (bingkai, logo, kop, kotak instansi & judul) dan blok "Mengetahui". */
function Pratinjau({ isi }: { isi: Isian }) {
  return (
    <aside className="order-first lg:order-none" aria-label="Pratinjau">
      <div className="lg:sticky lg:top-0">
        <p className="mb-2 text-xs font-medium text-fg-muted">Pratinjau</p>
        <div className="rounded-[var(--radius-md)] border border-border bg-[#e9eef2] p-3">
          <div className="mx-auto grid max-w-[15rem] grid-cols-1 gap-3 lg:max-w-none">
            <div className="aspect-[612/792] rounded-[2px] bg-white p-[6%] shadow-sm">
              <div className="flex h-full flex-col items-center rounded-[14%/10%] border border-black/80 px-[3%] pt-[5%] text-center font-[Arial,Helvetica,sans-serif] text-black">
                <Image src="/logo/logoboltim.png" alt="" width={40} height={46} className="h-[9%] w-auto" />
                <p className="mt-[5%] w-full truncate text-[9px] font-bold leading-tight">{isi.kop1 || "—"}</p>
                <p className="w-full truncate text-[9px] font-bold leading-tight">{isi.kop2 || "—"}</p>
                <div className="mt-[10%] w-[106%] border-[2px] border-[#F1F1F1] bg-[#A4A4A4] px-1 py-[5%] shadow-[2px_2px_0_#A6A6A6]">
                  <p className="truncate text-[9px] font-bold leading-tight text-white">{isi.instansi1 || "—"}</p>
                  <p className="truncate text-[9px] font-bold leading-tight text-white">{isi.instansi2 || "—"}</p>
                </div>
                <div className="mt-[5%] w-[106%] border-[2px] border-[#F1F1F1] bg-[#5A9BD4] px-1 py-[6%] text-white shadow-[2px_2px_0_#8CA4B9]">
                  <p className="text-[10px] font-bold leading-tight">LAPORAN KINERJA HARIAN</p>
                  <p className="text-[7px] font-bold">TAHUN · ( BULAN )</p>
                </div>
                <div className="mt-auto mb-[8%] h-1.5 w-1/3 rounded bg-black/10" aria-hidden />
              </div>
            </div>
            <div className="rounded-[2px] bg-white px-3 py-3 text-center font-[Times_New_Roman,Times,serif] text-black shadow-sm">
              <p className="text-[10px]">MENGETAHUI,</p>
              <p className="text-[10px] leading-snug [overflow-wrap:anywhere]">{isi.mengetahuiJabatan || "—"}</p>
              <div className="h-8" aria-hidden />
              <p className="text-[10px] font-bold underline underline-offset-2 [overflow-wrap:anywhere]">{isi.mengetahuiNama || "…………………"}</p>
              {isi.mengetahuiNip && <p className="text-[9px]">NIP. {isi.mengetahuiNip}</p>}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
