"use client";

import { useState } from "react";
import { Clock, DatabaseZap, DoorOpen, Info, Lock, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DatePicker, DateTimePicker, nowLocalDateTime } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { BidangIsian, KunciIsian, useTerkunci } from "@/features/form-rm/isian/kunci";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import {
  BagianLangkah,
  IsiCepat,
  KONTROL,
  KakiLangkah,
  LabelKolom,
  LencanaLangkah,
  SyaratFinal,
  TOMBOL_KECIL,
  TataLetakLangkah,
  Wajib,
  type ButirSyarat,
  type PilihanCepat,
} from "@/features/form-rm/isian/langkah/bagian";
import type { Langkah } from "@/features/form-rm/isian/langkah/NavLangkah";
import { PilihanRadio } from "@/features/form-rm/isian/langkah/PilihanRadio";
import { hitungAlur } from "@/features/form-rm/persetujuan/alur";
import { KepalaIsian, KonfirmasiGanti, KotakTtd, NilaiKalimat, samaNama } from "@/features/form-rm/persetujuan/bidang";
import { JK_PILIHAN, kosong, umurTahun, type JkPilihan } from "@/features/form-rm/persetujuan/informasi";
import {
  LABEL_SELAKU,
  LANGKAH_RM41,
  RM41_KOTA,
  SELAKU_RM41,
  TEKS_RM41,
  TEKS_SELAKU,
  emptyRm41Form,
  kekuranganRm41,
  pisahWaktu,
  statusLangkahRm41,
  tujuanRm41,
  type IdLangkahRm41,
  type Rm41Data,
  type SelakuRm41,
} from "@/features/form-rm/rm41.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

/* Tata letak isian RM.41 (tampilan pengisian saja — cetak tetap Rm41Document):
 * 4 langkah mengikuti urutan kertas, navigasi langkah lengket (scrollspy),
 * panel "Syarat finalisasi" + kekurangan per langkah yang memindahkan fokus ke
 * kolomnya. Syarat = `kekuranganRm41` (sumber yang sama dengan validasi FINAL
 * server). Path kolom tak berubah → simpan, penanda SIMRS, aturan TTD
 * (`cekTtdRm41`), dan cetak tetap. */

const idL = (id: IdLangkahRm41) => `rm41-langkah-${id}`;

/** Nama langkah di navigasi. */
const NAV: Record<IdLangkahRm41, { judul: string; singkat: string }> = {
  pernyata: { judul: "Yang menyatakan", singkat: "Menyatakan" },
  pasien: { judul: "Data pasien", singkat: "Pasien" },
  alasan: { judul: "Alasan & pernyataan", singkat: "Alasan" },
  ttd: { judul: "Waktu & tanda tangan", singkat: "TTD" },
};

const siapkan = (data: unknown): Rm41Data => ({ ...emptyRm41Form(), ...((data && typeof data === "object" ? data : {}) as Partial<Rm41Data>) });

const MAKS_ALASAN = 300;

/** Textarea: tinggi mengikuti isi (field-sizing; peramban lama tetap tinggi minimum + gulir). */
const TEXTAREA = cn(
  "block w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg [field-sizing:content]",
  "placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 pointer-coarse:text-base",
);

const tujuan = (id: IdLangkahRm41, pesan: string) => tujuanRm41(pesan) ?? idL(id);
const ringkasKurang = (kurang: readonly string[]) =>
  kurang.slice(0, 2).join(", ") + (kurang.length > 2 ? ` +${kurang.length - 2} lagi` : "");

export function Rm41FormView({ isian, header, izin }: { isian: IsianForm; header: FormRmHeader; izin: IzinIsian }) {
  const k = useIsian(isian, izin, siapkan);
  const { form, setForm } = k;
  const [gantiKe, setGantiKe] = useState<SelakuRm41 | null>(null);

  const set = <K extends keyof Rm41Data>(key: K, value: Rm41Data[K]) => setForm((f) => ({ ...f, [key]: value }));

  const kurang = kekuranganRm41(form);
  const alur = hitungAlur(LANGKAH_RM41, kurang, (id, x) => statusLangkahRm41(form, id, x), k.terkunci);
  const waktu = pisahWaktu(form.waktu);
  const pasienNamaHeader = header.nama === "—" ? "" : header.nama;
  const namaPasien = form.pasienNama || pasienNamaHeader;
  const umurPasien = umurTahun(header.umur);
  const asal = k.isian.asal ?? {};
  /** SIMRS mencatat kepulangan APS (waktu & petugas terisi dari sana). */
  const apsSimrs = asal.waktu?.sumber === "pulang";
  /** Nilai SIMRS saat kolom diisi otomatis ("" bila tak ada / bukan teks). */
  const nilaiSimrs = (path: keyof Rm41Data) => {
    const v = asal[path]?.nilai;
    return typeof v === "string" ? v : "";
  };
  const ttdKonteks = (peran: string) => [namaPasien, `RM.41 — ${peran}`].filter(Boolean).join(" · ");
  // Daftar syarat hanya untuk yang bisa mengisi (DRAF & tidak terkunci).
  const draf = isian.status === "DRAF" && !k.terkunci;

  const langkah: Langkah[] = LANGKAH_RM41.map((l, i) => {
    const st = alur.status[l.id];
    const n = kurang[l.id].length;
    const ket = st === "lengkap" ? "Lengkap" : st === "sebagian" ? `${n} belum lengkap` : "Belum diisi";
    return {
      id: idL(l.id),
      no: i + 1,
      judul: NAV[l.id].judul,
      singkat: NAV[l.id].singkat,
      status: st,
      ket: alur.aktif === l.id ? `Berikutnya · ${ket}` : ket,
    };
  });
  const butir: ButirSyarat[] = LANGKAH_RM41.map((l, i) => ({
    kunci: l.id,
    label: `${i + 1}. ${NAV[l.id].judul}`,
    ok: kurang[l.id].length === 0,
    tujuan: kurang[l.id].length ? tujuan(l.id, kurang[l.id][0]) : idL(l.id),
    ket: kurang[l.id].length ? ringkasKurang(kurang[l.id]) : undefined,
  }));

  /** Kartu langkah + kaki (kekurangan yang bisa diklik, "Lanjut"). */
  const props = (id: IdLangkahRm41) => {
    const i = LANGKAH_RM41.findIndex((l) => l.id === id);
    const berikut = LANGKAH_RM41[i + 1];
    return {
      kartu: {
        id: idL(id),
        no: i + 1,
        sorot: alur.aktif === id,
        lencana: <LencanaLangkah status={alur.status[id]} kurang={kurang[id].length} berikutnya={alur.aktif === id} />,
      },
      kaki: (
        <KakiLangkah
          kurang={kurang[id].map((p) => ({ label: p, tujuan: tujuan(id, p) }))}
          tampilKurang={alur.status[id] !== "kosong"}
          lanjut={berikut && { id: idL(berikut.id), judul: NAV[berikut.id].judul }}
        />
      ),
    };
  };
  const p = { pernyata: props("pernyata"), pasien: props("pasien"), alasan: props("alasan"), ttd: props("ttd") };

  /* ------------------------------------------------------------- perubahan */

  /**
   * "Diri sendiri" menyalin nama & umur pasien bila identitas masih kosong;
   * berpindah dari diri sendiri ke keluarga mengosongkan nama & umur salinan
   * itu (alamat dibiarkan: keluarga umumnya serumah).
   */
  function terapkanSelaku(f: Rm41Data, x: SelakuRm41): Rm41Data {
    const nama = f.pasienNama || pasienNamaHeader;
    if (x === "diri" && kosong(f.pernyataNama) && kosong(f.pernyataUmur)) {
      return { ...f, selaku: x, pernyataNama: nama, pernyataUmur: umurPasien };
    }
    if (f.selaku === "diri" && x !== "diri" && samaNama(f.pernyataNama, nama)) {
      return { ...f, selaku: x, pernyataNama: "", pernyataUmur: "" };
    }
    return { ...f, selaku: x };
  }

  /** TTD yang menyatakan terikat pada pilihan "Selaku …" → mengganti mengosongkannya (dengan konfirmasi). */
  function pilihSelaku(x: SelakuRm41) {
    if (form.selaku === x) return;
    if (form.pernyataTtd !== "" && form.selaku !== "") setGantiKe(x);
    else setForm((f) => terapkanSelaku(f, x));
  }
  function konfirmasiGanti() {
    if (!gantiKe) return;
    setForm((f) => ({ ...terapkanSelaku(f, gantiKe), pernyataTtd: "" }));
    setGantiKe(null);
  }

  /* --------------------------------------------------------- isi cepat */

  const diri = form.selaku === "diri";
  const cepatNama: PilihanCepat[] =
    diri && namaPasien && !samaNama(form.pernyataNama, namaPasien)
      ? [{ kunci: "pasien", ket: "Nama pasien", nilai: namaPasien, pilih: () => set("pernyataNama", namaPasien) }]
      : [];
  const cepatUmur: PilihanCepat[] =
    diri && umurPasien && form.pernyataUmur !== umurPasien
      ? [{ kunci: "pasien", ket: "Umur pasien", nilai: `${umurPasien} th`, pilih: () => set("pernyataUmur", umurPasien) }]
      : [];
  const alamatSimrs = nilaiSimrs("pernyataAlamat");
  const cepatAlamat: PilihanCepat[] =
    alamatSimrs && form.pernyataAlamat.trim() !== alamatSimrs.trim()
      ? [{ kunci: "simrs", ket: "Alamat pasien (SIMRS)", nilai: alamatSimrs, pilih: () => set("pernyataAlamat", alamatSimrs) }]
      : [];
  const waktuSimrs = nilaiSimrs("waktu");
  const ws = pisahWaktu(waktuSimrs);
  const cepatWaktu: PilihanCepat[] =
    apsSimrs && ws.tanggal && form.waktu !== waktuSimrs
      ? [{ kunci: "simrs", ket: "Waktu pulang di SIMRS", nilai: `${ws.tanggal}, ${ws.jam}`, pilih: () => set("waktu", waktuSimrs) }]
      : [];
  const petugasSimrs = nilaiSimrs("petugasNama");
  const cepatPetugas: PilihanCepat[] =
    petugasSimrs && !samaNama(form.petugasNama, petugasSimrs)
      ? [{ kunci: "simrs", ket: "Petugas di SIMRS", nilai: petugasSimrs, pilih: () => set("petugasNama", petugasSimrs) }]
      : [];

  return (
    <IsianFrame
      kendali={k}
      aksen={
        <span className="inline-flex items-center gap-2">
          <LencanaSelaku selaku={form.selaku} ringkas />
          <span className="tabular-nums">
            {alur.jumlahLengkap}/{LANGKAH_RM41.length} langkah
          </span>
        </span>
      }
    >
      <TataLetakLangkah langkah={langkah} samping={draf && <SyaratFinal butir={butir} idJudul="rm41-syarat-judul" />}>
        <KepalaIsian
          header={header}
          urutan={isian.urutan}
          lencana={
            <>
              <Badge tone="warning">
                <DoorOpen className="size-3.5" aria-hidden />
                Pulang atas permintaan sendiri
              </Badge>
              {apsSimrs && (
                <Badge tone="brand">
                  <DatabaseZap className="size-3.5" aria-hidden />
                  Tercatat di SIMRS
                </Badge>
              )}
            </>
          }
          subjekLabel="Pernyataan"
          subjek={[waktu.tanggal, waktu.jam && `pukul ${waktu.jam} WITA`].filter(Boolean).join(", ")}
        />

        {/* 1 — Yang menyatakan */}
        <BagianLangkah
          {...p.pernyata.kartu}
          judul="Yang bertanda tangan"
          ket="Pilih dulu siapa yang menyatakan: pasien sendiri atau keluarganya. Pasien sendiri → nama & umur terisi dari data pasien."
          aksi={<LencanaSelaku selaku={form.selaku} />}
        >
          <BidangIsian className="space-y-5">
            <div>
              <PilihanRadio
                id="rm41-selaku"
                ringkas
                legend={
                  <>
                    Selaku … dari pasien <Wajib />
                  </>
                }
                keterangan="Tanda tangan yang menyatakan terikat pada pilihan ini."
                value={form.selaku}
                onChange={(v) => pilihSelaku(v as SelakuRm41)}
                opsi={SELAKU_RM41.map((x) => ({ value: x, label: LABEL_SELAKU[x] }))}
              />
              {gantiKe ? (
                <KonfirmasiGanti id="rm41-ganti-judul" label="Ganti" onBatal={() => setGantiKe(null)} onYa={konfirmasiGanti}>
                  Ganti menjadi <b>{LABEL_SELAKU[gantiKe].toLowerCase()}</b>? Tanda tangan yang menyatakan akan dihapus dan harus dibuat ulang.
                </KonfirmasiGanti>
              ) : (
                <p className="mt-2 rounded-[var(--radius-md)] bg-surface-2/60 px-3 py-2 text-xs text-fg-muted">
                  Tercetak: “Selaku{" "}
                  {SELAKU_RM41.map((x, i) => (
                    <span key={x}>
                      {i > 0 && " / "}
                      <span
                        className={
                          form.selaku && form.selaku !== x ? "line-through opacity-60" : form.selaku === x ? "font-semibold text-fg" : undefined
                        }
                      >
                        {TEKS_SELAKU[x]}
                      </span>
                    </span>
                  ))}{" "}
                  dari pasien”{form.selaku ? " — pilihan lain dicoret." : "."}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-4 @xl:grid-cols-[minmax(0,2fr)_8rem]">
              <div className="min-w-0">
                <LabelKolom htmlFor="rm41-nama" wajib>
                  Nama
                </LabelKolom>
                <Input
                  id="rm41-nama"
                  value={form.pernyataNama}
                  maxLength={120}
                  onChange={(e) => set("pernyataNama", e.target.value)}
                  placeholder={form.selaku && !diri ? `Nama ${LABEL_SELAKU[form.selaku].toLowerCase()} pasien` : "Nama lengkap"}
                  autoComplete="off"
                  enterKeyHint="next"
                  className={KONTROL}
                />
                <IsiCepat pilihan={cepatNama} />
              </div>
              <div>
                <LabelKolom htmlFor="rm41-umur" wajib>
                  Umur (tahun)
                </LabelKolom>
                <Input
                  id="rm41-umur"
                  value={form.pernyataUmur}
                  inputMode="numeric"
                  maxLength={3}
                  onChange={(e) => set("pernyataUmur", e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="mis. 45"
                  autoComplete="off"
                  enterKeyHint="next"
                  className={KONTROL}
                />
                <IsiCepat pilihan={cepatUmur} />
              </div>
              <div className="@xl:col-span-2">
                <LabelKolom htmlFor="rm41-alamat" asal="pernyataAlamat" wajib>
                  Alamat
                </LabelKolom>
                <textarea
                  id="rm41-alamat"
                  rows={2}
                  value={form.pernyataAlamat}
                  maxLength={300}
                  onChange={(e) => set("pernyataAlamat", e.target.value)}
                  placeholder="Jalan, desa/kelurahan, kecamatan, kabupaten"
                  aria-describedby="rm41-alamat-ket"
                  className={cn(TEXTAREA, "min-h-[4.25rem] max-h-[12rem]")}
                />
                <p id="rm41-alamat-ket" className="mt-1.5 text-xs text-fg-subtle">
                  Terisi alamat pasien dari SIMRS — ubah bila yang menyatakan tinggal di alamat lain.
                </p>
                <IsiCepat pilihan={cepatAlamat} />
              </div>
            </div>
          </BidangIsian>
          {p.pernyata.kaki}
        </BagianLangkah>

        {/* 2 — Data pasien */}
        <BagianLangkah
          {...p.pasien.kartu}
          judul="Data pasien"
          ket="Terisi otomatis dari SIMRS. Cocokkan dengan gelang identitas pasien sebelum ditandatangani."
        >
          <BidangIsian>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 @xl:grid-cols-2 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <LabelKolom htmlFor="rm41-pasien-nama" asal="pasienNama" wajib>
                  Nama
                </LabelKolom>
                <Input
                  id="rm41-pasien-nama"
                  value={form.pasienNama}
                  maxLength={120}
                  onChange={(e) => set("pasienNama", e.target.value)}
                  placeholder="Nama pasien"
                  autoComplete="off"
                  enterKeyHint="next"
                  className={KONTROL}
                />
              </div>
              <PilihanRadio
                id="rm41-pasien-jk"
                ringkas
                legend={
                  <>
                    Jenis kelamin (L / P) <Wajib />
                  </>
                }
                asal="pasienJk"
                value={form.pasienJk}
                onChange={(v) => set("pasienJk", v as "" | JkPilihan)}
                opsi={JK_PILIHAN.map((x) => ({ value: x, label: x }))}
                bolehKosong
              />
              <div className="min-w-0">
                <LabelKolom htmlFor="rm41-pasien-lahir" asal="pasienTglLahir" wajib>
                  Tanggal lahir
                </LabelKolom>
                <DatePicker id="rm41-pasien-lahir" value={form.pasienTglLahir} onChange={(v) => set("pasienTglLahir", v)} placeholder="Pilih tanggal" />
              </div>
              <div className="min-w-0">
                <LabelKolom htmlFor="rm41-pasien-norm" asal="pasienNorm" wajib>
                  Nomor RM
                </LabelKolom>
                <Input
                  id="rm41-pasien-norm"
                  value={form.pasienNorm}
                  inputMode="numeric"
                  maxLength={12}
                  onChange={(e) => set("pasienNorm", e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="No. RM"
                  autoComplete="off"
                  spellCheck={false}
                  className={cn(KONTROL, "font-mono")}
                />
              </div>
            </div>
          </BidangIsian>
          {p.pasien.kaki}
        </BagianLangkah>

        {/* 3 — Alasan & pernyataan */}
        <BagianLangkah
          {...p.alasan.kartu}
          judul="Alasan & pernyataan"
          ket="Tulis alasan pasien / keluarga meminta pulang, lalu bacakan empat butir pernyataan sebelum ditandatangani."
        >
          <BidangIsian>
            <div className="grid grid-cols-1 gap-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
              <div className="min-w-0">
                <LabelKolom htmlFor="rm41-alasan" wajib>
                  Alasan pulang atas permintaan sendiri
                </LabelKolom>
                <textarea
                  id="rm41-alasan"
                  rows={4}
                  value={form.alasan}
                  maxLength={MAKS_ALASAN}
                  onChange={(e) => set("alasan", e.target.value)}
                  placeholder="Tulis alasan sesuai yang disampaikan pasien / keluarga"
                  aria-describedby="rm41-alasan-hitung rm41-alasan-ket"
                  className={cn(TEXTAREA, "min-h-28 max-h-72 resize-y")}
                />
                <p
                  id="rm41-alasan-hitung"
                  className={cn("mt-1 text-right text-xs tabular-nums", form.alasan.length >= MAKS_ALASAN ? "text-warning" : "text-fg-subtle")}
                >
                  {form.alasan.length}/{MAKS_ALASAN} karakter
                </p>
                <p id="rm41-alasan-ket" className="mt-2 flex items-start gap-2 rounded-[var(--radius-md)] bg-brand-soft/50 px-3 py-2 text-xs text-fg-muted">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
                  Butir 2 dan 4 menyatakan rumah sakit telah menjelaskan penyakit, konsekuensi keputusan, dan alternatif pengobatan —
                  pastikan penjelasan itu sudah diberikan.
                </p>
              </div>
              <figure className="m-0 rounded-[var(--radius-md)] border border-dashed border-border bg-surface-2/40 px-4 py-3">
                <figcaption className="mb-2 text-xs font-semibold text-fg-muted">{TEKS_RM41.menyatakan}</figcaption>
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-fg-muted marker:font-semibold marker:text-fg">
                  <li>
                    {TEKS_RM41.butir1Awal} <b className="text-fg">{TEKS_RM41.aps}</b> {TEKS_RM41.butir1Akhir}{" "}
                    <NilaiKalimat nilai={form.alasan.trim()} kosongTeks="alasan" />.
                  </li>
                  <li>{TEKS_RM41.butir2}</li>
                  <li>{TEKS_RM41.butir3}</li>
                  <li>{TEKS_RM41.butir4}</li>
                </ol>
                <p className="mt-2 text-sm text-fg-muted">{TEKS_RM41.penutup}</p>
              </figure>
            </div>
          </BidangIsian>
          {p.alasan.kaki}
        </BagianLangkah>

        {/* 4 — Waktu & tanda tangan */}
        <BagianLangkah
          {...p.ttd.kartu}
          judul="Waktu & tanda tangan"
          ket="Tanggal & jam pernyataan, lalu tanda tangan petugas RS, saksi, dan yang menyatakan (urutan kolom seperti kertas)."
        >
          {draf && <SyaratFinal butir={butir} idJudul="rm41-syarat-judul-ponsel" className="mb-5 xl:hidden" />}
          <BidangIsian>
            <KolomWaktuKota value={form.waktu} onChange={(v) => set("waktu", v)} cepat={cepatWaktu} />

            <div className="mt-5 grid grid-cols-1 gap-4 @3xl:grid-cols-3">
              <KotakTtd ikon={ShieldCheck} peran="Petugas RS" nama={form.petugasNama} sudah={form.petugasTtd !== ""} idTtd="rm41-ttd-petugas">
                <div className="mb-3">
                  <LabelKolom htmlFor="rm41-petugas" asal="petugasNama" wajib>
                    Nama jelas petugas
                  </LabelKolom>
                  <Input
                    id="rm41-petugas"
                    value={form.petugasNama}
                    maxLength={120}
                    onChange={(e) => set("petugasNama", e.target.value)}
                    placeholder="Nama petugas"
                    autoComplete="off"
                    enterKeyHint="next"
                    className={KONTROL}
                  />
                  <IsiCepat pilihan={cepatPetugas} />
                  <SaranNamaSaya nama={form.petugasNama} onPilih={(v) => set("petugasNama", v)} />
                </div>
                <SignaturePad
                  label="Tanda tangan petugas RS"
                  value={form.petugasTtd}
                  onChange={(v) => set("petugasTtd", v)}
                  context={ttdKonteks("Petugas RS")}
                  petugas={{ nama: form.petugasNama, onNama: (v) => set("petugasNama", v), isiNamaOtomatis: true }}
                />
              </KotakTtd>
              <KotakTtd ikon={UsersRound} peran="Saksi" nama={form.saksiNama} sudah={form.saksiTtd !== ""} idTtd="rm41-ttd-saksi">
                <div className="mb-3">
                  <LabelKolom htmlFor="rm41-saksi" wajib>
                    Nama jelas saksi
                  </LabelKolom>
                  <Input
                    id="rm41-saksi"
                    value={form.saksiNama}
                    maxLength={120}
                    onChange={(e) => set("saksiNama", e.target.value)}
                    placeholder="mis. perawat atau keluarga"
                    autoComplete="off"
                    enterKeyHint="next"
                    className={KONTROL}
                  />
                  <SaranNamaSaya nama={form.saksiNama} onPilih={(v) => set("saksiNama", v)} />
                </div>
                <SignaturePad
                  label="Tanda tangan saksi"
                  value={form.saksiTtd}
                  onChange={(v) => set("saksiTtd", v)}
                  context={ttdKonteks("Saksi")}
                  petugas={{ nama: form.saksiNama, onNama: (v) => set("saksiNama", v) }}
                />
              </KotakTtd>
              <KotakTtd
                ikon={UserRound}
                peran="Saya yang menyatakan"
                nama={form.pernyataNama}
                kosongNama="Isi nama di langkah 1"
                sudah={form.pernyataTtd !== ""}
                idTtd="rm41-ttd-pernyata"
              >
                {!form.selaku && (
                  <p className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-fg">
                    <Lock className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                    Pilih “Selaku …” di langkah 1 lebih dulu — tanda tangan terikat padanya.
                  </p>
                )}
                <KunciIsian terkunci={k.terkunci || !form.selaku}>
                  <BidangIsian>
                    <SignaturePad
                      label="Tanda tangan yang menyatakan"
                      value={form.pernyataTtd}
                      onChange={(v) => set("pernyataTtd", v)}
                      context={ttdKonteks(form.selaku ? `Yang menyatakan (${LABEL_SELAKU[form.selaku].toLowerCase()})` : "Yang menyatakan")}
                    />
                  </BidangIsian>
                </KunciIsian>
              </KotakTtd>
            </div>
          </BidangIsian>
          {p.ttd.kaki}
        </BagianLangkah>
      </TataLetakLangkah>
    </IsianFrame>
  );
}

/* ================================================================ bagian */

/** "Modayag, [tanggal], Jam : [jam] WITA" — tanggal & jam + "Sekarang" + isi cepat SIMRS. */
function KolomWaktuKota({ value, onChange, cepat }: { value: string; onChange: (v: string) => void; cepat: readonly PilihanCepat[] }) {
  const terkunci = useTerkunci();
  return (
    <div>
      <LabelKolom htmlFor="rm41-waktu" asal="waktu" wajib>
        Tempat, tanggal &amp; jam (WITA)
      </LabelKolom>
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-sm text-fg-muted">{RM41_KOTA},</span>
        <div className="min-w-0 flex-1 @md:max-w-xs">
          <DateTimePicker id="rm41-waktu" value={value} onChange={onChange} placeholder="Pilih tanggal & jam" />
        </div>
        {!terkunci && !value && (
          <button type="button" onClick={() => onChange(nowLocalDateTime())} className={cn(TOMBOL_KECIL, "h-10")}>
            <Clock className="size-3.5" aria-hidden />
            Sekarang
          </button>
        )}
      </div>
      <IsiCepat pilihan={cepat} />
    </div>
  );
}

/* ================================================================ lencana */

function LencanaSelaku({ selaku, ringkas }: { selaku: Rm41Data["selaku"]; ringkas?: boolean }) {
  if (!selaku) {
    return (
      <Badge tone="warning" dot>
        {ringkas ? "Selaku belum dipilih" : "Yang menyatakan belum dipilih"}
      </Badge>
    );
  }
  const diri = selaku === "diri";
  const Ikon = diri ? UserRound : UsersRound;
  return (
    <Badge tone={diri ? "brand" : "neutral"}>
      <Ikon className="size-3.5" aria-hidden />
      {diri ? "Pasien sendiri" : `${LABEL_SELAKU[selaku]} pasien`}
    </Badge>
  );
}
