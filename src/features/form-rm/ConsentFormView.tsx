"use client";

import { useState } from "react";
import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { DatePicker, DateTimePicker } from "@/components/ui/DatePicker";
import { Select, SelectOther } from "@/components/ui/Select";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { BidangIsian } from "@/features/form-rm/isian/kunci";
import { LabelAsal } from "@/features/form-rm/isian/TandaAsal";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import { HUBUNGAN_OPTS } from "@/features/form-rm/edukasi.constants";
import {
  CONSENT_TEXT,
  IZIN_PRIVASI_OPTS,
  JK_OPTS,
  KELAS_OPTS,
  emptyConsentForm,
} from "@/features/form-rm/consent.constants";
import { cn } from "@/lib/cn";
import type { ConsentForm, FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

const siapkan = (data: unknown): ConsentForm => ({ ...emptyConsentForm(), ...(data as ConsentForm) });

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
  const [bacaIsi, setBacaIsi] = useState(false);

  const set = <K extends keyof ConsentForm>(key: K, value: ConsentForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setArr = (key: "pelepasanInfo" | "permintaanKhusus", i: number, value: string) =>
    setForm((f) => {
      const arr = [...f[key]];
      arr[i] = value;
      return { ...f, [key]: arr };
    });

  return (
    <IsianFrame kendali={k}>
      <BidangIsian>
        {/* Identitas pasien (read-only) */}
        <Card className="p-4">
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <IdItem label="No. Rekam Medis" value={header.norm} mono />
            <IdItem label="Nama Pasien" value={header.nama} strong />
            <IdItem label="Jenis Kelamin" value={header.jenisKelamin} />
            <IdItem
              label="Tgl Lahir / Umur"
              value={[header.tanggalLahir ? fmtTanggal(header.tanggalLahir) : null, header.umur && `(${header.umur})`]
                .filter(Boolean)
                .join(" ")}
            />
            <div className="sm:col-span-2 lg:col-span-1">
              <LabelAsal path="nik" htmlFor="nik">
                NIK
              </LabelAsal>
              <Input
                id="nik"
                inputMode="numeric"
                value={form.nik}
                onChange={(e) => set("nik", e.target.value)}
                placeholder="Nomor Induk Kependudukan"
              />
            </div>
          </div>
        </Card>
      </BidangIsian>

      <BidangIsian className="space-y-5">
        {/* Waktu pendaftaran */}
        <Section title="Waktu Pendaftaran & Ruang">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <LabelAsal path="waktuPendaftaran">Tanggal &amp; Jam (WITA)</LabelAsal>
              <DateTimePicker value={form.waktuPendaftaran} onChange={(v) => set("waktuPendaftaran", v)} />
            </div>
            <TextField label="Ruangan Rawat" asal="ruanganRawat" value={form.ruanganRawat} onChange={(v) => set("ruanganRawat", v)} placeholder="mis. Perawatan Interna" />
            <div>
              <LabelAsal path="kelas">Kelas</LabelAsal>
              <SelectOther value={form.kelas} onChange={(v) => set("kelas", v)} options={KELAS_OPTS} placeholder="Pilih kelas" otherPlaceholder="Kelas lain…" />
            </div>
          </div>
        </Section>

        {/* Penanggung jawab */}
        <Section title="Penanggung Jawab" desc="Data pihak yang bertanggung jawab atas pasien.">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField label="Nama" value={form.pjNama} onChange={(v) => set("pjNama", v)} placeholder="Nama penanggung jawab" />
            <div>
              <Label>Jenis Kelamin</Label>
              <Select value={form.pjJenisKelamin} onChange={(v) => set("pjJenisKelamin", v as ConsentForm["pjJenisKelamin"])} options={JK_OPTS} placeholder="Pilih" />
            </div>
            <TextField label="Umur" value={form.pjUmur} onChange={(v) => set("pjUmur", v)} placeholder="mis. 35 th" />
            <div>
              <Label>Hubungan dengan Pasien</Label>
              <SelectOther value={form.pjHubungan} onChange={(v) => set("pjHubungan", v)} options={HUBUNGAN_OPTS} placeholder="Pilih hubungan" otherPlaceholder="Hubungan lainnya…" />
            </div>
            <TextField label="No. Telepon / HP" value={form.pjTelepon} onChange={(v) => set("pjTelepon", v)} placeholder="08xx" />
            <div className="sm:col-span-2 lg:col-span-3">
              <Label>Alamat Tempat Tinggal</Label>
              <textarea
                rows={2}
                value={form.pjAlamat}
                onChange={(e) => set("pjAlamat", e.target.value)}
                placeholder="Alamat lengkap"
                className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              />
            </div>
          </div>
        </Section>

        {/* III — pelepasan informasi */}
        <Section title="Persetujuan Pelepasan Informasi (III)" desc={CONSENT_TEXT.III_3}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <TextField
                key={i}
                label={`Pihak ${i + 1}`}
                value={form.pelepasanInfo[i] ?? ""}
                onChange={(v) => setArr("pelepasanInfo", i, v)}
                placeholder="Nama / pihak"
              />
            ))}
          </div>
        </Section>

        {/* IV — keinginan privasi */}
        <Section title="Keinginan Privasi (IV)" desc={CONSENT_TEXT.IV_1}>
          <div className="space-y-4">
            <div>
              <Label className="mb-2">Akses pengunjung</Label>
              <div className="flex flex-wrap gap-2">
                {IZIN_PRIVASI_OPTS.map((o) => (
                  <Chip key={o} active={form.izinPrivasi === o} onClick={() => set("izinPrivasi", form.izinPrivasi === o ? "" : (o as ConsentForm["izinPrivasi"]))}>
                    {o}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2">{CONSENT_TEXT.IV_2}</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <Input
                    key={i}
                    value={form.permintaanKhusus[i] ?? ""}
                    onChange={(e) => setArr("permintaanKhusus", i, e.target.value)}
                    placeholder={`Nama / profesi ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </Section>
      </BidangIsian>

      {/* Isi persetujuan lengkap (read-only, collapsible) — tetap bisa dibuka saat terkunci */}
      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => setBacaIsi((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/50"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-fg">
            <ShieldCheck className="size-4 text-brand" /> Isi Persetujuan Lengkap (I–X)
          </span>
          <ChevronDown className={cn("size-4 text-fg-subtle transition-transform", bacaIsi && "rotate-180")} />
        </button>
        {bacaIsi && (
          <div className="space-y-3 border-t border-border px-4 py-4 text-[13px] leading-relaxed text-fg-muted">
            <Legal no="I" title="Persetujuan untuk Pengobatan">{CONSENT_TEXT.I}</Legal>
            <Legal no="II" title="Hasil yang Tidak Diharapkan">{CONSENT_TEXT.II}</Legal>
            <Legal no="III" title="Persetujuan Pelepasan Informasi">
              {CONSENT_TEXT.III_1}
              <br />
              {CONSENT_TEXT.III_2}
            </Legal>
            <Legal no="V" title="Informasi Biaya">{CONSENT_TEXT.V}</Legal>
            <Legal no="VI" title="Persetujuan Tindakan Pemasangan Alat Medis">{CONSENT_TEXT.VI}</Legal>
            <Legal no="VII" title="Pendidikan Kesehatan di RSUD Boltim">{CONSENT_TEXT.VII}</Legal>
            <Legal no="VIII" title="Tata Tertib Rumah Sakit">
              <ol className="ml-4 list-decimal space-y-0.5">
                {CONSENT_TEXT.VIII.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </Legal>
            <Legal no="IX" title="Hak dan Kewajiban Pasien">{CONSENT_TEXT.IX}</Legal>
            <Legal no="X" title="Pernyataan">{CONSENT_TEXT.X}</Legal>
          </div>
        )}
      </Card>

      <BidangIsian>
        {/* Tanda tangan */}
        <Section title="Pernyataan & Tanda Tangan" desc={CONSENT_TEXT.X}>
          <div className="mb-4 sm:max-w-xs">
            <Label>Tanggal Tanda Tangan</Label>
            <DatePicker value={form.tanggalTtd} onChange={(v) => set("tanggalTtd", v)} placeholder="Pilih tanggal" />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3">
              <p className="text-sm font-semibold text-fg">Pasien / Keluarga / Penanggung Jawab</p>
              <TextField label="Nama" asal="pasienNama" value={form.pasienNama} onChange={(v) => set("pasienNama", v)} placeholder="Nama penanda tangan" />
              <SignaturePad
                label="Tanda Tangan"
                value={form.pasienTtd}
                onChange={(v) => set("pasienTtd", v)}
                context={[header.nama, "General Consent"].filter(Boolean).join(" · ")}
              />
            </div>
            <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3">
              <p className="text-sm font-semibold text-fg">Petugas Rumah Sakit</p>
              <div>
                <TextField label="Nama" value={form.petugasNama} onChange={(v) => set("petugasNama", v)} placeholder="Nama petugas" />
                <SaranNamaSaya nama={form.petugasNama} onPilih={(v) => set("petugasNama", v)} />
              </div>
              <SignaturePad
                label="Tanda Tangan"
                value={form.petugasTtd}
                onChange={(v) => set("petugasTtd", v)}
                context={[header.nama, "General Consent — Petugas"].filter(Boolean).join(" · ")}
                petugas={{ nama: form.petugasNama, onNama: (v) => set("petugasNama", v), isiNamaOtomatis: true }}
              />
            </div>
          </div>
        </Section>
      </BidangIsian>
    </IsianFrame>
  );
}

/* ----------------------------------------------------------------- helpers */

const fmtTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

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

function Legal({ no, title, children }: { no: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-fg">
        {no}. {title}
      </p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
