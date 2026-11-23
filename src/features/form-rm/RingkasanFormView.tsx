"use client";

import { HeartPulse, Stethoscope } from "lucide-react";
import { DatePicker, nowLocalDateTime } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { KeadaanKeluarTertaut } from "@/features/form-rm/KeadaanKeluarTertaut";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { BidangIsian } from "@/features/form-rm/isian/kunci";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import {
  BagianLangkah,
  IsiCepat,
  ItemId,
  KONTROL,
  KakiLangkah,
  KolomWaktu,
  LabelKolom,
  LencanaLangkah,
  SyaratFinal,
  TataLetakLangkah,
  fmtTanggal,
  type ButirSyarat,
  type PilihanCepat,
} from "@/features/form-rm/isian/langkah/bagian";
import type { Langkah } from "@/features/form-rm/isian/langkah/NavLangkah";
import { PilihanCentang } from "@/features/form-rm/isian/langkah/PilihanCentang";
import { KARTU_PILIHAN, KONTROL_PILIHAN, PilihanRadio } from "@/features/form-rm/isian/langkah/PilihanRadio";
import { KotakTtd, samaNama } from "@/features/form-rm/persetujuan/bidang";
import {
  AGAMA_OPTS,
  BANGSA_OPTS,
  CARA_MASUK_OPTS,
  IMUNISASI_OPTS,
  IZIN_KELUAR_OPTS,
  JENIS_PELAYANAN_OPTS,
  LANGKAH_RINGKASAN,
  PEKERJAAN_OPTS,
  PENDIDIKAN_OPTS,
  PERKAWINAN_OPTS,
  PESERTA_OPTS,
  RUDA_PAKSA_OPTS,
  emptyRingkasanForm,
  hitungLamaRawat,
  lengkapiRingkasan,
  ringkasLangkahRingkasan,
  syaratRingkasan,
  type IdLangkahRingkasan,
  type KolomSyaratRingkasan,
} from "@/features/form-rm/ringkasan.constants";
import type { BacaKeluarSimrs, FormRmHeader, RingkasanForm } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

/* Tata letak isian RM.01 (tampilan pengisian saja — cetak tetap RingkasanDocument):
 * 6 langkah dalam dua kelompok = dua halaman kertas, navigasi langkah lengket
 * (scrollspy), panel "Syarat finalisasi" (`syaratRingkasan` — sumber yang sama
 * dengan validasi FINAL server). Semua pilihan = radio/checkbox asli. Path kolom
 * tak berubah → simpan gabung IGD→RI per kolom, penanda SIMRS, keadaan keluar
 * tertaut SIMRS, dan cetak tetap. */

const idL = (id: IdLangkahRingkasan) => `rm01-langkah-${id}`;

/** Kolom syarat FINAL → id elemen yang difokuskan. */
const TUJUAN: Record<KolomSyaratRingkasan, string> = {
  dokterMerawatNama: "rm01-dokter",
  dokterMerawatTtd: "rm01-ttd-dokter",
  skA: "rm01-sk-a",
  dokterKematianNama: "rm01-dokter-kematian",
  dokterKematianTtd: "rm01-ttd-kematian",
};

const opsi = (o: readonly string[]) => o.map((v) => ({ value: v, label: v }));
const YA_TIDAK = opsi(["Ya", "Tidak"]);

/** Data tersimpan → state UI: Sebab Kematian II selalu 3 baris. */
const siapkan = (data: unknown): RingkasanForm => lengkapiRingkasan({ ...emptyRingkasanForm(), ...(data as RingkasanForm) });

const jkSingkat = (jk: string) => (jk === "Laki-Laki" ? "L" : jk === "Perempuan" ? "P" : "");

export function RingkasanFormView({
  isian,
  header,
  izin,
  keluar,
}: {
  isian: IsianForm;
  header: FormRmHeader;
  izin: IzinIsian;
  /** Keluar menurut SIMRS (dibaca saat halaman dibuka); null bila isian belum tertaut. */
  keluar: BacaKeluarSimrs | null;
}) {
  const k = useIsian(isian, izin, siapkan);
  const { form, setForm } = k;
  // Keadaan Keluar tertaut SIMRS: DRAF = SIMRS terkini (tak terpengaruh "Muat ulang" yang mengganti state
  // dengan data tersimpan); FINAL/BATAL = nilai yang dibekukan server.
  const keadaanKeluar =
    k.isian.status !== "DRAF"
      ? String((k.isian.data as Partial<RingkasanForm> | null)?.keadaanKeluar ?? "")
      : keluar && keluar.status !== "gagal"
        ? (keluar.keluar?.nilaiForm ?? "")
        : form.keadaanKeluar;
  const meninggalSimrs = keluar?.status === "ada" && !!keluar.keluar?.meninggal;
  // Daftar syarat hanya untuk yang bisa mengisi (DRAF & tidak terkunci).
  const draf = isian.status === "DRAF" && !k.terkunci;

  const set = <K extends keyof RingkasanForm>(key: K, value: RingkasanForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setSkLain = (i: number, field: "teks" | "lama", v: string) =>
    setForm((f) => ({ ...f, skLain: f.skLain.map((x, j) => (j === i ? { ...x, [field]: v } : x)) }));

  const ringkas = ringkasLangkahRingkasan(form, meninggalSimrs);
  const syarat = syaratRingkasan(form);
  const mati = form.sebabKematianAktif;
  const pasien = header.nama === "—" ? "" : header.nama;
  const konteks = (peran: string) => [pasien, `RM.01 — ${peran}`].filter(Boolean).join(" · ");

  const langkah: Langkah[] = LANGKAH_RINGKASAN.map((l, i) => ({
    id: idL(l.id),
    no: i + 1,
    judul: l.judul,
    singkat: l.singkat,
    grup: l.grup,
    status: ringkas[l.id].status,
    ket: ringkas[l.id].ket,
  }));
  const butir: ButirSyarat[] = syarat.map((s) => ({ kunci: s.kolom, label: s.label, ok: s.ok, tujuan: TUJUAN[s.kolom] }));

  /** Kartu langkah + kaki (kekurangan syarat yang bisa diklik, "Lanjut"). */
  const props = (id: IdLangkahRingkasan) => {
    const i = LANGKAH_RINGKASAN.findIndex((l) => l.id === id);
    const berikut = LANGKAH_RINGKASAN[i + 1];
    const r = ringkas[id];
    return {
      kartu: {
        id: idL(id),
        no: i + 1,
        lencana: <LencanaLangkah status={r.status} kurang={r.sisa} />,
      },
      kaki: (
        <KakiLangkah
          kurang={r.kurang.map((s) => ({ label: s.label, tujuan: TUJUAN[s.kolom] }))}
          tampilKurang={r.status !== "kosong"}
          lanjut={berikut && { id: idL(berikut.id), judul: berikut.judul }}
        />
      ),
    };
  };
  const p = Object.fromEntries(LANGKAH_RINGKASAN.map((l) => [l.id, props(l.id)])) as Record<IdLangkahRingkasan, ReturnType<typeof props>>;

  /* ---------------------------------------------------------- isi cepat */

  const lamaHitung = hitungLamaRawat(form.tglMasuk, form.tglKeluar);
  const cepatLama: PilihanCepat[] =
    lamaHitung && lamaHitung !== form.lamaRawat.trim()
      ? [{ kunci: "hitung", ket: "Hitung dari tanggal", nilai: `${lamaHitung} hari`, pilih: () => set("lamaRawat", lamaHitung) }]
      : [];
  const cepatDokter: PilihanCepat[] =
    form.dpjp.trim() && !samaNama(form.dpjp, form.dokterMerawatNama)
      ? [{ kunci: "dpjp", ket: "DPJP", nilai: form.dpjp.trim(), pilih: () => set("dokterMerawatNama", form.dpjp.trim()) }]
      : [];
  const cepatDokterMati: PilihanCepat[] =
    form.dokterMerawatNama.trim() && !samaNama(form.dokterMerawatNama, form.dokterKematianNama)
      ? [{ kunci: "merawat", ket: "Dokter yang merawat", nilai: form.dokterMerawatNama.trim(), pilih: () => set("dokterKematianNama", form.dokterMerawatNama.trim()) }]
      : [];
  const tglKeluar = /^\d{4}-\d{2}-\d{2}/.test(form.tglKeluar) ? form.tglKeluar.slice(0, 10) : "";
  // Server mengisi tanggal ini = hari isian dibuat → "Tanggal keluar" tetap ditawarkan selama berbeda.
  // "Hari ini" dihitung saat diklik (bukan saat render) → tak ada selisih tanggal server/peramban.
  const cepatTglMati: PilihanCepat[] = [
    ...(tglKeluar && tglKeluar !== form.sebabKematianTanggal
      ? [{ kunci: "keluar", ket: "Tanggal keluar", nilai: fmtTanggal(tglKeluar), pilih: () => set("sebabKematianTanggal", tglKeluar) }]
      : []),
    ...(form.sebabKematianTanggal
      ? []
      : [{ kunci: "hari-ini", ket: "Hari ini", nilai: "", pilih: () => set("sebabKematianTanggal", nowLocalDateTime().slice(0, 10)) }]),
  ];
  const cepatNosokomial: PilihanCepat[] = form.infeksiNosokomial.trim()
    ? []
    : [{ kunci: "tidak", ket: "Tidak ada", nilai: "", pilih: () => set("infeksiNosokomial", "Tidak ada") }];

  return (
    <IsianFrame kendali={k}>
      <TataLetakLangkah langkah={langkah} samping={draf && <SyaratFinal butir={butir} idJudul="rm01-syarat-judul" />}>
        {/* ------------------------------------------------ 1. Identitas & keluarga */}
        <BagianLangkah
          {...p.identitas.kartu}
          judul="Identitas & keluarga terdekat"
          ket="Identitas dari pendaftaran SIMRS; alamat, telepon, dan keluarga terdekat terisi dari SIMRS bila ada."
        >
          <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded-[var(--radius-md)] bg-surface-2/50 px-3 py-2.5 text-sm @2xl:grid-cols-4">
            <ItemId label="No. rekam medis" value={header.norm} mono />
            <ItemId label="Nama pasien" value={jkSingkat(header.jenisKelamin) ? `${header.nama} (${jkSingkat(header.jenisKelamin)})` : header.nama} strong />
            <ItemId label="NIK" value={header.nik} mono />
            <ItemId
              label="Tgl lahir / umur"
              value={[header.tanggalLahir ? fmtTanggal(header.tanggalLahir) : "", header.umur ? `(${header.umur})` : ""].filter(Boolean).join(" ")}
            />
          </dl>
          <BidangIsian className="space-y-5">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 @2xl:grid-cols-4">
              <div className="@2xl:col-span-2 @2xl:row-span-2">
                <KolomAlamat id="rm01-alamat" label="Alamat" asal="alamat" value={form.alamat} onChange={(v) => set("alamat", v)} />
              </div>
              <KolomTelp id="rm01-telp" label="Telp / HP" asal="telp" value={form.telp} onChange={(v) => set("telp", v)} />
              <Kolom id="rm01-dirawat-ke" label="Dirawat yang ke-" asal="dirawatKe" value={form.dirawatKe} onChange={(v) => set("dirawatKe", v)} placeholder="mis. 1" inputMode="numeric" />
              <Kolom id="rm01-gol-darah" label="Golongan darah" asal="golDarah" value={form.golDarah} onChange={(v) => set("golDarah", v)} placeholder="A / B / AB / O" />
            </div>
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-2 p-0 text-sm font-semibold text-fg">Keluarga terdekat</legend>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 @2xl:grid-cols-4">
                <Kolom id="rm01-keluarga-nama" label="Nama" asal="keluargaNama" value={form.keluargaNama} onChange={(v) => set("keluargaNama", v)} placeholder="Nama keluarga terdekat" />
                <div className="@2xl:col-span-2">
                  <KolomAlamat id="rm01-keluarga-alamat" label="Alamat" asal="keluargaAlamat" value={form.keluargaAlamat} onChange={(v) => set("keluargaAlamat", v)} />
                </div>
                <KolomTelp id="rm01-keluarga-telp" label="Telp / HP" asal="keluargaTelp" value={form.keluargaTelp} onChange={(v) => set("keluargaTelp", v)} />
              </div>
            </fieldset>
          </BidangIsian>
          {p.identitas.kaki}
        </BagianLangkah>

        {/* ------------------------------------------------ 2. Data sosial */}
        <BagianLangkah {...p.sosial.kartu} judul="Data sosial" ket="Pilih satu pada tiap kelompok (kotak ☐ formulir). Terisi dari data pasien SIMRS bila ada.">
          <BidangIsian className="space-y-5">
            <PilihanRadio
              id="rm01-pendidikan"
              legend="Pendidikan terakhir"
              asal={["pendidikan", "pendidikanLain"]}
              ringkas
              bolehKosong
              value={form.pendidikan}
              onChange={(v) => set("pendidikan", v)}
              opsi={opsi(PENDIDIKAN_OPTS)}
            >
              <KolomLainLain id="rm01-pendidikan-lain" value={form.pendidikanLain} onChange={(v) => set("pendidikanLain", v)} />
            </PilihanRadio>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 @3xl:grid-cols-2">
              <PilihanRadio id="rm01-bangsa" legend="Bangsa" asal="bangsa" ringkas bolehKosong value={form.bangsa} onChange={(v) => set("bangsa", v as RingkasanForm["bangsa"])} opsi={opsi(BANGSA_OPTS)} />
              <PilihanRadio id="rm01-agama" legend="Agama" asal="agama" ringkas bolehKosong value={form.agama} onChange={(v) => set("agama", v)} opsi={opsi(AGAMA_OPTS)} />
              <PilihanRadio
                id="rm01-perkawinan"
                legend="Status perkawinan"
                asal="statusPerkawinan"
                ringkas
                bolehKosong
                value={form.statusPerkawinan}
                onChange={(v) => set("statusPerkawinan", v)}
                opsi={opsi(PERKAWINAN_OPTS)}
              />
              <PilihanRadio id="rm01-pekerjaan" legend="Pekerjaan" asal="pekerjaan" ringkas bolehKosong value={form.pekerjaan} onChange={(v) => set("pekerjaan", v)} opsi={opsi(PEKERJAAN_OPTS)} />
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 @2xl:grid-cols-2">
              <Kolom id="rm01-ortu-nama" label="Nama orang tua" asal="namaOrangTua" value={form.namaOrangTua} onChange={(v) => set("namaOrangTua", v)} placeholder="Nama ayah / ibu" />
              <Kolom
                id="rm01-ortu-pekerjaan"
                label="Pekerjaan orang tua"
                asal="pekerjaanOrangTua"
                value={form.pekerjaanOrangTua}
                onChange={(v) => set("pekerjaanOrangTua", v)}
                placeholder="Pekerjaan orang tua"
              />
            </div>
          </BidangIsian>
          {p.sosial.kaki}
        </BagianLangkah>

        {/* ------------------------------------------------ 3. Masuk & perawatan */}
        <BagianLangkah {...p.perawatan.kartu} judul="Masuk & perawatan" ket="Cara masuk, jenis pelayanan, waktu rawat, dokter jaga/DPJP, penjamin, dan izin keluar.">
          <BidangIsian className="space-y-5">
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 @3xl:grid-cols-2">
              <PilihanRadio
                id="rm01-cara-masuk"
                legend="Cara masuk rumah sakit"
                asal="caraMasuk"
                ringkas
                bolehKosong
                value={form.caraMasuk}
                onChange={(v) => set("caraMasuk", v)}
                opsi={opsi(CARA_MASUK_OPTS)}
              />
              <PilihanRadio
                id="rm01-jenis-pelayanan"
                legend="Jenis pelayanan"
                asal="jenisPelayanan"
                ringkas
                bolehKosong
                value={form.jenisPelayanan}
                onChange={(v) => set("jenisPelayanan", v)}
                opsi={opsi(JENIS_PELAYANAN_OPTS)}
              />
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem]">
              <KolomWaktu id="rm01-tgl-masuk" label="Tanggal & jam masuk (WITA)" asal="tglMasuk" value={form.tglMasuk} onChange={(v) => set("tglMasuk", v)} />
              <KolomWaktu id="rm01-tgl-keluar" label="Tanggal & jam keluar (WITA)" asal="tglKeluar" value={form.tglKeluar} onChange={(v) => set("tglKeluar", v)} />
              <div>
                <Kolom id="rm01-lama-rawat" label="Lama rawat (hari)" asal="lamaRawat" value={form.lamaRawat} onChange={(v) => set("lamaRawat", v)} placeholder="0" inputMode="numeric" />
                <IsiCepat pilihan={cepatLama} judul="Isi:" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 @2xl:grid-cols-2">
              <Kolom
                id="rm01-diagnosa-sementara"
                label="Diagnosa sementara"
                asal="diagnosaSementara"
                value={form.diagnosaSementara}
                onChange={(v) => set("diagnosaSementara", v)}
                placeholder="Diagnosa saat masuk"
              />
              <Kolom id="rm01-dpjp" label="Dokter jaga / DPJP" asal="dpjp" value={form.dpjp} onChange={(v) => set("dpjp", v)} placeholder="Nama dokter" />
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <PilihanRadio
                id="rm01-peserta"
                legend="Peserta"
                asal="peserta"
                ringkas
                bolehKosong
                value={form.peserta}
                onChange={(v) => set("peserta", v as RingkasanForm["peserta"])}
                opsi={opsi(PESERTA_OPTS)}
              />
              <PilihanRadio
                id="rm01-izin-keluar"
                legend="Izin keluar"
                asal="izinKeluar"
                ringkas
                bolehKosong
                value={form.izinKeluar}
                onChange={(v) => set("izinKeluar", v)}
                opsi={opsi(IZIN_KELUAR_OPTS)}
              />
            </div>
          </BidangIsian>
          {p.perawatan.kaki}
        </BagianLangkah>

        {/* ------------------------------------------------ 4. Diagnosa akhir & catatan */}
        <BagianLangkah
          {...p.diagnosa.kartu}
          judul="Diagnosa akhir & catatan"
          ket="Diagnosa beserta kode ICD-10 (operasi: ICD-9-CM). Diagnosa utama & sekunder terisi dari SIMRS bila ada."
        >
          <BidangIsian className="space-y-5">
            <div className="space-y-4">
              <BarisDiagnosa
                id="rm01-dx-utama"
                label="Diagnosa utama"
                kodeLabel="Kode ICD-10"
                asal={["diagnosaUtama", "diagnosaUtamaKode"]}
                teks={form.diagnosaUtama}
                kode={form.diagnosaUtamaKode}
                onTeks={(v) => set("diagnosaUtama", v)}
                onKode={(v) => set("diagnosaUtamaKode", v)}
              />
              <BarisDiagnosa
                id="rm01-dx-sekunder"
                label="Diagnosa sekunder"
                kodeLabel="Kode ICD-10"
                asal={["diagnosaSekunder", "diagnosaSekunderKode"]}
                teks={form.diagnosaSekunder}
                kode={form.diagnosaSekunderKode}
                onTeks={(v) => set("diagnosaSekunder", v)}
                onKode={(v) => set("diagnosaSekunderKode", v)}
              />
              <BarisDiagnosa
                id="rm01-dx-komplikasi"
                label="Komplikasi"
                kodeLabel="Kode ICD-10"
                teks={form.komplikasi}
                kode={form.komplikasiKode}
                onTeks={(v) => set("komplikasi", v)}
                onKode={(v) => set("komplikasiKode", v)}
              />
              <BarisDiagnosa
                id="rm01-dx-luar"
                label="Penyebab luar cedera & keracunan"
                kodeLabel="Kode ICD-10"
                teks={form.penyebabLuar}
                kode={form.penyebabLuarKode}
                onTeks={(v) => set("penyebabLuar", v)}
                onKode={(v) => set("penyebabLuarKode", v)}
              />
              <BarisDiagnosa
                id="rm01-dx-operasi"
                label="Operasi"
                kodeLabel="Kode ICD-9-CM"
                teks={form.operasi}
                kode={form.operasiKode}
                onTeks={(v) => set("operasi", v)}
                onKode={(v) => set("operasiKode", v)}
              />
            </div>
            <div className="border-t border-border pt-5">
              <LabelKolom htmlFor="rm01-catatan" opsional>
                Catatan
              </LabelKolom>
              <textarea
                id="rm01-catatan"
                rows={2}
                maxLength={600}
                value={form.catatan}
                onChange={(e) => set("catatan", e.target.value)}
                className="block w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 pointer-coarse:text-base"
              />
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 @2xl:grid-cols-2">
              <div>
                <Kolom id="rm01-nosokomial" label="Infeksi nosokomial" value={form.infeksiNosokomial} onChange={(v) => set("infeksiNosokomial", v)} placeholder="Ada / Tidak ada" />
                <IsiCepat pilihan={cepatNosokomial} judul="Isi:" />
              </div>
              <Kolom
                id="rm01-nosokomial-penyebab"
                label="Penyebab infeksi nosokomial"
                value={form.penyebabInfeksiNosokomial}
                onChange={(v) => set("penyebabInfeksiNosokomial", v)}
                placeholder="Penyebab"
              />
            </div>
            <PilihanCentang legend="Sejarah imunisasi" opsi={IMUNISASI_OPTS} nilai={form.imunisasi} onUbah={(v) => set("imunisasi", v)} />
          </BidangIsian>
          {p.diagnosa.kaki}
        </BagianLangkah>

        {/* ------------------------------------------------ 5. Keadaan keluar & dokter */}
        <BagianLangkah
          {...p.keluar.kartu}
          judul="Keadaan keluar & dokter yang merawat"
          ket="Keadaan keluar mengikuti data pasien pulang di SIMRS. Dokter yang merawat menandatangani halaman 1."
        >
          <div className="grid grid-cols-1 gap-5 @3xl:grid-cols-2">
            <KeadaanKeluarTertaut nilai={keadaanKeluar} status={k.isian.status} tertaut={k.isian.tertaut} baca={keluar} />
            <BidangIsian>
              <KotakTtd ikon={Stethoscope} peran="Dokter yang merawat" nama={form.dokterMerawatNama} sudah={form.dokterMerawatTtd !== ""} idTtd="rm01-ttd-dokter">
                <div className="mb-3">
                  <Kolom
                    id="rm01-dokter"
                    label="Nama dokter yang merawat"
                    asal="dokterMerawatNama"
                    wajib
                    value={form.dokterMerawatNama}
                    onChange={(v) => set("dokterMerawatNama", v)}
                    placeholder="Nama dokter beserta gelar"
                  />
                  <IsiCepat pilihan={cepatDokter} />
                  <SaranNamaSaya nama={form.dokterMerawatNama} onPilih={(v) => set("dokterMerawatNama", v)} />
                </div>
                <SignaturePad
                  label="Tanda tangan dokter yang merawat"
                  value={form.dokterMerawatTtd}
                  onChange={(v) => set("dokterMerawatTtd", v)}
                  context={konteks("Dokter merawat")}
                  petugas={{ nama: form.dokterMerawatNama, onNama: (v) => set("dokterMerawatNama", v) }}
                />
              </KotakTtd>
            </BidangIsian>
          </div>
          {p.keluar.kaki}
        </BagianLangkah>

        {/* ------------------------------------------------ 6. Sebab kematian (halaman 2) */}
        <BagianLangkah
          {...p.kematian.kartu}
          judul="Sebab kematian"
          ket="Halaman 2 — diisi dan dicetak hanya bila pasien meninggal."
        >
          {draf && <SyaratFinal butir={butir} idJudul="rm01-syarat-judul-ponsel" className="mb-5 xl:hidden" />}
          {meninggalSimrs && !mati && (
            <p className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-fg">
              <HeartPulse className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              SIMRS mencatat pasien meninggal. Centang kotak di bawah untuk mengisi sebab kematian.
            </p>
          )}
          <BidangIsian className="space-y-6">
            <label className={cn(KARTU_PILIHAN, "has-checked:border-danger has-checked:bg-danger-soft/60 @2xl:max-w-xl")}>
              <input
                id="rm01-mati"
                type="checkbox"
                checked={mati}
                onChange={(e) => set("sebabKematianAktif", e.target.checked)}
                aria-describedby="rm01-mati-ket"
                className={cn(KONTROL_PILIHAN, "mt-0.5 accent-danger")}
              />
              <span className="min-w-0">
                <span className="block font-medium">Pasien meninggal — isi sebab kematian</span>
                <span id="rm01-mati-ket" className="mt-0.5 block text-xs text-fg-muted">
                  Halaman 2 hanya dicetak bila dicentang. Melepas centang tidak menghapus isian.
                </span>
              </span>
            </label>

            {mati && (
              <>
                {/* I. Sebab kematian */}
                <fieldset className="m-0 min-w-0 border-0 p-0">
                  <legend className="mb-1 p-0 text-sm font-semibold text-fg">I. Sebab kematian</legend>
                  <p className="mb-3 text-xs text-fg-muted">
                    b.c. Penyakit-penyakit yang bila ada menjadi timbulnya sebab kematian tersebut ad.a., dengan menyebutkan penyakit yang
                    menjadi pokok pangkal terakhir.
                  </p>
                  <div className="space-y-4">
                    <BarisSebab
                      id="rm01-sk-a"
                      sebut="a"
                      label="a. Penyakit atau keadaan yang langsung menyebabkan kematian"
                      wajib
                      teks={form.skA}
                      lama={form.skALama}
                      onTeks={(v) => set("skA", v)}
                      onLama={(v) => set("skALama", v)}
                    />
                    <BarisSebab
                      id="rm01-sk-b"
                      sebut="b"
                      label="b. Penyakit tersebut dalam ad.a. disebabkan oleh (atau akibat dari)"
                      teks={form.skB}
                      lama={form.skBLama}
                      onTeks={(v) => set("skB", v)}
                      onLama={(v) => set("skBLama", v)}
                    />
                    <BarisSebab
                      id="rm01-sk-c"
                      sebut="c"
                      label="c. Penyakit tersebut dalam ad.b. disebabkan oleh (atau akibat dari)"
                      teks={form.skC}
                      lama={form.skCLama}
                      onTeks={(v) => set("skC", v)}
                      onLama={(v) => set("skCLama", v)}
                    />
                  </div>
                </fieldset>

                {/* II. Penyakit lain */}
                <fieldset className="m-0 min-w-0 border-0 p-0">
                  <legend className="mb-1 p-0 text-sm font-semibold text-fg">II. Penyakit lain yang mempengaruhi kematian</legend>
                  <p className="mb-3 text-xs text-fg-muted">
                    Penyakit-penyakit lain yang berarti dan mempengaruhi pula kematian itu, tetapi tidak ada hubungannya dengan penyakit-penyakit
                    tersebut ad.a.b.c.
                  </p>
                  <div className="space-y-4">
                    {form.skLain.map((row, i) => (
                      <BarisSebab
                        key={i}
                        id={`rm01-sk-lain-${i + 1}`}
                        label={`Penyakit lain ${i + 1}`}
                        sebut={`penyakit lain ${i + 1}`}
                        teks={row.teks}
                        lama={row.lama}
                        onTeks={(v) => setSkLain(i, "teks", v)}
                        onLama={(v) => setSkLain(i, "lama", v)}
                      />
                    ))}
                  </div>
                </fieldset>

                {/* Keterangan khusus */}
                <section aria-labelledby="rm01-kk-judul" className="space-y-5">
                  <h3 id="rm01-kk-judul" className="text-sm font-semibold text-fg">
                    Keterangan khusus untuk:
                  </h3>
                  <fieldset className="m-0 min-w-0 space-y-4 border-0 p-0">
                    <legend className="mb-2 p-0 text-[13px] font-semibold text-fg">I. Mati karena ruda paksa (violent death)</legend>
                    <PilihanRadio
                      id="rm01-ruda-paksa"
                      legend="a. Macam ruda paksa"
                      ringkas
                      bolehKosong
                      value={form.rudaPaksaMacam}
                      onChange={(v) => set("rudaPaksaMacam", v)}
                      opsi={opsi(RUDA_PAKSA_OPTS)}
                    />
                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 @2xl:grid-cols-2">
                      <Kolom id="rm01-ruda-cara" label="b. Cara kejadian ruda paksa" value={form.rudaPaksaCara} onChange={(v) => set("rudaPaksaCara", v)} />
                      <Kolom id="rm01-ruda-sifat" label="c. Sifat jejas (kerusakan tubuh)" value={form.rudaPaksaSifat} onChange={(v) => set("rudaPaksaSifat", v)} />
                    </div>
                  </fieldset>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-5 @3xl:grid-cols-3">
                    <fieldset className="m-0 min-w-0 space-y-3 border-0 p-0">
                      <legend className="mb-2 p-0 text-[13px] font-semibold text-fg">II. Kelahiran mati (stillbirth)</legend>
                      <PilihanRadio
                        id="rm01-lahir-mati"
                        legend="a. Apakah ini janin lahir mati"
                        ringkas
                        bolehKosong
                        value={form.lahirMatiJanin}
                        onChange={(v) => set("lahirMatiJanin", v as RingkasanForm["lahirMatiJanin"])}
                        opsi={YA_TIDAK}
                      />
                      <Kolom id="rm01-lahir-mati-sebab" label="b. Sebab kelahiran mati" value={form.lahirMatiSebab} onChange={(v) => set("lahirMatiSebab", v)} />
                    </fieldset>
                    <fieldset className="m-0 min-w-0 space-y-3 border-0 p-0">
                      <legend className="mb-2 p-0 text-[13px] font-semibold text-fg">III. Persalinan kehamilan</legend>
                      <PilihanRadio
                        id="rm01-persalinan"
                        legend="a. Apakah ini peristiwa persalinan"
                        ringkas
                        bolehKosong
                        value={form.persalinan}
                        onChange={(v) => set("persalinan", v as RingkasanForm["persalinan"])}
                        opsi={YA_TIDAK}
                      />
                      <PilihanRadio
                        id="rm01-kehamilan"
                        legend="b. Apakah ini peristiwa kehamilan"
                        ringkas
                        bolehKosong
                        value={form.kehamilan}
                        onChange={(v) => set("kehamilan", v as RingkasanForm["kehamilan"])}
                        opsi={YA_TIDAK}
                      />
                    </fieldset>
                    <fieldset className="m-0 min-w-0 space-y-3 border-0 p-0">
                      <legend className="mb-2 p-0 text-[13px] font-semibold text-fg">IV. Operasi</legend>
                      <PilihanRadio
                        id="rm01-operasi-ada"
                        legend="a. Apakah di sini dilakukan operasi"
                        ringkas
                        bolehKosong
                        value={form.operasiKhususAda}
                        onChange={(v) => set("operasiKhususAda", v as RingkasanForm["operasiKhususAda"])}
                        opsi={YA_TIDAK}
                      />
                      <Kolom id="rm01-operasi-jenis" label="b. Jenis operasi" value={form.operasiKhususJenis} onChange={(v) => set("operasiKhususJenis", v)} />
                    </fieldset>
                  </div>
                </section>

                {/* Yang memberikan keterangan */}
                <KotakTtd
                  ikon={Stethoscope}
                  peran="Yang memberikan keterangan sebab kematian"
                  nama={form.dokterKematianNama}
                  sudah={form.dokterKematianTtd !== ""}
                  idTtd="rm01-ttd-kematian"
                >
                  <div className="mb-3 grid grid-cols-1 gap-x-6 gap-y-4 @2xl:grid-cols-2">
                    <div>
                      <LabelKolom htmlFor="rm01-tgl-kematian">Tanggal (Sumber Rejo, …)</LabelKolom>
                      <DatePicker id="rm01-tgl-kematian" value={form.sebabKematianTanggal} onChange={(v) => set("sebabKematianTanggal", v)} placeholder="Pilih tanggal" />
                      <IsiCepat pilihan={cepatTglMati} />
                    </div>
                    <div>
                      <Kolom
                        id="rm01-dokter-kematian"
                        label="Nama dokter"
                        wajib
                        value={form.dokterKematianNama}
                        onChange={(v) => set("dokterKematianNama", v)}
                        placeholder="Nama dokter beserta gelar"
                      />
                      <IsiCepat pilihan={cepatDokterMati} />
                      <SaranNamaSaya nama={form.dokterKematianNama} onPilih={(v) => set("dokterKematianNama", v)} />
                    </div>
                  </div>
                  <SignaturePad
                    label="Tanda tangan dokter pemberi keterangan"
                    value={form.dokterKematianTtd}
                    onChange={(v) => set("dokterKematianTtd", v)}
                    reuse={samaNama(form.dokterKematianNama, form.dokterMerawatNama) ? form.dokterMerawatTtd : ""}
                    context={konteks("Sebab kematian")}
                    petugas={{ nama: form.dokterKematianNama, onNama: (v) => set("dokterKematianNama", v) }}
                  />
                </KotakTtd>
              </>
            )}
          </BidangIsian>
          {p.kematian.kaki}
        </BagianLangkah>
      </TataLetakLangkah>
    </IsianFrame>
  );
}

/* ================================================================== kolom */

type PropsKolom = {
  id: string;
  label: string;
  asal?: string;
  wajib?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

/** Kolom teks berlabel tampak (label `for` → input; tanpa aria-label yang menimpa label). */
function Kolom({ id, label, asal, wajib, value, onChange, placeholder, inputMode }: PropsKolom & { inputMode?: "numeric" }) {
  return (
    <div className="min-w-0">
      <LabelKolom htmlFor={id} asal={asal} wajib={wajib}>
        {label}
      </LabelKolom>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} enterKeyHint="next" className={KONTROL} />
    </div>
  );
}

/** Nomor telepon PASIEN/keluarga — tanpa isi otomatis peramban (data petugas tak boleh terisi). */
function KolomTelp({ id, label, asal, value, onChange }: Omit<PropsKolom, "placeholder" | "wajib">) {
  return (
    <div className="min-w-0">
      <LabelKolom htmlFor={id} asal={asal}>
        {label}
      </LabelKolom>
      <Input id={id} type="tel" inputMode="tel" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder="08xx" enterKeyHint="next" className={KONTROL} />
    </div>
  );
}

/** Alamat = textarea (alamat Indonesia panjang: jalan, RT/RW, desa, kecamatan). */
function KolomAlamat({ id, label, asal, value, onChange }: Omit<PropsKolom, "placeholder" | "wajib">) {
  return (
    <div className="min-w-0">
      <LabelKolom htmlFor={id} asal={asal}>
        {label}
      </LabelKolom>
      <textarea
        id={id}
        rows={2}
        maxLength={300}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 pointer-coarse:text-base"
      />
    </div>
  );
}

/** "Lain-lain …" sebaris dengan pil pendidikan (kolom terpisah di data & cetak). */
function KolomLainLain({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <span className="flex min-w-[12rem] flex-1 items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-[13px] text-fg-muted">
        Lain-lain
      </label>
      <input
        id={id}
        value={value}
        maxLength={60}
        onChange={(e) => onChange(e.target.value)}
        placeholder="mis. D3"
        enterKeyHint="next"
        className="h-9 min-w-0 flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 text-[13px] text-fg placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 pointer-coarse:h-11 pointer-coarse:text-base"
      />
    </span>
  );
}

/** Diagnosa + kode ICD: dua kolom berlabel; kode = pengenal → tanpa koreksi ejaan/otomatis, huruf kapital. */
function BarisDiagnosa({
  id,
  label,
  kodeLabel,
  asal,
  teks,
  kode,
  onTeks,
  onKode,
}: {
  id: string;
  label: string;
  kodeLabel: string;
  /** [path teks, path kode] bila kolom dapat diisi dari SIMRS. */
  asal?: readonly [string, string];
  teks: string;
  kode: string;
  onTeks: (v: string) => void;
  onKode: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-x-3 gap-y-2 @2xl:grid-cols-[minmax(0,1fr)_10rem]">
      <div className="min-w-0">
        <LabelKolom htmlFor={id} asal={asal?.[0]}>
          {label}
        </LabelKolom>
        <Input id={id} value={teks} onChange={(e) => onTeks(e.target.value)} placeholder="Diagnosa" enterKeyHint="next" className={KONTROL} />
      </div>
      <div className="min-w-0">
        <LabelKolom htmlFor={`${id}-kode`} asal={asal?.[1]}>
          {kodeLabel}
          <span className="sr-only"> {label.toLowerCase()}</span>
        </LabelKolom>
        <Input
          id={`${id}-kode`}
          value={kode}
          onChange={(e) => onKode(e.target.value.toUpperCase())}
          placeholder="mis. J06.9"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="next"
          className={cn(KONTROL, "font-mono")}
        />
      </div>
    </div>
  );
}

/** Baris sebab kematian: penyakit/keadaan + "Lama (kira-kira) mulai sakit hingga meninggal dunia". */
function BarisSebab({
  id,
  label,
  sebut,
  wajib,
  teks,
  lama,
  onTeks,
  onLama,
}: {
  id: string;
  label: string;
  /** Nama singkat baris untuk label "Lama …" di pembaca layar (mis. "a", "penyakit lain 1"). */
  sebut: string;
  wajib?: boolean;
  teks: string;
  lama: string;
  onTeks: (v: string) => void;
  onLama: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-2 @2xl:grid-cols-[minmax(0,1fr)_13rem] @2xl:items-end">
      <div className="min-w-0">
        <LabelKolom htmlFor={id} wajib={wajib}>
          {label}
        </LabelKolom>
        <Input id={id} value={teks} maxLength={200} onChange={(e) => onTeks(e.target.value)} placeholder="Penyakit / keadaan" enterKeyHint="next" className={KONTROL} />
      </div>
      <div className="min-w-0">
        <LabelKolom htmlFor={`${id}-lama`}>
          Lama sakit hingga meninggal
          <span className="sr-only"> ({sebut})</span>
        </LabelKolom>
        <Input id={`${id}-lama`} value={lama} maxLength={60} onChange={(e) => onLama(e.target.value)} placeholder="mis. ± 3 hari" enterKeyHint="next" className={KONTROL} />
      </div>
    </div>
  );
}
