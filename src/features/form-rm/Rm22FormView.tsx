"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  Check,
  CircleAlert,
  CircleCheckBig,
  CircleX,
  ListChecks,
  Lock,
  Stethoscope,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input, Label } from "@/components/ui/Field";
import { SelectOther } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { BidangIsian, KunciIsian } from "@/features/form-rm/isian/kunci";
import { LabelAsal } from "@/features/form-rm/isian/TandaAsal";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import {
  HUBUNGAN_RM22,
  INFORMASI_WAJIB,
  JENIS_INFORMASI,
  JK_RM22,
  LANGKAH_RM22,
  META_LEMBAR,
  TEKS_RM22,
  TTD_PERNYATAAN,
  emptyRm22Form,
  kekuranganRm22,
  statusLangkah,
  type IdInformasi,
  type IdLangkah,
  type JkRm22,
  type LembarRm22,
  type Rm22Data,
  type StatusLangkah,
} from "@/features/form-rm/rm22.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

/** Data tersimpan → state UI lengkap (baris informasi yang hilang dilengkapi). */
function siapkan(data: unknown): Rm22Data {
  const awal = emptyRm22Form();
  const d = (data && typeof data === "object" ? data : {}) as Partial<Rm22Data>;
  return {
    ...awal,
    ...d,
    informasi: Object.fromEntries(
      JENIS_INFORMASI.map((j) => [j.id, { ...awal.informasi[j.id], ...(d.informasi?.[j.id] ?? {}) }]),
    ) as Rm22Data["informasi"],
  };
}

const idLangkah = (id: IdLangkah) => `langkah-${id}`;
const kosong = (s: string) => s.trim() === "";
const samaNama = (a: string, b: string) => !kosong(a) && a.trim().toLowerCase() === b.trim().toLowerCase();

export function Rm22FormView({ isian, header, izin }: { isian: IsianForm; header: FormRmHeader; izin: IzinIsian }) {
  const k = useIsian(isian, izin, siapkan);
  const { form, setForm } = k;
  const [gantiKe, setGantiKe] = useState<LembarRm22 | null>(null);

  const set = <K extends keyof Rm22Data>(key: K, value: Rm22Data[K]) => setForm((f) => ({ ...f, [key]: value }));

  const kurang = kekuranganRm22(form);
  const status = Object.fromEntries(
    LANGKAH_RM22.map((l) => [l.id, statusLangkah(form, l.id, kurang[l.id])]),
  ) as Record<IdLangkah, StatusLangkah>;
  const jumlahLengkap = LANGKAH_RM22.filter((l) => status[l.id] === "lengkap").length;
  /** Langkah berikutnya yang perlu dilengkapi — disorot di navigasi & kartunya. */
  const aktif = k.terkunci ? null : (LANGKAH_RM22.find((l) => status[l.id] !== "lengkap")?.id ?? null);
  const meta = form.lembar ? META_LEMBAR[form.lembar] : null;
  const pasienNama = header.nama === "—" ? "" : header.nama;

  /* ------------------------------------------------------------- perubahan */

  function setIsiInformasi(id: IdInformasi, isi: string) {
    setForm((f) => {
      const lama = f.informasi[id];
      const informasi = { ...f.informasi, [id]: { isi, tanda: kosong(isi) ? false : lama.tanda } };
      // Tindakan di pernyataan mengikuti informasi no. 3 selama belum diubah sendiri.
      const ikut = id === "tindakan" && (kosong(f.tindakan) || f.tindakan === lama.isi);
      return { ...f, informasi, ...(ikut ? { tindakan: isi.slice(0, 300) } : {}) };
    });
  }
  const setTanda = (id: IdInformasi, tanda: boolean) =>
    setForm((f) => ({ ...f, informasi: { ...f.informasi, [id]: { ...f.informasi[id], tanda } } }));
  const tandaiSemua = () =>
    setForm((f) => ({
      ...f,
      informasi: Object.fromEntries(
        JENIS_INFORMASI.map((j) => [j.id, { ...f.informasi[j.id], tanda: !kosong(f.informasi[j.id].isi) }]),
      ) as Rm22Data["informasi"],
    }));

  /** TTD pernyataan & saksi terikat pada lembar → ganti lembar mengosongkannya (dengan konfirmasi). */
  function pilihLembar(l: LembarRm22) {
    if (form.lembar === l) return;
    if (TTD_PERNYATAAN.some((s) => form[s] !== "")) setGantiKe(l);
    else set("lembar", l);
  }
  function konfirmasiGanti() {
    if (!gantiKe) return;
    setForm((f) => ({ ...f, lembar: gantiKe, pernyataTtd: "", saksi1Ttd: "", saksi2Ttd: "" }));
    setGantiKe(null);
  }

  /** "Diri sendiri": identitas yang menyatakan = pasien (diisi bila masih kosong). */
  function pilihTerhadap(t: Rm22Data["terhadap"]) {
    setForm((f) => {
      const belumDiisi = kosong(f.pernyataNama) && !f.pernyataUmur && !f.pernyataJk && kosong(f.pernyataAlamat);
      return t === "diri" && belumDiisi
        ? { ...f, terhadap: t, pernyataNama: f.pasienNama || pasienNama, pernyataUmur: f.pasienUmur, pernyataJk: f.pasienJk, pernyataAlamat: f.pasienAlamat }
        : { ...f, terhadap: t };
    });
  }
  const salinIdentitasPasien = () =>
    setForm((f) => ({
      ...f,
      pernyataNama: f.pasienNama || pasienNama,
      pernyataUmur: f.pasienUmur,
      pernyataJk: f.pasienJk,
      pernyataAlamat: f.pasienAlamat,
    }));

  /* -------------------------------------------------------------- tampilan */

  const terisi = INFORMASI_WAJIB.filter((id) => !kosong(form.informasi[id].isi)).length;
  const adaIsi = JENIS_INFORMASI.filter((j) => !kosong(form.informasi[j.id].isi));
  const ditandai = adaIsi.filter((j) => form.informasi[j.id].tanda).length;
  const ttdKonteks = (peran: string) => [pasienNama, `RM.22 — ${peran}`].filter(Boolean).join(" · ");

  return (
    <IsianFrame
      kendali={k}
      aksen={
        <span className="inline-flex items-center gap-2">
          <LencanaLembar lembar={form.lembar} ringkas />
          <span className="tabular-nums">
            {jumlahLengkap}/{LANGKAH_RM22.length} langkah
          </span>
        </span>
      }
    >
      <KepalaIsian header={header} urutan={isian.urutan} lembar={form.lembar} tindakan={form.tindakan || form.informasi.tindakan.isi} />

      <NavAlur status={status} aktif={aktif} jumlahLengkap={jumlahLengkap} />

      <BidangIsian className="space-y-5">
        {/* 1 — Pihak pemberian informasi */}
        <Langkah id="pihak" no={1} status={status.pihak} aktif={aktif === "pihak"} kurang={kurang.pihak} berikut="informasi"
          judul="Pemberian Informasi"
          desc="Dokter yang melakukan tindakan, dokter yang memberi informasi, dan pasien/keluarga yang menerimanya.">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
            <div>
              <Label htmlFor="rm22-pelaksana">Dokter Pelaksana Tindakan</Label>
              <Input id="rm22-pelaksana" value={form.dokterPelaksana} maxLength={120}
                onChange={(e) => set("dokterPelaksana", e.target.value)} placeholder="Nama dokter beserta gelar" />
              {!kosong(form.pemberiInformasi) && !samaNama(form.dokterPelaksana, form.pemberiInformasi) && (
                <Saran onClick={() => set("dokterPelaksana", form.pemberiInformasi)}>
                  Sama dengan pemberi informasi: {form.pemberiInformasi}
                </Saran>
              )}
            </div>
            <div>
              <LabelAsal path="pemberiInformasi" htmlFor="rm22-pemberi">Pemberi Informasi / DPJP</LabelAsal>
              <Input id="rm22-pemberi" value={form.pemberiInformasi} maxLength={120}
                onChange={(e) => set("pemberiInformasi", e.target.value)} placeholder="Nama dokter pemberi informasi" />
            </div>
            <div>
              <Label htmlFor="rm22-penerima">Pasien / Keluarga (penerima informasi)</Label>
              <Input id="rm22-penerima" value={form.penerimaInformasi} maxLength={120}
                onChange={(e) => set("penerimaInformasi", e.target.value)} placeholder="Nama penerima informasi" />
              {pasienNama && !samaNama(form.penerimaInformasi, pasienNama) && (
                <Saran onClick={() => set("penerimaInformasi", pasienNama)}>Pasien sendiri: {pasienNama}</Saran>
              )}
            </div>
          </div>
          <p className="mt-4 rounded-[var(--radius-md)] bg-surface-2/60 px-3 py-2 text-xs text-fg-muted">{TEKS_RM22.catatanPenerima}</p>
        </Langkah>

        {/* 2 — Isi informasi */}
        <Langkah id="informasi" no={2} status={status.informasi} aktif={aktif === "informasi"} kurang={kurang.informasi} berikut="ttdInformasi"
          judul="Jenis & Isi Informasi"
          desc="Isi setiap jenis informasi yang dijelaskan (tulis “-” bila tidak berlaku). Tanda (V) dicentang setelah penerima memahami informasinya."
          kanan={
            <div className="flex flex-col items-end gap-1.5 text-xs">
              <Meter label="Terisi" nilai={terisi} total={INFORMASI_WAJIB.length} />
              <Meter label="Ditandai" nilai={ditandai} total={adaIsi.length} />
            </div>
          }>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-fg-subtle">Baris 1–10 wajib; Lain-lain opsional.</p>
            <Button type="button" size="sm" variant="secondary" icon={<ListChecks className="size-4" />}
              onClick={tandaiSemua} disabled={adaIsi.length === 0 || ditandai === adaIsi.length}>
              Tandai (V) semua yang terisi
            </Button>
          </div>
          <div role="table" aria-label="Jenis dan isi informasi" className="overflow-hidden rounded-[var(--radius-md)] border border-border">
            <div role="row" className="hidden grid-cols-[2.5rem_12rem_minmax(0,1fr)_7.5rem] border-b border-border bg-surface-2/70 text-xs font-semibold text-fg-muted md:grid">
              <span role="columnheader" className="px-2 py-2 text-center">No</span>
              <span role="columnheader" className="px-3 py-2">Jenis Informasi</span>
              <span role="columnheader" className="border-l border-border px-3 py-2">Isi Informasi</span>
              <span role="columnheader" className="border-l border-border px-2 py-2 text-center">Tanda (V)</span>
            </div>
            {JENIS_INFORMASI.map((j) => (
              <BarisInformasi key={j.id} id={j.id} no={j.no} label={j.label} contoh={j.contoh}
                wajib={j.id !== "lainLain"} nilai={form.informasi[j.id]}
                onIsi={(v) => setIsiInformasi(j.id, v)} onTanda={(v) => setTanda(j.id, v)} />
            ))}
          </div>
        </Langkah>

        {/* 3 — TTD pemberian informasi */}
        <Langkah id="ttdInformasi" no={3} status={status.ttdInformasi} aktif={aktif === "ttdInformasi"} kurang={kurang.ttdInformasi} berikut="lembar"
          judul="Tanda Tangan Pemberian Informasi"
          desc="Dokter menyatakan telah menerangkan; penerima menyatakan telah menerima informasi yang ditandainya.">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <KotakTtd ikon={Stethoscope} peran="Pemberi informasi" nama={form.pemberiInformasi} kosongNama="Isi nama pemberi informasi di langkah 1"
              pernyataan={TEKS_RM22.menerangkan}>
              <SignaturePad label="Tanda tangan pemberi informasi" value={form.pemberiTtd} onChange={(v) => set("pemberiTtd", v)}
                context={ttdKonteks("Pemberi informasi")} />
            </KotakTtd>
            <KotakTtd ikon={UserRound} peran="Penerima informasi" nama={form.penerimaInformasi} kosongNama="Isi nama penerima informasi di langkah 1"
              pernyataan={TEKS_RM22.menerima}>
              <SignaturePad label="Tanda tangan penerima informasi" value={form.penerimaTtd} onChange={(v) => set("penerimaTtd", v)}
                context={ttdKonteks("Penerima informasi")} />
            </KotakTtd>
          </div>
        </Langkah>

        {/* 4 — Keputusan: lembar persetujuan / penolakan */}
        <Langkah id="lembar" no={4} status={status.lembar} aktif={aktif === "lembar"} kurang={kurang.lembar} berikut="pernyataan"
          judul="Keputusan Pasien / Wali"
          desc="Pilih lembar yang dipakai. Bagian pemberian informasi sama untuk kedua lembar; pernyataan & tanda tangan berikutnya mengikuti lembar ini.">
          <div role="radiogroup" aria-label="Lembar keputusan" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <KartuLembar lembar="persetujuan" ikon={CircleCheckBig} dipilih={form.lembar === "persetujuan"} onPilih={() => pilihLembar("persetujuan")} />
            <KartuLembar lembar="penolakan" ikon={CircleX} dipilih={form.lembar === "penolakan"} onPilih={() => pilihLembar("penolakan")} />
          </div>
          {gantiKe && (
            <div role="alertdialog" aria-labelledby="rm22-ganti-judul"
              className="mt-3 flex flex-col gap-3 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-fg">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span id="rm22-ganti-judul">
                  Ganti ke <b>{META_LEMBAR[gantiKe].label}</b>? Tanda tangan yang menyatakan dan saksi akan dihapus dan harus
                  dibuat ulang.
                </span>
              </p>
              <div className="flex shrink-0 gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setGantiKe(null)}>Batal</Button>
                <Button type="button" size="sm" onClick={konfirmasiGanti}>Ganti lembar</Button>
              </div>
            </div>
          )}
        </Langkah>

        {/* 5 — Pernyataan */}
        <Langkah id="pernyataan" no={5} status={status.pernyataan} aktif={aktif === "pernyataan"} kurang={kurang.pernyataan} berikut="ttdPernyataan"
          judul={meta ? `Pernyataan ${meta.kata === "persetujuan" ? "Persetujuan" : "Penolakan"}` : "Pernyataan"}
          desc="Identitas yang menyatakan, tindakan, dan pasien yang menerima tindakan.">
          <div className="space-y-5">
            <fieldset className="min-w-0">
              <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Saya yang bertanda tangan di bawah ini</legend>
              <IdentitasOrang awalan="rm22-pernyata" nama={form.pernyataNama} umur={form.pernyataUmur} jk={form.pernyataJk} alamat={form.pernyataAlamat}
                onNama={(v) => set("pernyataNama", v)} onUmur={(v) => set("pernyataUmur", v)} onJk={(v) => set("pernyataJk", v)} onAlamat={(v) => set("pernyataAlamat", v)}
                saranNama={
                  !kosong(form.penerimaInformasi) && !samaNama(form.pernyataNama, form.penerimaInformasi) ? (
                    <Saran onClick={() => set("pernyataNama", form.penerimaInformasi)}>Sama dengan penerima informasi: {form.penerimaInformasi}</Saran>
                  ) : null
                } />
            </fieldset>

            <div>
              <Label htmlFor="rm22-tindakan">
                Dengan ini menyatakan <b className="text-fg">{meta?.kata ?? "persetujuan / penolakan"}</b> untuk dilakukannya tindakan
              </Label>
              <Input id="rm22-tindakan" value={form.tindakan} maxLength={300} onChange={(e) => set("tindakan", e.target.value)} placeholder="Nama tindakan kedokteran" />
              {!kosong(form.informasi.tindakan.isi) && form.tindakan !== form.informasi.tindakan.isi.slice(0, 300) && (
                <Saran onClick={() => set("tindakan", form.informasi.tindakan.isi.slice(0, 300))}>
                  Sama dengan informasi no. 3: {form.informasi.tindakan.isi}
                </Saran>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-fg-muted">Tindakan dilakukan terhadap</p>
              <div role="radiogroup" aria-label="Tindakan dilakukan terhadap" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <PilihanBesar ikon={UserRound} judul="Diri sendiri" ket="Yang menyatakan adalah pasien" dipilih={form.terhadap === "diri"} onPilih={() => pilihTerhadap("diri")} />
                <PilihanBesar ikon={UsersRound} judul="Keluarga / orang yang diwakili" ket="Yang menyatakan adalah wali / keluarga pasien" dipilih={form.terhadap === "keluarga"} onPilih={() => pilihTerhadap("keluarga")} />
              </div>
            </div>

            {form.terhadap === "diri" && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/40 px-3 py-2 text-[13px] text-fg-muted">
                <span>Identitas yang menyatakan = identitas pasien.</span>
                <Button type="button" size="sm" variant="secondary" onClick={salinIdentitasPasien}>Isi ulang dari data pasien</Button>
              </div>
            )}

            {form.terhadap === "keluarga" && (
              <fieldset className="min-w-0 rounded-[var(--radius-md)] border border-border p-3 sm:p-4">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Pasien yang menerima tindakan</legend>
                <div className="mb-4 sm:max-w-xs">
                  <Label htmlFor="rm22-hubungan">Hubungan (… saya)</Label>
                  <SelectOther id="rm22-hubungan" value={form.hubungan} onChange={(v) => set("hubungan", v.slice(0, 60))} options={HUBUNGAN_RM22}
                    placeholder="Pilih hubungan" otherPlaceholder="Hubungan lainnya…" />
                </div>
                <IdentitasOrang awalan="rm22-pasien" asal nama={form.pasienNama} umur={form.pasienUmur} jk={form.pasienJk} alamat={form.pasienAlamat}
                  onNama={(v) => set("pasienNama", v)} onUmur={(v) => set("pasienUmur", v)} onJk={(v) => set("pasienJk", v)} onAlamat={(v) => set("pasienAlamat", v)} />
              </fieldset>
            )}

            <div className="sm:max-w-xs">
              <Label htmlFor="rm22-tanggal">Tempat & tanggal</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-fg-muted">Modayag,</span>
                <div className="min-w-0 flex-1">
                  <DatePicker id="rm22-tanggal" value={form.tanggal} onChange={(v) => set("tanggal", v)} placeholder="Pilih tanggal" />
                </div>
              </div>
            </div>

            <KalimatPernyataan d={form} />
          </div>
        </Langkah>

        {/* 6 — TTD pernyataan & saksi (terkunci sampai lembar dipilih) */}
        <Langkah id="ttdPernyataan" no={6} status={status.ttdPernyataan} aktif={aktif === "ttdPernyataan"} kurang={kurang.ttdPernyataan}
          judul="Tanda Tangan Yang Menyatakan & Saksi"
          desc="Ditandatangani setelah keputusan dipilih. Minimal satu saksi (mis. perawat atau keluarga).">
          {!form.lembar && (
            <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-fg">
              <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              Pilih keputusan di langkah 4 lebih dulu — tanda tangan terikat pada lembar persetujuan atau penolakan.
            </p>
          )}
          <KunciIsian terkunci={k.terkunci || !form.lembar}>
            <BidangIsian>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <KotakTtd ikon={UserRound} peran="Yang menyatakan" nama={form.pernyataNama} kosongNama="Isi nama di langkah 5">
                  <SignaturePad label="Tanda tangan yang menyatakan" value={form.pernyataTtd} onChange={(v) => set("pernyataTtd", v)}
                    context={ttdKonteks(meta ? `${meta.label} — yang menyatakan` : "Yang menyatakan")}
                    reuse={samaNama(form.pernyataNama, form.penerimaInformasi) ? form.penerimaTtd : ""} />
                </KotakTtd>
                {([1, 2] as const).map((no) => {
                  const namaKey = no === 1 ? "saksi1Nama" : "saksi2Nama";
                  const ttdKey = no === 1 ? "saksi1Ttd" : "saksi2Ttd";
                  return (
                    <KotakTtd key={no} ikon={UsersRound} peran={`Saksi ${no}`} nama={form[namaKey]} opsional={no === 2}>
                      <Input value={form[namaKey]} maxLength={120} onChange={(e) => set(namaKey, e.target.value)}
                        placeholder={`Nama saksi ${no}`} aria-label={`Nama saksi ${no}`} className="mb-3" />
                      <SignaturePad label={`Tanda tangan saksi ${no}`} value={form[ttdKey]} onChange={(v) => set(ttdKey, v)}
                        context={ttdKonteks(`Saksi ${no}`)} />
                    </KotakTtd>
                  );
                })}
              </div>
            </BidangIsian>
          </KunciIsian>
        </Langkah>
      </BidangIsian>

      <RingkasanKekurangan kurang={kurang} terkunci={k.terkunci} />
    </IsianFrame>
  );
}

/* ================================================================= kepala */

function LencanaLembar({ lembar, ringkas }: { lembar: Rm22Data["lembar"]; ringkas?: boolean }) {
  if (lembar === "persetujuan") {
    return (
      <Badge tone="success">
        <CircleCheckBig className="size-3.5" aria-hidden />
        {ringkas ? "Persetujuan" : "Lembar Persetujuan"}
      </Badge>
    );
  }
  if (lembar === "penolakan") {
    return (
      <Badge tone="danger">
        <CircleX className="size-3.5" aria-hidden />
        {ringkas ? "Penolakan" : "Lembar Penolakan"}
      </Badge>
    );
  }
  return (
    <Badge tone="warning" dot>
      {ringkas ? "Keputusan belum dipilih" : "Lembar belum dipilih"}
    </Badge>
  );
}

function KepalaIsian({
  header,
  urutan,
  lembar,
  tindakan,
}: {
  header: FormRmHeader;
  urutan: number;
  lembar: Rm22Data["lembar"];
  tindakan: string;
}) {
  const jk = header.jenisKelamin === "Laki-Laki" ? "L" : header.jenisKelamin === "Perempuan" ? "P" : "";
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-surface-2/50 px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge tone="brand">Isian ke-{urutan}</Badge>
          <LencanaLembar lembar={lembar} />
        </div>
        <p className="min-w-0 truncate text-sm text-fg">
          <span className="text-fg-muted">Tindakan:</span>{" "}
          {tindakan.trim() ? <b className="font-semibold">{tindakan}</b> : <span className="text-fg-subtle">belum diisi</span>}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 text-sm md:grid-cols-5">
        <Ident label="No. RM" nilai={header.norm} mono />
        <Ident label="Nama" nilai={jk ? `${header.nama} (${jk})` : header.nama} tebal className="col-span-2 md:col-span-1" />
        <Ident label="NIK" nilai={header.nik} mono />
        <Ident label="Umur" nilai={header.umur ?? ""} />
        <Ident label="Ruang" nilai={header.ruang} />
      </dl>
    </Card>
  );
}

function Ident({ label, nilai, mono, tebal, className }: { label: string; nilai: string; mono?: boolean; tebal?: boolean; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className={cn("truncate text-fg", mono && "font-mono", tebal && "font-semibold")}>{nilai && nilai !== "—" ? nilai : "—"}</dd>
    </div>
  );
}

/* ============================================================== navigasi */

const NADA_LANGKAH: Record<StatusLangkah, string> = {
  lengkap: "bg-success text-white",
  sebagian: "bg-warning text-white",
  kosong: "bg-surface-2 text-fg-muted",
};

function NavAlur({ status, aktif, jumlahLengkap }: { status: Record<IdLangkah, StatusLangkah>; aktif: IdLangkah | null; jumlahLengkap: number }) {
  const daftarRef = useRef<HTMLOListElement>(null);
  // Layar sempit: geser navigasi (horizontal saja) agar langkah berikutnya terlihat.
  useEffect(() => {
    const ol = daftarRef.current;
    const chip = ol?.querySelector<HTMLElement>('[aria-current="step"]');
    if (ol && chip && ol.scrollWidth > ol.clientWidth) ol.scrollTo({ left: Math.max(0, chip.offsetLeft - 24), behavior: "smooth" });
  }, [aktif]);
  return (
    <nav
      aria-label="Alur pengisian"
      className="sticky top-16 z-10 -mx-4 border-b border-border bg-bg/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-bg/70 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="flex items-center gap-3">
        <ol ref={daftarRef} className="relative flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {LANGKAH_RM22.map((l, i) => {
            const st = status[l.id];
            const sorot = aktif === l.id;
            return (
              <li key={l.id} className="flex shrink-0 items-center gap-1.5">
                {i > 0 && <span className={cn("h-px w-3", status[LANGKAH_RM22[i - 1].id] === "lengkap" ? "bg-success" : "bg-border")} aria-hidden />}
                <a
                  href={`#${idLangkah(l.id)}`}
                  aria-current={sorot ? "step" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    sorot
                      ? "border-brand bg-brand-soft text-brand-soft-fg ring-2 ring-brand/25"
                      : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
                  )}
                  title={`${l.judul} — ${st === "lengkap" ? "lengkap" : st === "sebagian" ? "belum lengkap" : "belum diisi"}`}
                >
                  <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] font-bold", NADA_LANGKAH[st])}>
                    {st === "lengkap" ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  {l.judul}
                </a>
              </li>
            );
          })}
        </ol>
        <span className="hidden shrink-0 text-xs tabular-nums text-fg-subtle sm:inline">
          {jumlahLengkap}/{LANGKAH_RM22.length} lengkap
        </span>
      </div>
    </nav>
  );
}

/* ================================================================ langkah */

function Langkah({
  id,
  no,
  judul,
  desc,
  status,
  aktif,
  kurang,
  berikut,
  kanan,
  children,
}: {
  id: IdLangkah;
  no: number;
  judul: string;
  desc: string;
  status: StatusLangkah;
  aktif: boolean;
  kurang: string[];
  berikut?: IdLangkah;
  kanan?: React.ReactNode;
  children: React.ReactNode;
}) {
  const lanjut = berikut ? LANGKAH_RM22.find((l) => l.id === berikut) : null;
  return (
    <Card
      id={idLangkah(id)}
      data-langkah={id}
      data-status={status}
      className={cn(
        "scroll-mt-32 p-4 transition-shadow sm:p-5",
        aktif && "ring-2 ring-brand/35",
        status === "lengkap" && !aktif && "border-success/35",
      )}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", status === "kosong" ? "bg-brand-soft text-brand-soft-fg" : NADA_LANGKAH[status])}
            aria-hidden
          >
            {status === "lengkap" ? <Check className="size-4" strokeWidth={3} /> : no}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-fg">{judul}</h2>
              <LencanaStatus status={status} kurang={kurang.length} />
              {aktif && (
                <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-brand-fg">Langkah berikutnya</span>
              )}
            </div>
            <p className="mt-0.5 max-w-3xl text-xs text-fg-muted">{desc}</p>
          </div>
        </div>
        {kanan}
      </header>

      {children}

      {(kurang.length > 0 && status !== "kosong") || lanjut ? (
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          {kurang.length > 0 && status !== "kosong" ? (
            <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label="Belum lengkap">
              {kurang.slice(0, 4).map((x) => (
                <li key={x} className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] text-warning">{x}</li>
              ))}
              {kurang.length > 4 && <li className="px-1 text-[11px] text-fg-subtle">+{kurang.length - 4} lagi</li>}
            </ul>
          ) : (
            <span />
          )}
          {lanjut && (
            <a
              href={`#${idLangkah(lanjut.id)}`}
              className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1 text-[13px] font-medium text-brand transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              Lanjut: {lanjut.judul}
              <ArrowDown className="size-3.5" aria-hidden />
            </a>
          )}
        </footer>
      ) : null}
    </Card>
  );
}

function LencanaStatus({ status, kurang }: { status: StatusLangkah; kurang: number }) {
  if (status === "lengkap") {
    return (
      <Badge tone="success" className="py-0 text-[11px]">
        <Check className="size-3" aria-hidden /> Lengkap
      </Badge>
    );
  }
  if (status === "sebagian") return <Badge tone="warning" className="py-0 text-[11px]">{kurang} belum lengkap</Badge>;
  return <Badge className="py-0 text-[11px]">Belum diisi</Badge>;
}

function Meter({ label, nilai, total }: { label: string; nilai: number; total: number }) {
  const persen = total > 0 ? Math.round((nilai / total) * 100) : 0;
  const penuh = total > 0 && nilai === total;
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-right text-fg-muted">{label}</span>
      <span className="relative h-1.5 w-24 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width]", penuh ? "bg-success" : "bg-brand")} style={{ width: `${persen}%` }} />
      </span>
      <span className={cn("w-10 tabular-nums", penuh ? "font-semibold text-success" : "text-fg")}>
        {nilai}/{total}
      </span>
    </div>
  );
}

/* ============================================================ informasi */

function BarisInformasi({
  id,
  no,
  label,
  contoh,
  wajib,
  nilai,
  onIsi,
  onTanda,
}: {
  id: IdInformasi;
  no: string;
  label: string;
  contoh: string;
  wajib: boolean;
  nilai: { isi: string; tanda: boolean };
  onIsi: (v: string) => void;
  onTanda: (v: boolean) => void;
}) {
  const ada = !kosong(nilai.isi);
  const fieldId = `rm22-info-${id}`;
  return (
    <div
      role="row"
      data-info={id}
      className={cn(
        "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2 border-b border-border px-2 py-2.5 last:border-b-0 md:grid-cols-[2.5rem_12rem_minmax(0,1fr)_7.5rem] md:gap-0 md:p-0",
        ada && nilai.tanda ? "bg-success-soft/35" : ada ? "bg-brand-soft/25" : "",
      )}
    >
      <span role="cell" className="pt-2 text-center text-sm tabular-nums text-fg-muted md:py-3">{no}</span>
      <div role="cell" className="min-w-0 pt-1.5 md:px-3 md:py-2.5">
        <LabelAsal path={`informasi.${id}.isi`} htmlFor={fieldId} className="mb-0">
          <span className="text-sm font-medium text-fg">{label}</span>
          {!wajib && <span className="ml-1 text-xs text-fg-subtle">(opsional)</span>}
        </LabelAsal>
      </div>
      <div role="cell" className="col-span-3 col-start-1 row-start-2 md:col-span-1 md:col-start-3 md:row-start-1 md:border-l md:border-border md:p-2">
        <textarea
          id={fieldId}
          value={nilai.isi}
          maxLength={1000}
          rows={1}
          onChange={(e) => onIsi(e.target.value)}
          placeholder={contoh}
          className="block min-h-10 w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg [field-sizing:content] placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 md:max-h-48"
        />
      </div>
      <div role="cell" className="col-start-3 row-start-1 flex justify-end md:col-start-4 md:h-full md:items-start md:justify-center md:border-l md:border-border md:p-2">
        <button
          type="button"
          aria-pressed={nilai.tanda}
          aria-label={`Tanda (V) ${label}`}
          disabled={!ada}
          onClick={() => onTanda(!nilai.tanda)}
          title={ada ? (nilai.tanda ? "Batalkan tanda" : "Penerima memahami informasi ini") : "Isi informasinya lebih dulu"}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:cursor-not-allowed disabled:opacity-45",
            nilai.tanda
              ? "border-success bg-success text-white"
              : "border-border bg-surface text-fg-muted hover:border-success/50 hover:text-success",
          )}
        >
          <span className={cn("flex size-4 items-center justify-center rounded-[4px] border", nilai.tanda ? "border-white/70" : "border-current")}>
            {nilai.tanda && <Check className="size-3" strokeWidth={3} />}
          </span>
          {nilai.tanda ? "Ditandai" : "Tandai"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================ tanda tangan */

function KotakTtd({
  ikon: Ikon,
  peran,
  nama,
  kosongNama,
  pernyataan,
  opsional,
  children,
}: {
  ikon: LucideIcon;
  peran: string;
  nama: string;
  kosongNama?: string;
  pernyataan?: string;
  opsional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3" aria-label={peran}>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] bg-surface text-fg-muted ring-1 ring-border">
          <Ikon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">
            {peran}
            {opsional && <span className="ml-1 text-xs font-normal text-fg-subtle">(opsional)</span>}
          </p>
          {kosongNama !== undefined && (
            <p className={cn("truncate text-xs", kosong(nama) ? "text-warning" : "text-fg-muted")}>{kosong(nama) ? kosongNama : nama}</p>
          )}
        </div>
      </div>
      {pernyataan && <blockquote className="mb-3 border-l-2 border-brand/40 pl-3 text-xs italic leading-relaxed text-fg-muted">{pernyataan}</blockquote>}
      {children}
    </section>
  );
}

/* ================================================================ pilihan */

function KartuLembar({ lembar, ikon: Ikon, dipilih, onPilih }: { lembar: LembarRm22; ikon: LucideIcon; dipilih: boolean; onPilih: () => void }) {
  const m = META_LEMBAR[lembar];
  const setuju = lembar === "persetujuan";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={dipilih}
      data-lembar={lembar}
      onClick={onPilih}
      className={cn(
        "group relative flex items-start gap-3 rounded-[var(--radius-lg)] border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        dipilih
          ? setuju
            ? "border-success bg-success-soft"
            : "border-danger bg-danger-soft"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-2/50",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
          dipilih ? (setuju ? "bg-success text-white" : "bg-danger text-white") : setuju ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
        )}
      >
        <Ikon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-fg">{m.label}</span>
        <span className="block text-sm text-fg-muted">{m.ringkas}</span>
        <span className="mt-2 block text-[11px] font-medium tracking-wide text-fg-subtle">{m.judul}</span>
      </span>
      {dipilih && (
        <span className={cn("absolute right-3 top-3 flex size-6 items-center justify-center rounded-full text-white", setuju ? "bg-success" : "bg-danger")}>
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
      )}
    </button>
  );
}

function PilihanBesar({ ikon: Ikon, judul, ket, dipilih, onPilih }: { ikon: LucideIcon; judul: string; ket: string; dipilih: boolean; onPilih: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={dipilih}
      onClick={onPilih}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        dipilih ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
      )}
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)]", dipilih ? "bg-brand text-brand-fg" : "bg-surface-2 text-fg-subtle")}>
        <Ikon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{judul}</span>
        <span className="block text-xs opacity-80">{ket}</span>
      </span>
      {dipilih && <Check className="ml-auto size-4 shrink-0" aria-hidden />}
    </button>
  );
}

function PilihJk({ id, nilai, onUbah }: { id: string; nilai: "" | JkRm22; onUbah: (v: "" | JkRm22) => void }) {
  return (
    <div id={id} role="radiogroup" aria-label="Jenis kelamin" className="inline-flex h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
      {JK_RM22.map((jk) => (
        <button
          key={jk}
          type="button"
          role="radio"
          aria-checked={nilai === jk}
          onClick={() => onUbah(nilai === jk ? "" : jk)}
          className={cn(
            "flex-1 rounded-[calc(var(--radius-md)-3px)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
            nilai === jk ? "bg-surface text-fg shadow-sm ring-1 ring-border" : "text-fg-muted hover:text-fg",
          )}
        >
          {jk}
        </button>
      ))}
    </div>
  );
}

/** Nama · umur (tahun) · jenis kelamin · alamat — dipakai untuk yang menyatakan & pasien. */
function IdentitasOrang({
  awalan,
  asal,
  nama,
  umur,
  jk,
  alamat,
  onNama,
  onUmur,
  onJk,
  onAlamat,
  saranNama,
}: {
  awalan: string;
  /** Kolom pasien: penanda SIMRS di label. */
  asal?: boolean;
  nama: string;
  umur: string;
  jk: "" | JkRm22;
  alamat: string;
  onNama: (v: string) => void;
  onUmur: (v: string) => void;
  onJk: (v: "" | JkRm22) => void;
  onAlamat: (v: string) => void;
  saranNama?: React.ReactNode;
}) {
  const lbl = (path: string, htmlFor: string, teks: string) =>
    asal ? (
      <LabelAsal path={path} htmlFor={htmlFor}>{teks}</LabelAsal>
    ) : (
      <Label htmlFor={htmlFor}>{teks}</Label>
    );
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,2fr)_7rem_minmax(0,1.3fr)]">
      <div className="min-w-0">
        {lbl("pasienNama", `${awalan}-nama`, "Nama")}
        <Input id={`${awalan}-nama`} value={nama} maxLength={120} onChange={(e) => onNama(e.target.value)} placeholder="Nama lengkap" />
        {saranNama}
      </div>
      <div>
        {lbl("pasienUmur", `${awalan}-umur`, "Umur (tahun)")}
        <Input id={`${awalan}-umur`} value={umur} inputMode="numeric" maxLength={3}
          onChange={(e) => onUmur(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="mis. 35" />
      </div>
      <div>
        {asal ? <LabelAsal path="pasienJk" htmlFor={`${awalan}-jk`}>Jenis kelamin</LabelAsal> : <p className="mb-1.5 text-xs font-medium text-fg-muted">Jenis kelamin</p>}
        <PilihJk id={`${awalan}-jk`} nilai={jk} onUbah={onJk} />
      </div>
      <div className="sm:col-span-3">
        {lbl("pasienAlamat", `${awalan}-alamat`, "Alamat")}
        <textarea id={`${awalan}-alamat`} rows={2} value={alamat} maxLength={300} onChange={(e) => onAlamat(e.target.value)} placeholder="Alamat lengkap"
          className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40" />
      </div>
    </div>
  );
}

/** Tombol saran satu-klik di bawah kolom (mis. "Pasien sendiri: …"). */
function Saran({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-full border border-brand/30 bg-brand-soft/60 px-2.5 py-0.5 text-left text-xs font-medium text-brand-soft-fg transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
    >
      <span className="truncate">{children}</span>
    </button>
  );
}

/* ====================================================== pratinjau kalimat */

/** Kalimat pernyataan seperti yang akan tercetak; bagian kosong ditandai. */
function KalimatPernyataan({ d }: { d: Rm22Data }) {
  const meta = d.lembar ? META_LEMBAR[d.lembar] : null;
  const v = (s: string, kosongTeks = "…") => (kosong(s) ? <Rumpang>{kosongTeks}</Rumpang> : <b className="font-semibold text-fg">{s}</b>);
  const jk = (s: string) => (s ? s.toLowerCase() : "");
  return (
    <figure className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface-2/40 px-4 py-3">
      <figcaption className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Pratinjau pernyataan</figcaption>
      <p className="text-sm leading-relaxed text-fg-muted">
        Saya yang bertanda tangan di bawah ini, {v(d.pernyataNama, "nama")}, umur {v(d.pernyataUmur, "…")} tahun, {v(jk(d.pernyataJk), "jenis kelamin")}, alamat{" "}
        {v(d.pernyataAlamat, "alamat")}, dengan ini menyatakan {v(meta?.kata ?? "", "persetujuan / penolakan")} untuk dilakukannya tindakan{" "}
        {v(d.tindakan, "tindakan")} terhadap{" "}
        {d.terhadap === "diri" ? (
          <b className="font-semibold text-fg">saya</b>
        ) : d.terhadap === "keluarga" ? (
          <>
            {v(d.hubungan.toLowerCase(), "hubungan")} saya bernama {v(d.pasienNama, "nama pasien")}, umur {v(d.pasienUmur, "…")} tahun,{" "}
            {v(jk(d.pasienJk), "jenis kelamin")}, alamat {v(d.pasienAlamat, "alamat")}
          </>
        ) : (
          <Rumpang>saya / keluarga</Rumpang>
        )}
        . {TEKS_RM22.memahami}
      </p>
    </figure>
  );
}

function Rumpang({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-warning-soft px-1 text-warning">{children}</span>;
}

/* ===================================================== ringkasan akhir */

function RingkasanKekurangan({ kurang, terkunci }: { kurang: Record<IdLangkah, string[]>; terkunci: boolean }) {
  if (terkunci) return null;
  const sisa = LANGKAH_RM22.filter((l) => kurang[l.id].length > 0);
  if (sisa.length === 0) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-success/40 bg-success-soft px-4 py-3 text-sm text-fg">
        <CircleCheckBig className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <p>
          <b>Semua langkah lengkap.</b> Periksa kembali isian, lalu tekan <b>Finalkan</b> untuk mengunci formulir.
        </p>
      </div>
    );
  }
  const total = sisa.reduce((n, l) => n + kurang[l.id].length, 0);
  return (
    <Card className="p-4">
      <p className="mb-2 text-sm font-semibold text-fg">Sebelum difinalkan — {total} hal belum lengkap</p>
      <ul className="space-y-1.5 text-[13px]">
        {sisa.map((l) => (
          <li key={l.id} className="flex flex-wrap items-baseline gap-x-2">
            <a href={`#${idLangkah(l.id)}`} className="font-medium text-brand hover:underline">
              {LANGKAH_RM22.findIndex((x) => x.id === l.id) + 1}. {l.judul}
            </a>
            <span className="text-fg-muted">{kurang[l.id].join(" · ")}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
