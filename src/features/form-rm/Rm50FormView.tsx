"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronUp,
  ClipboardCheck,
  Droplet,
  PackageCheck,
  PackageX,
  PenLine,
  Plus,
  ThermometerSun,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { useNamaSaya } from "@/features/form-rm/isian/TtdSayaProvider";
import { BidangIsian, useTerkunci } from "@/features/form-rm/isian/kunci";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import {
  BagianLangkah,
  KONTROL,
  KakiLangkah,
  KolomWaktu,
  LabelKolom,
  LencanaLangkah,
  SyaratFinal,
  TOMBOL_KECIL,
  TataLetakLangkah,
  Wajib,
  fokusKe,
  type ButirSyarat,
} from "@/features/form-rm/isian/langkah/bagian";
import type { Langkah, SubLangkah } from "@/features/form-rm/isian/langkah/NavLangkah";
import { KONTROL_PILIHAN, LegendPilihan, PIL_PILIHAN, PilihanRadio } from "@/features/form-rm/isian/langkah/PilihanRadio";
import { hitungAlur } from "@/features/form-rm/persetujuan/alur";
import { KepalaIsian, KonfirmasiGanti, KotakTtd, samaNama, Saran } from "@/features/form-rm/persetujuan/bidang";
import { kosong } from "@/features/form-rm/persetujuan/informasi";
import {
  BARIS_HAL1,
  CONTOH_TTV,
  FASE_TTV,
  GOLONGAN_DARAH,
  KOLOM_TTV,
  LANGKAH_RM50,
  MAKS_KANTONG,
  SARAN_JENIS_DARAH,
  TEKS_RM50,
  adaReaksi,
  emptyRm50Form,
  jamFase,
  jumlahTtvSalah,
  kantongKosong,
  kedaluwarsa,
  kekuranganRinciRm50,
  kurangKantongRinci,
  labelKantong,
  pisahWaktu,
  statusKantong,
  statusLangkahRm50,
  suhuNaik,
  tahunTransfusiSah,
  ttvLengkap,
  ttvSalahFormat,
  type GolonganDarah,
  type IdLangkahRm50,
  type KantongRm50,
  type KeadaanKantong,
  type KolomTtv,
  type KurangRm50,
  type Rm50Data,
  type YaTidak,
} from "@/features/form-rm/rm50.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

/* Tata letak isian RM.50 (tampilan pengisian saja — cetak tetap Rm50Document):
 * 4 langkah dengan navigasi lengket (scrollspy; kantong tampil sebagai
 * sub-bagian di kolom samping), panel "Syarat finalisasi" yang memindahkan
 * fokus ke kolom yang kurang — termasuk membuka kartu kantong yang tertutup.
 * Syarat = `kekuranganRinciRm50` (sumber yang sama dengan validasi FINAL
 * server lewat `kekuranganRm50`). Path kolom tak berubah → simpan gabung,
 * penanda SIMRS, aturan paraf (`cekParafRm50`), dan cetak tetap. */

const idL = (id: IdLangkahRm50) => `rm50-langkah-${id}`;
const idKantong = (kid: string) => `rm50-kantong-${kid}`;
/** id elemen kolom sebuah kekurangan (kolom kartu kantong: `rm50-k-<id baris>-<kolom>`). */
const tujuanKolom = (x: KurangRm50) => (x.kantong ? `rm50-k-${x.kantong}-${x.kolom}` : `rm50-${x.kolom}`);

const NAV: Record<IdLangkahRm50, { judul: string; singkat: string }> = {
  transfusi: { judul: "Data transfusi", singkat: "Transfusi" },
  riwayat: { judul: "Riwayat & golongan darah", singkat: "Riwayat" },
  penerimaan: { judul: "Penerimaan kantong", singkat: "Penerimaan" },
  monitoring: { judul: "Monitoring per kantong", singkat: "Monitoring" },
};

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

const ringkasKurang = (kurang: readonly string[]) => kurang.slice(0, 2).join(", ") + (kurang.length > 2 ? ` +${kurang.length - 2} lagi` : "");

const ABO = ["A", "B", "AB", "O"] as const;
const RHESUS = [
  { id: "", label: "Tidak dicatat" },
  { id: "+", label: "Rh+ (positif)" },
  { id: "-", label: "Rh− (negatif)" },
] as const;

/** Kepala kolom TTV seperti kertas (TD · N · R · S) + nama lengkap untuk pembaca layar. */
const LABEL_TTV: Record<KolomTtv, { label: string; nama: string; satuan: string; contoh: string; mode: "text" | "numeric" | "decimal" }> = {
  td: { label: "TD", nama: "tekanan darah", satuan: "mmHg", contoh: "120/80", mode: "text" },
  n: { label: "N", nama: "nadi", satuan: "x/mnt", contoh: "88", mode: "numeric" },
  r: { label: "R", nama: "napas", satuan: "x/mnt", contoh: "20", mode: "numeric" },
  s: { label: "S", nama: "suhu", satuan: "°C", contoh: "36,5", mode: "decimal" },
};

/** Masukan TTV: hanya karakter yang mungkin (angka, "/", ",", ".", "-"). */
const saringTtv = (c: KolomTtv, v: string) =>
  (c === "td" ? v.replace(/[^\d/-]/g, "") : c === "s" ? v.replace(/[^\d.,-]/g, "") : v.replace(/[^\d-]/g, "")).slice(0, 7);

export function Rm50FormView({ isian, header, izin }: { isian: IsianForm; header: FormRmHeader; izin: IzinIsian }) {
  const k = useIsian(isian, izin, siapkan);
  const { form, setForm } = k;
  const [terbuka, setTerbuka] = useState<ReadonlySet<string>>(
    () => new Set(form.kantong.filter((x, i) => kurangKantongRinci(x, i).length > 0).map((x) => x.id)),
  );
  const [hapus, setHapus] = useState<string | null>(null);
  const [umum, setUmum] = useState("");
  const jedaUmum = useRef(0);
  useEffect(() => () => window.clearTimeout(jedaUmum.current), []);

  const set = <K extends keyof Rm50Data>(key: K, value: Rm50Data[K]) => setForm((f) => ({ ...f, [key]: value }));
  const ubahKantong = (id: string, ubah: (x: KantongRm50) => KantongRm50) =>
    setForm((f) => ({ ...f, kantong: f.kantong.map((x) => (x.id === id ? ubah(x) : x)) }));

  const rinci = kekuranganRinciRm50(form);
  const kurang = Object.fromEntries(LANGKAH_RM50.map((l) => [l.id, rinci[l.id].map((x) => x.pesan)])) as Record<IdLangkahRm50, string[]>;
  const alur = hitungAlur(LANGKAH_RM50, kurang, (id, x) => statusLangkahRm50(form, id, x), k.terkunci);
  // Daftar syarat hanya untuk yang bisa mengisi (DRAF & tidak terkunci).
  const draf = isian.status === "DRAF" && !k.terkunci;
  const waktu = pisahWaktu(form.waktu);
  const reaksi = form.kantong.some((x) => adaReaksi(x.reaksi));
  const pasienNama = header.nama === "—" ? "" : header.nama;
  const diterimaSetelah = !!form.waktu && !!form.diterimaWaktu && form.diterimaWaktu > form.waktu;
  const semuaTerbuka = form.kantong.length > 0 && form.kantong.every((x) => terbuka.has(x.id));

  /** Pindah fokus ke kolom; kolom di kartu kantong yang tertutup → kartunya dibuka dulu (render sinkron). */
  function fokus(id: string) {
    const kid = /^rm50-k-([a-z0-9]+)-/.exec(id)?.[1];
    if (kid && !terbuka.has(kid)) flushSync(() => setTerbuka((s) => new Set(s).add(kid)));
    fokusKe(id);
  }

  /** Satu live region sopan untuk kesalahan format yang muncul saat kolom ditinggalkan (jeda agar tak menimpa kolom berikutnya). */
  function umumkan(teks: string) {
    window.clearTimeout(jedaUmum.current);
    setUmum("");
    jedaUmum.current = window.setTimeout(() => setUmum(teks), 500);
  }

  const sub: SubLangkah[] = form.kantong.map((x, i) => {
    const st = statusKantong(x, i);
    const n = kurangKantongRinci(x, i).length;
    return {
      id: idKantong(x.id),
      judul: [labelKantong(i), x.jenis.trim()].filter(Boolean).join(" · "),
      status: st,
      ket: st === "lengkap" ? (adaReaksi(x.reaksi) ? "Lengkap · ada reaksi" : "Lengkap") : st === "sebagian" ? `${n} belum lengkap` : "Belum diisi",
    };
  });
  const langkah: Langkah[] = LANGKAH_RM50.map((l, i) => {
    const st = alur.status[l.id];
    const n = kurang[l.id].length;
    const ket =
      l.id === "monitoring" && form.kantong.length > 0
        ? `${form.kantong.length} kantong · ${sub.filter((s) => s.status === "lengkap").length} lengkap`
        : st === "lengkap"
          ? "Lengkap"
          : st === "sebagian"
            ? `${n} belum lengkap`
            : "Belum diisi";
    return {
      id: idL(l.id),
      no: i + 1,
      judul: NAV[l.id].judul,
      singkat: NAV[l.id].singkat,
      status: st,
      ket: alur.aktif === l.id ? `Berikutnya · ${ket}` : ket,
      sub: l.id === "monitoring" ? sub : undefined,
    };
  });
  const butir: ButirSyarat[] = LANGKAH_RM50.map((l, i) => ({
    kunci: l.id,
    label: `${i + 1}. ${NAV[l.id].judul}`,
    ok: rinci[l.id].length === 0,
    tujuan: rinci[l.id].length ? tujuanKolom(rinci[l.id][0]) : idL(l.id),
    ket: rinci[l.id].length ? ringkasKurang(kurang[l.id]) : undefined,
  }));

  /** Kekurangan di kaki langkah. Monitoring: satu butir per kantong (bisa 23 × 13 kolom) → fokus ke kolom pertama yang kurang. */
  const kakiKurang = (id: IdLangkahRm50) => {
    if (id !== "monitoring") return rinci[id].map((x) => ({ label: x.pesan, tujuan: tujuanKolom(x) }));
    const umumMon = rinci.monitoring.filter((x) => !x.kantong).map((x) => ({ label: x.pesan, tujuan: tujuanKolom(x) }));
    const perKantong = form.kantong.flatMap((x, i) => {
      const r = kurangKantongRinci(x, i);
      return r.length ? [{ label: `${labelKantong(i)}: ${r.length} belum lengkap`, tujuan: tujuanKolom(r[0]) }] : [];
    });
    return [...umumMon, ...perKantong];
  };

  /** Kartu langkah + kaki (kekurangan yang bisa diklik, "Lanjut"). */
  const props = (id: IdLangkahRm50) => {
    const i = LANGKAH_RM50.findIndex((l) => l.id === id);
    const berikut = LANGKAH_RM50[i + 1];
    return {
      kartu: {
        id: idL(id),
        no: i + 1,
        sorot: alur.aktif === id,
        lencana: <LencanaLangkah status={alur.status[id]} kurang={kurang[id].length} berikutnya={alur.aktif === id} />,
      },
      kaki: (
        <KakiLangkah
          kurang={kakiKurang(id)}
          tampilKurang={alur.status[id] !== "kosong"}
          lanjut={berikut && { id: idL(berikut.id), judul: NAV[berikut.id].judul }}
          fokus={fokus}
        />
      ),
    };
  };
  const p = { transfusi: props("transfusi"), riwayat: props("riwayat"), penerimaan: props("penerimaan"), monitoring: props("monitoring") };

  /* ------------------------------------------------------------- kantong */

  /** Kantong baru mewarisi jenis darah & nama petugas kantong terakhir; kartunya dibuka dan kolom pertama difokuskan. */
  function tambahKantong() {
    const id = idBaru();
    flushSync(() => {
      setForm((f) => {
        const akhir = f.kantong.at(-1);
        return { ...f, kantong: [...f.kantong, { ...kantongKosong(id), jenis: akhir?.jenis ?? "", parafNama: akhir?.parafNama ?? "" }] };
      });
      setTerbuka((s) => new Set(s).add(id));
    });
    fokusKe(`rm50-k-${id}-waktu`);
  }
  /** Hapus → fokus pindah ke kantong sesudahnya (atau sebelumnya / tombol Tambah) agar tidak hilang ke <body>. */
  function hapusKantong(id: string) {
    const i = form.kantong.findIndex((x) => x.id === id);
    const sisa = form.kantong.filter((x) => x.id !== id);
    const tetangga = sisa[i] ?? sisa[i - 1];
    flushSync(() => {
      setForm((f) => ({ ...f, kantong: f.kantong.filter((x) => x.id !== id) }));
      setHapus(null);
    });
    document.getElementById(tetangga ? `rm50-k-${tetangga.id}-alih` : "rm50-tambah")?.focus();
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
      <TataLetakLangkah langkah={langkah} samping={draf && <SyaratFinal butir={butir} idJudul="rm50-syarat-judul" fokus={fokus} />}>
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

        {/* ------------------------------------------------ 1. Data transfusi */}
        <BagianLangkah
          {...p.transfusi.kartu}
          judul="Data transfusi"
          ket="Tanggal & jam transfusi, ruang rawat, dan dokter yang merawat (terisi dari SIMRS bila ada)."
        >
          <div className="grid grid-cols-1 gap-5 @4xl:grid-cols-[minmax(0,1fr)_17rem]">
            <BidangIsian>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 @xl:grid-cols-2">
                <div className="@xl:col-span-2">
                  <KolomWaktu id="rm50-waktu" label="Tanggal & jam transfusi" wajib value={form.waktu} onChange={(v) => set("waktu", v)} />
                </div>
                <div className="min-w-0">
                  <LabelKolom htmlFor="rm50-ruang" asal="ruangRawat" wajib>
                    Ruang rawat
                  </LabelKolom>
                  <Input
                    id="rm50-ruang"
                    value={form.ruangRawat}
                    maxLength={120}
                    onChange={(e) => set("ruangRawat", e.target.value)}
                    placeholder="Nama ruang"
                    enterKeyHint="next"
                    className={KONTROL}
                  />
                </div>
                <div className="min-w-0">
                  <LabelKolom htmlFor="rm50-dokter" asal="dokter" wajib>
                    Dokter yang merawat
                  </LabelKolom>
                  <Input
                    id="rm50-dokter"
                    value={form.dokter}
                    maxLength={120}
                    onChange={(e) => set("dokter", e.target.value)}
                    placeholder="Nama dokter (DPJP)"
                    enterKeyHint="next"
                    className={KONTROL}
                  />
                </div>
              </div>
            </BidangIsian>
            <div className="rounded-[var(--radius-md)] border border-brand/25 bg-brand-soft/40 px-4 py-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-brand-soft-fg">
                <ClipboardCheck className="size-4" aria-hidden /> Pengingat sebelum transfusi
              </p>
              <ol className="space-y-1 text-[13px] text-fg-muted">
                {TEKS_RM50.catatan.map((c, i) => (
                  <li key={c} className="flex gap-2">
                    <span className="w-4 shrink-0 font-semibold tabular-nums text-fg">{i + 1}.</span>
                    {c}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[11px] text-fg-subtle">Tercetak sebagai “Catatan” di halaman 2.</p>
            </div>
          </div>
          {p.transfusi.kaki}
        </BagianLangkah>

        {/* ------------------------------------------------ 2. Riwayat & golongan darah */}
        <BagianLangkah
          {...p.riwayat.kartu}
          judul="Riwayat & golongan darah"
          ket="Riwayat alergi dan transfusi sebelumnya, serta golongan darah pasien."
          aksi={<LencanaGolongan golongan={form.golonganDarah} besar />}
        >
          <BidangIsian>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 @3xl:grid-cols-3">
              <div className="min-w-0">
                <PilihanRadio
                  id="rm50-alergi"
                  legend={
                    <>
                      Riwayat alergi <Wajib />
                    </>
                  }
                  asal="alergi"
                  ringkas
                  value={form.alergi}
                  onChange={(v) => set("alergi", v as YaTidak)}
                  opsi={[
                    { value: "tidak", label: "Tidak" },
                    { value: "ya", label: "Ya, ada" },
                  ]}
                />
                {form.alergi === "ya" && (
                  <div className="mt-3">
                    <LabelKolom htmlFor="rm50-alergi-ket" asal="alergiKet" wajib>
                      Sebutkan alergi
                    </LabelKolom>
                    <Input
                      id="rm50-alergi-ket"
                      value={form.alergiKet}
                      maxLength={200}
                      onChange={(e) => set("alergiKet", e.target.value)}
                      placeholder="Obat / makanan / lainnya"
                      className={KONTROL}
                    />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <PilihanRadio
                  id="rm50-pernah"
                  legend={
                    <>
                      Pernah transfusi darah / produk darah <Wajib />
                    </>
                  }
                  ringkas
                  value={form.pernahTransfusi}
                  onChange={(v) => set("pernahTransfusi", v as YaTidak)}
                  opsi={[
                    { value: "tidak", label: "Tidak" },
                    { value: "ya", label: "Ya, pernah" },
                  ]}
                />
                {form.pernahTransfusi === "ya" && <KolomTahun tahun={form.transfusiTahun} waktu={form.waktu} onUbah={(v) => set("transfusiTahun", v)} />}
              </div>
              <PilihGolongan nilai={form.golonganDarah} onUbah={(v) => set("golonganDarah", v)} />
            </div>
          </BidangIsian>
          {p.riwayat.kaki}
        </BagianLangkah>

        {/* ------------------------------------------------ 3. Penerimaan kantong */}
        <BagianLangkah
          {...p.penerimaan.kartu}
          judul="Penerimaan kantong darah"
          ket="Periksa keutuhan kantong saat diterima dari bank darah, lalu catat tanggal & jam diterima."
        >
          <BidangIsian>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 @3xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <fieldset id="rm50-keadaan" tabIndex={-1} className="m-0 min-w-0 border-0 p-0 outline-none">
                  <LegendPilihan>
                    Keadaan kantong darah <Wajib />
                  </LegendPilihan>
                  <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
                    {(["utuh", "tidakUtuh"] as const).map((x) => (
                      <KartuKeadaan key={x} nilai={x} dipilih={form.kantongKeadaan === x} onPilih={() => set("kantongKeadaan", x)} />
                    ))}
                  </div>
                </fieldset>
                {form.kantongKeadaan === "tidakUtuh" && (
                  <div className="mt-3">
                    <LabelKolom htmlFor="rm50-kantong-ket" wajib>
                      Keterangan (Tidak utuh, …)
                    </LabelKolom>
                    <Input
                      id="rm50-kantong-ket"
                      value={form.kantongKet}
                      maxLength={120}
                      onChange={(e) => set("kantongKet", e.target.value)}
                      placeholder="mis. bocor di selang"
                      className={KONTROL}
                    />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <KolomWaktu
                  id="rm50-diterima"
                  label="Tanggal & jam darah diterima"
                  wajib
                  value={form.diterimaWaktu}
                  onChange={(v) => set("diterimaWaktu", v)}
                />
                {diterimaSetelah && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Waktu diterima sesudah jam transfusi di langkah 1 — periksa kembali.
                  </p>
                )}
              </div>
            </div>
          </BidangIsian>
          {p.penerimaan.kaki}
        </BagianLangkah>

        {/* ------------------------------------------------ 4. Monitoring per kantong */}
        <BagianLangkah
          {...p.monitoring.kartu}
          judul="Monitoring per kantong"
          ket={`Satu kartu per kantong darah: identitas kantong, tanda vital pada empat waktu, reaksi, dan paraf petugas. Kertas memuat ${MAKS_KANTONG} kantong (halaman 1: ${BARIS_HAL1}).`}
          aksi={
            form.kantong.length > 1 ? (
              <button
                type="button"
                aria-expanded={semuaTerbuka}
                onClick={() => setTerbuka(semuaTerbuka ? new Set() : new Set(form.kantong.map((x) => x.id)))}
                className={TOMBOL_KECIL}
              >
                {semuaTerbuka ? <ChevronsDownUp className="size-3.5" aria-hidden /> : <ChevronsUpDown className="size-3.5" aria-hidden />}
                {semuaTerbuka ? "Tutup semua kantong" : "Buka semua kantong"}
              </button>
            ) : undefined
          }
        >
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
                fokus={fokus}
                umumkan={umumkan}
              />
            ))}
            {!k.terkunci && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Button
                  id="rm50-tambah"
                  type="button"
                  variant="secondary"
                  icon={<Plus className="size-4" />}
                  onClick={tambahKantong}
                  disabled={form.kantong.length >= MAKS_KANTONG}
                  className="pointer-coarse:h-11"
                >
                  Tambah kantong
                </Button>
                <span className="text-xs tabular-nums text-fg-muted">
                  {form.kantong.length >= MAKS_KANTONG
                    ? `Formulir penuh (${MAKS_KANTONG} kantong) — buat isian baru untuk kantong berikutnya.`
                    : `${form.kantong.length} dari ${MAKS_KANTONG} baris terpakai`}
                </span>
              </div>
            )}
          </div>
          {draf && <SyaratFinal butir={butir} idJudul="rm50-syarat-judul-ponsel" className="mt-5 xl:hidden" fokus={fokus} />}
          {p.monitoring.kaki}
        </BagianLangkah>
      </TataLetakLangkah>
      <p aria-live="polite" className="sr-only">
        {umum}
      </p>
    </IsianFrame>
  );
}

/* ============================================================ kartu kantong */

/**
 * Satu kantong darah = satu baris tabel kertas. Akordeon ber-heading: tombol
 * buka/tutup ada DI DALAM h3 (navigasi heading tetap jalan) dan berada di
 * luar wilayah isian terkunci → pengamat (baca-saja) tetap bisa membukanya.
 */
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
  fokus,
  umumkan,
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
  fokus: (id: string) => void;
  umumkan: (teks: string) => void;
}) {
  const base = `rm50-k-${k.id}`;
  const L = labelKantong(no);
  const namaSaya = useNamaSaya();
  const terkunci = useTerkunci();
  const kurang = kurangKantongRinci(k, no);
  const lengkap = kurang.length === 0;
  const kadal = kedaluwarsa(k);
  const panas = suhuNaik(k);
  const reaksi = adaReaksi(k.reaksi);
  const salahTtv = jumlahTtvSalah(k);
  const w = pisahWaktu(k.waktu);
  const ringkas = [w.tanggal && `${w.tanggal}, ${w.jam}`, k.noSeri.trim() && `No. seri ${k.noSeri.trim()}`].filter(Boolean).join(" · ");
  const gantiNama = (n: string) => onUbah((x) => ({ ...x, parafNama: n, paraf: x.paraf.startsWith("ttd:") && !samaNama(n, x.parafNama) ? "" : x.paraf }));

  function tutup() {
    onAlih();
    document.getElementById(`${base}-alih`)?.focus();
  }

  return (
    <section
      id={idKantong(k.id)}
      tabIndex={-1}
      data-kantong={no + 1}
      aria-labelledby={`${base}-judul`}
      className={cn(
        "scroll-mt-32 overflow-hidden rounded-[var(--radius-lg)] border bg-surface outline-none",
        reaksi || kadal || salahTtv > 0 ? "border-danger/50" : lengkap ? "border-success/40" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4">
        <h3 id={`${base}-judul`} className="min-w-0 flex-[1_1_16rem]">
          <button
            id={`${base}-alih`}
            type="button"
            onClick={onAlih}
            aria-expanded={terbuka}
            aria-controls={terbuka ? `${base}-panel` : undefined}
            className="flex w-full min-w-0 items-start gap-2 rounded-[var(--radius-md)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring pointer-coarse:min-h-11"
          >
            {/* Penanda tepat sebelum label (mudah dipindai); diputar, bukan diganti. */}
            <ChevronRight
              className={cn("mt-0.5 size-4 shrink-0 text-fg-subtle transition-transform motion-reduce:transition-none", terbuka && "rotate-90")}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-fg">
                {L}
                {k.jenis.trim() && <span className="font-normal text-fg-muted"> · {k.jenis.trim()}</span>}
                {k.isi && <span className="font-normal text-fg-muted"> · {k.isi} ml</span>}
              </span>
              <span className="block truncate text-xs font-normal text-fg-muted">{ringkas || "Belum diisi"}</span>
            </span>
          </button>
        </h3>
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
          {salahTtv > 0 && (
            <Badge tone="danger">
              <AlertTriangle className="size-3.5" aria-hidden /> {salahTtv} TTV salah format
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
          {!terkunci && (
            <button
              type="button"
              onClick={onHapus}
              aria-label={`Hapus ${L}`}
              className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring pointer-coarse:size-11"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {minta && (
        <div className="px-3 pb-3 sm:px-4">
          <KonfirmasiGanti id={`${base}-hapus`} label="Hapus kantong" onBatal={onBatalHapus} onYa={onYaHapus}>
            Hapus <b>{L}</b> beserta tanda vital{k.paraf ? " dan parafnya" : ""}? Kantong sesudahnya bergeser naik.
          </KonfirmasiGanti>
        </div>
      )}

      {!terbuka && <RingkasTtv k={k} />}

      {terbuka && (
        <div id={`${base}-panel`} className="@container border-t border-border px-3 py-4 sm:px-4">
          <BidangIsian className="space-y-5">
            {/* Identitas kantong */}
            {/* Urutan kolom kertas: tanggal/jam · jenis · no. seri · kadaluarsa · isi. Lebar minimum untuk pemilih tanggal. */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 @xl:grid-cols-4 @3xl:grid-cols-[minmax(13rem,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(10.5rem,1.1fr)_minmax(0,0.7fr)]">
              <div className="col-span-2 @3xl:col-span-1">
                <KolomWaktu id={`${base}-waktu`} label="Tanggal/jam mulai" wajib value={k.waktu} onChange={(v) => onUbah((x) => ({ ...x, waktu: v }))} />
              </div>
              <div className="min-w-0">
                <LabelKolom htmlFor={`${base}-jenis`} wajib>
                  Jenis darah
                </LabelKolom>
                <Input
                  id={`${base}-jenis`}
                  value={k.jenis}
                  maxLength={30}
                  onChange={(e) => onUbah((x) => ({ ...x, jenis: e.target.value }))}
                  placeholder="mis. PRC"
                  className={KONTROL}
                />
                {!terkunci && (
                  <div className="flex flex-wrap gap-x-1">
                    {SARAN_JENIS_DARAH.filter((s) => s !== k.jenis.trim()).map((s) => (
                      <Saran key={s} onClick={() => onUbah((x) => ({ ...x, jenis: s }))}>
                        {s}
                      </Saran>
                    ))}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <LabelKolom htmlFor={`${base}-seri`} wajib>
                  No. seri kantong
                </LabelKolom>
                <Input
                  id={`${base}-seri`}
                  value={k.noSeri}
                  maxLength={40}
                  onChange={(e) => onUbah((x) => ({ ...x, noSeri: e.target.value }))}
                  placeholder="No. seri"
                  autoComplete="off"
                  className={cn(KONTROL, "font-mono")}
                />
              </div>
              <div className="min-w-0">
                <LabelKolom htmlFor={`${base}-kadaluarsa`} wajib>
                  Tanggal kadaluarsa
                </LabelKolom>
                <DatePicker id={`${base}-kadaluarsa`} value={k.kadaluarsa} onChange={(v) => onUbah((x) => ({ ...x, kadaluarsa: v }))} placeholder="Pilih" />
                {kadal && <p className="mt-1 text-xs font-medium text-danger">Kedaluwarsa sebelum tanggal transfusi.</p>}
              </div>
              <div className="min-w-0">
                <LabelKolom htmlFor={`${base}-isi`} wajib>
                  Isi (ml)
                </LabelKolom>
                <Input
                  id={`${base}-isi`}
                  value={k.isi}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(e) => onUbah((x) => ({ ...x, isi: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  placeholder="mis. 250"
                  className={KONTROL}
                />
              </div>
            </div>

            <TabelTtv base={base} k={k} label={L} onUbah={onUbah} umumkan={umumkan} />

            {/* Reaksi & paraf */}
            <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
              <div className="min-w-0">
                <LabelKolom htmlFor={`${base}-reaksi`} wajib>
                  Reaksi (sebutkan)
                </LabelKolom>
                <Input
                  id={`${base}-reaksi`}
                  value={k.reaksi}
                  maxLength={80}
                  onChange={(e) => onUbah((x) => ({ ...x, reaksi: e.target.value }))}
                  placeholder="Tulis reaksi yang terjadi"
                  aria-describedby={`${base}-reaksi-ket`}
                  className={cn(KONTROL, reaksi && "border-danger")}
                />
                <p id={`${base}-reaksi-ket`} className={cn("mt-1.5 text-xs", reaksi ? "font-medium text-danger" : "text-fg-subtle")}>
                  {reaksi ? "Tercatat sebagai reaksi transfusi." : "Tulis “Tidak ada” bila tidak ada reaksi."}
                </p>
                {kosong(k.reaksi) && !terkunci && <Saran onClick={() => onUbah((x) => ({ ...x, reaksi: "Tidak ada" }))}>Tidak ada reaksi</Saran>}
              </div>
              <KotakTtd
                ikon={PenLine}
                peran="Paraf perawat / bidan"
                nama={k.parafNama}
                kosongNama="Isi nama petugas yang memaraf"
                sudah={k.paraf !== ""}
                idTtd={`${base}-paraf`}
              >
                <div className="mb-3">
                  <LabelKolom htmlFor={`${base}-paraf-nama`} wajib>
                    Nama petugas
                  </LabelKolom>
                  <Input
                    id={`${base}-paraf-nama`}
                    value={k.parafNama}
                    maxLength={120}
                    onChange={(e) => gantiNama(e.target.value)}
                    placeholder="Nama petugas yang memaraf"
                    className={KONTROL}
                  />
                  <div className="flex flex-wrap gap-x-1.5">
                    {/* Ganti nama → paraf tersimpan (terikat nama lama) dilepas, sama seperti mengetik nama. */}
                    <SaranNamaSaya nama={k.parafNama} onPilih={gantiNama} />
                    {namaSaran
                      .filter((n) => !samaNama(n, k.parafNama) && !samaNama(n, namaSaya))
                      .slice(0, 3)
                      .map((n) => (
                        <Saran key={n} onClick={() => gantiNama(n)}>
                          {n}
                        </Saran>
                      ))}
                  </div>
                </div>
                <SignaturePad
                  label={`Paraf ${L.toLowerCase()}`}
                  value={k.paraf}
                  onChange={(v) => onUbah((x) => ({ ...x, paraf: v }))}
                  context={konteks}
                  reuse={kosong(k.parafNama) ? "" : parafLain}
                  petugas={{ jenis: "PARAF", nama: k.parafNama, onNama: (n) => onUbah((x) => ({ ...x, parafNama: n })), isiNamaOtomatis: true }}
                />
              </KotakTtd>
            </div>
          </BidangIsian>

          {/* Kaki kartu: kekurangan yang bisa diklik + tutup (fokus kembali ke tombol kartu). */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            {lengkap ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                <Check className="size-3.5" aria-hidden /> {L} lengkap
              </span>
            ) : !terkunci ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-fg-subtle">Belum lengkap:</span>
                <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label={`${L} belum lengkap`}>
                  {kurang.map((x) => (
                    <li key={x.pesan}>
                      <button
                        type="button"
                        onClick={() => fokus(`rm50-k-${k.id}-${x.kolom}`)}
                        className="rounded-full bg-warning-soft px-2 py-0.5 text-left text-[11px] text-warning transition-colors hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring pointer-coarse:min-h-9"
                      >
                        {x.pesan.replace(`${L}: `, "")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <span />
            )}
            <button type="button" onClick={tutup} className={TOMBOL_KECIL}>
              <ChevronUp className="size-3.5" aria-hidden />
              Tutup {L.toLowerCase()}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ============================================================ tanda vital */

/**
 * Tanda vital satu kantong = satu tabel (baris = waktu pengukuran, kolom = TD ·
 * N · R · S). Wadah ≥ 36rem: tabel seperti kertas; lebih sempit: tiap waktu
 * jadi kartu 2 × 2 dengan label per kolom (container query, satu DOM).
 */
function TabelTtv({
  base,
  k,
  label,
  onUbah,
  umumkan,
}: {
  base: string;
  k: KantongRm50;
  label: string;
  onUbah: (ubah: (x: KantongRm50) => KantongRm50) => void;
  umumkan: (teks: string) => void;
}) {
  const panas = suhuNaik(k);
  return (
    <div>
      <table className="block w-full border-collapse @xl:table @xl:table-fixed">
        {/* Mode tabel: caption harus `table-caption` — caption ber-display block di dalam tabel terbungkus jadi sel anonim. */}
        <caption className="mb-2 block text-left text-xs font-semibold text-fg @xl:table-caption">
          Tanda-tanda vital {label.toLowerCase()} <span className="font-normal text-fg-muted">— tulis “-” bila tidak diukur</span>
        </caption>
        <thead className="hidden @xl:table-header-group">
          <tr className="text-left text-[11px] text-fg-muted">
            <th scope="col" className="w-[34%] pr-3 pb-1.5 font-medium">
              Waktu pengukuran
            </th>
            {KOLOM_TTV.map((c) => (
              <th key={c} scope="col" className="px-1 pb-1.5 font-semibold text-fg">
                {LABEL_TTV[c].label} <span className="font-normal text-fg-subtle">{LABEL_TTV[c].satuan}</span>
                <span className="sr-only"> ({LABEL_TTV[c].nama})</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block space-y-2 @xl:table-row-group">
          {FASE_TTV.map((f, fi) => {
            const ok = ttvLengkap(k.ttv[f.id]);
            const jam = jamFase(k.waktu, f.menit);
            return (
              <tr
                key={f.id}
                data-fase={f.id}
                className={cn(
                  "grid grid-cols-2 gap-2 rounded-[var(--radius-md)] border p-2.5",
                  "@xl:table-row @xl:rounded-none @xl:border-x-0 @xl:border-b-0 @xl:p-0",
                  ok ? "border-success/40 bg-success-soft/25 @xl:border-border @xl:bg-transparent" : "border-border",
                )}
              >
                <th scope="row" className="col-span-2 text-left font-normal @xl:py-2 @xl:pr-3 @xl:align-top">
                  <span className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                    <span className="text-[13px] font-semibold leading-snug text-fg">
                      <span className="mr-1 tabular-nums text-fg-subtle">{fi + 1}.</span>
                      {f.baris.join(" ")}
                    </span>
                    {ok ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-success">
                        <Check className="size-3.5" strokeWidth={3} aria-hidden />
                        Lengkap
                      </span>
                    ) : jam ? (
                      <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand-soft-fg">
                        <span className="sr-only">perkiraan pukul </span>± {jam}
                      </span>
                    ) : f.menit === null ? (
                      <span className="shrink-0 text-[11px] text-fg-subtle">selesai + 60 mnt</span>
                    ) : null}
                  </span>
                </th>
                {KOLOM_TTV.map((c) => (
                  <td key={c} className="min-w-0 @xl:px-1 @xl:py-2 @xl:align-top">
                    <SelTtv
                      id={`${base}-${f.id}-${c}`}
                      fase={f.singkat}
                      kolom={c}
                      nilai={k.ttv[f.id][c]}
                      onUbah={(v) => onUbah((x) => ({ ...x, ttv: { ...x.ttv, [f.id]: { ...x.ttv[f.id], [c]: v } } }))}
                      onSalah={() => umumkan(`${label}, ${f.singkat}, ${LABEL_TTV[c].label}: ${CONTOH_TTV[c]}`)}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {panas && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
          <ThermometerSun className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Suhu naik ≥ 1 °C dari sebelum transfusi — pantau kemungkinan reaksi transfusi.
        </p>
      )}
    </div>
  );
}

/**
 * Sel TTV. Format salah (mis. "120/") ditandai SETELAH kolom ditinggalkan —
 * tidak saat masih diketik — lewat `aria-invalid` + pesan yang dirujuk
 * `aria-describedby` hanya selama tampil; hilang begitu dibetulkan.
 */
function SelTtv({
  id,
  fase,
  kolom,
  nilai,
  onUbah,
  onSalah,
}: {
  id: string;
  fase: string;
  kolom: KolomTtv;
  nilai: string;
  onUbah: (v: string) => void;
  onSalah: () => void;
}) {
  const [diketik, setDiketik] = useState(false);
  const [pernahKeluar, setPernahKeluar] = useState(false);
  const L = LABEL_TTV[kolom];
  const salah = ttvSalahFormat(kolom, nilai);
  const tampil = salah && (!diketik || pernahKeluar);
  return (
    <div className="min-w-0">
      {/* Label tampak saat bertumpuk; di mode tabel kepala kolom yang tampak, label tetap dibaca pembaca layar. */}
      <label htmlFor={id} className="mb-0.5 block text-[11px] font-medium text-fg-muted @xl:sr-only">
        <span className="sr-only">{fase}, </span>
        {L.label}
        <span className="sr-only"> {L.nama},</span> <span className="font-normal text-fg-subtle">{L.satuan}</span>
      </label>
      <input
        id={id}
        value={nilai}
        inputMode={L.mode}
        placeholder={L.contoh}
        autoComplete="off"
        enterKeyHint="next"
        aria-invalid={tampil}
        aria-describedby={tampil ? `${id}-pesan` : undefined}
        onFocus={() => setDiketik(true)}
        onBlur={() => {
          setDiketik(false);
          if (salah) {
            setPernahKeluar(true);
            onSalah();
          }
        }}
        onChange={(e) => onUbah(saringTtv(kolom, e.target.value))}
        className={cn(
          "h-10 w-full min-w-0 rounded-[var(--radius-sm)] border bg-surface px-1.5 text-center text-sm tabular-nums text-fg placeholder:text-fg-subtle/70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 disabled:opacity-70 pointer-coarse:h-11 pointer-coarse:text-base",
          tampil ? "border-danger" : "border-border focus-visible:border-brand",
        )}
      />
      {tampil && (
        <p id={`${id}-pesan`} className="mt-1 text-[11px] leading-snug text-danger">
          {CONTOH_TTV[kolom]}
        </p>
      )}
    </div>
  );
}

/** Ringkasan TTV saat kartu tertutup (4 waktu). */
function RingkasTtv({ k }: { k: KantongRm50 }) {
  return (
    <dl className="grid grid-cols-2 gap-px border-t border-border bg-border @xl:grid-cols-4">
      {FASE_TTV.map((f) => {
        const t = k.ttv[f.id];
        const ok = ttvLengkap(t);
        const ada = KOLOM_TTV.some((c) => !kosong(t[c]));
        return (
          <div key={f.id} className="flex flex-wrap items-baseline gap-x-1.5 bg-surface px-3 py-1.5 text-xs">
            <dt className={cn("font-medium", ok ? "text-success" : "text-fg-subtle")}>{f.singkat}</dt>
            <dd className="tabular-nums text-fg-muted">
              {ada ? (
                KOLOM_TTV.map((c) => t[c] || "…").join(" · ")
              ) : (
                <>
                  <span aria-hidden>—</span>
                  <span className="sr-only">belum diisi</span>
                </>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/* ================================================================= pilihan */

/** Tahun transfusi sebelumnya: ditandai salah hanya setelah 4 angka diketik. */
function KolomTahun({ tahun, waktu, onUbah }: { tahun: string; waktu: string; onUbah: (v: string) => void }) {
  const salah = tahun.length === 4 && !tahunTransfusiSah(tahun, waktu);
  return (
    <div className="mt-3 max-w-[12rem]">
      <LabelKolom htmlFor="rm50-tahun" wajib>
        Tahun
      </LabelKolom>
      <Input
        id="rm50-tahun"
        value={tahun}
        inputMode="numeric"
        maxLength={4}
        placeholder="mis. 2024"
        aria-invalid={salah}
        aria-describedby={salah ? "rm50-tahun-pesan" : undefined}
        onChange={(e) => onUbah(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className={cn(KONTROL, salah && "border-danger")}
      />
      {salah && (
        <p id="rm50-tahun-pesan" className="mt-1 text-xs text-danger">
          Tahun 19xx–20xx, tidak sesudah tahun transfusi ini.
        </p>
      )}
    </div>
  );
}

function pecahGolongan(g: "" | GolonganDarah): { abo: string; rh: "" | "+" | "-" } {
  const m = /^(AB|A|B|O)([+-]?)$/.exec(g);
  return m ? { abo: m[1], rh: m[2] as "" | "+" | "-" } : { abo: "", rh: "" };
}

/** Golongan ABO (4 radio) + rhesus (3 radio, aktif setelah ABO dipilih) → satu nilai referensi SIMGOS ("O+", "AB", …). */
function PilihGolongan({ nilai, onUbah }: { nilai: "" | GolonganDarah; onUbah: (v: "" | GolonganDarah) => void }) {
  const terkunci = useTerkunci();
  const { abo, rh } = pecahGolongan(nilai);
  const susun = (a: string, r: string) => {
    const g = `${a}${r}`;
    onUbah(a && (GOLONGAN_DARAH as readonly string[]).includes(g) ? (g as GolonganDarah) : "");
  };
  return (
    <fieldset id="rm50-golongan" tabIndex={-1} className="m-0 min-w-0 border-0 p-0 outline-none">
      <LegendPilihan asal="golonganDarah">
        Golongan darah <Wajib />
      </LegendPilihan>
      <div className="grid grid-cols-4 gap-1.5">
        {ABO.map((a) => (
          <label
            key={a}
            className={cn(
              "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface text-base font-bold text-fg transition-colors",
              "hover:border-border-strong has-checked:border-danger has-checked:bg-danger-soft has-checked:text-danger",
              "has-focus-visible:ring-2 has-focus-visible:ring-brand-ring has-disabled:cursor-default has-disabled:hover:border-border",
            )}
          >
            <input type="radio" name="rm50-abo" value={a} checked={abo === a} onChange={() => susun(a, rh)} className={cn(KONTROL_PILIHAN, "accent-danger")} />
            {a}
          </label>
        ))}
      </div>
      <fieldset className="m-0 mt-3 min-w-0 border-0 p-0" disabled={!abo || undefined}>
        <LegendPilihan petunjuk={abo ? undefined : "— pilih ABO dulu"}>Rhesus</LegendPilihan>
        <div className="flex flex-wrap gap-1.5">
          {RHESUS.map((r) => (
            <label key={r.id || "x"} className={cn(PIL_PILIHAN, "has-disabled:opacity-60")}>
              <input type="radio" name="rm50-rh" value={r.id} checked={!!abo && rh === r.id} onChange={() => susun(abo, r.id)} className={KONTROL_PILIHAN} />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      {nilai && !terkunci && (
        <button
          type="button"
          onClick={() => onUbah("")}
          className="mt-1.5 rounded-[var(--radius-sm)] px-1 py-0.5 text-xs font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          Kosongkan golongan darah
        </button>
      )}
    </fieldset>
  );
}

function LencanaGolongan({ golongan, besar }: { golongan: "" | GolonganDarah; besar?: boolean }) {
  if (!golongan) {
    return besar ? null : (
      <Badge tone="neutral" dot>
        Golongan darah belum diisi
      </Badge>
    );
  }
  if (besar) {
    return (
      <span
        role="img"
        aria-label={`Golongan darah ${golongan}`}
        className="flex size-12 items-center justify-center rounded-full bg-danger text-lg font-bold text-white shadow-sm"
      >
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

const META_KEADAAN: Record<KeadaanKantong, { ikon: LucideIcon; judul: string; ket: string; kartu: string; radio: string; ikonAktif: string; ikonPasif: string }> = {
  utuh: {
    ikon: PackageCheck,
    judul: "Utuh",
    ket: "Kantong tidak bocor / rusak",
    kartu: "has-checked:border-success has-checked:bg-success-soft",
    radio: "accent-success",
    ikonAktif: "bg-success text-white",
    ikonPasif: "bg-success-soft text-success",
  },
  tidakUtuh: {
    ikon: PackageX,
    judul: "Tidak utuh",
    ket: "Tuliskan keadaannya",
    kartu: "has-checked:border-danger has-checked:bg-danger-soft",
    radio: "accent-danger",
    ikonAktif: "bg-danger text-white",
    ikonPasif: "bg-danger-soft text-danger",
  },
};

/** Kartu radio asli (seluruh kartu = target klik). Terpilih hanya mengubah warna → tata letak tak bergeser. */
function KartuKeadaan({ nilai, dipilih, onPilih }: { nilai: KeadaanKantong; dipilih: boolean; onPilih: () => void }) {
  const m = META_KEADAAN[nilai];
  const Ikon = m.ikon;
  return (
    <label
      data-keadaan={nilai}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] border-2 border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong pointer-coarse:min-h-12",
        "has-focus-visible:ring-2 has-focus-visible:ring-brand-ring has-disabled:cursor-default has-disabled:hover:border-border",
        m.kartu,
      )}
    >
      <input type="radio" name="rm50-keadaan" value={nilai} checked={dipilih} onChange={onPilih} className={cn(KONTROL_PILIHAN, "size-5", m.radio)} />
      <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-full transition-colors", dipilih ? m.ikonAktif : m.ikonPasif)}>
        <Ikon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg">{m.judul}</span>
        <span className="block text-xs text-fg-muted">{m.ket}</span>
      </span>
    </label>
  );
}
