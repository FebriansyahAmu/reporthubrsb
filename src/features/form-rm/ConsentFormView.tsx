"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck2,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleCheck,
  PenLine,
  UserRoundCheck,
} from "lucide-react";
import { Input, Label } from "@/components/ui/Field";
import { DatePicker, DateTimePicker, toYmd } from "@/components/ui/DatePicker";
import { SelectOther } from "@/components/ui/Select";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { BidangIsian, useTerkunci } from "@/features/form-rm/isian/kunci";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import {
  BagianLangkah,
  IsiCepat,
  ItemId,
  KONTROL,
  KolomTeks,
  LabelKolom,
  SyaratFinal,
  TOMBOL_KECIL,
  TataLetakLangkah,
  Wajib,
  fmtTanggal,
  statusDari,
  terisi,
  type ButirSyarat,
} from "@/features/form-rm/isian/langkah/bagian";
import type { Langkah } from "@/features/form-rm/isian/langkah/NavLangkah";
import { PilihanRadio } from "@/features/form-rm/isian/langkah/PilihanRadio";
import { HUBUNGAN_OPTS } from "@/features/form-rm/edukasi.constants";
import {
  CONSENT_TEXT,
  HAK_PASIEN,
  IZIN_PRIVASI_OPTS,
  JK_OPTS,
  JUDUL_POIN,
  KELAS_OPTS,
  KEWAJIBAN_PASIEN,
  SYARAT_FINAL_CONSENT,
  emptyConsentForm,
  kekuranganConsent,
  type SyaratConsent,
} from "@/features/form-rm/consent.constants";
import { cn } from "@/lib/cn";
import type { ConsentForm, FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

const siapkan = (data: unknown): ConsentForm => ({ ...emptyConsentForm(), ...(data as ConsentForm) });

/* Tata letak isian RM.03 (tampilan pengisian saja — cetak tetap ConsentDocument):
 * 4 langkah berurutan seperti alur di meja admisi, navigasi langkah (scrollspy)
 * lengket, status tiap langkah, dan daftar "Syarat finalisasi" yang membawa ke
 * kolomnya. Path kolom tak berubah → simpan gabung, penanda SIMRS, log, cetak tetap. */

const ID = {
  pasien: "rm03-pasien",
  pj: "rm03-pj",
  persetujuan: "rm03-persetujuan",
  ttd: "rm03-ttd",
} as const;
/* Kelas bersama (dipakai juga oleh konstanta poin di tingkat modul → dideklarasikan lebih dulu). */
const PANAH = "size-4 shrink-0 text-fg-subtle transition-transform duration-200 motion-reduce:transition-none";
const RINGKAS =
  "flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-fg transition-colors hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring [&::-webkit-details-marker]:hidden pointer-coarse:min-h-11 [details[open]>&_svg:first-child]:rotate-90";
const RINGKAS_SUB =
  "flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-fg [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring [details[open]>&_svg:first-child]:rotate-90";

/** Elemen tujuan tiap syarat finalisasi (difokuskan dari daftar syarat). */
const TUJUAN_SYARAT: Record<SyaratConsent["kolom"], string> = {
  pasienNama: "rm03-pasien-nama",
  pasienTtd: "rm03-ttd-pasien",
  petugasNama: "rm03-petugas-nama",
  petugasTtd: "rm03-ttd-petugas",
  tanggalTtd: "rm03-tanggal-ttd",
};

const KOLOM_PASIEN = ["nik", "waktuPendaftaran", "ruanganRawat", "kelas"] as const;
const KOLOM_PJ = ["pjNama", "pjJenisKelamin", "pjUmur", "pjHubungan", "pjTelepon", "pjAlamat"] as const;

const samaNama = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase() && a.trim() !== "";

export function ConsentFormView({
  isian,
  header,
  izin,
}: {
  isian: IsianForm;
  header: FormRmHeader;
  izin: IzinIsian;
}) {
  const k = useIsian(isian, izin, siapkan);
  const { form, setForm } = k;

  const set = <K extends keyof ConsentForm>(key: K, value: ConsentForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setArr = (key: "pelepasanInfo" | "permintaanKhusus", i: number, value: string) =>
    setForm((f) => {
      const arr = [...f[key]];
      // Tanpa lubang: mengisi "Pihak 3" lebih dulu tak boleh menjadi [null, null, "…"] (ditolak skema).
      while (arr.length < i) arr.push("");
      arr[i] = value;
      return { ...f, [key]: arr };
    });

  const kurang = kekuranganConsent(form);
  const nPasien = KOLOM_PASIEN.filter((c) => terisi(form[c])).length;
  const nPj = KOLOM_PJ.filter((c) => terisi(form[c])).length;
  const nSyarat = SYARAT_FINAL_CONSENT.length - kurang.length;
  const langkah: Langkah[] = [
    {
      id: ID.pasien,
      no: 1,
      judul: "Pasien & pendaftaran",
      singkat: "Pasien",
      status: statusDari(nPasien, KOLOM_PASIEN.length),
      ket: `${nPasien} dari ${KOLOM_PASIEN.length} terisi`,
    },
    {
      id: ID.pj,
      no: 2,
      judul: "Penanggung jawab",
      singkat: "Penanggung jawab",
      status: statusDari(nPj, KOLOM_PJ.length),
      ket: `${nPj} dari ${KOLOM_PJ.length} terisi`,
    },
    {
      id: ID.persetujuan,
      no: 3,
      judul: "Isi persetujuan I–IX",
      singkat: "Persetujuan",
      status: form.izinPrivasi ? "lengkap" : "kosong",
      ket: form.izinPrivasi ? `Privasi: ${form.izinPrivasi.toLowerCase()}` : "Pilihan privasi belum dipilih",
    },
    {
      id: ID.ttd,
      no: 4,
      judul: "Pernyataan & tanda tangan",
      singkat: "Tanda tangan",
      status: statusDari(nSyarat, SYARAT_FINAL_CONSENT.length),
      ket: `${nSyarat} dari ${SYARAT_FINAL_CONSENT.length} syarat terpenuhi`,
    },
  ];
  // Daftar syarat hanya untuk yang bisa mengisi (DRAF & tidak terkunci).
  const draf = isian.status === "DRAF" && !k.terkunci;
  const belum = new Set(kurang.map((s) => s.kolom));
  const butirSyarat: ButirSyarat[] = SYARAT_FINAL_CONSENT.map((s) => ({
    kunci: s.kolom,
    label: s.label,
    ok: !belum.has(s.kolom),
    tujuan: TUJUAN_SYARAT[s.kolom],
  }));

  return (
    <IsianFrame kendali={k}>
      <TataLetakLangkah langkah={langkah} samping={draf && <SyaratFinal butir={butirSyarat} idJudul="rm03-syarat-judul" />}>
          {/* ------------------------------------------------ 1. Pasien & pendaftaran */}
          <Langkah1 header={header} form={form} set={set} />

          {/* ------------------------------------------------ 2. Penanggung jawab */}
          <Langkah2 header={header} form={form} set={set} setForm={setForm} />

          {/* ------------------------------------------------ 3. Isi persetujuan */}
          <Langkah3 form={form} set={set} setArr={setArr} />

          {/* ------------------------------------------------ 4. Pernyataan & tanda tangan */}
          <BagianLangkah
            id={ID.ttd}
            no={4}
            judul="Pernyataan & tanda tangan"
            ket="Kolom bertanda * wajib diisi sebelum isian bisa difinalkan."
          >
            {draf && <SyaratFinal butir={butirSyarat} idJudul="rm03-syarat-judul-ponsel" className="mb-5 xl:hidden" />}
            <blockquote className="mb-5 rounded-[var(--radius-md)] border-l-4 border-brand bg-brand-soft/50 px-4 py-3 text-[13px] leading-relaxed text-fg">
              <p className="mb-1 text-xs font-semibold text-brand-soft-fg">X. {JUDUL_POIN.X}</p>
              <p className="font-medium [text-wrap:pretty]">{CONSENT_TEXT.X}</p>
            </blockquote>
            <BidangIsian className="space-y-5">
              <TanggalTtd value={form.tanggalTtd} onChange={(v) => set("tanggalTtd", v)} />
              <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
                <KartuTtd
                  judul="Pasien / keluarga / penanggung jawab"
                  sudah={terisi(form.pasienTtd)}
                  idTtd={TUJUAN_SYARAT.pasienTtd}
                  nama={
                    <>
                      <KolomTeks
                        id={TUJUAN_SYARAT.pasienNama}
                        label="Nama yang menandatangani"
                        asal="pasienNama"
                        wajib
                        value={form.pasienNama}
                        onChange={(v) => set("pasienNama", v)}
                        placeholder="Nama pasien atau penanggung jawab"
                      />
                      <IsiCepatNama
                        nilai={form.pasienNama}
                        pilihan={[
                          { ket: "Pasien", nama: header.nama },
                          { ket: "Penanggung jawab", nama: form.pjNama },
                        ]}
                        onPilih={(v) => set("pasienNama", v)}
                      />
                    </>
                  }
                >
                  <SignaturePad
                    label="Tanda tangan (wajib)"
                    value={form.pasienTtd}
                    onChange={(v) => set("pasienTtd", v)}
                    context={[header.nama, "General Consent"].filter(Boolean).join(" · ")}
                  />
                </KartuTtd>
                <KartuTtd
                  judul="Petugas rumah sakit"
                  sudah={terisi(form.petugasTtd)}
                  idTtd={TUJUAN_SYARAT.petugasTtd}
                  nama={
                    <>
                      <KolomTeks
                        id={TUJUAN_SYARAT.petugasNama}
                        label="Nama petugas"
                        wajib
                        value={form.petugasNama}
                        onChange={(v) => set("petugasNama", v)}
                        placeholder="Nama petugas"
                      />
                      <SaranNamaSaya nama={form.petugasNama} onPilih={(v) => set("petugasNama", v)} />
                    </>
                  }
                >
                  <SignaturePad
                    label="Tanda tangan (wajib)"
                    value={form.petugasTtd}
                    onChange={(v) => set("petugasTtd", v)}
                    context={[header.nama, "General Consent — Petugas"].filter(Boolean).join(" · ")}
                    petugas={{ nama: form.petugasNama, onNama: (v) => set("petugasNama", v), isiNamaOtomatis: true }}
                  />
                </KartuTtd>
              </div>
            </BidangIsian>
          </BagianLangkah>
      </TataLetakLangkah>
    </IsianFrame>
  );
}

/* ================================================================ langkah 1 */

type Setel = <K extends keyof ConsentForm>(key: K, value: ConsentForm[K]) => void;

function Langkah1({ header, form, set }: { header: FormRmHeader; form: ConsentForm; set: Setel }) {
  const digitNik = form.nik.replace(/\D/g, "").length;
  const nikJanggal = digitNik > 0 && digitNik !== 16;
  return (
    <BagianLangkah id={ID.pasien} no={1} judul="Pasien & pendaftaran" ket="Periksa data dari SIMRS; ubah bila tidak sesuai.">
      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded-[var(--radius-md)] bg-surface-2/60 px-4 py-3 text-sm @2xl:grid-cols-4">
        <ItemId label="No. Rekam Medis" value={header.norm} mono />
        <ItemId label="Nama pasien" value={header.nama} strong />
        <ItemId label="Jenis kelamin" value={header.jenisKelamin} />
        <ItemId
          label="Tgl lahir / umur"
          value={[header.tanggalLahir ? fmtTanggal(header.tanggalLahir) : null, header.umur && `(${header.umur})`]
            .filter(Boolean)
            .join(" ")}
        />
      </dl>
      <BidangIsian>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 @xl:grid-cols-2 @4xl:grid-cols-4">
          <div>
            <LabelKolom htmlFor="rm03-nik" asal="nik">
              NIK
            </LabelKolom>
            <Input
              id="rm03-nik"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="next"
              value={form.nik}
              onChange={(e) => set("nik", e.target.value)}
              placeholder="16 digit sesuai KTP/KK"
              aria-describedby="rm03-nik-ket"
              className={KONTROL}
            />
            <p id="rm03-nik-ket" className={cn("mt-1 flex items-center gap-1 text-[11px]", nikJanggal ? "text-warning" : "text-fg-subtle")}>
              {nikJanggal ? (
                <>
                  <AlertTriangle className="size-3 shrink-0" aria-hidden />
                  NIK biasanya 16 digit — terisi {digitNik}. Periksa kembali.
                </>
              ) : (
                "Nomor Induk Kependudukan (16 digit)."
              )}
            </p>
          </div>
          <div>
            <LabelKolom htmlFor="rm03-waktu" asal="waktuPendaftaran">
              Tanggal &amp; jam pendaftaran (WITA)
            </LabelKolom>
            <DateTimePicker id="rm03-waktu" value={form.waktuPendaftaran} onChange={(v) => set("waktuPendaftaran", v)} />
          </div>
          <KolomTeks
            id="rm03-ruangan"
            label="Ruangan rawat"
            asal="ruanganRawat"
            value={form.ruanganRawat}
            onChange={(v) => set("ruanganRawat", v)}
            placeholder="mis. Perawatan Interna"
          />
          <div>
            <LabelKolom htmlFor="rm03-kelas" asal="kelas">
              Kelas
            </LabelKolom>
            <SelectOther
              id="rm03-kelas"
              value={form.kelas}
              onChange={(v) => set("kelas", v)}
              options={KELAS_OPTS}
              placeholder="Pilih kelas"
              otherPlaceholder="Kelas lain…"
              otherAriaLabel="Kelas (lainnya)"
            />
          </div>
        </div>
      </BidangIsian>
    </BagianLangkah>
  );
}

/* ================================================================ langkah 2 */

function Langkah2({
  header,
  form,
  set,
  setForm,
}: {
  header: FormRmHeader;
  form: ConsentForm;
  set: Setel;
  setForm: (f: (d: ConsentForm) => ConsentForm) => void;
}) {
  const terkunci = useTerkunci();
  const jkPasien = JK_OPTS.find((o) => o.toLowerCase() === header.jenisKelamin.trim().toLowerCase()) ?? "";
  // Pintasan bila pasien menanggung dirinya sendiri — hanya saat nama PJ masih kosong (tak menimpa isian).
  const pasienSendiri = () =>
    setForm((f) => ({
      ...f,
      pjNama: header.nama,
      pjJenisKelamin: (jkPasien as ConsentForm["pjJenisKelamin"]) || f.pjJenisKelamin,
      pjUmur: f.pjUmur || header.umur || "",
      pjHubungan: f.pjHubungan || "Pasien sendiri",
    }));

  return (
    <BagianLangkah
      id={ID.pj}
      no={2}
      judul="Penanggung jawab"
      ket="Pihak yang bertanggung jawab atas pasien selama perawatan."
      aksi={
        !terkunci && !terisi(form.pjNama) && header.nama ? (
          <button type="button" onClick={pasienSendiri} className={TOMBOL_KECIL}>
            <UserRoundCheck className="size-3.5" aria-hidden />
            Pasien sendiri
          </button>
        ) : null
      }
    >
      <BidangIsian>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 @xl:grid-cols-2 @4xl:grid-cols-3">
          <KolomTeks id="rm03-pj-nama" label="Nama" value={form.pjNama} onChange={(v) => set("pjNama", v)} placeholder="Nama penanggung jawab" />
          <PilihanRadio
            legend="Jenis kelamin"
            value={form.pjJenisKelamin}
            onChange={(v) => set("pjJenisKelamin", v as ConsentForm["pjJenisKelamin"])}
            opsi={JK_OPTS.map((o) => ({ value: o, label: o }))}
            bolehKosong
          />
          <KolomTeks
            id="rm03-pj-umur"
            label="Umur"
            value={form.pjUmur}
            onChange={(v) => set("pjUmur", v)}
            placeholder="mis. 35 tahun"
          />
          <div>
            <Label htmlFor="rm03-pj-hubungan">Hubungan dengan pasien</Label>
            <SelectOther
              id="rm03-pj-hubungan"
              value={form.pjHubungan}
              onChange={(v) => set("pjHubungan", v)}
              options={HUBUNGAN_OPTS}
              placeholder="Pilih hubungan"
              otherPlaceholder="Hubungan lainnya…"
              otherAriaLabel="Hubungan dengan pasien (lainnya)"
            />
          </div>
          <div>
            <Label htmlFor="rm03-pj-telp">No. telepon / HP</Label>
            <Input
              id="rm03-pj-telp"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              enterKeyHint="next"
              value={form.pjTelepon}
              onChange={(e) => set("pjTelepon", e.target.value)}
              placeholder="08xx xxxx xxxx"
              className={KONTROL}
            />
          </div>
          <div className="@xl:col-span-2 @4xl:col-span-3">
            <Label htmlFor="rm03-pj-alamat">Alamat tempat tinggal</Label>
            <textarea
              id="rm03-pj-alamat"
              rows={2}
              value={form.pjAlamat}
              onChange={(e) => set("pjAlamat", e.target.value)}
              placeholder="Jalan, desa/kelurahan, kecamatan, kabupaten"
              // field-sizing: tinggi mengikuti isi (2–8 baris); peramban lama tetap 2 baris + gulir.
              className="block min-h-[4.25rem] max-h-[12rem] w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg [field-sizing:content] placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 pointer-coarse:text-base"
            />
          </div>
        </div>
      </BidangIsian>
    </BagianLangkah>
  );
}

/* ================================================================ langkah 3 */

/** Poin yang dibacakan/dijelaskan (tanpa isian) — teks dari formulir asli. */
const POIN_BACA: { no: keyof typeof JUDUL_POIN; isi: React.ReactNode }[] = [
  { no: "I", isi: CONSENT_TEXT.I },
  { no: "II", isi: CONSENT_TEXT.II },
];
const POIN_BACA_LANJUT: { no: keyof typeof JUDUL_POIN; isi: React.ReactNode }[] = [
  { no: "V", isi: CONSENT_TEXT.V },
  { no: "VI", isi: CONSENT_TEXT.VI },
  { no: "VII", isi: CONSENT_TEXT.VII },
  {
    no: "VIII",
    isi: (
      <ol className="ml-4 list-decimal space-y-0.5">
        {CONSENT_TEXT.VIII.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
    ),
  },
  {
    no: "IX",
    isi: (
      <>
        <p>{CONSENT_TEXT.IX}</p>
        <details className="poin-persetujuan mt-2 rounded-[var(--radius-sm)] border border-border bg-surface">
          <summary className={RINGKAS_SUB}>
            <ChevronRight className={PANAH} aria-hidden />
            Daftar hak & kewajiban pasien (untuk dijelaskan)
          </summary>
          <div className="space-y-3 px-3 pb-3 pt-1">
            <div>
              <p className="mb-1 font-semibold text-fg">Hak pasien (UU No. 44 Tahun 2009)</p>
              <ol className="ml-4 list-decimal space-y-0.5">
                {HAK_PASIEN.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>
            <div>
              <p className="mb-1 font-semibold text-fg">Kewajiban pasien (UU No. 29 Tahun 2004)</p>
              <ol className="ml-4 list-decimal space-y-0.5">
                {KEWAJIBAN_PASIEN.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>
          </div>
        </details>
      </>
    ),
  },
];

function Langkah3({
  form,
  set,
  setArr,
}: {
  form: ConsentForm;
  set: Setel;
  setArr: (key: "pelepasanInfo" | "permintaanKhusus", i: number, value: string) => void;
}) {
  // Buka/tutup semua (pola akordeon details): status tombol diturunkan dari butir yang terbuka.
  const wadah = useRef<HTMLDivElement | null>(null);
  const [semuaTerbuka, setSemuaTerbuka] = useState(false);
  const butir = () => [...(wadah.current?.querySelectorAll<HTMLDetailsElement>(":scope > details") ?? [])];
  const sinkron = () => {
    const d = butir();
    setSemuaTerbuka(d.length > 0 && d.every((x) => x.open));
  };
  const bukaTutupSemua = () => {
    const buka = !semuaTerbuka;
    for (const d of butir()) d.open = buka;
    setSemuaTerbuka(buka);
  };

  return (
    <BagianLangkah
      id={ID.persetujuan}
      no={3}
      judul="Isi persetujuan I–IX"
      ket="Jelaskan setiap poin kepada pasien atau penanggung jawab. Poin III dan IV berisi pilihan yang perlu diisi."
      aksi={
        <button type="button" onClick={bukaTutupSemua} aria-expanded={semuaTerbuka} className={TOMBOL_KECIL}>
          {semuaTerbuka ? <ChevronsDownUp className="size-3.5" aria-hidden /> : <ChevronsUpDown className="size-3.5" aria-hidden />}
          {semuaTerbuka ? "Tutup semua poin" : "Buka semua poin"}
        </button>
      }
    >
      <div ref={wadah} className="space-y-2">
        {POIN_BACA.map((p) => (
          <PoinBaca key={p.no} no={p.no} onToggle={sinkron}>
            {p.isi}
          </PoinBaca>
        ))}

        {/* III — berisi isian */}
        <PoinIsian no="III">
          <p>{CONSENT_TEXT.III_1}</p>
          <p className="mt-1.5">{CONSENT_TEXT.III_2}</p>
          <BidangIsian className="mt-3">
            <p id="rm03-pihak-ket" className="mb-2 text-fg">
              {CONSENT_TEXT.III_3}
            </p>
            <div className="grid grid-cols-1 gap-3 @xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <KolomTeks
                  key={i}
                  id={`rm03-pihak-${i}`}
                  label={`Pihak ${i + 1}`}
                  opsional
                  value={form.pelepasanInfo[i] ?? ""}
                  onChange={(v) => setArr("pelepasanInfo", i, v)}
                  placeholder="Nama / pihak"
                  describedBy="rm03-pihak-ket"
                />
              ))}
            </div>
          </BidangIsian>
        </PoinIsian>

        {/* IV — berisi isian */}
        <PoinIsian no="IV">
          <BidangIsian className="space-y-4">
            <PilihanRadio
              legend="Akses keluarga & pengunjung"
              keterangan="Apakah rumah sakit boleh memberi akses bagi keluarga, handai taulan, dan orang-orang yang akan menengok/menemui pasien?"
              value={form.izinPrivasi}
              onChange={(v) => set("izinPrivasi", v as ConsentForm["izinPrivasi"])}
              opsi={IZIN_PRIVASI_OPTS.map((o) => ({
                value: o,
                label: o,
                ket: o === "Mengijinkan" ? "Keluarga & pengunjung boleh menjenguk." : "Rumah sakit tidak memberi akses pengunjung.",
              }))}
              bolehKosong
            />
            <div>
              <p id="rm03-khusus-ket" className="mb-2 text-fg">
                {CONSENT_TEXT.IV_2}
              </p>
              <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
                {[0, 1].map((i) => (
                  <KolomTeks
                    key={i}
                    id={`rm03-khusus-${i}`}
                    label={`Nama / profesi ${i + 1}`}
                    opsional
                    value={form.permintaanKhusus[i] ?? ""}
                    onChange={(v) => setArr("permintaanKhusus", i, v)}
                    placeholder="mis. dr. … / rohaniwan"
                    describedBy="rm03-khusus-ket"
                  />
                ))}
              </div>
            </div>
          </BidangIsian>
        </PoinIsian>

        {POIN_BACA_LANJUT.map((p) => (
          <PoinBaca key={p.no} no={p.no} onToggle={sinkron}>
            {p.isi}
          </PoinBaca>
        ))}
      </div>
    </BagianLangkah>
  );
}

/* ================================================================ langkah 4 */

function TanggalTtd({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const terkunci = useTerkunci();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-full max-w-xs">
        <Label htmlFor={TUJUAN_SYARAT.tanggalTtd}>
          Tanggal tanda tangan <Wajib />
        </Label>
        <DatePicker id={TUJUAN_SYARAT.tanggalTtd} value={value} onChange={onChange} placeholder="Pilih tanggal" />
      </div>
      {!terkunci && (
        // Tanggal dihitung saat diklik (bukan saat render): aman untuk hidrasi & zona waktu server.
        <button type="button" onClick={() => onChange(toYmd(new Date()))} className={cn(TOMBOL_KECIL, "h-10")}>
          <CalendarCheck2 className="size-3.5" aria-hidden />
          Hari ini
        </button>
      )}
    </div>
  );
}

function KartuTtd({
  judul,
  sudah,
  idTtd,
  nama,
  children,
}: {
  judul: string;
  sudah: boolean;
  idTtd: string;
  nama: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface-2/30 p-3 @md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{judul}</h3>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            sudah ? "bg-success-soft text-success" : "bg-surface-2 text-fg-muted",
          )}
        >
          {sudah ? <CircleCheck className="size-3" aria-hidden /> : <PenLine className="size-3" aria-hidden />}
          {sudah ? "Sudah ditandatangani" : "Belum ditandatangani"}
        </span>
      </div>
      <div>{nama}</div>
      {/* Tujuan fokus dari daftar syarat (tabIndex −1: bisa difokus, bukan pemberhentian Tab). */}
      <div id={idTtd} tabIndex={-1} className="rounded-[var(--radius-md)] outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
        {children}
      </div>
    </div>
  );
}

/** Pintasan isi nama penanda tangan dari data yang sudah ada (pasien / penanggung jawab). */
function IsiCepatNama({
  nilai,
  pilihan,
  onPilih,
}: {
  nilai: string;
  pilihan: { ket: string; nama: string }[];
  onPilih: (v: string) => void;
}) {
  const tampil = pilihan.filter((p) => terisi(p.nama) && !samaNama(p.nama, nilai));
  return <IsiCepat pilihan={tampil.map((p) => ({ kunci: p.ket, ket: p.ket, nilai: p.nama, pilih: () => onPilih(p.nama) }))} />;
}

/* ================================================================== bersama */

/** Poin yang hanya dibacakan: akordeon <details> (tetap bisa dicari dengan Find saat tertutup). */
function PoinBaca({ no, onToggle, children }: { no: keyof typeof JUDUL_POIN; onToggle: () => void; children: React.ReactNode }) {
  return (
    <details onToggle={onToggle} className="poin-persetujuan rounded-[var(--radius-md)] border border-border bg-surface">
      <summary className={RINGKAS}>
        <ChevronRight className={PANAH} aria-hidden />
        <span className="w-10 shrink-0 font-mono text-xs font-semibold text-fg-muted">{no}.</span>
        <span className="min-w-0 font-medium">{JUDUL_POIN[no]}</span>
      </summary>
      <div className="px-3 pb-3 pl-[4.25rem] text-[13px] leading-relaxed text-fg-muted [text-wrap:pretty]">{children}</div>
    </details>
  );
}

/** Poin yang memuat isian (III, IV): selalu terbuka, ditandai "Perlu diisi". */
function PoinIsian({ no, children }: { no: keyof typeof JUDUL_POIN; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-brand/30 bg-brand-soft/25">
      <div className="flex flex-wrap items-center gap-2 px-3 pt-2.5">
        {/* Spasi selebar panah akordeon → nomor & judul sejajar dengan poin lain. */}
        <span aria-hidden className="size-4 shrink-0" />
        <span className="w-10 shrink-0 font-mono text-xs font-semibold text-fg-muted">{no}.</span>
        <h3 className="text-sm font-medium text-fg">{JUDUL_POIN[no]}</h3>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-soft-fg">Ada isian</span>
      </div>
      <div className="px-3 pb-3 pt-1.5 text-[13px] leading-relaxed text-fg-muted @md:pl-[4.25rem] [text-wrap:pretty]">{children}</div>
    </div>
  );
}
