"use client";

import { Check, HeartPulse } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { DatePicker, DateTimePicker } from "@/components/ui/DatePicker";
import { KeadaanKeluarTertaut } from "@/features/form-rm/KeadaanKeluarTertaut";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { BidangIsian } from "@/features/form-rm/isian/kunci";
import { LabelAsal } from "@/features/form-rm/isian/TandaAsal";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import {
  AGAMA_OPTS,
  BANGSA_OPTS,
  CARA_MASUK_OPTS,
  IMUNISASI_OPTS,
  IZIN_KELUAR_OPTS,
  JENIS_PELAYANAN_OPTS,
  PEKERJAAN_OPTS,
  PENDIDIKAN_OPTS,
  PERKAWINAN_OPTS,
  PESERTA_OPTS,
  RUDA_PAKSA_OPTS,
  emptyRingkasanForm,
} from "@/features/form-rm/ringkasan.constants";
import { cn } from "@/lib/cn";
import type { BacaKeluarSimrs, FormRmHeader, RingkasanForm } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

const YT = ["Ya", "Tidak"];

/** Data tersimpan → state UI: Sebab Kematian II selalu 3 baris. */
function siapkan(data: unknown): RingkasanForm {
  const f: RingkasanForm = { ...emptyRingkasanForm(), ...(data as RingkasanForm) };
  const skLain = [...(Array.isArray(f.skLain) ? f.skLain : [])];
  while (skLain.length < 3) skLain.push({ teks: "", lama: "" });
  return { ...f, skLain };
}

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

  const set = <K extends keyof RingkasanForm>(key: K, value: RingkasanForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const toggleImun = (v: string) =>
    setForm((f) => ({
      ...f,
      imunisasi: f.imunisasi.includes(v)
        ? f.imunisasi.filter((x) => x !== v)
        : [...f.imunisasi, v],
    }));
  const setSkLain = (i: number, field: "teks" | "lama", v: string) =>
    setForm((f) => ({
      ...f,
      skLain: f.skLain.map((x, j) => (j === i ? { ...x, [field]: v } : x)),
    }));

  const mati = form.sebabKematianAktif;

  return (
    <IsianFrame kendali={k}>
      <BidangIsian className="space-y-5">
        {/* Identitas */}
        <Card className="p-4">
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <IdItem label="No. Rekam Medis" value={header.norm} mono />
            <IdItem label="Nama Pasien" value={`${header.nama} (${jkSingkat(header.jenisKelamin)})`} strong />
            <IdItem label="NIK" value={header.nik} mono />
            <IdItem
              label="Tgl Lahir / Umur"
              value={[header.tanggalLahir ? fmtTanggal(header.tanggalLahir) : null, header.umur && `(${header.umur})`]
                .filter(Boolean)
                .join(" ")}
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <TextField label="Alamat" asal="alamat" value={form.alamat} onChange={(v) => set("alamat", v)} placeholder="Alamat pasien" />
            </div>
            <TextField label="Telp / HP" asal="telp" value={form.telp} onChange={(v) => set("telp", v)} placeholder="08xx" />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Dirawat ke-" asal="dirawatKe" value={form.dirawatKe} onChange={(v) => set("dirawatKe", v)} placeholder="1" />
              <TextField label="Gol. Darah" asal="golDarah" value={form.golDarah} onChange={(v) => set("golDarah", v)} placeholder="A/B/O/AB" />
            </div>
          </div>
        </Card>

        {/* Klasifikasi sosial */}
        <Section title="Data Sosial">
          <div className="space-y-4">
            <div>
              <LabelAsal path={["pendidikan", "pendidikanLain"]}>Pendidikan Terakhir</LabelAsal>
              <div className="flex flex-wrap items-center gap-2">
                <ChipRow options={PENDIDIKAN_OPTS} value={form.pendidikan} onChange={(v) => set("pendidikan", v)} />
                <Input
                  value={form.pendidikanLain}
                  onChange={(e) => set("pendidikanLain", e.target.value)}
                  placeholder="Lain-lain…"
                  className="h-9 w-40"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <LabelAsal path="bangsa">Bangsa</LabelAsal>
                <ChipRow options={BANGSA_OPTS} value={form.bangsa} onChange={(v) => set("bangsa", v as RingkasanForm["bangsa"])} />
              </div>
              <div>
                <LabelAsal path="agama">Agama</LabelAsal>
                <ChipRow options={AGAMA_OPTS} value={form.agama} onChange={(v) => set("agama", v)} />
              </div>
              <div>
                <LabelAsal path="statusPerkawinan">Status Perkawinan</LabelAsal>
                <ChipRow options={PERKAWINAN_OPTS} value={form.statusPerkawinan} onChange={(v) => set("statusPerkawinan", v)} />
              </div>
              <div>
                <LabelAsal path="pekerjaan">Pekerjaan</LabelAsal>
                <ChipRow options={PEKERJAAN_OPTS} value={form.pekerjaan} onChange={(v) => set("pekerjaan", v)} />
              </div>
              <div>
                <LabelAsal path="caraMasuk">Cara Masuk Rumah Sakit</LabelAsal>
                <ChipRow options={CARA_MASUK_OPTS} value={form.caraMasuk} onChange={(v) => set("caraMasuk", v)} />
              </div>
              <div>
                <LabelAsal path="jenisPelayanan">Jenis Pelayanan</LabelAsal>
                <ChipRow options={JENIS_PELAYANAN_OPTS} value={form.jenisPelayanan} onChange={(v) => set("jenisPelayanan", v)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Nama Orang Tua" asal="namaOrangTua" value={form.namaOrangTua} onChange={(v) => set("namaOrangTua", v)} placeholder="Nama orang tua" />
              <TextField label="Pekerjaan Orang Tua" asal="pekerjaanOrangTua" value={form.pekerjaanOrangTua} onChange={(v) => set("pekerjaanOrangTua", v)} placeholder="Pekerjaan orang tua" />
            </div>
          </div>
        </Section>

        {/* Keluarga terdekat */}
        <Section title="Keluarga Terdekat">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Nama" asal="keluargaNama" value={form.keluargaNama} onChange={(v) => set("keluargaNama", v)} placeholder="Nama keluarga terdekat" />
            <div className="sm:col-span-2">
              <TextField label="Alamat" asal="keluargaAlamat" value={form.keluargaAlamat} onChange={(v) => set("keluargaAlamat", v)} placeholder="Alamat keluarga" />
            </div>
            <TextField label="Telp / HP" asal="keluargaTelp" value={form.keluargaTelp} onChange={(v) => set("keluargaTelp", v)} placeholder="08xx" />
          </div>
        </Section>

        {/* Perawatan */}
        <Section title="Data Perawatan">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <LabelAsal path="tglMasuk">Tgl &amp; Jam Masuk (WITA)</LabelAsal>
              <DateTimePicker value={form.tglMasuk} onChange={(v) => set("tglMasuk", v)} />
            </div>
            <div>
              <LabelAsal path="tglKeluar">Tgl &amp; Jam Keluar (WITA)</LabelAsal>
              <DateTimePicker value={form.tglKeluar} onChange={(v) => set("tglKeluar", v)} />
            </div>
            <TextField label="Lama Rawat (hari)" asal="lamaRawat" value={form.lamaRawat} onChange={(v) => set("lamaRawat", v)} placeholder="0" />
            <TextField label="Diagnosa Sementara" asal="diagnosaSementara" value={form.diagnosaSementara} onChange={(v) => set("diagnosaSementara", v)} placeholder="Diagnosa saat masuk" />
            <TextField label="Dokter Jaga / DPJP" asal="dpjp" value={form.dpjp} onChange={(v) => set("dpjp", v)} placeholder="Nama DPJP" />
            <div>
              <LabelAsal path="peserta">Peserta</LabelAsal>
              <ChipRow options={PESERTA_OPTS} value={form.peserta} onChange={(v) => set("peserta", v as RingkasanForm["peserta"])} />
            </div>
            <div className="lg:col-span-3">
              <LabelAsal path="izinKeluar">Izin Keluar</LabelAsal>
              <ChipRow options={IZIN_KELUAR_OPTS} value={form.izinKeluar} onChange={(v) => set("izinKeluar", v)} />
            </div>
          </div>
        </Section>

        {/* Diagnosa akhir */}
        <Section title="Diagnosa Akhir & Kode ICD">
          <div className="space-y-3">
            <DxRow label="Diagnosa Utama" asal={["diagnosaUtama", "diagnosaUtamaKode"]} teks={form.diagnosaUtama} kode={form.diagnosaUtamaKode} onTeks={(v) => set("diagnosaUtama", v)} onKode={(v) => set("diagnosaUtamaKode", v)} />
            <DxRow label="Diagnosa Sekunder" asal={["diagnosaSekunder", "diagnosaSekunderKode"]} teks={form.diagnosaSekunder} kode={form.diagnosaSekunderKode} onTeks={(v) => set("diagnosaSekunder", v)} onKode={(v) => set("diagnosaSekunderKode", v)} />
            <DxRow label="Komplikasi" teks={form.komplikasi} kode={form.komplikasiKode} onTeks={(v) => set("komplikasi", v)} onKode={(v) => set("komplikasiKode", v)} />
            <DxRow label="Penyebab Luar Cedera & Keracunan" teks={form.penyebabLuar} kode={form.penyebabLuarKode} onTeks={(v) => set("penyebabLuar", v)} onKode={(v) => set("penyebabLuarKode", v)} />
            <DxRow label="Operasi" teks={form.operasi} kode={form.operasiKode} onTeks={(v) => set("operasi", v)} onKode={(v) => set("operasiKode", v)} />
          </div>
        </Section>

        {/* Catatan, nosokomial, imunisasi */}
        <Section title="Catatan & Lain-lain">
          <div className="space-y-4">
            <div>
              <Label>Catatan</Label>
              <textarea
                rows={2}
                value={form.catatan}
                onChange={(e) => set("catatan", e.target.value)}
                placeholder="Catatan"
                className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Infeksi Nosokomial" value={form.infeksiNosokomial} onChange={(v) => set("infeksiNosokomial", v)} placeholder="Ada / Tidak ada" />
              <TextField label="Penyebab Infeksi Nosokomial" value={form.penyebabInfeksiNosokomial} onChange={(v) => set("penyebabInfeksiNosokomial", v)} placeholder="Penyebab" />
            </div>
            <div>
              <Label>Sejarah Imunisasi</Label>
              <div className="flex flex-wrap gap-2">
                {IMUNISASI_OPTS.map((o) => (
                  <Chip key={o} active={form.imunisasi.includes(o)} onClick={() => toggleImun(o)}>
                    {o}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Dokter merawat + keadaan keluar */}
        <Section title="Dokter yang Merawat & Keadaan Keluar">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3">
              <TextField label="Nama Dokter yang Merawat" asal="dokterMerawatNama" value={form.dokterMerawatNama} onChange={(v) => set("dokterMerawatNama", v)} placeholder="Nama dokter" />
              <SignaturePad
                label="Tanda Tangan Dokter"
                value={form.dokterMerawatTtd}
                onChange={(v) => set("dokterMerawatTtd", v)}
                context={[header.nama, "RM.01 — Dokter Merawat"].filter(Boolean).join(" · ")}
              />
            </div>
            <div>
              <KeadaanKeluarTertaut nilai={keadaanKeluar} status={k.isian.status} tertaut={k.isian.tertaut} baca={keluar} />
              <p className="mt-2 text-xs text-fg-subtle">
                Jika pasien meninggal, aktifkan <b>Sebab Kematian</b> di bawah untuk mengisi &amp; mencetak halaman 2.
              </p>
            </div>
          </div>
        </Section>

        {/* ===== Toggle Sebab Kematian ===== */}
        <Card className={cn("overflow-hidden transition-colors", mati && "border-danger/40")}>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className={cn("flex size-9 items-center justify-center rounded-[var(--radius-md)]", mati ? "bg-danger/15 text-danger" : "bg-surface-2 text-fg-subtle")}>
                <HeartPulse className="size-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-fg">Sebab Kematian (halaman 2)</p>
                <p className="text-xs text-fg-muted">Aktifkan hanya bila pasien meninggal. Jika non-aktif, halaman ini tidak dicetak.</p>
              </div>
            </div>
            <Switch checked={mati} onChange={(v) => set("sebabKematianAktif", v)} label="Aktifkan Sebab Kematian" />
          </div>

          {mati && (
            <div className="space-y-5 border-t border-border px-4 py-4">
              {/* I. Sebab kematian */}
              <div>
                <SubHead>I. Sebab Kematian</SubHead>
                <div className="space-y-2.5">
                  <SkRow labelLeft="a. Penyakit/keadaan yang langsung menyebabkan kematian" teks={form.skA} lama={form.skALama} onTeks={(v) => set("skA", v)} onLama={(v) => set("skALama", v)} />
                  <p className="pl-1 text-xs italic text-fg-subtle">Penyakit tersebut dalam (a) disebabkan oleh / akibat dari:</p>
                  <SkRow labelLeft="b." teks={form.skB} lama={form.skBLama} onTeks={(v) => set("skB", v)} onLama={(v) => set("skBLama", v)} />
                  <p className="pl-1 text-xs italic text-fg-subtle">Penyakit tersebut dalam (b) disebabkan oleh / akibat dari:</p>
                  <SkRow labelLeft="c." teks={form.skC} lama={form.skCLama} onTeks={(v) => set("skC", v)} onLama={(v) => set("skCLama", v)} />
                </div>
              </div>

              {/* II. Penyakit lain */}
              <div>
                <SubHead>II. Penyakit lain yang mempengaruhi kematian (tanpa hubungan dengan I)</SubHead>
                <div className="space-y-2.5">
                  {form.skLain.map((row, i) => (
                    <SkRow
                      key={i}
                      labelLeft={`${i + 1}.`}
                      teks={row.teks}
                      lama={row.lama}
                      onTeks={(v) => setSkLain(i, "teks", v)}
                      onLama={(v) => setSkLain(i, "lama", v)}
                    />
                  ))}
                </div>
              </div>

              {/* Keterangan khusus */}
              <div>
                <SubHead>Keterangan Khusus</SubHead>
                <div className="space-y-4">
                  <div>
                    <Label>I. Mati karena Ruda Paksa (Violent Death) — Macam Ruda Paksa</Label>
                    <ChipRow options={RUDA_PAKSA_OPTS} value={form.rudaPaksaMacam} onChange={(v) => set("rudaPaksaMacam", v)} />
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <TextField label="Cara Kejadian Ruda Paksa" value={form.rudaPaksaCara} onChange={(v) => set("rudaPaksaCara", v)} placeholder="Cara kejadian" />
                      <TextField label="Sifat Jejas (kerusakan tubuh)" value={form.rudaPaksaSifat} onChange={(v) => set("rudaPaksaSifat", v)} placeholder="Sifat jejas" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <YaTidakField label="II. Kelahiran Mati — apakah ini janin lahir mati?" value={form.lahirMatiJanin} onChange={(v) => set("lahirMatiJanin", v as RingkasanForm["lahirMatiJanin"])} />
                    <TextField label="Sebab kelahiran mati" value={form.lahirMatiSebab} onChange={(v) => set("lahirMatiSebab", v)} placeholder="Sebab" />
                    <YaTidakField label="III. Apakah ini peristiwa persalinan?" value={form.persalinan} onChange={(v) => set("persalinan", v as RingkasanForm["persalinan"])} />
                    <YaTidakField label="Apakah ini peristiwa kehamilan?" value={form.kehamilan} onChange={(v) => set("kehamilan", v as RingkasanForm["kehamilan"])} />
                    <YaTidakField label="IV. Apakah di sini dilakukan operasi?" value={form.operasiKhususAda} onChange={(v) => set("operasiKhususAda", v as RingkasanForm["operasiKhususAda"])} />
                    <TextField label="Jenis operasi" value={form.operasiKhususJenis} onChange={(v) => set("operasiKhususJenis", v)} placeholder="Jenis operasi" />
                  </div>
                </div>
              </div>

              {/* TTD pemberi keterangan */}
              <div className="rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3">
                <p className="mb-3 text-sm font-semibold text-fg">Yang Memberikan Keterangan Sebab Kematian</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <Label>Tanggal</Label>
                      <DatePicker value={form.sebabKematianTanggal} onChange={(v) => set("sebabKematianTanggal", v)} placeholder="Pilih tanggal" />
                    </div>
                    <TextField label="Nama Dokter" value={form.dokterKematianNama} onChange={(v) => set("dokterKematianNama", v)} placeholder="Nama dokter" />
                  </div>
                  <SignaturePad
                    label="Tanda Tangan Dokter"
                    value={form.dokterKematianTtd}
                    onChange={(v) => set("dokterKematianTtd", v)}
                    reuse={form.dokterMerawatTtd}
                    context={[header.nama, "RM.01 — Sebab Kematian"].filter(Boolean).join(" · ")}
                  />
                </div>
              </div>
            </div>
          )}
        </Card>

      </BidangIsian>
    </IsianFrame>
  );
}

/* ----------------------------------------------------------------- helpers */

const fmtTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const jkSingkat = (jk: string) => (jk === "Laki-Laki" ? "L" : jk === "Perempuan" ? "P" : "-");

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">{title}</h2>
        {desc && <p className="mt-0.5 text-xs text-fg-muted">{desc}</p>}
      </div>
      {children}
    </Card>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{children}</p>;
}

function IdItem({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-fg-muted">{label}</p>
      <p className={cn("text-fg", mono && "font-mono", strong && "font-semibold")}>{value || "—"}</p>
    </div>
  );
}

/** Kolom teks; `asal` = path kolom untuk penanda SIMRS / diubah. */
function TextField({
  label,
  asal,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  asal?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      {asal ? <LabelAsal path={asal}>{label}</LabelAsal> : <Label>{label}</Label>}
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
    </div>
  );
}

/** Diagnosa + kode ICD (2 kolom). */
function DxRow({
  label,
  asal,
  teks,
  kode,
  onTeks,
  onKode,
}: {
  label: string;
  /** [path teks, path kode] bila kolom dapat diisi dari SIMRS. */
  asal?: readonly [string, string];
  teks: string;
  kode: string;
  onTeks: (v: string) => void;
  onKode: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
      <div>
        {asal ? <LabelAsal path={asal[0]}>{label}</LabelAsal> : <Label>{label}</Label>}
        <Input value={teks} onChange={(e) => onTeks(e.target.value)} placeholder="Diagnosa" aria-label={label} />
      </div>
      <div>
        {asal ? <LabelAsal path={asal[1]}>Kode ICD</LabelAsal> : <Label>Kode ICD</Label>}
        <Input value={kode} onChange={(e) => onKode(e.target.value)} placeholder="mis. J06.9" className="font-mono" aria-label={`Kode ICD ${label}`} />
      </div>
    </div>
  );
}

/** Baris Sebab Kematian: teks (kiri) + lama sakit (kanan). */
function SkRow({ labelLeft, teks, lama, onTeks, onLama }: { labelLeft: string; teks: string; lama: string; onTeks: (v: string) => void; onLama: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_11rem]">
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 pt-0 text-sm font-medium text-fg-muted">{labelLeft.length <= 3 ? labelLeft : ""}</span>
        <div className="min-w-0 flex-1">
          {labelLeft.length > 3 && <Label className="mb-1">{labelLeft}</Label>}
          <Input value={teks} onChange={(e) => onTeks(e.target.value)} placeholder="Penyakit / keadaan" />
        </div>
      </div>
      <div>
        <Input value={lama} onChange={(e) => onLama(e.target.value)} placeholder="Lama sakit → meninggal" />
      </div>
    </div>
  );
}

function YaTidakField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <ChipRow options={YT} value={value} onChange={onChange} />
    </div>
  );
}

/** Deret chip single-select (klik lagi untuk batal). */
function ChipRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} active={value === o} onClick={() => onChange(value === o ? "" : o)}>
          {o}
        </Chip>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        active
          ? "border-brand bg-brand-soft text-brand-soft-fg"
          : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {active && <Check className="size-3.5" />}
      {children}
    </button>
  );
}

/** Switch aksesibel (role=switch). */
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        checked ? "bg-danger" : "border border-border bg-surface-2",
      )}
    >
      <span
        className={cn(
          "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
