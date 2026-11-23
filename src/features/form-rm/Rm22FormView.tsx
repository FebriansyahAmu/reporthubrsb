"use client";

import { useState } from "react";
import { CircleCheckBig, CircleX, Lock, UserRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { BidangIsian, KunciIsian } from "@/features/form-rm/isian/kunci";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import {
  BagianLangkah,
  KONTROL,
  KakiLangkah,
  LabelKolom,
  LencanaLangkah,
  SyaratFinal,
  TataLetakLangkah,
  Wajib,
  type ButirSyarat,
} from "@/features/form-rm/isian/langkah/bagian";
import type { Langkah } from "@/features/form-rm/isian/langkah/NavLangkah";
import { KONTROL_PILIHAN } from "@/features/form-rm/isian/langkah/PilihanRadio";
import { hitungAlur } from "@/features/form-rm/persetujuan/alur";
import {
  BagianYangMenyatakan,
  KalimatIdentitas,
  KalimatTerhadap,
  KepalaIsian,
  KonfirmasiGanti,
  KotakSaksi,
  KotakTtd,
  MeterInformasi,
  NilaiKalimat,
  PihakInformasi,
  PratinjauPernyataan,
  samaNama,
  Saran,
  TabelInformasi,
  tandaiSemuaInformasi,
  TempatTanggal,
  TtdInformasi,
  ubahIsiInformasi,
} from "@/features/form-rm/persetujuan/bidang";
import { kosong, lengkapiInformasi, type IdInformasi } from "@/features/form-rm/persetujuan/informasi";
import { tujuanPesan } from "@/features/form-rm/persetujuan/tujuan";
import {
  LANGKAH_RM22,
  META_LEMBAR,
  RM22_KOTA,
  TEKS_RM22,
  TTD_PERNYATAAN,
  emptyRm22Form,
  kekuranganRm22,
  statusLangkah,
  type IdLangkah,
  type LembarRm22,
  type Rm22Data,
} from "@/features/form-rm/rm22.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

/* Tata letak isian RM.22 (tampilan pengisian saja — cetak tetap Rm22Document):
 * 6 langkah dalam dua bagian formulir kertas (A. Pemberian informasi, B.
 * Persetujuan/penolakan), navigasi langkah lengket (scrollspy), panel "Syarat
 * finalisasi" + kekurangan per langkah yang memindahkan fokus ke kolomnya.
 * Syarat = `kekuranganRm22` (sumber yang sama dengan validasi FINAL server).
 * Path kolom tak berubah → simpan gabung, penanda SIMRS, aturan TTD, cetak tetap. */

const AWALAN = "rm22";
const idL = (id: IdLangkah) => `rm22-langkah-${id}`;

/** Nama langkah di navigasi + kelompok (= bagian formulir kertas). */
const NAV: Record<IdLangkah, { judul: string; singkat: string; grup: string }> = {
  pihak: { judul: "Pihak informasi", singkat: "Pihak", grup: "A. Pemberian informasi" },
  informasi: { judul: "Isi informasi", singkat: "Informasi", grup: "A. Pemberian informasi" },
  ttdInformasi: { judul: "Tanda tangan informasi", singkat: "TTD informasi", grup: "A. Pemberian informasi" },
  lembar: { judul: "Keputusan pasien", singkat: "Keputusan", grup: "B. Persetujuan / penolakan" },
  pernyataan: { judul: "Pernyataan", singkat: "Pernyataan", grup: "B. Persetujuan / penolakan" },
  ttdPernyataan: { judul: "Tanda tangan & saksi", singkat: "TTD & saksi", grup: "B. Persetujuan / penolakan" },
};

/** Data tersimpan → state UI lengkap (baris informasi yang hilang dilengkapi). */
function siapkan(data: unknown): Rm22Data {
  const d = (data && typeof data === "object" ? data : {}) as Partial<Rm22Data>;
  return { ...emptyRm22Form(), ...d, informasi: lengkapiInformasi(d.informasi) };
}

const tujuan = (id: IdLangkah, pesan: string) => tujuanPesan(AWALAN, pesan) ?? idL(id);
const ringkasKurang = (kurang: readonly string[]) =>
  kurang.slice(0, 2).join(", ") + (kurang.length > 2 ? ` +${kurang.length - 2} lagi` : "");

export function Rm22FormView({ isian, header, izin }: { isian: IsianForm; header: FormRmHeader; izin: IzinIsian }) {
  const k = useIsian(isian, izin, siapkan);
  const { form, setForm } = k;
  const [gantiKe, setGantiKe] = useState<LembarRm22 | null>(null);

  const set = <K extends keyof Rm22Data>(key: K, value: Rm22Data[K]) => setForm((f) => ({ ...f, [key]: value }));

  const kurang = kekuranganRm22(form);
  const alur = hitungAlur(LANGKAH_RM22, kurang, (id, x) => statusLangkah(form, id, x), k.terkunci);
  const meta = form.lembar ? META_LEMBAR[form.lembar] : null;
  const pasienNama = header.nama === "—" ? "" : header.nama;
  // Daftar syarat hanya untuk yang bisa mengisi (DRAF & tidak terkunci).
  const draf = isian.status === "DRAF" && !k.terkunci;

  const langkah: Langkah[] = LANGKAH_RM22.map((l, i) => {
    const st = alur.status[l.id];
    const n = kurang[l.id].length;
    const tunggu = l.id === "ttdPernyataan" && !form.lembar && st !== "lengkap";
    const ket = tunggu
      ? "Menunggu keputusan (langkah 4)"
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
      grup: NAV[l.id].grup,
      status: st,
      ket: alur.aktif === l.id ? `Berikutnya · ${ket}` : ket,
    };
  });
  const butir: ButirSyarat[] = LANGKAH_RM22.map((l, i) => ({
    kunci: l.id,
    label: `${i + 1}. ${NAV[l.id].judul}`,
    ok: kurang[l.id].length === 0,
    tujuan: kurang[l.id].length ? tujuan(l.id, kurang[l.id][0]) : idL(l.id),
    ket: kurang[l.id].length ? ringkasKurang(kurang[l.id]) : undefined,
  }));

  /** Kartu langkah + kaki (kekurangan yang bisa diklik, "Lanjut"). */
  const props = (id: IdLangkah) => {
    const i = LANGKAH_RM22.findIndex((l) => l.id === id);
    const berikut = LANGKAH_RM22[i + 1];
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

  /* ------------------------------------------------------------- perubahan */

  function setIsiInformasi(id: IdInformasi, isi: string) {
    setForm((f) => {
      const lama = f.informasi[id];
      // Tindakan di pernyataan mengikuti informasi no. 3 selama belum diubah sendiri.
      const ikut = id === "tindakan" && (kosong(f.tindakan) || f.tindakan === lama.isi);
      return { ...f, informasi: ubahIsiInformasi(f.informasi, id, isi), ...(ikut ? { tindakan: isi.slice(0, 300) } : {}) };
    });
  }

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

  const ttdKonteks = (peran: string) => [pasienNama, `RM.22 — ${peran}`].filter(Boolean).join(" · ");
  const p = {
    pihak: props("pihak"),
    informasi: props("informasi"),
    ttdInformasi: props("ttdInformasi"),
    lembar: props("lembar"),
    pernyataan: props("pernyataan"),
    ttdPernyataan: props("ttdPernyataan"),
  };

  return (
    <IsianFrame
      kendali={k}
      aksen={
        <span className="inline-flex items-center gap-2">
          <LencanaLembar lembar={form.lembar} ringkas />
          <span className="tabular-nums">
            {alur.jumlahLengkap}/{LANGKAH_RM22.length} langkah
          </span>
        </span>
      }
    >
      <TataLetakLangkah langkah={langkah} samping={draf && <SyaratFinal butir={butir} idJudul="rm22-syarat-judul" />}>
        <KepalaIsian
          header={header}
          urutan={isian.urutan}
          lencana={<LencanaLembar lembar={form.lembar} />}
          subjekLabel="Tindakan"
          subjek={form.tindakan || form.informasi.tindakan.isi}
        />

        {/* ============================ A. PEMBERIAN INFORMASI ============================ */}

        <BagianLangkah
          {...p.pihak.kartu}
          judul="Pihak pemberian informasi"
          ket="Dokter yang melakukan tindakan, dokter yang memberi informasi, dan pasien/keluarga yang menerimanya."
        >
          <BidangIsian>
            <PihakInformasi awalan={AWALAN} form={form} set={set} pasienNama={pasienNama} />
          </BidangIsian>
          {p.pihak.kaki}
        </BagianLangkah>

        <BagianLangkah
          {...p.informasi.kartu}
          judul="Jenis & isi informasi"
          ket="Isi setiap jenis informasi yang dijelaskan (tulis “-” bila tidak berlaku)."
          aksi={<MeterInformasi informasi={form.informasi} />}
        >
          <BidangIsian>
            <TabelInformasi
              awalan={AWALAN}
              informasi={form.informasi}
              onIsi={setIsiInformasi}
              onTanda={(id, tanda) => setForm((f) => ({ ...f, informasi: { ...f.informasi, [id]: { ...f.informasi[id], tanda } } }))}
              onTandaiSemua={() => setForm((f) => ({ ...f, informasi: tandaiSemuaInformasi(f.informasi) }))}
            />
          </BidangIsian>
          {p.informasi.kaki}
        </BagianLangkah>

        <BagianLangkah
          {...p.ttdInformasi.kartu}
          judul="Tanda tangan pemberian informasi"
          ket="Dokter menyatakan telah menerangkan; penerima menyatakan telah menerima informasi yang ditandainya."
        >
          <BidangIsian>
            <TtdInformasi form={form} set={set} konteks={ttdKonteks} noPihak={1} awalan={AWALAN} />
          </BidangIsian>
          {p.ttdInformasi.kaki}
        </BagianLangkah>

        {/* ======================== B. PERSETUJUAN / PENOLAKAN ======================== */}

        <BagianLangkah
          {...p.lembar.kartu}
          judul="Keputusan pasien / wali"
          ket="Bagian pemberian informasi sama untuk kedua lembar; pernyataan & tanda tangan berikutnya mengikuti lembar yang dipilih."
        >
          {/* Wadah container query DI LUAR fieldset ber-legend (Chromium tak merender ulang wadah yang jadi anak fieldset ber-legend). */}
          <div className="@container">
            <BidangIsian>
              <fieldset id="rm22-lembar" tabIndex={-1} className="m-0 min-w-0 border-0 p-0 outline-none">
                <legend className="mb-2 p-0 text-xs font-medium text-fg-muted">
                  Pilih lembar yang dipakai <Wajib />
                </legend>
                <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
                  <KartuLembar lembar="persetujuan" ikon={CircleCheckBig} dipilih={form.lembar === "persetujuan"} onPilih={() => pilihLembar("persetujuan")} />
                  <KartuLembar lembar="penolakan" ikon={CircleX} dipilih={form.lembar === "penolakan"} onPilih={() => pilihLembar("penolakan")} />
                </div>
              </fieldset>
            </BidangIsian>
          </div>
          {gantiKe && (
            <KonfirmasiGanti id="rm22-ganti-judul" label="Ganti lembar" onBatal={() => setGantiKe(null)} onYa={konfirmasiGanti}>
              Ganti ke <b>{META_LEMBAR[gantiKe].label}</b>? Tanda tangan yang menyatakan dan saksi akan dihapus dan harus dibuat ulang.
            </KonfirmasiGanti>
          )}
          {p.lembar.kaki}
        </BagianLangkah>

        <BagianLangkah
          {...p.pernyataan.kartu}
          judul={meta ? `Pernyataan ${meta.kata === "persetujuan" ? "persetujuan" : "penolakan"}` : "Pernyataan"}
          ket="Identitas yang menyatakan, tindakan, dan pasien yang menerima tindakan."
        >
          <BidangIsian className="space-y-5">
            <BagianYangMenyatakan
              awalan={AWALAN}
              form={form}
              setForm={setForm}
              pasienNamaHeader={pasienNama}
              objek="Tindakan"
              judulPasien="Pasien yang menerima tindakan"
              tengah={
                <div>
                  <LabelKolom htmlFor="rm22-tindakan" wajib>
                    Dengan ini menyatakan <b className="text-fg">{meta?.kata ?? "persetujuan / penolakan"}</b> untuk dilakukannya tindakan
                  </LabelKolom>
                  <Input
                    id="rm22-tindakan"
                    value={form.tindakan}
                    maxLength={300}
                    onChange={(e) => set("tindakan", e.target.value)}
                    placeholder="Nama tindakan kedokteran"
                    enterKeyHint="next"
                    className={KONTROL}
                  />
                  {!kosong(form.informasi.tindakan.isi) && form.tindakan !== form.informasi.tindakan.isi.slice(0, 300) && (
                    <Saran onClick={() => set("tindakan", form.informasi.tindakan.isi.slice(0, 300))}>
                      Sama dengan informasi no. 3: {form.informasi.tindakan.isi}
                    </Saran>
                  )}
                </div>
              }
            />

            <TempatTanggal id="rm22-tanggal" kota={RM22_KOTA} value={form.tanggal} onChange={(v) => set("tanggal", v)} />

            <PratinjauPernyataan>
              <KalimatIdentitas d={form} />, dengan ini menyatakan <NilaiKalimat nilai={meta?.kata ?? ""} kosongTeks="persetujuan / penolakan" />{" "}
              untuk dilakukannya tindakan <NilaiKalimat nilai={form.tindakan} kosongTeks="tindakan" /> terhadap <KalimatTerhadap d={form} />.{" "}
              {TEKS_RM22.memahami}
            </PratinjauPernyataan>
          </BidangIsian>
          {p.pernyataan.kaki}
        </BagianLangkah>

        <BagianLangkah
          {...p.ttdPernyataan.kartu}
          judul="Tanda tangan yang menyatakan & saksi"
          ket="Ditandatangani setelah keputusan dipilih. Minimal satu saksi lengkap (nama & tanda tangan), mis. perawat atau keluarga."
        >
          {draf && <SyaratFinal butir={butir} idJudul="rm22-syarat-judul-ponsel" className="mb-5 xl:hidden" />}
          {!form.lembar && (
            <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-fg">
              <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              Pilih keputusan di langkah 4 lebih dulu — tanda tangan terikat pada lembar persetujuan atau penolakan.
            </p>
          )}
          <KunciIsian terkunci={k.terkunci || !form.lembar}>
            <BidangIsian>
              <div className="@container">
                <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
                  <KotakTtd
                    ikon={UserRound}
                    peran="Yang menyatakan"
                    nama={form.pernyataNama}
                    kosongNama="Isi nama di langkah 5"
                    sudah={form.pernyataTtd !== ""}
                    idTtd="rm22-ttd-pernyata"
                  >
                    <SignaturePad
                      label="Tanda tangan yang menyatakan"
                      value={form.pernyataTtd}
                      onChange={(v) => set("pernyataTtd", v)}
                      context={ttdKonteks(meta ? `${meta.label} — yang menyatakan` : "Yang menyatakan")}
                      reuse={samaNama(form.pernyataNama, form.penerimaInformasi) ? form.penerimaTtd : ""}
                    />
                  </KotakTtd>
                  <KotakSaksi
                    awalan={AWALAN}
                    no={1}
                    nama={form.saksi1Nama}
                    ttd={form.saksi1Ttd}
                    onNama={(v) => set("saksi1Nama", v)}
                    onTtd={(v) => set("saksi1Ttd", v)}
                    konteks={ttdKonteks("Saksi 1")}
                  />
                  <KotakSaksi
                    awalan={AWALAN}
                    no={2}
                    nama={form.saksi2Nama}
                    ttd={form.saksi2Ttd}
                    onNama={(v) => set("saksi2Nama", v)}
                    onTtd={(v) => set("saksi2Ttd", v)}
                    konteks={ttdKonteks("Saksi 2")}
                  />
                </div>
              </div>
            </BidangIsian>
          </KunciIsian>
          {p.ttdPernyataan.kaki}
        </BagianLangkah>
      </TataLetakLangkah>
    </IsianFrame>
  );
}

/* ================================================================ lencana */

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

/**
 * Kartu pilihan lembar: radio asli di dalam label (seluruh kartu = target klik).
 * Terpilih hanya mengubah warna border/latar (lebar border tetap) → tak menggeser tata letak.
 */
function KartuLembar({ lembar, ikon: Ikon, dipilih, onPilih }: { lembar: LembarRm22; ikon: LucideIcon; dipilih: boolean; onPilih: () => void }) {
  const m = META_LEMBAR[lembar];
  const setuju = lembar === "persetujuan";
  return (
    <label
      data-lembar={lembar}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border-2 border-border bg-surface p-4 transition-colors hover:border-border-strong",
        "has-focus-visible:ring-2 has-focus-visible:ring-brand-ring has-disabled:cursor-default has-disabled:hover:border-border",
        setuju ? "has-checked:border-success has-checked:bg-success-soft" : "has-checked:border-danger has-checked:bg-danger-soft",
      )}
    >
      <input
        type="radio"
        name="rm22-lembar"
        value={lembar}
        checked={dipilih}
        onChange={onPilih}
        className={cn(KONTROL_PILIHAN, "mt-3 size-5", setuju ? "accent-success" : "accent-danger")}
      />
      <span
        aria-hidden
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
          dipilih ? (setuju ? "bg-success text-white" : "bg-danger text-white") : setuju ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
        )}
      >
        <Ikon className="size-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-fg">{m.label}</span>
        <span className="block text-sm text-fg-muted">{m.ringkas}</span>
        <span className="mt-2 block text-[11px] font-medium tracking-wide text-fg-subtle">{m.judul}</span>
      </span>
    </label>
  );
}
