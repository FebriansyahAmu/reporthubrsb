"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, HeartPulse, Loader2, Printer, Save } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { DatePicker, DateTimePicker, toYmd } from "@/components/ui/DatePicker";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import {
  AGAMA_OPTS,
  BANGSA_OPTS,
  CARA_MASUK_OPTS,
  IMUNISASI_OPTS,
  IZIN_KELUAR_OPTS,
  JENIS_PELAYANAN_OPTS,
  KEADAAN_KELUAR_OPTS,
  PEKERJAAN_OPTS,
  PENDIDIKAN_OPTS,
  PERKAWINAN_OPTS,
  PESERTA_OPTS,
  RUDA_PAKSA_OPTS,
  emptyRingkasanForm,
} from "@/features/form-rm/ringkasan.constants";
import { cn } from "@/lib/cn";
import type {
  FormRmHeader,
  FormRmSaved,
  RingkasanForm,
  RingkasanPrefill,
} from "@/server/modules/form-rm/form-rm.types";

const YT = ["Ya", "Tidak"];

export function RingkasanFormView({
  nopen,
  header,
  prefill,
  initialSaved,
}: {
  nopen: string;
  header: FormRmHeader;
  prefill: RingkasanPrefill;
  initialSaved: FormRmSaved<RingkasanForm> | null;
}) {
  const [form, setForm] = useState<RingkasanForm>(() => {
    const base = emptyRingkasanForm();
    if (initialSaved?.data) {
      Object.assign(base, initialSaved.data);
      if (!Array.isArray(base.skLain)) base.skLain = [];
      while (base.skLain.length < 3) base.skLain.push({ teks: "", lama: "" });
      return base;
    }
    // Seed dari prefill SIMGOS (form baru).
    base.alamat = prefill.alamat;
    base.golDarah = prefill.golDarah;
    base.dirawatKe = prefill.dirawatKe;
    base.pendidikan = prefill.pendidikan;
    base.pendidikanLain = prefill.pendidikanLain;
    base.bangsa = prefill.bangsa;
    base.agama = prefill.agama;
    base.statusPerkawinan = prefill.statusPerkawinan;
    base.pekerjaan = prefill.pekerjaan;
    base.tglMasuk = prefill.tglMasuk;
    base.tglKeluar = prefill.tglKeluar;
    base.lamaRawat = prefill.lamaRawat;
    base.dpjp = prefill.dpjp;
    base.dokterMerawatNama = prefill.dpjp;
    base.peserta = prefill.peserta;
    base.diagnosaUtama = prefill.diagnosaUtama;
    base.diagnosaUtamaKode = prefill.diagnosaUtamaKode;
    base.diagnosaSekunder = prefill.diagnosaSekunder;
    base.diagnosaSekunderKode = prefill.diagnosaSekunderKode;
    base.sebabKematianTanggal = toYmd(new Date());
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tersimpan, setTersimpan] = useState(!!initialSaved);
  const [savedAt, setSavedAt] = useState<string | null>(initialSaved?.updatedAt ?? null);

  const adaPrefill =
    !initialSaved &&
    Object.values(prefill).some((v) => typeof v === "string" && v.trim() !== "");

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

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/form-rm/ringkasan/${nopen}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: form,
          header: { norm: header.norm, nama: header.nama, ruang: header.ruang },
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan formulir");
      const json = (await res.json()) as { data: FormRmSaved<RingkasanForm> };
      setTersimpan(true);
      setSavedAt(json.data.updatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  const mati = form.sebabKematianAktif;

  return (
    <div className="space-y-5 pb-24">
      {adaPrefill && (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-brand/30 bg-brand-soft px-3 py-2.5 text-[13px] text-brand-soft-fg">
          <Check className="mt-0.5 size-4 shrink-0" />
          <span>
            Sebagian data telah <b>terisi otomatis dari SIMRS</b> (alamat, agama, pekerjaan, tanggal
            rawat, DPJP, diagnosa, dll). Periksa dan sesuaikan bila perlu sebelum menyimpan.
          </span>
        </div>
      )}

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
            <Label>Alamat</Label>
            <Input value={form.alamat} onChange={(e) => set("alamat", e.target.value)} placeholder="Alamat pasien" />
          </div>
          <TextField label="Telp / HP" value={form.telp} onChange={(v) => set("telp", v)} placeholder="08xx" />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Dirawat ke-" value={form.dirawatKe} onChange={(v) => set("dirawatKe", v)} placeholder="1" />
            <TextField label="Gol. Darah" value={form.golDarah} onChange={(v) => set("golDarah", v)} placeholder="A/B/O/AB" />
          </div>
        </div>
      </Card>

      {/* Klasifikasi sosial */}
      <Section title="Data Sosial">
        <div className="space-y-4">
          <div>
            <Label>Pendidikan Terakhir</Label>
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
              <Label>Bangsa</Label>
              <ChipRow options={BANGSA_OPTS} value={form.bangsa} onChange={(v) => set("bangsa", v as RingkasanForm["bangsa"])} />
            </div>
            <div>
              <Label>Agama</Label>
              <ChipRow options={AGAMA_OPTS} value={form.agama} onChange={(v) => set("agama", v)} />
            </div>
            <div>
              <Label>Status Perkawinan</Label>
              <ChipRow options={PERKAWINAN_OPTS} value={form.statusPerkawinan} onChange={(v) => set("statusPerkawinan", v)} />
            </div>
            <div>
              <Label>Pekerjaan</Label>
              <ChipRow options={PEKERJAAN_OPTS} value={form.pekerjaan} onChange={(v) => set("pekerjaan", v)} />
            </div>
            <div>
              <Label>Cara Masuk Rumah Sakit</Label>
              <ChipRow options={CARA_MASUK_OPTS} value={form.caraMasuk} onChange={(v) => set("caraMasuk", v)} />
            </div>
            <div>
              <Label>Jenis Pelayanan</Label>
              <ChipRow options={JENIS_PELAYANAN_OPTS} value={form.jenisPelayanan} onChange={(v) => set("jenisPelayanan", v)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Nama Orang Tua" value={form.namaOrangTua} onChange={(v) => set("namaOrangTua", v)} placeholder="Nama orang tua" />
            <TextField label="Pekerjaan Orang Tua" value={form.pekerjaanOrangTua} onChange={(v) => set("pekerjaanOrangTua", v)} placeholder="Pekerjaan orang tua" />
          </div>
        </div>
      </Section>

      {/* Keluarga terdekat */}
      <Section title="Keluarga Terdekat">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="Nama" value={form.keluargaNama} onChange={(v) => set("keluargaNama", v)} placeholder="Nama keluarga terdekat" />
          <div className="sm:col-span-2">
            <Label>Alamat</Label>
            <Input value={form.keluargaAlamat} onChange={(e) => set("keluargaAlamat", e.target.value)} placeholder="Alamat keluarga" />
          </div>
          <TextField label="Telp / HP" value={form.keluargaTelp} onChange={(v) => set("keluargaTelp", v)} placeholder="08xx" />
        </div>
      </Section>

      {/* Perawatan */}
      <Section title="Data Perawatan" desc="Tanggal masuk/keluar & DPJP diprefill dari SIMRS bila tersedia.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <Label>Tgl &amp; Jam Masuk (WITA)</Label>
            <DateTimePicker value={form.tglMasuk} onChange={(v) => set("tglMasuk", v)} />
          </div>
          <div>
            <Label>Tgl &amp; Jam Keluar (WITA)</Label>
            <DateTimePicker value={form.tglKeluar} onChange={(v) => set("tglKeluar", v)} />
          </div>
          <TextField label="Lama Rawat (hari)" value={form.lamaRawat} onChange={(v) => set("lamaRawat", v)} placeholder="0" />
          <TextField label="Diagnosa Sementara" value={form.diagnosaSementara} onChange={(v) => set("diagnosaSementara", v)} placeholder="Diagnosa saat masuk" />
          <TextField label="Dokter Jaga / DPJP" value={form.dpjp} onChange={(v) => set("dpjp", v)} placeholder="Nama DPJP" />
          <div>
            <Label>Peserta</Label>
            <ChipRow options={PESERTA_OPTS} value={form.peserta} onChange={(v) => set("peserta", v as RingkasanForm["peserta"])} />
          </div>
          <div className="lg:col-span-3">
            <Label>Izin Keluar</Label>
            <ChipRow options={IZIN_KELUAR_OPTS} value={form.izinKeluar} onChange={(v) => set("izinKeluar", v)} />
          </div>
        </div>
      </Section>

      {/* Diagnosa akhir */}
      <Section title="Diagnosa Akhir & Kode ICD" desc="Diagnosa utama & sekunder diprefill dari rekam medis (ICD-10).">
        <div className="space-y-3">
          <DxRow label="Diagnosa Utama" teks={form.diagnosaUtama} kode={form.diagnosaUtamaKode} onTeks={(v) => set("diagnosaUtama", v)} onKode={(v) => set("diagnosaUtamaKode", v)} />
          <DxRow label="Diagnosa Sekunder" teks={form.diagnosaSekunder} kode={form.diagnosaSekunderKode} onTeks={(v) => set("diagnosaSekunder", v)} onKode={(v) => set("diagnosaSekunderKode", v)} />
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
            <TextField label="Nama Dokter yang Merawat" value={form.dokterMerawatNama} onChange={(v) => set("dokterMerawatNama", v)} placeholder="Nama dokter" />
            <SignaturePad
              label="Tanda Tangan Dokter"
              value={form.dokterMerawatTtd}
              onChange={(v) => set("dokterMerawatTtd", v)}
              context={[header.nama, "RM.01 — Dokter Merawat"].filter(Boolean).join(" · ")}
            />
          </div>
          <div>
            <Label>Keadaan Keluar</Label>
            <div className="flex flex-wrap gap-2">
              {KEADAAN_KELUAR_OPTS.map((o) => (
                <Chip key={o} active={form.keadaanKeluar === o} onClick={() => set("keadaanKeluar", form.keadaanKeluar === o ? "" : o)}>
                  {o}
                </Chip>
              ))}
            </div>
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

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div className="min-w-0 text-xs text-fg-muted">
            {error ? (
              <span className="text-danger">{error}</span>
            ) : tersimpan ? (
              <span className="inline-flex items-center gap-1.5 text-success">
                <Check className="size-3.5" />
                Tersimpan{savedAt ? ` · ${fmtWaktu(savedAt)}` : ""}
              </span>
            ) : (
              <span>Belum disimpan</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tersimpan && (
              <Link
                href={`/print/form-rm/ringkasan/${nopen}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
              >
                <Printer className="size-4" />
                Cetak
              </Link>
            )}
            <Button
              onClick={handleSave}
              disabled={saving}
              icon={saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            >
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- helpers */

const fmtTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const fmtWaktu = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
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

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/** Diagnosa + kode ICD (2 kolom). */
function DxRow({ label, teks, kode, onTeks, onKode }: { label: string; teks: string; kode: string; onTeks: (v: string) => void; onKode: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
      <div>
        <Label>{label}</Label>
        <Input value={teks} onChange={(e) => onTeks(e.target.value)} placeholder="Diagnosa" />
      </div>
      <div>
        <Label>Kode ICD</Label>
        <Input value={kode} onChange={(e) => onKode(e.target.value)} placeholder="mis. J06.9" className="font-mono" />
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
