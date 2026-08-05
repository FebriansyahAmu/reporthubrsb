"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Printer, QrCode, Save } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { DatePicker, DateTimePicker, nowLocalDateTime } from "@/components/ui/DatePicker";
import { SelectOther } from "@/components/ui/Select";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { cn } from "@/lib/cn";
import {
  BACA_TULIS_OPTS,
  BAHASA_OPTS,
  EDUKASI_KATEGORI,
  EVALUASI_OPTS,
  HAMBATAN_OPTS,
  HUBUNGAN_OPTS,
  KESEDIAAN_OPTS,
  METODE_OPTS,
  PEMAHAMAN_OPTS,
  PENDIDIKAN_OPTS,
  SARANA_OPTS,
  SASARAN_OPTS,
  TIPE_BELAJAR_OPTS,
  emptyEdukasiForm,
} from "@/features/form-rm/edukasi.constants";
import type {
  EdukasiEntry,
  EdukasiForm,
  EdukasiPersiapan,
  FormRmHeader,
  FormRmSaved,
} from "@/server/modules/form-rm/form-rm.types";

export function EdukasiFormView({
  nopen,
  header,
  initialSaved,
}: {
  nopen: string;
  header: FormRmHeader;
  initialSaved: FormRmSaved<EdukasiForm> | null;
}) {
  const [form, setForm] = useState<EdukasiForm>(initialSaved?.data ?? emptyEdukasiForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tersimpan, setTersimpan] = useState(!!initialSaved);
  const [savedAt, setSavedAt] = useState<string | null>(initialSaved?.updatedAt ?? null);

  const topikByKategori = useMemo(
    () => new Map(EDUKASI_KATEGORI.map((k) => [k.key, k.topik])),
    [],
  );

  function patchPersiapan(p: Partial<EdukasiPersiapan>) {
    setForm((f) => ({ ...f, persiapan: { ...f.persiapan, ...p } }));
  }
  function patchEntry(i: number, p: Partial<EdukasiEntry>) {
    setForm((f) => ({
      ...f,
      entries: f.entries.map((e, idx) => (idx === i ? { ...e, ...p } : e)),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/form-rm/edukasi/${nopen}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: form,
          header: { norm: header.norm, nama: header.nama, ruang: header.ruang },
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan formulir");
      const json = (await res.json()) as { data: FormRmSaved<EdukasiForm> };
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
      {/* Identitas pasien (read-only dari SIMRS) */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <IdItem label="No. Rekam Medis" value={header.norm} mono />
          <IdItem label="Nama Pasien" value={header.nama} strong />
          <IdItem
            label="Tgl Lahir / Umur"
            value={[header.tanggalLahir ? fmtTanggal(header.tanggalLahir) : null, header.umur && `(${header.umur})`]
              .filter(Boolean)
              .join(" ")}
          />
        </div>
      </Card>

      {/* PERSIAPAN EDUKASI */}
      <Section title="Persiapan Edukasi" desc="Kondisi & kesiapan pasien/keluarga menerima edukasi.">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
          <CheckField
            label="Bahasa"
            options={BAHASA_OPTS}
            values={form.persiapan.bahasa}
            onToggle={(v) => patchPersiapan({ bahasa: toggle(form.persiapan.bahasa, v) })}
            other={form.persiapan.bahasaLain}
            onOther={(v) => patchPersiapan({ bahasaLain: v })}
          />
          <RadioField
            label="Kebutuhan Penerjemah"
            options={["Ya", "Tidak"]}
            value={form.persiapan.penerjemah}
            onChange={(v) => patchPersiapan({ penerjemah: v as EdukasiPersiapan["penerjemah"] })}
          />
          <RadioField
            label="Pendidikan Pasien"
            options={PENDIDIKAN_OPTS}
            value={form.persiapan.pendidikan}
            onChange={(v) => patchPersiapan({ pendidikan: form.persiapan.pendidikan === v ? "" : v })}
            other={form.persiapan.pendidikanLain}
            onOther={(v) => patchPersiapan({ pendidikanLain: v })}
          />
          <RadioField
            label="Baca & Tulis"
            options={BACA_TULIS_OPTS}
            value={form.persiapan.bacaTulis}
            onChange={(v) => patchPersiapan({ bacaTulis: v as EdukasiPersiapan["bacaTulis"] })}
          />
          <CheckField
            label="Pilihan Tipe Pembelajaran"
            options={TIPE_BELAJAR_OPTS}
            values={form.persiapan.tipePembelajaran}
            onToggle={(v) => patchPersiapan({ tipePembelajaran: toggle(form.persiapan.tipePembelajaran, v) })}
          />
          <RadioField
            label="Kesediaan Menerima Edukasi"
            options={KESEDIAAN_OPTS}
            value={form.persiapan.kesediaan}
            onChange={(v) => patchPersiapan({ kesediaan: v as EdukasiPersiapan["kesediaan"] })}
          />
          <div className="lg:col-span-2">
            <CheckField
              label="Hambatan Edukasi"
              options={HAMBATAN_OPTS}
              values={form.persiapan.hambatan}
              onToggle={(v) => patchPersiapan({ hambatan: toggle(form.persiapan.hambatan, v) })}
              other={form.persiapan.hambatanLain}
              onOther={(v) => patchPersiapan({ hambatanLain: v })}
              columns
            />
          </div>
        </div>
      </Section>

      {/* KEBUTUHAN EDUKASI */}
      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-fg-subtle">
          Kebutuhan Edukasi
        </h2>
        <p className="mb-3 text-xs text-fg-muted">
          Aktifkan kategori yang benar-benar diberikan, lalu lengkapi rinciannya.
        </p>
        <div className="space-y-3">
          {form.entries.map((entry, i) => (
            <EntryCard
              key={entry.kategori}
              entry={entry}
              topik={topikByKategori.get(entry.kategori) ?? []}
              onPatch={(p) => patchEntry(i, p)}
            />
          ))}
        </div>
      </div>

      {/* Catatan */}
      <Section title="Catatan Tambahan" desc="Opsional.">
        <textarea
          rows={3}
          value={form.catatan}
          onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))}
          placeholder="Catatan edukasi tambahan…"
          className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        />
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
                href={`/print/form-rm/edukasi/${nopen}`}
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

/* ---------------------------------------------------------------- entry card */

function EntryCard({
  entry,
  topik,
  onPatch,
}: {
  entry: EdukasiEntry;
  topik: string[];
  onPatch: (p: Partial<EdukasiEntry>) => void;
}) {
  // Saat kategori diaktifkan, auto-isi Tanggal & Jam = sekarang (bila masih kosong).
  function toggleAktif() {
    const nextAktif = !entry.aktif;
    const patch: Partial<EdukasiEntry> = { aktif: nextAktif };
    if (nextAktif && !entry.tanggalJam) patch.tanggalJam = nowLocalDateTime();
    onPatch(patch);
  }

  return (
    <Card className={cn("overflow-hidden transition-colors", entry.aktif && "border-brand/40")}>
      <button
        type="button"
        onClick={toggleAktif}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/50"
      >
        <div className="min-w-0">
          <p className="font-semibold text-fg">{entry.kategori}</p>
          <p className="truncate text-xs text-fg-muted">{topik.join(" · ")}</p>
        </div>
        <span
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
            entry.aktif ? "bg-brand" : "bg-surface-2",
          )}
          aria-hidden
        >
          <span
            className={cn(
              "inline-block size-5 rounded-full bg-white shadow transition-transform",
              entry.aktif ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </span>
      </button>

      {entry.aktif && (
        <div className="space-y-5 border-t border-border px-4 py-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField
              label="Edukator (Nama)"
              value={entry.edukatorNama}
              onChange={(v) => onPatch({ edukatorNama: v })}
              placeholder="Nama petugas edukator"
            />
            <div>
              <Label>Tanggal &amp; Jam</Label>
              <DateTimePicker
                value={entry.tanggalJam}
                onChange={(v) => onPatch({ tanggalJam: v })}
              />
            </div>
            <div>
              <Label>Durasi (menit)</Label>
              <Input
                type="number"
                min={0}
                value={entry.durasiMenit}
                onChange={(e) => onPatch({ durasiMenit: e.target.value })}
                placeholder="mis. 10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
            <RadioField
              label="Sasaran"
              options={SASARAN_OPTS}
              value={entry.sasaran}
              onChange={(v) => onPatch({ sasaran: entry.sasaran === v ? "" : v })}
            />
            <TextField
              label="Nama Sasaran"
              value={entry.sasaranNama}
              onChange={(v) => onPatch({ sasaranNama: v })}
              placeholder="Nama penerima edukasi"
            />
            <div>
              <Label>Hubungan dgn Pasien</Label>
              <SelectOther
                value={entry.sasaranHubungan}
                onChange={(v) => onPatch({ sasaranHubungan: v })}
                options={HUBUNGAN_OPTS}
                placeholder="Pilih hubungan"
                otherPlaceholder="Hubungan lainnya…"
              />
            </div>
          </div>

          {/* TTD Edukator otomatis jadi QR (isi nama) saat cetak; sasaran ttd gambar. */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium text-fg-muted">Tanda Tangan Edukator</p>
              <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-dashed border-border bg-surface-2/40 px-3 py-2.5 text-xs text-fg-muted">
                <QrCode className="size-8 shrink-0 text-fg-subtle" />
                <span>
                  Otomatis berupa <span className="font-medium text-fg">QR code</span> berisi nama
                  edukator{entry.edukatorNama ? <> (<span className="font-medium text-fg">{entry.edukatorNama}</span>)</> : null} saat dicetak.
                </span>
              </div>
            </div>
            <SignaturePad
              label="Tanda Tangan Sasaran / Keluarga"
              value={entry.sasaranTtd}
              onChange={(v) => onPatch({ sasaranTtd: v })}
            />
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
            <CheckField
              label="Metode Edukasi"
              options={METODE_OPTS}
              values={entry.metode}
              onToggle={(v) => onPatch({ metode: toggle(entry.metode, v) })}
            />
            <CheckField
              label="Sarana Edukasi"
              options={SARANA_OPTS}
              values={entry.sarana}
              onToggle={(v) => onPatch({ sarana: toggle(entry.sarana, v) })}
              other={entry.saranaLain}
              onOther={(v) => onPatch({ saranaLain: v })}
            />
            <CheckField
              label="Tingkat Pemahaman"
              options={PEMAHAMAN_OPTS}
              values={entry.pemahaman}
              onToggle={(v) => onPatch({ pemahaman: toggle(entry.pemahaman, v) })}
            />
            <CheckField
              label="Evaluasi"
              options={EVALUASI_OPTS}
              values={entry.evaluasi}
              onToggle={(v) => onPatch({ evaluasi: toggle(entry.evaluasi, v) })}
            />
          </div>

          <div className="sm:max-w-xs">
            <Label>Tanggal Re-Edukasi</Label>
            <DatePicker
              value={entry.tanggalReEdukasi}
              onChange={(v) => onPatch({ tanggalReEdukasi: v })}
              placeholder="Pilih tanggal re-edukasi"
            />
          </div>
        </div>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- helpers */

function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

const fmtTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const fmtWaktu = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
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

function IdItem({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-fg-muted">{label}</p>
      <p className={cn("text-fg", mono && "font-mono", strong && "font-semibold")}>{value || "—"}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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

function CheckField({
  label,
  options,
  values,
  onToggle,
  other,
  onOther,
  columns,
}: {
  label: string;
  options: string[];
  values: string[];
  onToggle: (v: string) => void;
  other?: string;
  onOther?: (v: string) => void;
  columns?: boolean;
}) {
  return (
    <div>
      <Label className="mb-2">{label}</Label>
      <div className={cn("flex flex-wrap gap-2", columns && "gap-y-2")}>
        {options.map((o) => (
          <Chip key={o} active={values.includes(o)} onClick={() => onToggle(o)}>
            {o}
          </Chip>
        ))}
        {onOther && (
          <input
            value={other ?? ""}
            onChange={(e) => onOther(e.target.value)}
            placeholder="Lain-lain…"
            className="h-8 min-w-[8rem] flex-1 rounded-full border border-border bg-surface px-3 text-[13px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          />
        )}
      </div>
    </div>
  );
}

function RadioField({
  label,
  options,
  value,
  onChange,
  other,
  onOther,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  other?: string;
  onOther?: (v: string) => void;
}) {
  return (
    <div>
      <Label className="mb-2">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} active={value === o} onClick={() => onChange(o)}>
            {o}
          </Chip>
        ))}
        {onOther && (
          <input
            value={other ?? ""}
            onChange={(e) => onOther(e.target.value)}
            placeholder="Lain-lain…"
            className="h-8 min-w-[8rem] flex-1 rounded-full border border-border bg-surface px-3 text-[13px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          />
        )}
      </div>
    </div>
  );
}
