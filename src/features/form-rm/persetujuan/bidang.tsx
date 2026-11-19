"use client";

import { useId, type Dispatch, type SetStateAction } from "react";
import { CalendarCheck2, CircleAlert, CircleCheck, ListChecks, PenLine, Stethoscope, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DatePicker, toYmd } from "@/components/ui/DatePicker";
import { Input, Label } from "@/components/ui/Field";
import { SelectOther } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { SaranNamaSaya } from "@/features/form-rm/isian/SaranNamaSaya";
import { useTerkunci } from "@/features/form-rm/isian/kunci";
import { TandaAsal } from "@/features/form-rm/isian/TandaAsal";
import { KONTROL, LabelKolom, TOMBOL_KECIL, Wajib } from "@/features/form-rm/isian/langkah/bagian";
import { KONTROL_PILIHAN, PIL_PILIHAN, PilihanRadio } from "@/features/form-rm/isian/langkah/PilihanRadio";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
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
    <div className="@container">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 @3xl:grid-cols-3">
        <div>
          <LabelKolom htmlFor={`${awalan}-pelaksana`} asal="dokterPelaksana" wajib>
            Dokter pelaksana tindakan
          </LabelKolom>
          <Input
            id={`${awalan}-pelaksana`}
            value={form.dokterPelaksana}
            maxLength={120}
            onChange={(e) => set("dokterPelaksana", e.target.value)}
            placeholder="Nama dokter beserta gelar"
            enterKeyHint="next"
            className={KONTROL}
          />
          {!kosong(form.pemberiInformasi) && !samaNama(form.dokterPelaksana, form.pemberiInformasi) && (
            <Saran onClick={() => set("dokterPelaksana", form.pemberiInformasi)}>Sama dengan pemberi informasi: {form.pemberiInformasi}</Saran>
          )}
        </div>
        <div>
          <LabelKolom htmlFor={`${awalan}-pemberi`} asal="pemberiInformasi" wajib>
            Pemberi informasi / DPJP
          </LabelKolom>
          <Input
            id={`${awalan}-pemberi`}
            value={form.pemberiInformasi}
            maxLength={120}
            onChange={(e) => set("pemberiInformasi", e.target.value)}
            placeholder="Nama dokter pemberi informasi"
            enterKeyHint="next"
            className={KONTROL}
          />
          <SaranNamaSaya nama={form.pemberiInformasi} onPilih={(v) => set("pemberiInformasi", v)} />
        </div>
        <div>
          <LabelKolom htmlFor={`${awalan}-penerima`} wajib>
            Penerima informasi (pasien / keluarga)
          </LabelKolom>
          <Input
            id={`${awalan}-penerima`}
            value={form.penerimaInformasi}
            maxLength={120}
            onChange={(e) => set("penerimaInformasi", e.target.value)}
            placeholder="Nama penerima informasi"
            aria-describedby={`${awalan}-penerima-ket`}
            enterKeyHint="next"
            className={KONTROL}
          />
          {pasienNama && !samaNama(form.penerimaInformasi, pasienNama) && (
            <Saran onClick={() => set("penerimaInformasi", pasienNama)}>Pasien sendiri: {pasienNama}</Saran>
          )}
        </div>
      </div>
      <p id={`${awalan}-penerima-ket`} className="mt-4 rounded-[var(--radius-md)] bg-surface-2/60 px-3 py-2 text-xs text-fg-muted">
        {TEKS_INFORMASI.catatanPenerima}
      </p>
    </div>
  );
}

/** TTD pemberi ("telah menerangkan") & penerima ("telah menerima") informasi. */
export function TtdInformasi({
  form,
  set,
  konteks,
  noPihak,
  awalan,
}: {
  form: DataPihak;
  set: SetPihak;
  konteks: (peran: string) => string;
  /** Nomor langkah tempat nama pihak diisi (petunjuk saat nama kosong). */
  noPihak: number;
  /** Awalan id kotak TTD (tujuan fokus dari daftar syarat). */
  awalan?: string;
}) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
        <KotakTtd
          ikon={Stethoscope}
          peran="Pemberi informasi"
          nama={form.pemberiInformasi}
          kosongNama={`Isi nama pemberi informasi di langkah ${noPihak}`}
          pernyataan={TEKS_INFORMASI.menerangkan}
          sudah={form.pemberiTtd !== ""}
          idTtd={awalan && `${awalan}-ttd-pemberi`}
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
          sudah={form.penerimaTtd !== ""}
          idTtd={awalan && `${awalan}-ttd-penerima`}
        >
          <SignaturePad
            label="Tanda tangan penerima informasi"
            value={form.penerimaTtd}
            onChange={(v) => set("penerimaTtd", v)}
            context={konteks("Penerima informasi")}
          />
        </KotakTtd>
      </div>
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

/** Kelas <progress> bergaya (pseudo-elemen -webkit & -moz di aturan terpisah). */
const PROGRES =
  "block h-1.5 w-24 appearance-none overflow-clip rounded-full border-0 bg-surface-2 [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:transition-[inline-size] [&::-moz-progress-bar]:rounded-full";

function BarisMeter({ label, nilai, total }: { label: string; nilai: number; total: number }) {
  const id = useId();
  const penuh = total > 0 && nilai === total;
  return (
    <>
      <span id={id} className="text-right text-fg-muted">
        {label}
      </span>
      <progress
        aria-labelledby={id}
        value={nilai}
        max={Math.max(total, 1)}
        className={cn(
          PROGRES,
          penuh
            ? "[&::-webkit-progress-value]:bg-success [&::-moz-progress-bar]:bg-success"
            : "[&::-webkit-progress-value]:bg-brand [&::-moz-progress-bar]:bg-brand",
        )}
      />
      <span className={cn("tabular-nums", penuh ? "font-semibold text-success" : "text-fg")}>
        {nilai}/{total}
      </span>
    </>
  );
}

/** Meter "Terisi" (baris wajib) & "Ditandai" (baris berisi) di kepala langkah — <progress> asli berlabel. */
export function MeterInformasi({ informasi }: { informasi: DataTabelInformasi }) {
  const h = hitungInformasi(informasi);
  return (
    <div className="grid grid-cols-[auto_6rem_auto] items-center gap-x-2 gap-y-1.5 text-xs">
      <BarisMeter label="Terisi" nilai={h.terisi} total={INFORMASI_WAJIB.length} />
      <BarisMeter label="Ditandai" nilai={h.ditandai} total={h.adaIsi} />
    </div>
  );
}

/**
 * Tabel "Jenis / Isi Informasi / Tanda (V)" — <table> semantik (judul baris =
 * jenis informasi). Wadah < 36rem: baris bertumpuk jadi kartu (container
 * query), kepala kolom disembunyikan karena setiap kontrol sudah berlabel.
 */
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
  const terkunci = useTerkunci();
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-subtle [text-wrap:pretty]">
          Baris 1–10 wajib, Lain-lain opsional. Centang <b className="font-semibold text-fg-muted">Tanda (V)</b> setelah penerima
          memahami informasinya.
        </p>
        {!terkunci && (
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
        )}
      </div>
      <div className="@container">
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-border @max-xl:overflow-visible @max-xl:rounded-none @max-xl:border-0">
          <table className="w-full border-separate border-spacing-0 text-sm @max-xl:block">
            <caption className="sr-only">Jenis dan isi informasi</caption>
            <thead className="bg-surface-2/70 text-xs font-semibold text-fg-muted @max-xl:hidden">
              <tr>
                <th scope="col" className="w-60 border-b border-border px-3 py-2 text-left font-semibold">
                  Jenis informasi
                </th>
                <th scope="col" className="border-b border-l border-border px-3 py-2 text-left font-semibold">
                  Isi informasi
                </th>
                <th scope="col" className="w-32 border-b border-l border-border px-2 py-2 text-center font-semibold">
                  Tanda (V)
                </th>
              </tr>
            </thead>
            <tbody className="@max-xl:block @max-xl:space-y-2">
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
            </tbody>
          </table>
        </div>
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
  // Garis bawah tiap sel kecuali baris terakhir (tabel border-separate).
  const sel = "border-b border-border [tr:last-child>&]:border-b-0 @max-xl:border-0";
  return (
    <tr
      data-info={id}
      className={cn(
        "align-top @max-xl:grid @max-xl:grid-cols-[minmax(0,1fr)_auto] @max-xl:gap-x-2 @max-xl:gap-y-2 @max-xl:rounded-[var(--radius-md)] @max-xl:border @max-xl:border-border @max-xl:p-3",
        ada && nilai.tanda ? "bg-success-soft/35" : ada ? "bg-brand-soft/25" : "",
      )}
    >
      <th scope="row" className={cn(sel, "px-3 py-2.5 text-left font-normal @max-xl:block @max-xl:self-center @max-xl:p-0")}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <label htmlFor={fieldId} className="text-sm font-medium text-fg">
            {no && <span className="mr-1 inline-block min-w-5 tabular-nums text-fg-muted">{no}</span>}
            {label}
            {wajib ? (
              <>
                {" "}
                <Wajib />
              </>
            ) : (
              <span className="ml-1 text-xs font-normal text-fg-subtle">(opsional)</span>
            )}
          </label>
          <TandaAsal path={`informasi.${id}.isi`} />
        </div>
      </th>
      <td className={cn(sel, "border-l p-2 @max-xl:col-span-2 @max-xl:row-start-2 @max-xl:block @max-xl:p-0")}>
        <textarea
          id={fieldId}
          value={nilai.isi}
          maxLength={1000}
          rows={1}
          onChange={(e) => onIsi(e.target.value)}
          placeholder={contoh}
          className="block min-h-10 w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg [field-sizing:content] placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 md:max-h-48 pointer-coarse:text-base"
        />
        {saran}
      </td>
      <td className={cn(sel, "border-l p-2 text-center @max-xl:col-start-2 @max-xl:row-start-1 @max-xl:block @max-xl:p-0")}>
        {/* Checkbox asli: belum bisa dicentang sebelum isinya ada (sama dengan aturan syarat FINAL). */}
        <label
          title={ada ? undefined : "Isi informasinya lebih dulu"}
          className={cn(
            PIL_PILIHAN,
            "has-checked:border-success has-checked:bg-success-soft has-disabled:opacity-50",
          )}
        >
          <input
            id={`${fieldId}-tanda`}
            type="checkbox"
            checked={nilai.tanda}
            disabled={!ada}
            onChange={(e) => onTanda(e.target.checked)}
            className={cn(KONTROL_PILIHAN, "accent-success")}
          />
          <span className="font-medium">Tanda (V)</span>
          <span className="sr-only"> — {label}</span>
        </label>
      </td>
    </tr>
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
  sudah,
  idTtd,
  children,
}: {
  ikon: LucideIcon;
  peran: string;
  nama: string;
  kosongNama?: string;
  pernyataan?: string;
  opsional?: boolean;
  /** Status TTD ("Sudah/Belum ditandatangani", teks — bukan warna saja). */
  sudah?: boolean;
  /** id pembungkus TTD (tujuan fokus dari daftar syarat; bisa difokus, bukan pemberhentian Tab). */
  idTtd?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3" aria-label={peran}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface text-fg-muted ring-1 ring-border">
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
        {sudah !== undefined && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              sudah ? "bg-success-soft text-success" : "bg-surface-2 text-fg-muted",
            )}
          >
            {sudah ? <CircleCheck className="size-3" aria-hidden /> : <PenLine className="size-3" aria-hidden />}
            {sudah ? "Sudah ditandatangani" : "Belum ditandatangani"}
          </span>
        )}
      </div>
      {pernyataan && (
        <blockquote className="mb-3 border-l-2 border-brand/40 pl-3 text-xs italic leading-relaxed text-fg-muted">{pernyataan}</blockquote>
      )}
      {idTtd ? (
        <div id={idTtd} tabIndex={-1} className="rounded-[var(--radius-md)] outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** Saksi 1 & 2: nama (label tampak) + tanda tangan (saksi 2 opsional). */
export function KotakSaksi({
  no,
  nama,
  ttd,
  onNama,
  onTtd,
  konteks,
  awalan,
}: {
  no: 1 | 2;
  nama: string;
  ttd: string;
  onNama: (v: string) => void;
  onTtd: (v: string) => void;
  konteks: string;
  /** Awalan id kolom nama & kotak TTD (tujuan fokus dari daftar syarat). */
  awalan?: string;
}) {
  const cadangan = useId();
  const idNama = awalan ? `${awalan}-saksi${no}-nama` : `${cadangan}-nama`;
  return (
    <KotakTtd ikon={UsersRound} peran={`Saksi ${no}`} nama={nama} opsional={no === 2} sudah={ttd !== ""} idTtd={awalan && `${awalan}-ttd-saksi${no}`}>
      <div className="mb-3">
        <Label htmlFor={idNama}>Nama saksi {no}</Label>
        <Input
          id={idNama}
          value={nama}
          maxLength={120}
          onChange={(e) => onNama(e.target.value)}
          placeholder="mis. perawat atau keluarga"
          enterKeyHint="next"
          className={KONTROL}
        />
        <SaranNamaSaya nama={nama} onPilih={onNama} />
      </div>
      {/* Saksi bisa petugas RS → boleh memakai TTD tersimpan; nama tak diisi otomatis (bisa keluarga). */}
      <SignaturePad label={`Tanda tangan saksi ${no}`} value={ttd} onChange={onTtd} context={konteks} petugas={{ nama, onNama }} />
    </KotakTtd>
  );
}

/* ================================================================ pilihan */

/** Pilihan jenis kelamin bergaya segmen (dipakai RM.41). */
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

/** Nama · umur (tahun) · jenis kelamin (radio asli) · alamat — dipakai untuk yang menyatakan & pasien. Semua wajib sebelum FINAL. */
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
  // Breakpoint layar (bukan container query): IdentitasOrang berada di dalam <fieldset> ber-legend; wadah
  // `container-type` sebagai anak fieldset ber-legend tak dirender ulang oleh Chromium saat isinya berubah
  // (mis. memilih "Diri sendiri") → kolom hilang. Lihat docs/form-rm-rm22-tampilan-isian.md.
  return (
    <div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,1fr)_7rem] lg:grid-cols-[minmax(0,2fr)_7rem_minmax(0,1.4fr)]">
        <div className="min-w-0">
          <LabelKolom htmlFor={`${awalan}-nama`} asal={asal ? "pasienNama" : undefined} wajib>
            Nama
          </LabelKolom>
          <Input
            id={`${awalan}-nama`}
            value={nama}
            maxLength={120}
            onChange={(e) => onNama(e.target.value)}
            placeholder="Nama lengkap"
            enterKeyHint="next"
            className={KONTROL}
          />
          {saranNama}
        </div>
        <div>
          <LabelKolom htmlFor={`${awalan}-umur`} asal={asal ? "pasienUmur" : undefined} wajib>
            Umur (tahun)
          </LabelKolom>
          <Input
            id={`${awalan}-umur`}
            value={umur}
            inputMode="numeric"
            maxLength={3}
            onChange={(e) => onUmur(e.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="mis. 35"
            enterKeyHint="next"
            className={KONTROL}
          />
        </div>
        <PilihanRadio
          id={`${awalan}-jk`}
          ringkas
          className="sm:col-span-2 lg:col-span-1"
          legend={
            <>
              Jenis kelamin <Wajib />
            </>
          }
          asal={asal ? "pasienJk" : undefined}
          value={jk}
          onChange={(v) => onJk(v as "" | JkPilihan)}
          opsi={JK_PILIHAN.map((x) => ({ value: x, label: x }))}
          bolehKosong
        />
        <div className="sm:col-span-2 lg:col-span-3">
          <LabelKolom htmlFor={`${awalan}-alamat`} asal={asal ? "pasienAlamat" : undefined} wajib>
            Alamat
          </LabelKolom>
          <textarea
            id={`${awalan}-alamat`}
            rows={2}
            value={alamat}
            maxLength={300}
            onChange={(e) => onAlamat(e.target.value)}
            placeholder="Jalan, desa/kelurahan, kecamatan, kabupaten"
            // field-sizing: tinggi mengikuti isi (2–8 baris); peramban lama tetap 2 baris + gulir.
            className="block min-h-[4.25rem] max-h-[12rem] w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg [field-sizing:content] placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 pointer-coarse:text-base"
          />
        </div>
      </div>
    </div>
  );
}

/* ====================================================== yang menyatakan */

type DataPernyataan = DataYangMenyatakan & { penerimaInformasi: string };

/**
 * "Saya yang bertanda tangan di bawah ini" (identitas yang menyatakan), lalu
 * "terhadap diri sendiri / keluarga" (radio asli) — keluarga: hubungan +
 * identitas pasien (terisi SIMRS). Pilihan "diri sendiri" menyalin identitas
 * pasien ke yang menyatakan bila masih kosong. `tengah` = bidang khusus
 * formulir di antara keduanya (mis. tindakan RM.22).
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
  const terkunci = useTerkunci();
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
      {/* mx-0 (bukan m-0): jarak bawah dari `space-y-*` induk tetap berlaku. */}
      <fieldset className="mx-0 min-w-0 border-0 p-0">
        <legend className="mb-3 p-0 text-sm font-semibold text-fg">Saya yang bertanda tangan di bawah ini</legend>
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

      <div className="@container">
        <PilihanRadio
          id={`${awalan}-terhadap`}
          legend={
            <>
              {objek} dilakukan terhadap <Wajib />
            </>
          }
          value={form.terhadap}
          onChange={(v) => pilihTerhadap(v as DataYangMenyatakan["terhadap"])}
          opsi={[
            { value: "diri", label: "Diri sendiri", ket: "Yang menyatakan adalah pasien" },
            { value: "keluarga", label: "Keluarga / orang yang diwakili", ket: "Yang menyatakan adalah wali / keluarga pasien" },
          ]}
        />
      </div>

      {form.terhadap === "diri" && !terkunci && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/40 px-3 py-2 text-[13px] text-fg-muted">
          <span>Identitas yang menyatakan = identitas pasien.</span>
          <Button type="button" size="sm" variant="secondary" onClick={() => setForm((f) => ({ ...f, ...dariPasien(f) }))}>
            Isi ulang dari data pasien
          </Button>
        </div>
      )}

      {form.terhadap === "keluarga" && (
        <fieldset className="min-w-0 rounded-[var(--radius-md)] border border-border p-3 sm:p-4">
          <legend className="px-1 text-sm font-semibold text-fg">{judulPasien}</legend>
          <div className="mb-4 sm:max-w-xs">
            <LabelKolom htmlFor={`${awalan}-hubungan`} wajib>
              Hubungan (… saya)
            </LabelKolom>
            <SelectOther
              id={`${awalan}-hubungan`}
              value={form.hubungan}
              onChange={(v) => ubah({ hubungan: v.slice(0, 60) })}
              options={HUBUNGAN_KELUARGA}
              placeholder="Pilih hubungan"
              otherPlaceholder="Hubungan lainnya…"
              otherAriaLabel="Hubungan dengan pasien (lainnya)"
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

/** "<Kota>, [tanggal]" pernyataan + pintasan "Hari ini" (dihitung saat diklik). */
export function TempatTanggal({ id, kota, value, onChange }: { id: string; kota: string; value: string; onChange: (v: string) => void }) {
  const terkunci = useTerkunci();
  return (
    <div>
      <LabelKolom htmlFor={id} wajib>
        Tempat &amp; tanggal
      </LabelKolom>
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-sm text-fg-muted">{kota},</span>
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <DatePicker id={id} value={value} onChange={onChange} placeholder="Pilih tanggal" />
        </div>
        {!terkunci && (
          <button type="button" onClick={() => onChange(toYmd(new Date()))} className={cn(TOMBOL_KECIL, "h-10")}>
            <CalendarCheck2 className="size-3.5" aria-hidden />
            Hari ini
          </button>
        )}
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
