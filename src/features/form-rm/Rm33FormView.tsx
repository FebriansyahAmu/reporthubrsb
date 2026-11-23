"use client";

import { useState } from "react";
import { CircleCheckBig, CirclePause, CircleX, Lock, PenLine, Stethoscope, UserRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DatePicker, nowLocalDateTime } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { BidangIsian, KunciIsian, useTerkunci } from "@/features/form-rm/isian/kunci";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import {
  BagianLangkah,
  KONTROL,
  KakiLangkah,
  LabelKolom,
  LencanaLangkah,
  SyaratFinal,
  TOMBOL_KECIL,
  TataLetakLangkah,
  Wajib,
  fokusKe,
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
import { kosong, lengkapiInformasi, tanggalPanjang } from "@/features/form-rm/persetujuan/informasi";
import { tujuanPesan } from "@/features/form-rm/persetujuan/tujuan";
import {
  KEPUTUSAN_RM33,
  LANGKAH_RM33,
  META_KEPUTUSAN,
  META_LEMBAR_RM33,
  RM33_KOTA,
  TEKS_RM33,
  TTD_PERNYATAAN_RM33,
  emptyRm33Form,
  kekuranganRm33,
  keTujuan,
  statusLangkahRm33,
  tindakanRujukan,
  type IdLangkahRm33,
  type KeputusanRm33,
  type Rm33Data,
} from "@/features/form-rm/rm33.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

/* Tata letak isian RM.33 (tampilan pengisian saja — cetak tetap Rm33Document):
 * 7 langkah dalam dua bagian formulir kertas (A. Pemberian informasi, B.
 * Persetujuan / penundaan / penolakan), navigasi langkah lengket (scrollspy),
 * panel "Syarat finalisasi" + kekurangan per langkah yang memindahkan fokus ke
 * kolomnya. Syarat = `kekuranganRm33` (sumber yang sama dengan validasi FINAL
 * server). Path kolom tak berubah → simpan gabung, penanda SIMRS, aturan TTD
 * (`cekTtdRm33`), dan cetak tetap. */

const AWALAN = "rm33";
const idL = (id: IdLangkahRm33) => `rm33-langkah-${id}`;

const GRUP_A = "A. Pemberian informasi";
const GRUP_B = "B. Persetujuan / penundaan / penolakan";

/** Nama langkah di navigasi + kelompok (= bagian formulir kertas). */
const NAV: Record<IdLangkahRm33, { judul: string; singkat: string; grup: string }> = {
  rujukan: { judul: "Rencana rujukan", singkat: "Rujukan", grup: GRUP_A },
  pihak: { judul: "Pihak informasi", singkat: "Pihak", grup: GRUP_A },
  informasi: { judul: "Isi informasi", singkat: "Informasi", grup: GRUP_A },
  ttdInformasi: { judul: "Tanda tangan informasi", singkat: "TTD informasi", grup: GRUP_A },
  keputusan: { judul: "Keputusan pasien", singkat: "Keputusan", grup: GRUP_B },
  pernyataan: { judul: "Pernyataan", singkat: "Pernyataan", grup: GRUP_B },
  ttdPernyataan: { judul: "Tanda tangan, dokter & saksi", singkat: "TTD & saksi", grup: GRUP_B },
};

/** Data tersimpan → state UI lengkap (baris informasi yang hilang dilengkapi). */
function siapkan(data: unknown): Rm33Data {
  const d = (data && typeof data === "object" ? data : {}) as Partial<Rm33Data>;
  return { ...emptyRm33Form(), ...d, informasi: lengkapiInformasi(d.informasi) };
}

const tujuan = (id: IdLangkahRm33, pesan: string) => tujuanPesan(AWALAN, pesan) ?? idL(id);
const ringkasKurang = (kurang: readonly string[]) =>
  kurang.slice(0, 2).join(", ") + (kurang.length > 2 ? ` +${kurang.length - 2} lagi` : "");

const IKON_KEPUTUSAN: Record<KeputusanRm33, LucideIcon> = { setuju: CircleCheckBig, menunda: CirclePause, menolak: CircleX };
/** Judul langkah pernyataan: "Pernyataan persetujuan / penundaan / penolakan rujukan". */
const KATA_BENDA: Record<KeputusanRm33, string> = { setuju: "persetujuan", menunda: "penundaan", menolak: "penolakan" };

/** Warna per keputusan (setuju hijau, menunda kuning, menolak merah) — selalu disertai ikon & teks. */
const NADA_KEPUTUSAN: Record<KeputusanRm33, { kartu: string; radio: string; ikon: string; ikonPasif: string }> = {
  setuju: {
    kartu: "has-checked:border-success has-checked:bg-success-soft",
    radio: "accent-success",
    ikon: "bg-success text-white",
    ikonPasif: "bg-success-soft text-success",
  },
  menunda: {
    kartu: "has-checked:border-warning has-checked:bg-warning-soft",
    radio: "accent-warning",
    ikon: "bg-warning text-white",
    ikonPasif: "bg-warning-soft text-warning",
  },
  menolak: {
    kartu: "has-checked:border-danger has-checked:bg-danger-soft",
    radio: "accent-danger",
    ikon: "bg-danger text-white",
    ikonPasif: "bg-danger-soft text-danger",
  },
};

export function Rm33FormView({ isian, header, izin }: { isian: IsianForm; header: FormRmHeader; izin: IzinIsian }) {
  const k = useIsian(isian, izin, siapkan);
  const { form, setForm } = k;
  const [gantiKe, setGantiKe] = useState<KeputusanRm33 | null>(null);

  const set = <K extends keyof Rm33Data>(key: K, value: Rm33Data[K]) => setForm((f) => ({ ...f, [key]: value }));

  const kurang = kekuranganRm33(form);
  const alur = hitungAlur(LANGKAH_RM33, kurang, (id, x) => statusLangkahRm33(form, id, x), k.terkunci);
  const keputusan = form.keputusan ? META_KEPUTUSAN[form.keputusan] : null;
  const pasienNama = header.nama === "—" ? "" : header.nama;
  const ke = keTujuan(form.tujuanRujukan);
  const tglRujuk = tanggalPanjang(form.tanggalRujuk);
  const saranTindakan = tindakanRujukan(form.tujuanRujukan);
  // Daftar syarat hanya untuk yang bisa mengisi (DRAF & tidak terkunci).
  const draf = isian.status === "DRAF" && !k.terkunci;

  const langkah: Langkah[] = LANGKAH_RM33.map((l, i) => {
    const st = alur.status[l.id];
    const n = kurang[l.id].length;
    const tunggu = l.id === "ttdPernyataan" && !form.keputusan && st !== "lengkap";
    const ket = tunggu
      ? "Menunggu keputusan (langkah 5)"
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
  const butir: ButirSyarat[] = LANGKAH_RM33.map((l, i) => ({
    kunci: l.id,
    label: `${i + 1}. ${NAV[l.id].judul}`,
    ok: kurang[l.id].length === 0,
    tujuan: kurang[l.id].length ? tujuan(l.id, kurang[l.id][0]) : idL(l.id),
    ket: kurang[l.id].length ? ringkasKurang(kurang[l.id]) : undefined,
  }));

  /** Kartu langkah + kaki (kekurangan yang bisa diklik, "Lanjut"). */
  const props = (id: IdLangkahRm33) => {
    const i = LANGKAH_RM33.findIndex((l) => l.id === id);
    const berikut = LANGKAH_RM33[i + 1];
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

  /** TTD pernyataan, dokter, & saksi terikat pada keputusan → mengganti keputusan mengosongkannya (dengan konfirmasi). */
  function pilihKeputusan(x: KeputusanRm33) {
    if (form.keputusan === x) return;
    if (TTD_PERNYATAAN_RM33.some((s) => form[s] !== "")) setGantiKe(x);
    else set("keputusan", x);
  }
  function konfirmasiGanti() {
    if (!gantiKe) return;
    setForm((f) => ({ ...f, keputusan: gantiKe, pernyataTtd: "", dokterTtd: "", saksi1Ttd: "", saksi2Ttd: "" }));
    setGantiKe(null);
  }

  const ttdKonteks = (peran: string) => [pasienNama, `RM.33 — ${peran}`].filter(Boolean).join(" · ");
  const p = {
    rujukan: props("rujukan"),
    pihak: props("pihak"),
    informasi: props("informasi"),
    ttdInformasi: props("ttdInformasi"),
    keputusan: props("keputusan"),
    pernyataan: props("pernyataan"),
    ttdPernyataan: props("ttdPernyataan"),
  };

  return (
    <IsianFrame
      kendali={k}
      aksen={
        <span className="inline-flex items-center gap-2">
          <LencanaKeputusan keputusan={form.keputusan} ringkas />
          <span className="tabular-nums">
            {alur.jumlahLengkap}/{LANGKAH_RM33.length} langkah
          </span>
        </span>
      }
    >
      <TataLetakLangkah langkah={langkah} samping={draf && <SyaratFinal butir={butir} idJudul="rm33-syarat-judul" />}>
        <KepalaIsian
          header={header}
          urutan={isian.urutan}
          lencana={<LencanaKeputusan keputusan={form.keputusan} />}
          subjekLabel="Rujukan"
          subjek={[ke, tglRujuk].filter(Boolean).join(" · ")}
        />

        {/* ============================ A. PEMBERIAN INFORMASI ============================ */}

        <BagianLangkah
          {...p.rujukan.kartu}
          judul="Rencana rujukan"
          ket="Rumah sakit / fasilitas tujuan dan tanggal rujuk. Terisi otomatis bila surat rujukan keluar sudah dibuat di SIMRS."
        >
          <BidangIsian>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <LabelKolom htmlFor="rm33-tujuan" asal="tujuanRujukan" wajib>
                  Dirujuk ke (rumah sakit / fasilitas tujuan)
                </LabelKolom>
                <Input
                  id="rm33-tujuan"
                  value={form.tujuanRujukan}
                  maxLength={200}
                  onChange={(e) => set("tujuanRujukan", e.target.value)}
                  placeholder="mis. RSUP Prof. Dr. R. D. Kandou Manado (Penyakit Dalam)"
                  aria-describedby="rm33-tujuan-ket"
                  enterKeyHint="next"
                  className={KONTROL}
                />
                <p id="rm33-tujuan-ket" className="mt-1.5 text-xs text-fg-subtle">
                  Cukup nama faskes (dan poli). Kata “ke” ditambahkan otomatis pada pernyataan.
                </p>
              </div>
              <div className="min-w-0">
                <LabelKolom htmlFor="rm33-tgl-rujuk" asal="tanggalRujuk" wajib>
                  Tanggal rujuk
                </LabelKolom>
                <DatePicker id="rm33-tgl-rujuk" value={form.tanggalRujuk} onChange={(v) => set("tanggalRujuk", v)} placeholder="Pilih tanggal" />
                {!form.tanggalRujuk && <Saran onClick={() => set("tanggalRujuk", nowLocalDateTime().slice(0, 10))}>Rujuk hari ini</Saran>}
              </div>
            </div>
          </BidangIsian>
          {p.rujukan.kaki}
        </BagianLangkah>

        <BagianLangkah
          {...p.pihak.kartu}
          judul="Pihak pemberian informasi"
          ket="Dokter yang merujuk (pelaksana), dokter yang memberi informasi, dan pasien/keluarga yang menerimanya."
        >
          <BidangIsian>
            <PihakInformasi awalan={AWALAN} form={form} set={set} pasienNama={pasienNama} />
          </BidangIsian>
          {p.pihak.kaki}
        </BagianLangkah>

        <BagianLangkah
          {...p.informasi.kartu}
          judul="Jenis & isi informasi"
          ket="Isi setiap jenis informasi tentang rujukan (tulis “-” bila tidak berlaku)."
          aksi={<MeterInformasi informasi={form.informasi} />}
        >
          <BidangIsian>
            <TabelInformasi
              awalan={AWALAN}
              informasi={form.informasi}
              onIsi={(id, isi) => setForm((f) => ({ ...f, informasi: ubahIsiInformasi(f.informasi, id, isi) }))}
              onTanda={(id, tanda) => setForm((f) => ({ ...f, informasi: { ...f.informasi, [id]: { ...f.informasi[id], tanda } } }))}
              onTandaiSemua={() => setForm((f) => ({ ...f, informasi: tandaiSemuaInformasi(f.informasi) }))}
              saran={{
                tindakan:
                  saranTindakan && form.informasi.tindakan.isi.trim() !== saranTindakan ? (
                    <Saran onClick={() => setForm((f) => ({ ...f, informasi: ubahIsiInformasi(f.informasi, "tindakan", saranTindakan) }))}>
                      Isi: {saranTindakan}
                    </Saran>
                  ) : null,
              }}
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
            <TtdInformasi form={form} set={set} konteks={ttdKonteks} noPihak={2} awalan={AWALAN} />
          </BidangIsian>
          {p.ttdInformasi.kaki}
        </BagianLangkah>

        {/* =============== B. PERSETUJUAN / PENUNDAAN / PENOLAKAN RUJUKAN =============== */}

        <BagianLangkah
          {...p.keputusan.kartu}
          judul="Keputusan pasien / wali"
          ket="Setuju memakai lembar Persetujuan Rujukan; menunda atau menolak memakai lembar Penundaan & Penolakan Rujukan. Pernyataan & tanda tangan berikutnya mengikuti keputusan ini."
        >
          {/* Wadah container query DI LUAR fieldset ber-legend (Chromium tak merender ulang wadah yang jadi anak fieldset ber-legend). */}
          <div className="@container">
            <BidangIsian>
              <fieldset id="rm33-keputusan" tabIndex={-1} className="m-0 min-w-0 border-0 p-0 outline-none">
                <legend className="mb-2 p-0 text-xs font-medium text-fg-muted">
                  Keputusan atas rencana rujukan <Wajib />
                </legend>
                <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-3">
                  {KEPUTUSAN_RM33.map((x) => (
                    <KartuKeputusan key={x} keputusan={x} dipilih={form.keputusan === x} onPilih={() => pilihKeputusan(x)} />
                  ))}
                </div>
              </fieldset>
            </BidangIsian>
          </div>
          {keputusan && !gantiKe && (
            <p className="mt-3 rounded-[var(--radius-md)] bg-surface-2/60 px-3 py-2 text-xs text-fg-muted">
              Tercetak pada <b className="text-fg">{META_LEMBAR_RM33[keputusan.lembar].label}</b>:{" "}
              {keputusan.lembar === "persetujuan" ? (
                <>
                  “Dengan ini menyatakan <b className="text-fg">SETUJU</b> untuk rujuk …”
                </>
              ) : (
                <>
                  “dengan ini menyatakan <KataPilihan pilih={form.keputusan === "menunda"}>MENUNDA</KataPilihan>/
                  <KataPilihan pilih={form.keputusan === "menolak"}>MENOLAK</KataPilihan> untuk rujuk …” — pilihan lain dicoret.
                </>
              )}
            </p>
          )}
          {gantiKe && (
            <KonfirmasiGanti id="rm33-ganti-judul" label="Ganti keputusan" onBatal={() => setGantiKe(null)} onYa={konfirmasiGanti}>
              Ganti ke <b>{META_KEPUTUSAN[gantiKe].label}</b>? Tanda tangan yang menyatakan, dokter, dan saksi akan dihapus dan harus dibuat
              ulang.
            </KonfirmasiGanti>
          )}
          {p.keputusan.kaki}
        </BagianLangkah>

        <BagianLangkah
          {...p.pernyataan.kartu}
          judul={form.keputusan ? `Pernyataan ${KATA_BENDA[form.keputusan]} rujukan` : "Pernyataan"}
          ket="Identitas yang menyatakan dan pasien yang dirujuk; tanggal & tujuan rujukan diambil dari langkah 1."
        >
          <BidangIsian className="space-y-5">
            <BagianYangMenyatakan
              awalan={AWALAN}
              form={form}
              setForm={setForm}
              pasienNamaHeader={pasienNama}
              objek="Rujukan"
              judulPasien="Pasien yang dirujuk"
              tengah={<RingkasRujukan kata={keputusan?.kata ?? ""} tanggal={tglRujuk} ke={ke} />}
            />

            <TempatTanggal id="rm33-tanggal" kota={RM33_KOTA} value={form.tanggal} onChange={(v) => set("tanggal", v)} />

            <PratinjauPernyataan>
              <KalimatIdentitas d={form} />, dengan ini menyatakan <NilaiKalimat nilai={keputusan?.kata ?? ""} kosongTeks="setuju / menunda / menolak" />{" "}
              untuk rujuk tanggal <NilaiKalimat nilai={tglRujuk} kosongTeks="tanggal" /> <NilaiKalimat nilai={ke} kosongTeks="ke tujuan" />{" "}
              terhadap <KalimatTerhadap d={form} />. {TEKS_RM33.memahami} <NilaiKalimat nilai={ke} kosongTeks="ke tujuan" />{" "}
              {TEKS_RM33.memahamiLanjut}
            </PratinjauPernyataan>
          </BidangIsian>
          {p.pernyataan.kaki}
        </BagianLangkah>

        <BagianLangkah
          {...p.ttdPernyataan.kartu}
          judul="Tanda tangan yang menyatakan, dokter & saksi"
          ket="Ditandatangani setelah keputusan dipilih. Dokter = dokter yang menindak; minimal satu saksi lengkap (nama & tanda tangan), mis. perawat atau keluarga."
        >
          {draf && <SyaratFinal butir={butir} idJudul="rm33-syarat-judul-ponsel" className="mb-5 xl:hidden" />}
          {!form.keputusan && (
            <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-fg">
              <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              Pilih keputusan di langkah 5 lebih dulu — tanda tangan terikat pada keputusan setuju, menunda, atau menolak.
            </p>
          )}
          <KunciIsian terkunci={k.terkunci || !form.keputusan}>
            <BidangIsian>
              <div className="@container">
                <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
                  <KotakTtd
                    ikon={UserRound}
                    peran="Yang menyatakan"
                    nama={form.pernyataNama}
                    kosongNama="Isi nama di langkah 6"
                    sudah={form.pernyataTtd !== ""}
                    idTtd="rm33-ttd-pernyata"
                  >
                    <SignaturePad
                      label="Tanda tangan yang menyatakan"
                      value={form.pernyataTtd}
                      onChange={(v) => set("pernyataTtd", v)}
                      context={ttdKonteks(keputusan ? `${keputusan.label} — yang menyatakan` : "Yang menyatakan")}
                      reuse={samaNama(form.pernyataNama, form.penerimaInformasi) ? form.penerimaTtd : ""}
                    />
                  </KotakTtd>
                  <KotakTtd ikon={Stethoscope} peran="Dokter" nama={form.dokterNama} sudah={form.dokterTtd !== ""} idTtd="rm33-ttd-dokter">
                    <div className="mb-3">
                      <LabelKolom htmlFor="rm33-dokter" asal="dokterNama" wajib>
                        Nama dokter yang menindak
                      </LabelKolom>
                      <Input
                        id="rm33-dokter"
                        value={form.dokterNama}
                        maxLength={120}
                        onChange={(e) => set("dokterNama", e.target.value)}
                        placeholder="Nama dokter beserta gelar"
                        enterKeyHint="next"
                        className={KONTROL}
                      />
                      <div className="flex flex-wrap gap-x-1.5">
                        {!kosong(form.dokterPelaksana) && !samaNama(form.dokterNama, form.dokterPelaksana) && (
                          <Saran onClick={() => set("dokterNama", form.dokterPelaksana)}>Dokter pelaksana: {form.dokterPelaksana}</Saran>
                        )}
                        {!kosong(form.pemberiInformasi) &&
                          !samaNama(form.dokterNama, form.pemberiInformasi) &&
                          !samaNama(form.dokterPelaksana, form.pemberiInformasi) && (
                            <Saran onClick={() => set("dokterNama", form.pemberiInformasi)}>Pemberi informasi: {form.pemberiInformasi}</Saran>
                          )}
                        <SaranNamaSaya nama={form.dokterNama} onPilih={(v) => set("dokterNama", v)} />
                      </div>
                    </div>
                    <SignaturePad
                      label="Tanda tangan dokter"
                      value={form.dokterTtd}
                      onChange={(v) => set("dokterTtd", v)}
                      context={ttdKonteks(keputusan ? `${keputusan.label} — dokter` : "Dokter")}
                      reuse={samaNama(form.dokterNama, form.pemberiInformasi) ? form.pemberiTtd : ""}
                      petugas={{ nama: form.dokterNama, onNama: (v) => set("dokterNama", v) }}
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
              <p className="mt-3 text-xs text-fg-subtle">Penanda tangan lazim: {TEKS_RM33.catatanTtd}.</p>
            </BidangIsian>
          </KunciIsian>
          {p.ttdPernyataan.kaki}
        </BagianLangkah>
      </TataLetakLangkah>
    </IsianFrame>
  );
}

/* ================================================================ bagian */

/**
 * "… dengan ini menyatakan [keputusan] untuk rujuk tanggal … ke …" — urutan
 * kalimat formulir kertas. Tanggal & tujuan tidak diketik ulang: diambil dari
 * langkah 1 (satu sumber), dengan pintasan untuk mengubahnya di sana.
 */
function RingkasRujukan({ kata, tanggal, ke }: { kata: string; tanggal: string; ke: string }) {
  const terkunci = useTerkunci();
  const lengkap = tanggal !== "" && ke !== "";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/40 px-3 py-2 text-[13px] text-fg-muted">
      <p className="min-w-0">
        Dengan ini menyatakan <NilaiKalimat nilai={kata} kosongTeks="setuju / menunda / menolak" /> untuk rujuk tanggal{" "}
        <NilaiKalimat nilai={tanggal} kosongTeks="tanggal" /> <NilaiKalimat nilai={ke} kosongTeks="ke tujuan" />
      </p>
      {!terkunci && (
        <button type="button" onClick={() => fokusKe(ke === "" || tanggal !== "" ? "rm33-tujuan" : "rm33-tgl-rujuk")} className={TOMBOL_KECIL}>
          <PenLine className="size-3.5" aria-hidden />
          {lengkap ? "Ubah di langkah 1" : "Isi di langkah 1"}
        </button>
      )}
    </div>
  );
}

/* ================================================================ lencana */

function LencanaKeputusan({ keputusan, ringkas }: { keputusan: Rm33Data["keputusan"]; ringkas?: boolean }) {
  if (!keputusan) {
    return (
      <Badge tone="warning" dot>
        Keputusan belum dipilih
      </Badge>
    );
  }
  const m = META_KEPUTUSAN[keputusan];
  const Ikon = IKON_KEPUTUSAN[keputusan];
  return (
    <Badge tone={m.nada}>
      <Ikon className="size-3.5" aria-hidden />
      {ringkas ? m.lencana : m.label}
    </Badge>
  );
}

/** "MENUNDA/MENOLAK" seperti tercetak: pilihan yang tidak dipilih dicoret. */
function KataPilihan({ pilih, children }: { pilih: boolean; children: React.ReactNode }) {
  return <span className={pilih ? "font-semibold text-fg" : "line-through opacity-70"}>{children}</span>;
}

/**
 * Kartu pilihan keputusan: radio asli di dalam label (seluruh kartu = target klik).
 * Terpilih hanya mengubah warna border/latar (lebar border tetap) → tak menggeser tata letak.
 */
function KartuKeputusan({ keputusan, dipilih, onPilih }: { keputusan: KeputusanRm33; dipilih: boolean; onPilih: () => void }) {
  const m = META_KEPUTUSAN[keputusan];
  const nada = NADA_KEPUTUSAN[keputusan];
  const Ikon = IKON_KEPUTUSAN[keputusan];
  return (
    <label
      data-keputusan={keputusan}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border-2 border-border bg-surface p-4 transition-colors hover:border-border-strong",
        "has-focus-visible:ring-2 has-focus-visible:ring-brand-ring has-disabled:cursor-default has-disabled:hover:border-border",
        nada.kartu,
      )}
    >
      <input
        type="radio"
        name="rm33-keputusan"
        value={keputusan}
        checked={dipilih}
        onChange={onPilih}
        className={cn(KONTROL_PILIHAN, "mt-1.5 size-5", nada.radio)}
      />
      {/* Ikon sebaris dengan judul → keterangan mendapat lebar penuh (tiga kartu sebaris di layar lebar). */}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-full transition-colors", dipilih ? nada.ikon : nada.ikonPasif)}>
            <Ikon className="size-5" />
          </span>
          <span className="min-w-0 text-base font-semibold text-fg">{m.label}</span>
        </span>
        <span className="mt-1.5 block text-sm text-fg-muted">{m.ringkas}</span>
        <span className="mt-2 block text-[11px] font-medium tracking-wide text-fg-subtle">{META_LEMBAR_RM33[m.lembar].label}</span>
      </span>
    </label>
  );
}
