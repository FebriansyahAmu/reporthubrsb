"use client";

import { useState } from "react";
import { Check, DatabaseZap, DoorOpen, Info, Lock, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DatePicker, DateTimePicker, nowLocalDateTime } from "@/components/ui/DatePicker";
import { Input, Label } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { BidangIsian, KunciIsian } from "@/features/form-rm/isian/kunci";
import { LabelAsal } from "@/features/form-rm/isian/TandaAsal";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import { hitungAlur, Langkah, NavAlur, RingkasanKekurangan } from "@/features/form-rm/persetujuan/alur";
import { KepalaIsian, KonfirmasiGanti, KotakTtd, NilaiKalimat, PilihJk, samaNama, Saran } from "@/features/form-rm/persetujuan/bidang";
import { kosong, umurTahun } from "@/features/form-rm/persetujuan/informasi";
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
  type Rm41Data,
  type SelakuRm41,
} from "@/features/form-rm/rm41.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

const siapkan = (data: unknown): Rm41Data => ({ ...emptyRm41Form(), ...((data && typeof data === "object" ? data : {}) as Partial<Rm41Data>) });

const MAKS_ALASAN = 300;

const TEXTAREA =
  "block w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40";

export function Rm41FormView({ isian, header, izin }: { isian: IsianForm; header: FormRmHeader; izin: IzinIsian }) {
  const k = useIsian(isian, izin, siapkan);
  const { form, setForm } = k;
  const [gantiKe, setGantiKe] = useState<SelakuRm41 | null>(null);

  const set = <K extends keyof Rm41Data>(key: K, value: Rm41Data[K]) => setForm((f) => ({ ...f, [key]: value }));

  const kurang = kekuranganRm41(form);
  const alur = hitungAlur(LANGKAH_RM41, kurang, (id, x) => statusLangkahRm41(form, id, x), k.terkunci);
  const waktu = pisahWaktu(form.waktu);
  const pasienNamaHeader = header.nama === "—" ? "" : header.nama;
  const asal = k.isian.asal ?? {};
  /** SIMRS mencatat kepulangan APS (waktu & petugas terisi dari sana). */
  const apsSimrs = asal.waktu?.sumber === "pulang";
  /** Nilai kolom masih sama dengan isi SIMRS (belum diubah petugas). */
  const masihSimrs = (path: "waktu" | "pernyataAlamat") => asal[path] !== undefined && asal[path].nilai === form[path];
  const ttdKonteks = (peran: string) => [form.pasienNama || pasienNamaHeader, `RM.41 — ${peran}`].filter(Boolean).join(" · ");

  /* ------------------------------------------------------------- perubahan */

  /**
   * "Diri sendiri" menyalin nama & umur pasien bila identitas masih kosong;
   * berpindah dari diri sendiri ke keluarga mengosongkan nama & umur salinan
   * itu (alamat dibiarkan: keluarga umumnya serumah).
   */
  function terapkanSelaku(f: Rm41Data, x: SelakuRm41): Rm41Data {
    const namaPasien = f.pasienNama || pasienNamaHeader;
    if (x === "diri" && kosong(f.pernyataNama) && kosong(f.pernyataUmur)) {
      return { ...f, selaku: x, pernyataNama: namaPasien, pernyataUmur: umurTahun(header.umur) };
    }
    if (f.selaku === "diri" && x !== "diri" && samaNama(f.pernyataNama, namaPasien)) {
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
              <span title="Waktu pulang & petugas diambil dari pencatatan pasien pulang SIMRS (cara keluar: pulang paksa)">
                <Badge tone="brand">
                  <DatabaseZap className="size-3.5" aria-hidden />
                  Tercatat di SIMRS
                </Badge>
              </span>
            )}
          </>
        }
        subjekLabel="Pernyataan"
        subjek={[waktu.tanggal, waktu.jam && `pukul ${waktu.jam} WITA`].filter(Boolean).join(", ")}
      />

      <NavAlur langkah={LANGKAH_RM41} status={alur.status} aktif={alur.aktif} />

      <BidangIsian className="space-y-5">
        {/* 1 — Yang menyatakan */}
        <Langkah {...alur.props("pernyata")} judul="Yang Bertanda Tangan"
          desc="Pilih dulu siapa yang menyatakan: pasien sendiri, atau keluarganya. Pasien sendiri → nama & umur terisi dari data pasien."
          kanan={<LencanaSelaku selaku={form.selaku} />}>
          <div className="space-y-5">
            <div>
              <p className="mb-1.5 text-xs font-medium text-fg-muted">Selaku … dari pasien</p>
              <div role="radiogroup" aria-label="Selaku" className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {SELAKU_RM41.map((x) => (
                  <PilihSelaku key={x} selaku={x} dipilih={form.selaku === x} onPilih={() => pilihSelaku(x)} />
                ))}
              </div>
              {gantiKe ? (
                <KonfirmasiGanti id="rm41-ganti-judul" label="Ganti" onBatal={() => setGantiKe(null)} onYa={konfirmasiGanti}>
                  Ganti menjadi <b>{LABEL_SELAKU[gantiKe].toLowerCase()}</b>? Tanda tangan yang menyatakan akan dihapus dan harus dibuat ulang.
                </KonfirmasiGanti>
              ) : (
                <p className="mt-2 text-xs text-fg-muted">
                  Tercetak: “Selaku{" "}
                  {SELAKU_RM41.map((x, i) => (
                    <span key={x}>
                      {i > 0 && " / "}
                      <span className={form.selaku && form.selaku !== x ? "line-through opacity-60" : form.selaku === x ? "font-semibold text-fg" : undefined}>
                        {TEKS_SELAKU[x]}
                      </span>
                    </span>
                  ))}{" "}
                  dari pasien” — pilihan lain dicoret.
                </p>
              )}
            </div>

            <fieldset className="min-w-0">
              <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Yang bertanda tangan di bawah ini</legend>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,2fr)_8rem]">
                <div className="min-w-0">
                  <Label htmlFor="rm41-nama">Nama</Label>
                  <Input id="rm41-nama" value={form.pernyataNama} maxLength={120} onChange={(e) => set("pernyataNama", e.target.value)}
                    placeholder={form.selaku && form.selaku !== "diri" ? `Nama ${LABEL_SELAKU[form.selaku].toLowerCase()} pasien` : "Nama lengkap"} />
                </div>
                <div>
                  <Label htmlFor="rm41-umur">Umur (tahun)</Label>
                  <Input id="rm41-umur" value={form.pernyataUmur} inputMode="numeric" maxLength={3}
                    onChange={(e) => set("pernyataUmur", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="mis. 45" />
                </div>
                <div className="sm:col-span-2">
                  <LabelAsal path="pernyataAlamat" htmlFor="rm41-alamat">Alamat</LabelAsal>
                  <textarea id="rm41-alamat" rows={2} value={form.pernyataAlamat} maxLength={300}
                    onChange={(e) => set("pernyataAlamat", e.target.value)} placeholder="Alamat lengkap" className={TEXTAREA} />
                  {masihSimrs("pernyataAlamat") && (
                    <p className="mt-1.5 text-xs text-fg-subtle">Terisi alamat pasien dari SIMRS — ubah bila yang menyatakan tinggal di alamat lain.</p>
                  )}
                </div>
              </div>
              {form.selaku === "diri" && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/40 px-3 py-2 text-[13px] text-fg-muted">
                  <span>Yang menyatakan = pasien sendiri.</span>
                  <Button type="button" size="sm" variant="secondary"
                    onClick={() => setForm((f) => ({ ...f, pernyataNama: f.pasienNama || pasienNamaHeader, pernyataUmur: umurTahun(header.umur) }))}>
                    Isi ulang dari data pasien
                  </Button>
                </div>
              )}
            </fieldset>
          </div>
        </Langkah>

        {/* 2 — Data pasien */}
        <Langkah {...alur.props("pasien")} judul="Data Pasien"
          desc="Terisi otomatis dari SIMRS. Cocokkan dengan gelang identitas pasien sebelum ditandatangani.">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <LabelAsal path="pasienNama" htmlFor="rm41-pasien-nama">Nama</LabelAsal>
              <Input id="rm41-pasien-nama" value={form.pasienNama} maxLength={120} onChange={(e) => set("pasienNama", e.target.value)} placeholder="Nama pasien" />
            </div>
            <div>
              <LabelAsal path="pasienJk" htmlFor="rm41-pasien-jk">Jenis kelamin (L / P)</LabelAsal>
              <PilihJk id="rm41-pasien-jk" nilai={form.pasienJk} onUbah={(v) => set("pasienJk", v)} />
            </div>
            <div>
              <LabelAsal path="pasienTglLahir" htmlFor="rm41-pasien-lahir">Tanggal lahir</LabelAsal>
              <DatePicker id="rm41-pasien-lahir" value={form.pasienTglLahir} onChange={(v) => set("pasienTglLahir", v)} placeholder="Pilih tanggal" />
            </div>
            <div>
              <LabelAsal path="pasienNorm" htmlFor="rm41-pasien-norm">Nomor RM</LabelAsal>
              <Input id="rm41-pasien-norm" value={form.pasienNorm} inputMode="numeric" maxLength={12} className="font-mono"
                onChange={(e) => set("pasienNorm", e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="No. RM" />
            </div>
          </div>
        </Langkah>

        {/* 3 — Alasan & pernyataan */}
        <Langkah {...alur.props("alasan")} judul="Alasan & Pernyataan"
          desc="Tulis alasan pasien / keluarga meminta pulang, lalu bacakan empat butir pernyataan sebelum ditandatangani.">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <div className="min-w-0">
              <Label htmlFor="rm41-alasan">Alasan pulang atas permintaan sendiri</Label>
              <textarea id="rm41-alasan" rows={4} value={form.alasan} maxLength={MAKS_ALASAN}
                onChange={(e) => set("alasan", e.target.value)} placeholder="Tulis alasan sesuai yang disampaikan pasien / keluarga"
                className={cn(TEXTAREA, "resize-y")} />
              <p className={cn("mt-1 text-right text-xs tabular-nums", form.alasan.length >= MAKS_ALASAN ? "text-warning" : "text-fg-subtle")}>
                {form.alasan.length}/{MAKS_ALASAN}
              </p>
              <p className="mt-2 flex items-start gap-2 rounded-[var(--radius-md)] bg-brand-soft/50 px-3 py-2 text-xs text-fg-muted">
                <Info className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
                Butir 2 dan 4 menyatakan rumah sakit telah menjelaskan penyakit, konsekuensi keputusan, dan alternatif pengobatan — pastikan
                penjelasan itu sudah diberikan.
              </p>
            </div>
            <figure className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface-2/40 px-4 py-3">
              <figcaption className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{TEKS_RM41.menyatakan}</figcaption>
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
        </Langkah>

        {/* 4 — Waktu & tanda tangan */}
        <Langkah {...alur.props("ttd")} judul="Waktu & Tanda Tangan"
          desc="Tanggal & jam pernyataan, lalu tanda tangan petugas RS, saksi, dan yang menyatakan (urutan kolom seperti kertas).">
          <div className="mb-5 sm:max-w-md">
            <LabelAsal path="waktu" htmlFor="rm41-waktu">Tempat, tanggal & jam (WITA)</LabelAsal>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-fg-muted">{RM41_KOTA},</span>
              <div className="min-w-0 flex-1">
                <DateTimePicker id="rm41-waktu" value={form.waktu} onChange={(v) => set("waktu", v)} placeholder="Pilih tanggal & jam" />
              </div>
            </div>
            {!form.waktu && <Saran onClick={() => set("waktu", nowLocalDateTime())}>Isi waktu sekarang</Saran>}
            {apsSimrs && masihSimrs("waktu") && <p className="mt-1.5 text-xs text-fg-subtle">Terisi waktu pasien dipulangkan di SIMRS.</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KotakTtd ikon={ShieldCheck} peran="Petugas RS" nama={form.petugasNama}>
              <LabelAsal path="petugasNama" htmlFor="rm41-petugas">Nama jelas</LabelAsal>
              <Input id="rm41-petugas" value={form.petugasNama} maxLength={120} onChange={(e) => set("petugasNama", e.target.value)}
                placeholder="Nama petugas" className="mb-3" />
              <SignaturePad label="Tanda tangan petugas RS" value={form.petugasTtd} onChange={(v) => set("petugasTtd", v)} context={ttdKonteks("Petugas RS")} />
            </KotakTtd>
            <KotakTtd ikon={UsersRound} peran="Saksi" nama={form.saksiNama}>
              <Label htmlFor="rm41-saksi">Nama jelas</Label>
              <Input id="rm41-saksi" value={form.saksiNama} maxLength={120} onChange={(e) => set("saksiNama", e.target.value)}
                placeholder="Nama saksi" className="mb-3" />
              <SignaturePad label="Tanda tangan saksi" value={form.saksiTtd} onChange={(v) => set("saksiTtd", v)} context={ttdKonteks("Saksi")} />
            </KotakTtd>
            <KotakTtd ikon={UserRound} peran="Saya yang menyatakan" nama={form.pernyataNama} kosongNama="Isi nama di langkah 1">
              {!form.selaku && (
                <p className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-fg">
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                  Pilih “Selaku …” di langkah 1 lebih dulu — tanda tangan terikat padanya.
                </p>
              )}
              <KunciIsian terkunci={k.terkunci || !form.selaku}>
                <BidangIsian>
                  <SignaturePad label="Tanda tangan yang menyatakan" value={form.pernyataTtd} onChange={(v) => set("pernyataTtd", v)}
                    context={ttdKonteks(form.selaku ? `Yang menyatakan (${LABEL_SELAKU[form.selaku].toLowerCase()})` : "Yang menyatakan")} />
                </BidangIsian>
              </KunciIsian>
            </KotakTtd>
          </div>
        </Langkah>
      </BidangIsian>

      <RingkasanKekurangan langkah={LANGKAH_RM41} kurang={kurang} terkunci={k.terkunci} />
    </IsianFrame>
  );
}

/* ================================================================ lencana */

function LencanaSelaku({ selaku, ringkas }: { selaku: Rm41Data["selaku"]; ringkas?: boolean }) {
  if (!selaku) {
    return (
      <Badge tone="neutral" dot>
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

function PilihSelaku({ selaku, dipilih, onPilih }: { selaku: SelakuRm41; dipilih: boolean; onPilih: () => void }) {
  const diri = selaku === "diri";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={dipilih}
      data-selaku={selaku}
      onClick={onPilih}
      className={cn(
        "relative flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        diri && "col-span-3 sm:col-span-1",
        dipilih
          ? "border-brand bg-brand-soft text-brand-soft-fg ring-1 ring-brand/30"
          : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
      )}
    >
      {diri ? <UserRound className="size-4 shrink-0" aria-hidden /> : null}
      {LABEL_SELAKU[selaku]}
      {dipilih && <Check className="size-4 shrink-0" strokeWidth={3} aria-hidden />}
    </button>
  );
}
