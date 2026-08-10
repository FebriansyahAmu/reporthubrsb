"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Loader2, Printer, Save, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { DatePicker, DateTimePicker, toYmd } from "@/components/ui/DatePicker";
import { Select, SelectOther } from "@/components/ui/Select";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { HUBUNGAN_OPTS } from "@/features/form-rm/edukasi.constants";
import {
  CONSENT_TEXT,
  IZIN_PRIVASI_OPTS,
  JK_OPTS,
  KELAS_OPTS,
  emptyConsentForm,
} from "@/features/form-rm/consent.constants";
import { cn } from "@/lib/cn";
import type { ConsentForm, FormRmHeader, FormRmSaved } from "@/server/modules/form-rm/form-rm.types";

export function ConsentFormView({
  nopen,
  header,
  initialSaved,
}: {
  nopen: string;
  header: FormRmHeader;
  initialSaved: FormRmSaved<ConsentForm> | null;
}) {
  const [form, setForm] = useState<ConsentForm>(() => {
    const base = emptyConsentForm();
    if (initialSaved?.data) {
      Object.assign(base, initialSaved.data);
    } else {
      base.waktuPendaftaran = header.masuk.slice(0, 16); // "YYYY-MM-DDTHH:mm"
      base.ruanganRawat = header.ruang && header.ruang !== "—" ? header.ruang : "";
      base.pasienNama = header.nama && header.nama !== "—" ? header.nama : "";
      base.tanggalTtd = toYmd(new Date());
    }
    // NIK: prefill dari SIMRS bila field masih kosong (termasuk rekaman lama).
    if (!base.nik && header.nik) base.nik = header.nik;
    return base;
  });
  // Apakah NIK datang otomatis dari SIMRS (untuk hint & badge di UI).
  const nikDariSimrs = !!header.nik && form.nik === header.nik;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tersimpan, setTersimpan] = useState(!!initialSaved);
  const [savedAt, setSavedAt] = useState<string | null>(initialSaved?.updatedAt ?? null);
  const [bacaIsi, setBacaIsi] = useState(false);

  const set = <K extends keyof ConsentForm>(key: K, value: ConsentForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setArr = (key: "pelepasanInfo" | "permintaanKhusus", i: number, value: string) =>
    setForm((f) => {
      const arr = [...f[key]];
      arr[i] = value;
      return { ...f, [key]: arr };
    });

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/form-rm/consent/${nopen}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: form,
          header: { norm: header.norm, nama: header.nama, ruang: header.ruang },
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan formulir");
      const json = (await res.json()) as { data: FormRmSaved<ConsentForm> };
      setTersimpan(true);
      setSavedAt(json.data.updatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 pb-24">
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
            <div className="flex items-center gap-2">
              <Label htmlFor="nik">NIK</Label>
              {nikDariSimrs && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-medium text-success">
                  <Check className="size-2.5" /> SIMRS
                </span>
              )}
            </div>
            <Input
              id="nik"
              inputMode="numeric"
              value={form.nik}
              onChange={(e) => set("nik", e.target.value)}
              placeholder="Nomor Induk Kependudukan"
            />
            <p className="mt-1 text-[11px] text-fg-subtle">
              {nikDariSimrs
                ? "Otomatis dari data SIMRS — dapat disesuaikan."
                : "Tidak ditemukan di SIMRS, isi manual."}
            </p>
          </div>
        </div>
      </Card>

      {/* Waktu pendaftaran */}
      <Section title="Waktu Pendaftaran & Ruang" desc="Prefill dari SIMRS, bisa disesuaikan.">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Tanggal &amp; Jam (WITA)</Label>
            <DateTimePicker value={form.waktuPendaftaran} onChange={(v) => set("waktuPendaftaran", v)} />
          </div>
          <TextField label="Ruangan Rawat" value={form.ruanganRawat} onChange={(v) => set("ruanganRawat", v)} placeholder="mis. Perawatan Interna" />
          <div>
            <Label>Kelas</Label>
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

      {/* Isi persetujuan lengkap (read-only, collapsible) */}
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

      {/* Tanda tangan */}
      <Section title="Pernyataan & Tanda Tangan" desc={CONSENT_TEXT.X}>
        <div className="mb-4 sm:max-w-xs">
          <Label>Tanggal Tanda Tangan</Label>
          <DatePicker value={form.tanggalTtd} onChange={(v) => set("tanggalTtd", v)} placeholder="Pilih tanggal" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3">
            <p className="text-sm font-semibold text-fg">Pasien / Keluarga / Penanggung Jawab</p>
            <TextField label="Nama" value={form.pasienNama} onChange={(v) => set("pasienNama", v)} placeholder="Nama penanda tangan" />
            <SignaturePad
              label="Tanda Tangan"
              value={form.pasienTtd}
              onChange={(v) => set("pasienTtd", v)}
              context={[header.nama, "General Consent"].filter(Boolean).join(" · ")}
            />
          </div>
          <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3">
            <p className="text-sm font-semibold text-fg">Petugas Rumah Sakit</p>
            <TextField label="Nama" value={form.petugasNama} onChange={(v) => set("petugasNama", v)} placeholder="Nama petugas" />
            <SignaturePad
              label="Tanda Tangan"
              value={form.petugasTtd}
              onChange={(v) => set("petugasTtd", v)}
              context={[header.nama, "General Consent — Petugas"].filter(Boolean).join(" · ")}
            />
          </div>
        </div>
      </Section>

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
                href={`/print/form-rm/consent/${nopen}`}
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

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
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
