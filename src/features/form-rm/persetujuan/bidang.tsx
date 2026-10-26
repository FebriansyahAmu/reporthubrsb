"use client";

import type { Dispatch, SetStateAction } from "react";
import { Check, CircleAlert, ListChecks, Stethoscope, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input, Label } from "@/components/ui/Field";
import { SelectOther } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { LabelAsal } from "@/features/form-rm/isian/TandaAsal";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import { Meter } from "./alur";
import { Saran } from "./saran";
import {
  HUBUNGAN_KELUARGA,
  INFORMASI_WAJIB,
  JENIS_INFORMASI,
  JK_PILIHAN,
  kosong,
  TEKS_INFORMASI,
  type DataPemberianInformasi,
  type DataYangMenyatakan,
  type IdInformasi,
  type JkPilihan,
  type TabelInformasi as DataTabelInformasi,
} from "./informasi";

/**
 * Bidang isian BERSAMA formulir informasi & persetujuan (RM.22 & RM.33):
 * kepala isian, tabel PEMBERIAN INFORMASI, kotak tanda tangan, identitas,
 * blok "yang menyatakan … terhadap saya / keluarga", saksi, dan konfirmasi
 * ganti keputusan. Tampilan khusus tiap formulir ada di view masing-masing.
 */

export const samaNama = (a: string, b: string) => !kosong(a) && a.trim().toLowerCase() === b.trim().toLowerCase();

/* ================================================================= kepala */

export function KepalaIsian({
  header,
  urutan,
  lencana,
  subjekLabel,
  subjek,
}: {
  header: FormRmHeader;
  urutan: number;
  lencana: React.ReactNode;
  /** "Tindakan" / "Rujukan". */
  subjekLabel: string;
  subjek: string;
}) {
  const jk = header.jenisKelamin === "Laki-Laki" ? "L" : header.jenisKelamin === "Perempuan" ? "P" : "";
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-surface-2/50 px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge tone="brand">Isian ke-{urutan}</Badge>
          {lencana}
        </div>
        <p className="min-w-0 truncate text-sm text-fg">
          <span className="text-fg-muted">{subjekLabel}:</span>{" "}
          {subjek.trim() ? <b className="font-semibold">{subjek}</b> : <span className="text-fg-subtle">belum diisi</span>}
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

/* ==================================================== pemberian informasi */

type DataPihak = Pick<DataPemberianInformasi, "dokterPelaksana" | "pemberiInformasi" | "penerimaInformasi" | "pemberiTtd" | "penerimaTtd">;
type SetPihak = <K extends keyof DataPihak>(key: K, value: DataPihak[K]) => void;

/** Dokter pelaksana, pemberi informasi / DPJP, dan penerima informasi + saran satu-klik. */
export function PihakInformasi({ awalan, form, set, pasienNama }: { awalan: string; form: DataPihak; set: SetPihak; pasienNama: string }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
        <div>
          <LabelAsal path="dokterPelaksana" htmlFor={`${awalan}-pelaksana`}>
            Dokter Pelaksana Tindakan
          </LabelAsal>
          <Input
            id={`${awalan}-pelaksana`}
            value={form.dokterPelaksana}
            maxLength={120}
            onChange={(e) => set("dokterPelaksana", e.target.value)}
            placeholder="Nama dokter beserta gelar"
          />
          {!kosong(form.pemberiInformasi) && !samaNama(form.dokterPelaksana, form.pemberiInformasi) && (
            <Saran onClick={() => set("dokterPelaksana", form.pemberiInformasi)}>Sama dengan pemberi informasi: {form.pemberiInformasi}</Saran>
          )}
        </div>
        <div>
          <LabelAsal path="pemberiInformasi" htmlFor={`${awalan}-pemberi`}>
            Pemberi Informasi / DPJP
          </LabelAsal>
          <Input
            id={`${awalan}-pemberi`}
            value={form.pemberiInformasi}
            maxLength={120}
            onChange={(e) => set("pemberiInformasi", e.target.value)}
            placeholder="Nama dokter pemberi informasi"
          />
          <SaranNamaSaya nama={form.pemberiInformasi} onPilih={(v) => set("pemberiInformasi", v)} />
        </div>
        <div>
          <Label htmlFor={`${awalan}-penerima`}>Pasien / Keluarga (penerima informasi)</Label>
          <Input
            id={`${awalan}-penerima`}
            value={form.penerimaInformasi}
            maxLength={120}
            onChange={(e) => set("penerimaInformasi", e.target.value)}
            placeholder="Nama penerima informasi"
          />
          {pasienNama && !samaNama(form.penerimaInformasi, pasienNama) && (
            <Saran onClick={() => set("penerimaInformasi", pasienNama)}>Pasien sendiri: {pasienNama}</Saran>
          )}
        </div>
      </div>
      <p className="mt-4 rounded-[var(--radius-md)] bg-surface-2/60 px-3 py-2 text-xs text-fg-muted">{TEKS_INFORMASI.catatanPenerima}</p>
    </>
  );
}

/** TTD pemberi ("telah menerangkan") & penerima ("telah menerima") informasi. */
export function TtdInformasi({
  form,
  set,
  konteks,
  noPihak,
}: {
  form: DataPihak;
  set: SetPihak;
  konteks: (peran: string) => string;
  /** Nomor langkah tempat nama pihak diisi (petunjuk saat nama kosong). */
  noPihak: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <KotakTtd
        ikon={Stethoscope}
        peran="Pemberi informasi"
        nama={form.pemberiInformasi}
        kosongNama={`Isi nama pemberi informasi di langkah ${noPihak}`}
        pernyataan={TEKS_INFORMASI.menerangkan}
      >
        <SignaturePad
          label="Tanda tangan pemberi informasi"
          value={form.pemberiTtd}
          onChange={(v) => set("pemberiTtd", v)}
          context={konteks("Pemberi informasi")}
          petugas={{ nama: form.pemberiInformasi, onNama: (v) => set("pemberiInformasi", v) }}
        />
      </KotakTtd>
      <KotakTtd
        ikon={UserRound}
        peran="Penerima informasi"
        nama={form.penerimaInformasi}
        kosongNama={`Isi nama penerima informasi di langkah ${noPihak}`}
        pernyataan={TEKS_INFORMASI.menerima}
      >
        <SignaturePad
          label="Tanda tangan penerima informasi"
          value={form.penerimaTtd}
          onChange={(v) => set("penerimaTtd", v)}
          context={konteks("Penerima informasi")}
        />
      </KotakTtd>
    </div>
  );
}

/* ============================================================ informasi */

/** Isi satu baris; tanda (V) ikut dilepas bila isinya dikosongkan. */
export function ubahIsiInformasi(informasi: DataTabelInformasi, id: IdInformasi, isi: string): DataTabelInformasi {
  return { ...informasi, [id]: { isi, tanda: kosong(isi) ? false : informasi[id].tanda } };
}

/** Tandai (V) semua baris yang berisi. */
export function tandaiSemuaInformasi(informasi: DataTabelInformasi): DataTabelInformasi {
  return Object.fromEntries(
    JENIS_INFORMASI.map((j) => [j.id, { ...informasi[j.id], tanda: !kosong(informasi[j.id].isi) }]),
  ) as DataTabelInformasi;
}

function hitungInformasi(informasi: DataTabelInformasi) {
  const adaIsi = JENIS_INFORMASI.filter((j) => !kosong(informasi[j.id].isi));
  return {
    terisi: INFORMASI_WAJIB.filter((id) => !kosong(informasi[id].isi)).length,
    adaIsi: adaIsi.length,
    ditandai: adaIsi.filter((j) => informasi[j.id].tanda).length,
  };
}

/** Meter "Terisi" (baris wajib) & "Ditandai" (baris berisi) di kepala langkah. */
export function MeterInformasi({ informasi }: { informasi: DataTabelInformasi }) {
  const h = hitungInformasi(informasi);
  return (
    <div className="flex flex-col items-end gap-1.5 text-xs">
      <Meter label="Terisi" nilai={h.terisi} total={INFORMASI_WAJIB.length} />
      <Meter label="Ditandai" nilai={h.ditandai} total={h.adaIsi} />
    </div>
  );
}

/** Tabel "Jenis / Isi Informasi / Tanda (V)" — grid di layar lebar, kartu bertumpuk di ponsel. */
export function TabelInformasi({
  awalan,
  informasi,
  onIsi,
  onTanda,
  onTandaiSemua,
  saran,
}: {
  awalan: string;
  informasi: DataTabelInformasi;
  onIsi: (id: IdInformasi, isi: string) => void;
  onTanda: (id: IdInformasi, tanda: boolean) => void;
  onTandaiSemua: () => void;
  /** Saran satu-klik di bawah baris tertentu (mis. "Rujukan ke …" pada no. 3). */
  saran?: Partial<Record<IdInformasi, React.ReactNode>>;
}) {
  const h = hitungInformasi(informasi);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-subtle">Baris 1–10 wajib; Lain-lain opsional.</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<ListChecks className="size-4" />}
          onClick={onTandaiSemua}
          disabled={h.adaIsi === 0 || h.ditandai === h.adaIsi}
        >
          Tandai (V) semua yang terisi
        </Button>
      </div>
      <div role="table" aria-label="Jenis dan isi informasi" className="overflow-hidden rounded-[var(--radius-md)] border border-border">
        <div
          role="row"
          className="hidden grid-cols-[2.5rem_12rem_minmax(0,1fr)_7.5rem] border-b border-border bg-surface-2/70 text-xs font-semibold text-fg-muted md:grid"
        >
          <span role="columnheader" className="px-2 py-2 text-center">
            No
          </span>
          <span role="columnheader" className="px-3 py-2">
            Jenis Informasi
          </span>
          <span role="columnheader" className="border-l border-border px-3 py-2">
            Isi Informasi
          </span>
          <span role="columnheader" className="border-l border-border px-2 py-2 text-center">
            Tanda (V)
          </span>
        </div>
        {JENIS_INFORMASI.map((j) => (
          <BarisInformasi
            key={j.id}
            fieldId={`${awalan}-info-${j.id}`}
            id={j.id}
            no={j.no}
            label={j.label}
            contoh={j.contoh}
            wajib={j.id !== "lainLain"}
            nilai={informasi[j.id]}
            onIsi={(v) => onIsi(j.id, v)}
            onTanda={(v) => onTanda(j.id, v)}
            saran={saran?.[j.id]}
          />
        ))}
      </div>
    </>
  );
}

function BarisInformasi({
  fieldId,
  id,
  no,
  label,
  contoh,
  wajib,
  nilai,
  onIsi,
  onTanda,
  saran,
}: {
  fieldId: string;
  id: IdInformasi;
  no: string;
  label: string;
  contoh: string;
  wajib: boolean;
  nilai: { isi: string; tanda: boolean };
  onIsi: (v: string) => void;
  onTanda: (v: boolean) => void;
  saran?: React.ReactNode;
}) {
  const ada = !kosong(nilai.isi);
  return (
    <div
      role="row"
      data-info={id}
      className={cn(
        "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2 border-b border-border px-2 py-2.5 last:border-b-0 md:grid-cols-[2.5rem_12rem_minmax(0,1fr)_7.5rem] md:gap-0 md:p-0",
        ada && nilai.tanda ? "bg-success-soft/35" : ada ? "bg-brand-soft/25" : "",
      )}
    >
      <span role="cell" className="pt-2 text-center text-sm tabular-nums text-fg-muted md:py-3">
        {no}
      </span>
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
        {saran}
      </div>
      <div
        role="cell"
        className="col-start-3 row-start-1 flex justify-end md:col-start-4 md:h-full md:items-start md:justify-center md:border-l md:border-border md:p-2"
      >
        <button
          type="button"
          aria-pressed={nilai.tanda}
          aria-label={`Tanda (V) ${label}`}
          disabled={!ada}
          onClick={() => onTanda(!nilai.tanda)}
          title={ada ? (nilai.tanda ? "Batalkan tanda" : "Penerima memahami informasi ini") : "Isi informasinya lebih dulu"}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:cursor-not-allowed disabled:opacity-45",
            nilai.tanda ? "border-success bg-success text-white" : "border-border bg-surface text-fg-muted hover:border-success/50 hover:text-success",
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

export function KotakTtd({
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
      {pernyataan && (
        <blockquote className="mb-3 border-l-2 border-brand/40 pl-3 text-xs italic leading-relaxed text-fg-muted">{pernyataan}</blockquote>
      )}
      {children}
    </section>
  );
}

/** Saksi 1 & 2: nama + tanda tangan (saksi 2 opsional). */
export function KotakSaksi({
  no,
  nama,
  ttd,
  onNama,
  onTtd,
  konteks,
}: {
  no: 1 | 2;
  nama: string;
  ttd: string;
  onNama: (v: string) => void;
  onTtd: (v: string) => void;
  konteks: string;
}) {
  return (
    <KotakTtd ikon={UsersRound} peran={`Saksi ${no}`} nama={nama} opsional={no === 2}>
      <Input
        value={nama}
        maxLength={120}
        onChange={(e) => onNama(e.target.value)}
        placeholder={`Nama saksi ${no}`}
        aria-label={`Nama saksi ${no}`}
      />
      <div className="mb-3">
        <SaranNamaSaya nama={nama} onPilih={onNama} />
      </div>
      {/* Saksi bisa petugas RS → boleh memakai TTD tersimpan; nama tak diisi otomatis (bisa keluarga). */}
      <SignaturePad label={`Tanda tangan saksi ${no}`} value={ttd} onChange={onTtd} context={konteks} petugas={{ nama, onNama }} />
    </KotakTtd>
  );
}

/* ================================================================ pilihan */

export function PilihanBesar({
  ikon: Ikon,
  judul,
  ket,
  dipilih,
  onPilih,
}: {
  ikon: LucideIcon;
  judul: string;
  ket: string;
  dipilih: boolean;
  onPilih: () => void;
}) {
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
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)]",
          dipilih ? "bg-brand text-brand-fg" : "bg-surface-2 text-fg-subtle",
        )}
      >
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

export function PilihJk({ id, nilai, onUbah }: { id: string; nilai: "" | JkPilihan; onUbah: (v: "" | JkPilihan) => void }) {
  return (
    <div id={id} role="radiogroup" aria-label="Jenis kelamin" className="inline-flex h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
      {JK_PILIHAN.map((jk) => (
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
  jk: "" | JkPilihan;
  alamat: string;
  onNama: (v: string) => void;
  onUmur: (v: string) => void;
  onJk: (v: "" | JkPilihan) => void;
  onAlamat: (v: string) => void;
  saranNama?: React.ReactNode;
}) {
  const lbl = (path: string, htmlFor: string, teks: string) =>
    asal ? (
      <LabelAsal path={path} htmlFor={htmlFor}>
        {teks}
      </LabelAsal>
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
        <Input
          id={`${awalan}-umur`}
          value={umur}
          inputMode="numeric"
          maxLength={3}
          onChange={(e) => onUmur(e.target.value.replace(/\D/g, "").slice(0, 3))}
          placeholder="mis. 35"
        />
      </div>
      <div>
        {asal ? (
          <LabelAsal path="pasienJk" htmlFor={`${awalan}-jk`}>
            Jenis kelamin
          </LabelAsal>
        ) : (
          <p className="mb-1.5 text-xs font-medium text-fg-muted">Jenis kelamin</p>
        )}
        <PilihJk id={`${awalan}-jk`} nilai={jk} onUbah={onJk} />
      </div>
      <div className="sm:col-span-3">
        {lbl("pasienAlamat", `${awalan}-alamat`, "Alamat")}
        <textarea
          id={`${awalan}-alamat`}
          rows={2}
          value={alamat}
          maxLength={300}
          onChange={(e) => onAlamat(e.target.value)}
          placeholder="Alamat lengkap"
          className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40"
        />
      </div>
    </div>
  );
}

/* ====================================================== yang menyatakan */

type DataPernyataan = DataYangMenyatakan & { penerimaInformasi: string };

/**
 * "Saya yang bertanda tangan di bawah ini" (identitas yang menyatakan), lalu
 * "terhadap diri sendiri / keluarga" — keluarga: hubungan + identitas pasien
 * (terisi SIMRS). Pilihan "diri sendiri" menyalin identitas pasien ke yang
 * menyatakan bila masih kosong. `tengah` = bidang khusus formulir di antara
 * keduanya (mis. tindakan RM.22).
 */
export function BagianYangMenyatakan<T extends DataPernyataan>({
  awalan,
  form,
  setForm,
  pasienNamaHeader,
  objek,
  judulPasien,
  tengah,
}: {
  awalan: string;
  form: T;
  setForm: Dispatch<SetStateAction<T>>;
  /** Nama pasien kepala formulir (cadangan bila kolom pasien kosong). */
  pasienNamaHeader: string;
  /** "Tindakan" / "Rujukan" — "… dilakukan terhadap". */
  objek: string;
  /** Judul kelompok identitas pasien (mis. "Pasien yang menerima tindakan"). */
  judulPasien: string;
  tengah?: React.ReactNode;
}) {
  const ubah = (patch: Partial<DataYangMenyatakan>) => setForm((f) => ({ ...f, ...patch }));
  const dariPasien = (f: DataYangMenyatakan): Partial<DataYangMenyatakan> => ({
    pernyataNama: f.pasienNama || pasienNamaHeader,
    pernyataUmur: f.pasienUmur,
    pernyataJk: f.pasienJk,
    pernyataAlamat: f.pasienAlamat,
  });
  function pilihTerhadap(t: DataYangMenyatakan["terhadap"]) {
    setForm((f) => {
      const belumDiisi = kosong(f.pernyataNama) && !f.pernyataUmur && !f.pernyataJk && kosong(f.pernyataAlamat);
      return t === "diri" && belumDiisi ? { ...f, terhadap: t, ...dariPasien(f) } : { ...f, terhadap: t };
    });
  }

  return (
    <>
      <fieldset className="min-w-0">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Saya yang bertanda tangan di bawah ini</legend>
        <IdentitasOrang
          awalan={`${awalan}-pernyata`}
          nama={form.pernyataNama}
          umur={form.pernyataUmur}
          jk={form.pernyataJk}
          alamat={form.pernyataAlamat}
          onNama={(v) => ubah({ pernyataNama: v })}
          onUmur={(v) => ubah({ pernyataUmur: v })}
          onJk={(v) => ubah({ pernyataJk: v })}
          onAlamat={(v) => ubah({ pernyataAlamat: v })}
          saranNama={
            !kosong(form.penerimaInformasi) && !samaNama(form.pernyataNama, form.penerimaInformasi) ? (
              <Saran onClick={() => ubah({ pernyataNama: form.penerimaInformasi })}>
                Sama dengan penerima informasi: {form.penerimaInformasi}
              </Saran>
            ) : null
          }
        />
      </fieldset>

      {tengah}

      <div>
        <p className="mb-1.5 text-xs font-medium text-fg-muted">{objek} dilakukan terhadap</p>
        <div role="radiogroup" aria-label={`${objek} dilakukan terhadap`} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <PilihanBesar
            ikon={UserRound}
            judul="Diri sendiri"
            ket="Yang menyatakan adalah pasien"
            dipilih={form.terhadap === "diri"}
            onPilih={() => pilihTerhadap("diri")}
          />
          <PilihanBesar
            ikon={UsersRound}
            judul="Keluarga / orang yang diwakili"
            ket="Yang menyatakan adalah wali / keluarga pasien"
            dipilih={form.terhadap === "keluarga"}
            onPilih={() => pilihTerhadap("keluarga")}
          />
        </div>
      </div>

      {form.terhadap === "diri" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/40 px-3 py-2 text-[13px] text-fg-muted">
          <span>Identitas yang menyatakan = identitas pasien.</span>
          <Button type="button" size="sm" variant="secondary" onClick={() => setForm((f) => ({ ...f, ...dariPasien(f) }))}>
            Isi ulang dari data pasien
          </Button>
        </div>
      )}

      {form.terhadap === "keluarga" && (
        <fieldset className="min-w-0 rounded-[var(--radius-md)] border border-border p-3 sm:p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{judulPasien}</legend>
          <div className="mb-4 sm:max-w-xs">
            <Label htmlFor={`${awalan}-hubungan`}>Hubungan (… saya)</Label>
            <SelectOther
              id={`${awalan}-hubungan`}
              value={form.hubungan}
              onChange={(v) => ubah({ hubungan: v.slice(0, 60) })}
              options={HUBUNGAN_KELUARGA}
              placeholder="Pilih hubungan"
              otherPlaceholder="Hubungan lainnya…"
            />
          </div>
          <IdentitasOrang
            awalan={`${awalan}-pasien`}
            asal
            nama={form.pasienNama}
            umur={form.pasienUmur}
            jk={form.pasienJk}
            alamat={form.pasienAlamat}
            onNama={(v) => ubah({ pasienNama: v })}
            onUmur={(v) => ubah({ pasienUmur: v })}
            onJk={(v) => ubah({ pasienJk: v })}
            onAlamat={(v) => ubah({ pasienAlamat: v })}
          />
        </fieldset>
      )}
    </>
  );
}

/** "<Kota>, [tanggal]" pernyataan. */
export function TempatTanggal({ id, kota, value, onChange }: { id: string; kota: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="sm:max-w-xs">
      <Label htmlFor={id}>Tempat & tanggal</Label>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-sm text-fg-muted">{kota},</span>
        <div className="min-w-0 flex-1">
          <DatePicker id={id} value={value} onChange={onChange} placeholder="Pilih tanggal" />
        </div>
      </div>
    </div>
  );
}

/* ============================================================ umpan balik */

/** Konfirmasi sebaris (mis. ganti keputusan menghapus TTD pernyataan). */
export function KonfirmasiGanti({
  id,
  children,
  label,
  onBatal,
  onYa,
}: {
  id: string;
  children: React.ReactNode;
  label: string;
  onBatal: () => void;
  onYa: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-labelledby={id}
      className="mt-3 flex flex-col gap-3 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2 text-fg">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <span id={id}>{children}</span>
      </p>
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onBatal}>
          Batal
        </Button>
        <Button type="button" size="sm" onClick={onYa}>
          {label}
        </Button>
      </div>
    </div>
  );
}

export { Saran };

/** Rumpang pratinjau kalimat yang masih kosong. */
export function Rumpang({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-warning-soft px-1 text-warning">{children}</span>;
}

/** Nilai pratinjau kalimat: tebal bila terisi, rumpang kuning bila kosong. */
export function NilaiKalimat({ nilai, kosongTeks = "…" }: { nilai: string; kosongTeks?: string }) {
  return kosong(nilai) ? <Rumpang>{kosongTeks}</Rumpang> : <b className="font-semibold text-fg">{nilai}</b>;
}

/** Bingkai "Pratinjau pernyataan". */
export function PratinjauPernyataan({ children }: { children: React.ReactNode }) {
  return (
    <figure className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface-2/40 px-4 py-3">
      <figcaption className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Pratinjau pernyataan</figcaption>
      <p className="text-sm leading-relaxed text-fg-muted">{children}</p>
    </figure>
  );
}

/** Bagian kalimat "…, umur … tahun, …, alamat …" yang menyatakan & pasien. */
export function KalimatIdentitas({ d }: { d: DataYangMenyatakan }) {
  const jk = (s: string) => (s ? s.toLowerCase() : "");
  return (
    <>
      Saya yang bertanda tangan di bawah ini, <NilaiKalimat nilai={d.pernyataNama} kosongTeks="nama" />, umur{" "}
      <NilaiKalimat nilai={d.pernyataUmur} /> tahun, <NilaiKalimat nilai={jk(d.pernyataJk)} kosongTeks="jenis kelamin" />, alamat{" "}
      <NilaiKalimat nilai={d.pernyataAlamat} kosongTeks="alamat" />
    </>
  );
}

/** "terhadap saya" / "terhadap <hubungan> saya bernama …". */
export function KalimatTerhadap({ d }: { d: DataYangMenyatakan }) {
  const jk = (s: string) => (s ? s.toLowerCase() : "");
  if (d.terhadap === "diri") return <b className="font-semibold text-fg">saya</b>;
  if (d.terhadap === "keluarga") {
    return (
      <>
        <NilaiKalimat nilai={d.hubungan.toLowerCase()} kosongTeks="hubungan" /> saya bernama{" "}
        <NilaiKalimat nilai={d.pasienNama} kosongTeks="nama pasien" />, umur <NilaiKalimat nilai={d.pasienUmur} /> tahun,{" "}
        <NilaiKalimat nilai={jk(d.pasienJk)} kosongTeks="jenis kelamin" />, alamat <NilaiKalimat nilai={d.pasienAlamat} kosongTeks="alamat" />
      </>
    );
  }
  return <Rumpang>saya / keluarga</Rumpang>;
}
