"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Ban, CheckCircle2, ChevronRight, Link2Off, PencilLine, Printer, RefreshCw, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DatePicker, formatIndoDate, parseYmd } from "@/components/ui/DatePicker";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { NumberedPagination } from "@/components/ui/NumberedPagination";
import { SegmentedControl, type SegmentItem } from "@/components/ui/SegmentedControl";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { ErrorState } from "@/components/feedback/States";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { tanggalHariIniWita } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { tafsirCari } from "./cari";
import type { StatusIsian } from "./isian.status";
import type { KodeForm } from "./registry";
import {
  DASAR_TANGGAL,
  LABEL_DASAR,
  MAKS_RENTANG_RIWAYAT,
  PESAN_CARI_RIWAYAT,
  PINTASAN_RENTANG,
  pintasanAktif,
  queryRiwayat,
  rentangPintasan,
  selisihHari,
  tambahHari,
  type DasarTanggal,
  type FilterRiwayat,
  type ItemRiwayat,
  type RiwayatResult,
  type StatusRiwayat,
} from "./riwayat";
import { TAMPILAN_FORM } from "./tampilan";

export type OpsiFormRiwayat = { kode: KodeForm; label: string };

const STATUS: Record<StatusIsian, { label: string; ikon: typeof PencilLine; kelas: string }> = {
  DRAF: { label: "Draf", ikon: PencilLine, kelas: "bg-warning-soft text-warning ring-warning/20" },
  FINAL: { label: "Final", ikon: CheckCircle2, kelas: "bg-success-soft text-success ring-success/20" },
  BATAL: { label: "Dibatalkan", ikon: Ban, kelas: "bg-danger-soft text-danger ring-danger/20" },
};

const LABEL_STATUS_SEGMEN: Record<StatusRiwayat, string> = { semua: "Semua", DRAF: "Draf", FINAL: "Final", BATAL: "Batal" };

const WITA = "Asia/Makassar";
const fmtJam = new Intl.DateTimeFormat("id-ID", { timeZone: WITA, hour: "2-digit", minute: "2-digit" });
const fmtHari = new Intl.DateTimeFormat("id-ID", { timeZone: WITA, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtWaktuPenuh = new Intl.DateTimeFormat("id-ID", { timeZone: WITA, dateStyle: "medium", timeStyle: "short" });

const tanggalPendek = (ymd: string) => {
  const d = parseYmd(ymd);
  return d ? formatIndoDate(d) : ymd;
};

/** Inisial nama tanpa gelar ("dr. Budi Santoso, Sp.PD" → "BS"). */
function inisial(nama: string): string {
  const kata = nama
    .split(",")[0]
    .split(/\s+/)
    .filter((k) => k && !k.endsWith("."));
  return (kata.slice(0, 2).map((k) => k[0]).join("") || "?").toUpperCase();
}

/**
 * Riwayat Pengisian Form RM: filter rentang tanggal (WITA) + dasar tanggal,
 * status, formulir, pasien, dan "isian saya". Filter tersimpan di URL
 * (`replaceState`) sehingga kembali dari halaman isian memulihkan daftar.
 */
export function RiwayatPengisianView({
  opsiForm,
  hariIni,
  awal,
  formTetap,
  onUrl,
}: {
  opsiForm: OpsiFormRiwayat[];
  hariIni: string;
  awal: FilterRiwayat;
  /** Riwayat satu form saja (halaman detail form): pemilih formulir disembunyikan, baris berfokus pasien. */
  formTetap?: KodeForm;
  /** Ada = URL dikelola pemanggil (mis. tab halaman detail) — terima query string filter. */
  onUrl?: (qs: string) => void;
}) {
  const [f, setF] = useState<FilterRiwayat>(awal);
  const [cariInput, setCariInput] = useState(awal.q);
  const cari = useDebounce(cariInput.trim(), 350);
  const cariSah = cari === "" || tafsirCari(cari) !== null;

  // Ubah filter = kembali ke halaman 1 (kecuali pindah halaman).
  const ubah = (p: Partial<FilterRiwayat>) => setF((s) => ({ ...s, ...p, halaman: p.halaman ?? 1 }));

  const [cariTerakhir, setCariTerakhir] = useState(cari);
  if (cariSah && cari !== cariTerakhir) {
    setCariTerakhir(cari);
    if (cari !== f.q) setF((s) => ({ ...s, q: cari, halaman: 1 }));
  }

  const rentangSalah =
    f.dari > f.sampai ? "Tanggal awal melebihi tanggal akhir." : selisihHari(f.dari, f.sampai) >= MAKS_RENTANG_RIWAYAT
      ? `Rentang tanggal maksimal ${MAKS_RENTANG_RIWAYAT} hari.`
      : null;

  const qsApi = queryRiwayat(formTetap ? { ...f, form: formTetap } : f, hariIni, true);
  const qsUrl = queryRiwayat(formTetap ? { ...f, form: "" } : f, hariIni, false);
  useEffect(() => {
    if (onUrl) return onUrl(qsUrl);
    const url = `${window.location.pathname}${qsUrl ? `?${qsUrl}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(window.history.state, "", url);
  }, [qsUrl, onUrl]);

  const { result, loading, error, reload } = useAsyncData<RiwayatResult | null>(
    () => (rentangSalah ? Promise.resolve(null) : apiGet<RiwayatResult>(`/api/form-rm/riwayat?${qsApi}`)),
    [qsApi, rentangSalah],
  );

  const opsiSelect = useMemo<SelectOption[]>(
    () => [{ value: "", label: "Semua formulir" }, ...opsiForm.map((o) => ({ value: o.kode, label: `${o.kode} · ${o.label}` }))],
    [opsiForm],
  );
  const opsiDasar = useMemo<SelectOption[]>(() => DASAR_TANGGAL.map((d) => ({ value: d, label: LABEL_DASAR[d] })), []);

  const jumlah = result?.jumlah;
  const segmenStatus: SegmentItem<StatusRiwayat>[] = (["semua", "DRAF", "FINAL", "BATAL"] as const).map((s) => ({
    value: s,
    label: LABEL_STATUS_SEGMEN[s],
    jumlah: jumlah?.[s],
  }));
  const pintasan = pintasanAktif(f.dari, f.sampai, hariIni);

  const kelompok = useMemo(() => {
    const out: { tanggal: string; label: string; items: ItemRiwayat[] }[] = [];
    for (const it of result?.data ?? []) {
      const tgl = tanggalHariIniWita(new Date(it.waktu));
      let g = out.at(-1);
      if (!g || g.tanggal !== tgl) {
        g = { tanggal: tgl, label: fmtHari.format(new Date(it.waktu)), items: [] };
        out.push(g);
      }
      g.items.push(it);
    }
    return out;
  }, [result]);

  const kemarin = tambahHari(hariIni, -1);
  const awalBaris = result ? (result.halaman - 1) * result.perHalaman + 1 : 0;

  return (
    <div className="space-y-5">
      <Card className="space-y-4 rounded-xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="min-w-0">
              <Label htmlFor="riwayat-dari">Dari tanggal</Label>
              <DatePicker id="riwayat-dari" value={f.dari} max={f.sampai} clearable={false} onChange={(v) => ubah({ dari: v })} />
            </div>
            <div className="min-w-0">
              <Label htmlFor="riwayat-sampai">Sampai tanggal</Label>
              <DatePicker
                id="riwayat-sampai"
                value={f.sampai}
                min={f.dari}
                max={hariIni}
                clearable={false}
                onChange={(v) => ubah({ sampai: v })}
              />
            </div>
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <Label htmlFor="riwayat-dasar">Berdasarkan</Label>
              <Select id="riwayat-dasar" value={f.dasar} onChange={(v) => ubah({ dasar: v as DasarTanggal })} options={opsiDasar} />
            </div>
          </div>
          <div role="group" aria-label="Pintasan rentang" className="flex flex-wrap gap-1.5 lg:pb-0.5">
            {PINTASAN_RENTANG.map((p) => (
              <button
                key={p.kunci}
                type="button"
                aria-pressed={pintasan === p.kunci}
                onClick={() => ubah(rentangPintasan(p.kunci, hariIni))}
                className={cn(
                  "inline-flex h-9 items-center rounded-lg border px-3 text-[13px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                  pintasan === p.kunci
                    ? "border-brand/30 bg-brand-soft text-brand-soft-fg"
                    : "border-border bg-surface text-fg-muted hover:bg-surface-2/60 hover:text-fg",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {rentangSalah && <p className="-mt-1 text-xs text-danger">{rentangSalah}</p>}

        <div
          className={cn(
            "grid gap-3 border-t border-border pt-4",
            formTetap
              ? "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
              : "sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-end",
          )}
        >
          <div className="min-w-0">
            <Label htmlFor="riwayat-cari">Cari pasien</Label>
            <InputWithIcon
              id="riwayat-cari"
              type="search"
              icon={<Search className="size-4" />}
              placeholder="Nama, No. RM, atau NOPEN"
              value={cariInput}
              onChange={(e) => setCariInput(e.target.value)}
              autoComplete="off"
              aria-invalid={!cariSah}
              aria-describedby={!cariSah ? "riwayat-cari-petunjuk" : undefined}
            />
            {!cariSah && (
              <p id="riwayat-cari-petunjuk" className="mt-1 text-xs text-fg-muted">
                {PESAN_CARI_RIWAYAT}.
              </p>
            )}
          </div>
          {!formTetap && (
            <div className="min-w-0">
              <Label htmlFor="riwayat-form">Formulir</Label>
              <Select id="riwayat-form" value={f.form} onChange={(v) => ubah({ form: v })} options={opsiSelect} placeholder="Semua formulir" />
            </div>
          )}
          <label
            htmlFor="riwayat-saya"
            className={cn(
              "flex h-10 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-sm font-medium text-fg",
              !formTetap && "sm:col-span-2 lg:col-span-1",
            )}
          >
            <Switch id="riwayat-saya" checked={f.saya} onChange={(v) => ubah({ saya: v })} />
            Hanya isian saya
          </label>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-xl">
        <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <SegmentedControl
            label="Status isian"
            items={segmenStatus}
            value={f.status}
            onChange={(v) => ubah({ status: v })}
            penuh
            className="sm:shrink-0"
          />
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <p className="text-xs text-fg-muted tabular" aria-live="polite">
              {result
                ? `${result.total} isian · ${tanggalPendek(f.dari)}${f.dari !== f.sampai ? ` – ${tanggalPendek(f.sampai)}` : ""}`
                : rentangSalah
                  ? "Perbaiki rentang tanggal"
                  : "Memuat…"}
            </p>
            <button
              type="button"
              onClick={reload}
              aria-label="Muat ulang"
              title="Muat ulang"
              className="grid size-8 place-items-center rounded-lg border border-border text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="hidden border-b border-border bg-surface-2/40 px-4 py-2 text-xs font-medium text-fg-muted md:grid md:grid-cols-[3.25rem_2.25rem_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_6.75rem_4.5rem] md:gap-x-3">
          <span>Pukul</span>
          <span className="col-span-2">{formTetap ? "Pasien" : "Formulir"}</span>
          <span>{formTetap ? "Keterangan / ruang" : "Pasien"}</span>
          <span>Petugas</span>
          <span>Status</span>
          <span className="sr-only">Aksi</span>
        </div>

        {loading && !result ? (
          <BarisKerangka />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : !result || result.data.length === 0 ? (
          <Kosong
            adaFilter={f.status !== "semua" || !!f.form || !!f.q || f.saya}
            onTampilkanSemua={() => {
              setCariInput("");
              setF({ ...f, ...rentangPintasan("30-hari", hariIni), status: "semua", form: "", q: "", saya: false, halaman: 1 });
            }}
            rentangSalah={!!rentangSalah}
          />
        ) : (
          <div className={cn("transition-opacity", loading && "opacity-60")}>
            {kelompok.map((g) => (
              <section key={g.tanggal} aria-label={g.label}>
                <h3 className="flex items-center gap-2 border-b border-border bg-surface-2/25 px-4 py-1.5 text-xs font-semibold text-fg-muted">
                  {g.label}
                  {(g.tanggal === hariIni || g.tanggal === kemarin) && (
                    <span className="rounded-full bg-brand-soft px-1.5 text-[11px] font-medium leading-[1.125rem] text-brand-soft-fg">
                      {g.tanggal === hariIni ? "Hari ini" : "Kemarin"}
                    </span>
                  )}
                </h3>
                <ul className="divide-y divide-border border-b border-border last:border-b-0">
                  {g.items.map((it) => (
                    <BarisRiwayat key={it.id} item={it} dasar={f.dasar} fokusPasien={!!formTetap} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {result && result.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
            <p className="text-xs text-fg-muted tabular">
              Menampilkan {awalBaris}–{awalBaris + result.data.length - 1} dari {result.total} isian
            </p>
            <NumberedPagination
              page={result.halaman}
              totalPages={result.jumlahHalaman}
              onPageChange={(h) => ubah({ halaman: h })}
              disabled={loading}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function LencanaBelumTertaut() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-soft px-1.5 text-[11px] font-medium leading-[1.125rem] text-warning">
      <Link2Off className="size-3" aria-hidden />
      Belum tertaut
    </span>
  );
}

/**
 * Satu isian. `fokusPasien` (riwayat satu form): kolom utama = pasien, kolom
 * kedua = pembeda isian (mis. tindakan) atau ruang; ikon = inisial pasien.
 */
function BarisRiwayat({ item, dasar, fokusPasien }: { item: ItemRiwayat; dasar: DasarTanggal; fokusPasien: boolean }) {
  const t = TAMPILAN_FORM[item.kode];
  const Ikon = t.ikon;
  const namaPasien = item.namaPasien || "Tanpa nama";
  const identitas = item.tertaut ? `RM ${item.norm} · ${item.nopen}` : "Identitas sementara";
  const st = STATUS[item.status];
  const IkonStatus = st.ikon;
  const petugas = item.difinalkanOleh ?? item.dibuatOleh;
  const perannya = item.difinalkanOleh ? "Difinalkan" : "Dibuat";
  const jam = fmtJam.format(new Date(item.waktu));
  const keteranganWaktu = `${LABEL_DASAR[dasar]}: ${fmtWaktuPenuh.format(new Date(item.waktu))} WITA`;
  const cetak = item.bolehCetak && (
    <Link
      href={`/print/form-rm/isian/${item.id}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Cetak ${item.kode} ${item.namaPasien}`}
      title="Cetak isian"
      className="relative z-10 grid size-8 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
    >
      <Printer className="size-4" />
    </Link>
  );

  return (
    <li className="group relative transition-colors hover:bg-surface-2/35 has-[a[data-baris]:focus-visible]:bg-surface-2/35 has-[a[data-baris]:focus-visible]:ring-2 has-[a[data-baris]:focus-visible]:ring-inset has-[a[data-baris]:focus-visible]:ring-brand-ring">
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[3.25rem_2.25rem_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_6.75rem_4.5rem] md:items-center">
        <time dateTime={item.waktu} title={keteranganWaktu} className="hidden text-[13px] font-medium text-fg-muted tabular md:order-1 md:block">
          {jam}
        </time>

        {fokusPasien ? (
          <span
            aria-hidden
            className="order-1 row-span-3 grid size-9 place-items-center rounded-full bg-surface-2/70 text-xs font-semibold text-fg-muted ring-1 ring-inset ring-border md:order-2 md:row-span-1"
          >
            {item.tertaut ? inisial(namaPasien) : <Link2Off className="size-4" />}
          </span>
        ) : (
          <span className="order-1 row-span-3 grid size-9 place-items-center rounded-lg bg-surface-2/70 text-fg-muted ring-1 ring-inset ring-border md:order-2 md:row-span-1">
            <Ikon className="size-4" aria-hidden />
          </span>
        )}

        <div className="order-2 min-w-0 md:order-3">
          <Link
            href={`/form-rm/isian/${item.id}`}
            prefetch={false}
            data-baris
            className={cn(
              "flex min-w-0 items-center gap-1.5 text-sm font-semibold text-fg after:absolute after:inset-0 after:content-['']",
              "focus-visible:outline-none group-has-[a[data-baris]:focus-visible]:underline",
            )}
          >
            <span className="truncate">{fokusPasien ? namaPasien : t.label}</span>
            {fokusPasien && !item.tertaut && <LencanaBelumTertaut />}
          </Link>
          <p className="truncate text-xs text-fg-muted tabular">
            {fokusPasien ? (
              identitas
            ) : (
              <>
                <span className="font-mono font-medium">{item.kode}</span>
                {item.ringkas && <span> · {item.ringkas}</span>}
              </>
            )}
          </p>
        </div>

        <span className="order-3 justify-self-end md:order-6 md:justify-self-start">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", st.kelas)}>
            <IkonStatus className="size-3.5" aria-hidden />
            {st.label}
          </span>
        </span>

        {fokusPasien ? (
          <div className="order-4 col-span-2 min-w-0 md:col-span-1">
            <p className="truncate text-sm text-fg">{item.ringkas ?? item.ruang ?? "Ruang tidak tercatat"}</p>
            {item.ringkas && item.ruang && <p className="truncate text-xs text-fg-muted">{item.ruang}</p>}
          </div>
        ) : (
          <div className="order-4 col-span-2 min-w-0 md:col-span-1">
            <p className="flex min-w-0 items-center gap-1.5 text-sm text-fg">
              <span className="truncate font-medium">{namaPasien}</span>
              {!item.tertaut && <LencanaBelumTertaut />}
            </p>
            <p className="truncate text-xs text-fg-muted tabular">
              {identitas}
              {item.tertaut && item.ruang && <span className="max-md:hidden"> · {item.ruang}</span>}
            </p>
          </div>
        )}

        <div className="order-5 col-span-2 flex items-center justify-between gap-2 text-xs text-fg-muted md:hidden">
          <span className="min-w-0 truncate">
            <time dateTime={item.waktu} title={keteranganWaktu} className="font-medium tabular">
              {jam}
            </time>
            {petugas && (
              <>
                {" "}
                · {perannya.toLowerCase()} {item.milikSaya && !item.difinalkanOleh ? "oleh Anda" : `oleh ${petugas.nama}`}
              </>
            )}
            {!fokusPasien && item.ruang && <> · {item.ruang}</>}
          </span>
          {cetak}
        </div>

        <div className="hidden min-w-0 items-center gap-2 md:order-5 md:flex">
          {petugas ? (
            <>
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-soft-fg"
              >
                {inisial(petugas.nama)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-fg" title={petugas.nama}>
                  {petugas.nama}
                </span>
                <span className="block text-[11px] text-fg-subtle">
                  {perannya}
                  {item.milikSaya && !item.difinalkanOleh && " · Anda"}
                </span>
              </span>
            </>
          ) : (
            <span className="text-xs text-fg-subtle">—</span>
          )}
        </div>

        <div className="hidden items-center justify-end gap-0.5 md:order-7 md:flex">
          {cetak}
          <ChevronRight className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
        </div>
      </div>
    </li>
  );
}

function Kosong({
  adaFilter,
  onTampilkanSemua,
  rentangSalah,
}: {
  adaFilter: boolean;
  onTampilkanSemua: () => void;
  rentangSalah: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-3 grid size-11 place-items-center rounded-full bg-surface-2 text-fg-subtle">
        <Search className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-fg">{rentangSalah ? "Rentang tanggal belum benar" : "Tidak ada isian pada rentang ini"}</p>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">
        {rentangSalah
          ? "Perbaiki tanggal awal dan akhir untuk menampilkan riwayat."
          : adaFilter
            ? "Longgarkan filter status, formulir, atau pencarian pasien."
            : "Perlebar rentang tanggal atau ganti dasar tanggal."}
      </p>
      {!rentangSalah && (
        <button
          type="button"
          onClick={onTampilkanSemua}
          className="mt-4 inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-fg shadow-xs transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          Tampilkan 30 hari terakhir tanpa filter
        </button>
      )}
    </div>
  );
}

function BarisKerangka() {
  return (
    <ul className="divide-y divide-border" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-9 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5 rounded" />
            <Skeleton className="h-3 w-1/4 rounded" />
          </div>
          <Skeleton className="hidden h-3.5 w-1/5 rounded md:block" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </li>
      ))}
    </ul>
  );
}
