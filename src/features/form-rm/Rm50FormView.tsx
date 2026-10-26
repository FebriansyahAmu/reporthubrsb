"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardCheck,
  Droplet,
  PackageCheck,
  PackageX,
  Pencil,
  Plus,
  ThermometerSun,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DatePicker, DateTimePicker, nowLocalDateTime } from "@/components/ui/DatePicker";
import { Input, Label } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { useNamaSaya } from "@/features/form-rm/isian/TtdSayaProvider";
import { BidangIsian } from "@/features/form-rm/isian/kunci";
import { LabelAsal } from "@/features/form-rm/isian/TandaAsal";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import { hitungAlur, Langkah, NavAlur, RingkasanKekurangan } from "@/features/form-rm/persetujuan/alur";
import { KepalaIsian, KonfirmasiGanti, samaNama, Saran } from "@/features/form-rm/persetujuan/bidang";
import { kosong } from "@/features/form-rm/persetujuan/informasi";
import {
  BARIS_HAL1,
  FASE_TTV,
  GOLONGAN_DARAH,
  LANGKAH_RM50,
  MAKS_KANTONG,
  SARAN_JENIS_DARAH,
  TEKS_RM50,
  adaReaksi,
  emptyRm50Form,
  jamFase,
  kantongKosong,
  kedaluwarsa,
  kekuranganRm50,
  kurangKantong,
  labelKantong,
  pisahWaktu,
  statusLangkahRm50,
  suhuNaik,
  ttvLengkap,
  type GolonganDarah,
  type IdFase,
  type KantongRm50,
  type KolomTtv,
  type Rm50Data,
  type YaTidak,
} from "@/features/form-rm/rm50.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

/** Data tersimpan → state UI lengkap (TTV tiap fase dilengkapi). */
function siapkan(data: unknown): Rm50Data {
  const d = (data && typeof data === "object" ? data : {}) as Partial<Rm50Data>;
  const kantong = Array.isArray(d.kantong) ? d.kantong : [];
  return {
    ...emptyRm50Form(),
    ...d,
    kantong: kantong.map((k) => {
      const dasar = kantongKosong(k.id);
      return { ...dasar, ...k, ttv: Object.fromEntries(FASE_TTV.map((f) => [f.id, { ...dasar.ttv[f.id], ...k.ttv?.[f.id] }])) as KantongRm50["ttv"] };
    }),
  };
}

/** Pengenal baris acak [a-z0-9] — `getRandomValues` (tersedia juga di HTTP LAN, tak seperti randomUUID). */
function idBaru(): string {
  const b = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(b, (x) => "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]).join("");
}

const ABO = ["A", "B", "AB", "O"] as const;
const RHESUS = [
  { id: "", label: "Tanpa Rh" },
  { id: "+", label: "Rh +" },
  { id: "-", label: "Rh −" },
] as const;

const LABEL_TTV: Record<KolomTtv, { label: string; satuan: string; contoh: string; mode: "text" | "numeric" | "decimal" }> = {
  td: { label: "TD", satuan: "mmHg", contoh: "120/80", mode: "text" },
  n: { label: "N", satuan: "x/mnt", contoh: "88", mode: "numeric" },
  r: { label: "R", satuan: "x/mnt", contoh: "20", mode: "numeric" },
  s: { label: "S", satuan: "°C", contoh: "36,5", mode: "decimal" },
};

/** Masukan TTV: hanya karakter yang mungkin (angka, "/", ",", ".", "-"). */
const saringTtv = (c: KolomTtv, v: string) =>
  (c === "td" ? v.replace(/[^\d/-]/g, "") : c === "s" ? v.replace(/[^\d.,-]/g, "") : v.replace(/[^\d-]/g, "")).slice(0, 7);

export function Rm50FormView({ isian, header, izin }: { isian: IsianForm; header: FormRmHeader; izin: IzinIsian }) {
  const k = useIsian(isian, izin, siapkan);
  const { form, setForm } = k;
  const [terbuka, setTerbuka] = useState<ReadonlySet<string>>(() => new Set(form.kantong.filter((x, i) => kurangKantong(x, i).length > 0).map((x) => x.id)));
  const [hapus, setHapus] = useState<string | null>(null);

  const set = <K extends keyof Rm50Data>(key: K, value: Rm50Data[K]) => setForm((f) => ({ ...f, [key]: value }));
  const ubahKantong = (id: string, ubah: (x: KantongRm50) => KantongRm50) =>
    setForm((f) => ({ ...f, kantong: f.kantong.map((x) => (x.id === id ? ubah(x) : x)) }));

  const kurang = kekuranganRm50(form);
  const alur = hitungAlur(LANGKAH_RM50, kurang, (id, x) => statusLangkahRm50(form, id, x), k.terkunci);
  const waktu = pisahWaktu(form.waktu);
  const reaksi = form.kantong.some((x) => adaReaksi(x.reaksi));
  const pasienNama = header.nama === "—" ? "" : header.nama;
  const diterimaSetelah = !!form.waktu && !!form.diterimaWaktu && form.diterimaWaktu > form.waktu;

  function tambahKantong() {
    const id = idBaru();
    setForm((f) => {
      const akhir = f.kantong.at(-1);
      const baru = kantongKosong(id);
      return { ...f, kantong: [...f.kantong, { ...baru, jenis: akhir?.jenis ?? "", parafNama: akhir?.parafNama ?? "" }] };
    });
    setTerbuka((s) => new Set(s).add(id));
    requestAnimationFrame(() => document.getElementById(`kantong-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function hapusKantong(id: string) {
    setForm((f) => ({ ...f, kantong: f.kantong.filter((x) => x.id !== id) }));
    setHapus(null);
  }
  const alih = (id: string) =>
    setTerbuka((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <IsianFrame
      kendali={k}
      aksen={
        <span className="inline-flex items-center gap-2">
          {reaksi && (
            <Badge tone="danger">
              <AlertTriangle className="size-3.5" aria-hidden />
              Ada reaksi
            </Badge>
          )}
          <span className="tabular-nums">
            {alur.jumlahLengkap}/{LANGKAH_RM50.length} langkah
          </span>
        </span>
      }
    >
      <KepalaIsian
        header={header}
        urutan={isian.urutan}
        lencana={
          <>
            <LencanaGolongan golongan={form.golonganDarah} />
            <Badge tone="neutral">
              <Droplet className="size-3.5" aria-hidden />
              {form.kantong.length} kantong
            </Badge>
            {reaksi && (
              <Badge tone="danger">
                <AlertTriangle className="size-3.5" aria-hidden />
                Ada reaksi transfusi
              </Badge>
            )}
          </>
        }
        subjekLabel="Transfusi"
        subjek={[waktu.tanggal, waktu.jam && `pukul ${waktu.jam}`].filter(Boolean).join(", ")}
      />

      <NavAlur langkah={LANGKAH_RM50} status={alur.status} aktif={alur.aktif} />

      <BidangIsian className="space-y-5">
        {/* 1 — Data transfusi */}
        <Langkah {...alur.props("transfusi")} judul="Data Transfusi"
          desc="Tanggal & jam transfusi, ruang rawat, dan dokter yang merawat (terisi dari SIMRS bila ada).">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
              <div>
                <Label htmlFor="rm50-waktu">Tanggal & jam</Label>
                <DateTimePicker id="rm50-waktu" value={form.waktu} onChange={(v) => set("waktu", v)} placeholder="Pilih tanggal & jam" />
                {!form.waktu && <Saran onClick={() => set("waktu", nowLocalDateTime())}>Isi waktu sekarang</Saran>}
              </div>
              <div className="min-w-0">
                <LabelAsal path="ruangRawat" htmlFor="rm50-ruang">Ruang rawat</LabelAsal>
                <Input id="rm50-ruang" value={form.ruangRawat} maxLength={120} onChange={(e) => set("ruangRawat", e.target.value)} placeholder="Nama ruang" />
              </div>
              <div className="min-w-0">
                <LabelAsal path="dokter" htmlFor="rm50-dokter">Dokter yang merawat</LabelAsal>
                <Input id="rm50-dokter" value={form.dokter} maxLength={120} onChange={(e) => set("dokter", e.target.value)} placeholder="Nama dokter (DPJP)" />
              </div>
            </div>
            <aside className="rounded-[var(--radius-md)] border border-brand/25 bg-brand-soft/40 px-4 py-3" aria-label="Catatan formulir">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-brand-soft-fg">
                <ClipboardCheck className="size-4" aria-hidden /> Catatan (tercetak di halaman 2)
              </p>
              <ol className="space-y-1 text-[13px] text-fg-muted">
                {TEKS_RM50.catatan.map((c, i) => (
                  <li key={c} className="flex gap-2">
                    <span className="w-4 shrink-0 font-semibold tabular-nums text-fg">{i + 1}.</span>
                    {c}
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </Langkah>

        {/* 2 — Riwayat & golongan darah */}
        <Langkah {...alur.props("riwayat")} judul="Riwayat & Golongan Darah"
          desc="Riwayat alergi dan transfusi sebelumnya, serta golongan darah pasien."
          kanan={<LencanaGolongan golongan={form.golonganDarah} besar />}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <fieldset className="min-w-0">
              <LabelAsal path="alergi" htmlFor="rm50-alergi">Riwayat alergi</LabelAsal>
              <PilihYaTidak id="rm50-alergi" nilai={form.alergi} ya="Ya, ada" onUbah={(v) => set("alergi", v)} />
              {form.alergi === "ya" && (
                <div className="mt-3">
                  <LabelAsal path="alergiKet" htmlFor="rm50-alergi-ket">Sebutkan</LabelAsal>
                  <Input id="rm50-alergi-ket" value={form.alergiKet} maxLength={200} onChange={(e) => set("alergiKet", e.target.value)} placeholder="Obat / makanan / lainnya" />
                </div>
              )}
            </fieldset>
            <fieldset className="min-w-0">
              <p className="mb-1.5 text-xs font-medium text-fg-muted">Pernah transfusi darah / produk darah</p>
              <PilihYaTidak id="rm50-pernah" nilai={form.pernahTransfusi} ya="Ya, pernah" onUbah={(v) => set("pernahTransfusi", v)} />
              {form.pernahTransfusi === "ya" && (
                <div className="mt-3 max-w-[10rem]">
                  <Label htmlFor="rm50-tahun">Tahun</Label>
                  <Input id="rm50-tahun" value={form.transfusiTahun} inputMode="numeric" maxLength={4} placeholder="mis. 2024"
                    onChange={(e) => set("transfusiTahun", e.target.value.replace(/\D/g, "").slice(0, 4))} />
                </div>
              )}
            </fieldset>
            <fieldset className="min-w-0">
              <LabelAsal path="golonganDarah">Golongan darah</LabelAsal>
              <PilihGolongan nilai={form.golonganDarah} onUbah={(v) => set("golonganDarah", v)} />
            </fieldset>
          </div>
        </Langkah>

        {/* 3 — Penerimaan kantong */}
        <Langkah {...alur.props("penerimaan")} judul="Penerimaan Kantong Darah"
          desc="Periksa keutuhan kantong saat diterima dari bank darah, lalu catat tanggal & jam diterima.">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div>
              <p className="mb-1.5 text-xs font-medium text-fg-muted">Keadaan kantong darah</p>
              <div role="radiogroup" aria-label="Keadaan kantong darah" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <KartuPilih ikon={PackageCheck} judul="Utuh" ket="Kantong tidak bocor / rusak" nada="success" dipilih={form.kantongKeadaan === "utuh"}
                  data="utuh" onPilih={() => set("kantongKeadaan", "utuh")} />
                <KartuPilih ikon={PackageX} judul="Tidak utuh" ket="Tuliskan keadaannya" nada="danger" dipilih={form.kantongKeadaan === "tidakUtuh"}
                  data="tidakUtuh" onPilih={() => set("kantongKeadaan", "tidakUtuh")} />
              </div>
              {form.kantongKeadaan === "tidakUtuh" && (
                <div className="mt-3">
                  <Label htmlFor="rm50-kantong-ket">Keterangan (Tidak utuh, …)</Label>
                  <Input id="rm50-kantong-ket" value={form.kantongKet} maxLength={120} onChange={(e) => set("kantongKet", e.target.value)} placeholder="mis. bocor di selang" />
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="rm50-diterima">Tanggal & jam darah diterima</Label>
              <DateTimePicker id="rm50-diterima" value={form.diterimaWaktu} onChange={(v) => set("diterimaWaktu", v)} placeholder="Pilih tanggal & jam" />
              {!form.diterimaWaktu && <Saran onClick={() => set("diterimaWaktu", nowLocalDateTime())}>Isi waktu sekarang</Saran>}
              {diterimaSetelah && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Waktu diterima setelah jam transfusi di langkah 1 — periksa kembali.
                </p>
              )}
            </div>
          </div>
        </Langkah>

        {/* 4 — Monitoring per kantong */}
        <Langkah {...alur.props("monitoring")} judul="Monitoring per Kantong"
          desc="Satu kartu per kantong darah: identitas kantong, tanda vital pada empat waktu, reaksi, dan paraf petugas."
          kanan={
            <span className="text-xs tabular-nums text-fg-muted">
              {form.kantong.length}/{MAKS_KANTONG} baris · hal. 1 memuat {BARIS_HAL1}
            </span>
          }>
          <div className="space-y-3">
            {form.kantong.length === 0 && (
              <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted">
                Belum ada kantong. Tambahkan kantong pertama saat transfusi akan dimulai.
              </p>
            )}
            {form.kantong.map((x, i) => (
              <KartuKantong
                key={x.id}
                k={x}
                no={i}
                terbuka={terbuka.has(x.id)}
                onAlih={() => alih(x.id)}
                onUbah={(ubah) => ubahKantong(x.id, ubah)}
                onHapus={() => setHapus(x.id)}
                minta={hapus === x.id}
                onBatalHapus={() => setHapus(null)}
                onYaHapus={() => hapusKantong(x.id)}
                parafLain={form.kantong.find((y) => y.id !== x.id && y.paraf.startsWith("ttd:") && samaNama(y.parafNama, x.parafNama))?.paraf ?? ""}
                namaSaran={[...new Set(form.kantong.filter((y) => y.id !== x.id).map((y) => y.parafNama.trim()).filter(Boolean))]}
                konteks={[pasienNama, `RM.50 — ${labelKantong(i)}`].filter(Boolean).join(" · ")}
              />
            ))}
            {!k.terkunci && (
              <Button type="button" variant="secondary" icon={<Plus className="size-4" />} onClick={tambahKantong} disabled={form.kantong.length >= MAKS_KANTONG}>
                {form.kantong.length >= MAKS_KANTONG ? `Formulir penuh (${MAKS_KANTONG} kantong) — buat isian baru` : "Tambah kantong"}
              </Button>
            )}
          </div>
        </Langkah>
      </BidangIsian>

      <RingkasanKekurangan langkah={LANGKAH_RM50} kurang={kurang} terkunci={k.terkunci} />
    </IsianFrame>
  );
}

/* ============================================================ kartu kantong */

function KartuKantong({
  k,
  no,
  terbuka,
  onAlih,
  onUbah,
  onHapus,
  minta,
  onBatalHapus,
  onYaHapus,
  parafLain,
  namaSaran,
  konteks,
}: {
  k: KantongRm50;
  no: number;
  terbuka: boolean;
  onAlih: () => void;
  onUbah: (ubah: (x: KantongRm50) => KantongRm50) => void;
  onHapus: () => void;
  minta: boolean;
  onBatalHapus: () => void;
  onYaHapus: () => void;
  parafLain: string;
  namaSaran: string[];
  konteks: string;
}) {
  const id = `rm50-k${no}`;
  const namaSaya = useNamaSaya();
  const kurang = kurangKantong(k, no);
  const lengkap = kurang.length === 0;
  const kadal = kedaluwarsa(k);
  const panas = suhuNaik(k);
  const reaksi = adaReaksi(k.reaksi);
  const w = pisahWaktu(k.waktu);
  const ubahTtv = (f: IdFase, c: KolomTtv, v: string) => onUbah((x) => ({ ...x, ttv: { ...x.ttv, [f]: { ...x.ttv[f], [c]: saringTtv(c, v) } } }));

  return (
    <section
      id={`kantong-${k.id}`}
      data-kantong={no + 1}
      aria-label={labelKantong(no)}
      className={cn(
        "scroll-mt-32 overflow-hidden rounded-[var(--radius-lg)] border bg-surface",
        reaksi || kadal ? "border-danger/50" : lengkap ? "border-success/40" : "border-border",
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4">
        <button type="button" onClick={onAlih} aria-expanded={terbuka} aria-controls={`${id}-panel`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-md)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", lengkap ? "bg-success text-white" : "bg-danger-soft text-danger")}>
            {lengkap ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <Droplet className="size-4" aria-hidden />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-fg">
              {labelKantong(no)}
              {k.jenis.trim() && <span className="font-normal text-fg-muted"> · {k.jenis.trim()}</span>}
              {k.isi && <span className="font-normal text-fg-muted"> · {k.isi} ml</span>}
            </span>
            <span className="block truncate text-xs text-fg-muted">
              {[w.tanggal && `${w.tanggal}, ${w.jam}`, k.noSeri && `No. seri ${k.noSeri}`].filter(Boolean).join(" · ") || "Belum diisi"}
            </span>
          </span>
          <ChevronDown className={cn("ml-auto size-4 shrink-0 text-fg-subtle transition-transform", terbuka && "rotate-180")} aria-hidden />
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {kadal && (
            <Badge tone="danger">
              <CalendarClock className="size-3.5" aria-hidden /> Kedaluwarsa
            </Badge>
          )}
          {panas && (
            <Badge tone="warning">
              <ThermometerSun className="size-3.5" aria-hidden /> Suhu naik ≥ 1 °C
            </Badge>
          )}
          {reaksi ? (
            <Badge tone="danger">
              <AlertTriangle className="size-3.5" aria-hidden /> Ada reaksi
            </Badge>
          ) : !kosong(k.reaksi) ? (
            <Badge tone="success">Tanpa reaksi</Badge>
          ) : null}
          {lengkap ? (
            <Badge tone="success">
              <Check className="size-3" aria-hidden /> Lengkap
            </Badge>
          ) : (
            <Badge tone="warning">{kurang.length} belum lengkap</Badge>
          )}
          <BidangIsian>
            <button type="button" onClick={onHapus} aria-label={`Hapus ${labelKantong(no)}`}
              className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:hidden">
              <Trash2 className="size-4" aria-hidden />
            </button>
          </BidangIsian>
        </div>
      </header>

      {minta && (
        <div className="px-3 pb-3 sm:px-4">
          <KonfirmasiGanti id={`${id}-hapus`} label="Hapus kantong" onBatal={onBatalHapus} onYa={onYaHapus}>
            Hapus <b>{labelKantong(no)}</b> beserta tanda vital{k.paraf ? " dan parafnya" : ""}? Kantong sesudahnya bergeser naik.
          </KonfirmasiGanti>
        </div>
      )}

      {/* Ringkasan TTV saat tertutup */}
      {!terbuka && (
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
          {FASE_TTV.map((f) => (
            <div key={f.id} className="bg-surface px-3 py-1.5 text-xs">
              <span className={cn("mr-1.5 font-medium", ttvLengkap(k.ttv[f.id]) ? "text-success" : "text-fg-subtle")}>{f.singkat}</span>
              <span className="tabular-nums text-fg-muted">
                {ttvLengkap(k.ttv[f.id]) ? `${k.ttv[f.id].td} · ${k.ttv[f.id].n} · ${k.ttv[f.id].r} · ${k.ttv[f.id].s}` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {terbuka && (
        <div id={`${id}-panel`} className="space-y-5 border-t border-border px-3 py-4 sm:px-4">
          {/* Identitas kantong */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-6">
            <div className="col-span-2">
              <Label htmlFor={`${id}-waktu`}>Tanggal/jam mulai</Label>
              <DateTimePicker id={`${id}-waktu`} value={k.waktu} onChange={(v) => onUbah((x) => ({ ...x, waktu: v }))} placeholder="Pilih tanggal & jam" />
              {!k.waktu && <Saran onClick={() => onUbah((x) => ({ ...x, waktu: nowLocalDateTime() }))}>Mulai sekarang</Saran>}
            </div>
            <div className="min-w-0">
              <Label htmlFor={`${id}-jenis`}>Jenis darah</Label>
              <Input id={`${id}-jenis`} value={k.jenis} maxLength={30} onChange={(e) => onUbah((x) => ({ ...x, jenis: e.target.value }))} placeholder="mis. PRC" />
              <div className="flex flex-wrap gap-x-1">
                {SARAN_JENIS_DARAH.filter((s) => s !== k.jenis.trim()).map((s) => (
                  <Saran key={s} onClick={() => onUbah((x) => ({ ...x, jenis: s }))}>{s}</Saran>
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <Label htmlFor={`${id}-seri`}>No. seri kantong</Label>
              <Input id={`${id}-seri`} value={k.noSeri} maxLength={40} className="font-mono" onChange={(e) => onUbah((x) => ({ ...x, noSeri: e.target.value }))} placeholder="No. seri" />
            </div>
            <div className="min-w-0">
              <Label htmlFor={`${id}-kadal`}>Tanggal kadaluarsa</Label>
              <DatePicker id={`${id}-kadal`} value={k.kadaluarsa} onChange={(v) => onUbah((x) => ({ ...x, kadaluarsa: v }))} placeholder="Pilih" />
              {kadal && <p className="mt-1 text-xs font-medium text-danger">Kedaluwarsa sebelum tanggal transfusi.</p>}
            </div>
            <div className="min-w-0">
              <Label htmlFor={`${id}-isi`}>Isi (ml)</Label>
              <Input id={`${id}-isi`} value={k.isi} inputMode="numeric" maxLength={4} onChange={(e) => onUbah((x) => ({ ...x, isi: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="mis. 250" />
            </div>
          </div>

          {/* Tanda vital: empat waktu */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              Tanda-tanda vital <span className="font-normal normal-case tracking-normal">— TD · N · R · S; tulis “-” bila tidak diukur</span>
            </p>
            <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {FASE_TTV.map((f, fi) => {
                const ok = ttvLengkap(k.ttv[f.id]);
                const jam = jamFase(k.waktu, f.menit);
                return (
                  <li key={f.id} data-fase={f.id} className={cn("flex flex-col rounded-[var(--radius-md)] border p-3", ok ? "border-success/40 bg-success-soft/25" : "border-border bg-surface-2/30")}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold leading-snug text-fg">
                        <span className="mr-1 text-fg-subtle tabular-nums">{fi + 1}.</span>
                        {f.baris.join(" ")}
                      </p>
                      {ok ? (
                        <Check className="size-4 shrink-0 text-success" strokeWidth={3} aria-label="Lengkap" />
                      ) : jam ? (
                        <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand-soft-fg" title="Perkiraan jam pengukuran dari jam mulai">
                          ± {jam}
                        </span>
                      ) : f.menit === null ? (
                        <span className="shrink-0 text-[11px] text-fg-subtle">selesai + 60 mnt</span>
                      ) : null}
                    </div>
                    <div className="mt-auto grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-1.5">
                      {(["td", "n", "r", "s"] as const).map((c) => (
                        <label key={c} className="min-w-0">
                          <span className="mb-0.5 block text-[11px] font-medium text-fg-muted">
                            {LABEL_TTV[c].label} <span className="text-fg-subtle">{LABEL_TTV[c].satuan}</span>
                          </span>
                          <input
                            id={`${id}-${f.id}-${c}`}
                            value={k.ttv[f.id][c]}
                            inputMode={LABEL_TTV[c].mode}
                            placeholder={LABEL_TTV[c].contoh}
                            aria-label={`${f.singkat} ${LABEL_TTV[c].label}`}
                            onChange={(e) => ubahTtv(f.id, c, e.target.value)}
                            className="h-9 w-full min-w-0 rounded-[var(--radius-sm)] border border-border bg-surface px-1.5 text-center text-sm tabular-nums text-fg placeholder:text-fg-subtle/70 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 disabled:opacity-70"
                          />
                        </label>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
            {panas && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                <ThermometerSun className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Suhu naik ≥ 1 °C dari sebelum transfusi — pantau kemungkinan reaksi transfusi.
              </p>
            )}
          </div>

          {/* Reaksi & paraf */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <Label htmlFor={`${id}-reaksi`}>Reaksi (sebutkan)</Label>
              <Input id={`${id}-reaksi`} value={k.reaksi} maxLength={80} onChange={(e) => onUbah((x) => ({ ...x, reaksi: e.target.value }))}
                placeholder="Tulis reaksi yang terjadi" className={reaksi ? "border-danger" : undefined} />
              {kosong(k.reaksi) && <Saran onClick={() => onUbah((x) => ({ ...x, reaksi: "Tidak ada" }))}>Tidak ada reaksi</Saran>}
            </div>
            <div className="min-w-0 rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3">
              <Label htmlFor={`${id}-paraf-nama`}>Paraf perawat / bidan — nama</Label>
              <Input id={`${id}-paraf-nama`} value={k.parafNama} maxLength={120} className="mb-1"
                onChange={(e) => onUbah((x) => ({ ...x, parafNama: e.target.value, paraf: x.paraf.startsWith("ttd:") && !samaNama(e.target.value, x.parafNama) ? "" : x.paraf }))}
                placeholder="Nama petugas yang memaraf" />
              <div className="mb-2 flex flex-wrap gap-x-1">
                {/* Ganti nama → paraf tersimpan (terikat nama lama) dilepas, sama seperti mengetik nama. */}
                <SaranNamaSaya nama={k.parafNama}
                  onPilih={(n) => onUbah((x) => ({ ...x, parafNama: n, paraf: x.paraf.startsWith("ttd:") ? "" : x.paraf }))} />
                {namaSaran.filter((n) => !samaNama(n, k.parafNama) && !samaNama(n, namaSaya)).slice(0, 3).map((n) => (
                  <Saran key={n} onClick={() => onUbah((x) => ({ ...x, parafNama: n, paraf: x.paraf.startsWith("ttd:") ? "" : x.paraf }))}>{n}</Saran>
                ))}
              </div>
              <SignaturePad label={`Paraf ${labelKantong(no).toLowerCase()}`} value={k.paraf} onChange={(v) => onUbah((x) => ({ ...x, paraf: v }))}
                context={konteks} reuse={kosong(k.parafNama) ? "" : parafLain}
                petugas={{ jenis: "PARAF", nama: k.parafNama, onNama: (n) => onUbah((x) => ({ ...x, parafNama: n })), isiNamaOtomatis: true }} />
            </div>
          </div>

          {!lengkap && (
            <ul className="flex flex-wrap gap-1.5" aria-label={`${labelKantong(no)} belum lengkap`}>
              {kurang.slice(0, 6).map((x) => (
                <li key={x} className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] text-warning">{x.replace(`${labelKantong(no)}: `, "")}</li>
              ))}
              {kurang.length > 6 && <li className="px-1 text-[11px] text-fg-subtle">+{kurang.length - 6} lagi</li>}
            </ul>
          )}
          {lengkap && (
            <Button type="button" size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} onClick={onAlih}>
              Tutup kartu
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/* ================================================================= pilihan */

function PilihYaTidak({ id, nilai, ya, onUbah }: { id: string; nilai: "" | YaTidak; ya: string; onUbah: (v: YaTidak) => void }) {
  return (
    <div id={id} role="radiogroup" className="inline-flex h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
      {(["tidak", "ya"] as const).map((v) => (
        <button key={v} type="button" role="radio" aria-checked={nilai === v} data-pilih={v} onClick={() => onUbah(v)}
          className={cn(
            "flex-1 rounded-[calc(var(--radius-md)-3px)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
            nilai === v ? (v === "ya" ? "bg-surface text-warning shadow-sm ring-1 ring-warning/40" : "bg-surface text-fg shadow-sm ring-1 ring-border") : "text-fg-muted hover:text-fg",
          )}>
          {v === "tidak" ? "Tidak" : ya}
        </button>
      ))}
    </div>
  );
}

function pecahGolongan(g: "" | GolonganDarah): { abo: string; rh: "" | "+" | "-" } {
  const m = /^(AB|A|B|O)([+-]?)$/.exec(g);
  return m ? { abo: m[1], rh: m[2] as "" | "+" | "-" } : { abo: "", rh: "" };
}

function PilihGolongan({ nilai, onUbah }: { nilai: "" | GolonganDarah; onUbah: (v: "" | GolonganDarah) => void }) {
  const { abo, rh } = pecahGolongan(nilai);
  const susun = (a: string, r: string) => {
    const g = `${a}${r}`;
    onUbah(a && (GOLONGAN_DARAH as readonly string[]).includes(g) ? (g as GolonganDarah) : "");
  };
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Golongan darah ABO" className="grid grid-cols-4 gap-1.5">
        {ABO.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={abo === a} data-abo={a} onClick={() => susun(a, rh)}
            className={cn(
              "h-11 rounded-[var(--radius-md)] border text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
              abo === a ? "border-danger bg-danger text-white" : "border-border bg-surface text-fg-muted hover:border-danger/40 hover:text-danger",
            )}>
            {a}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Rhesus" className="inline-flex h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
        {RHESUS.map((r) => (
          <button key={r.id || "x"} type="button" role="radio" aria-checked={!!abo && rh === r.id} disabled={!abo} onClick={() => susun(abo, r.id)}
            className={cn(
              "flex-1 rounded-[calc(var(--radius-md)-3px)] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-50",
              abo && rh === r.id ? "bg-surface text-fg shadow-sm ring-1 ring-border" : "text-fg-muted hover:text-fg",
            )}>
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LencanaGolongan({ golongan, besar }: { golongan: "" | GolonganDarah; besar?: boolean }) {
  if (!golongan) return besar ? null : <Badge tone="neutral" dot>Golongan darah belum diisi</Badge>;
  if (besar) {
    return (
      <span className="flex size-12 items-center justify-center rounded-full bg-danger text-lg font-bold text-white shadow-sm" aria-label={`Golongan darah ${golongan}`}>
        {golongan}
      </span>
    );
  }
  return (
    <Badge tone="danger">
      <Droplet className="size-3.5" aria-hidden />
      Gol. darah {golongan}
    </Badge>
  );
}

function KartuPilih({
  ikon: Ikon,
  judul,
  ket,
  nada,
  dipilih,
  data,
  onPilih,
}: {
  ikon: LucideIcon;
  judul: string;
  ket: string;
  nada: "success" | "danger";
  dipilih: boolean;
  data: string;
  onPilih: () => void;
}) {
  const warna = nada === "success" ? { kartu: "border-success bg-success-soft", ikon: "bg-success text-white" } : { kartu: "border-danger bg-danger-soft", ikon: "bg-danger text-white" };
  return (
    <button type="button" role="radio" aria-checked={dipilih} data-keadaan={data} onClick={onPilih}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] border-2 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        dipilih ? warna.kartu : "border-border bg-surface hover:border-border-strong",
      )}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", dipilih ? warna.ikon : "bg-surface-2 text-fg-subtle")}>
        <Ikon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg">{judul}</span>
        <span className="block text-xs text-fg-muted">{ket}</span>
      </span>
      {dipilih && <Check className="ml-auto size-4 shrink-0" aria-hidden />}
    </button>
  );
}
