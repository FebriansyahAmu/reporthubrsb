"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowRightLeft, DoorOpen, GitMerge, Info, RefreshCw, Search, Split, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { NumberedPagination } from "@/components/ui/NumberedPagination";
import { SegmentedControl, type SegmentItem } from "@/components/ui/SegmentedControl";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDateTime, formatJam } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { urlIsian } from "./berlanjut";
import { MIN_CARI, tafsirCari } from "./cari";
import { statusPasien } from "./kelengkapan";
import { jenisDariLayanan, LAYANAN, layananDariJenis, TITIK_LAYANAN, type KunciLayanan } from "./layanan";
import type { JenisKunjungan, KodeForm } from "./registry";
import { BukaIsianButton } from "./isian/BukaIsianButton";
import { StatusIsianBadge } from "./isian/StatusIsianBadge";
import type { DaftarPasienForm, PasienSasaran, StatusFormPasien } from "@/server/modules/form-rm/form-rm.types";

const SARING: { nilai: StatusFormPasien | "semua"; label: string }[] = [
  { nilai: "semua", label: "Semua" },
  { nilai: "KOSONG", label: "Belum diisi" },
  { nilai: "DRAF", label: "Draf" },
  { nilai: "FINAL", label: "Final" },
];

/** Inisial nama pasien (dua kata pertama). */
const inisialPasien = (nama: string) =>
  (
    nama
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((k) => k[0])
      .join("") || "?"
  ).toUpperCase();

/** Opsi ruangan pemilih + jenis kunjungannya (untuk menyaring ruangan per layanan). */
export type RuanganPemilih = { id: string; nama: string; jenis: JenisKunjungan };

/**
 * Pemilih pasien satu form (PRD §6.1): bawaan = pasien aktif sesuai sasaran
 * form; kata kunci ≥ 3 karakter mencari No.RM / NIK / NOPEN / nama di semua
 * episode sasaran. Filter layanan (RJ / IGD / RI) langsung berlaku dan
 * disimpan di URL (`?layanan=`). Pasien yang sudah punya isian form ini
 * membuka isian itu.
 */
export function PemilihPasien({
  kode,
  keteranganAktif,
  ruanganOptions,
  bolehBuat,
  berulang = false,
  layananOpsi,
  awalLayanan,
  onUrl,
}: {
  kode: KodeForm;
  /** Penjelasan daftar bawaan, mis. "Pasien IGD yang masuk 24 jam terakhir atau masih dilayani". */
  keteranganAktif: string;
  ruanganOptions: RuanganPemilih[];
  bolehBuat: boolean;
  /** Form berulang: pasien ber-isian menampilkan jumlah isian + tombol isian baru. */
  berulang?: boolean;
  /** Jenis kunjungan sasaran form (filter layanan tampil bila > 1). */
  layananOpsi: JenisKunjungan[];
  awalLayanan: KunciLayanan | null;
  /** Ada = URL dikelola pemanggil (tab halaman detail) — terima query string filter. */
  onUrl?: (qs: string) => void;
}) {
  const [cariInput, setCariInput] = useState("");
  const [ruanganId, setRuanganId] = useState("");
  const [status, setStatus] = useState<StatusFormPasien | "semua">("semua");
  const [layanan, setLayanan] = useState<KunciLayanan | null>(awalLayanan);
  const [halaman, setHalaman] = useState(1);
  const cari = useDebounce(cariInput, 400).trim();

  const cariSah = cari !== "" && tafsirCari(cari) !== null;
  const q = cariSah ? cari : "";
  const petunjuk = cariInput.trim() !== "" && tafsirCari(cariInput) === null;
  const pakaiLayanan = layananOpsi.length > 1;
  const layananAktif = pakaiLayanan ? layanan : null;

  const kunciSaring = `${q}|${ruanganId}|${status}|${layananAktif}`;
  const [kunciLama, setKunciLama] = useState(kunciSaring);
  if (kunciLama !== kunciSaring) {
    setKunciLama(kunciSaring);
    setHalaman(1);
  }

  const qsUrl = layananAktif ? `layanan=${layananAktif}` : "";
  useEffect(() => {
    if (onUrl) return onUrl(qsUrl);
    const url = `${window.location.pathname}${qsUrl ? `?${qsUrl}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(window.history.state, "", url);
  }, [qsUrl, onUrl]);

  const { result, loading, error, reload } = useAsyncData<DaftarPasienForm>(() => {
    const p = new URLSearchParams({ halaman: String(halaman) });
    if (q) p.set("q", q);
    else if (ruanganId) p.set("ruangan", ruanganId);
    if (status !== "semua") p.set("status", status);
    if (layananAktif) p.set("layanan", layananAktif);
    return apiGet<DaftarPasienForm>(`/api/form-rm/f/${encodeURIComponent(kode)}/pasien?${p.toString()}`);
  }, [kode, q, ruanganId, status, layananAktif, halaman]);

  const opsiRuangan = useMemo<SelectOption[]>(() => {
    const j = layananAktif ? jenisDariLayanan(layananAktif) : null;
    return [
      { value: "", label: "Semua ruangan" },
      ...ruanganOptions.filter((r) => !j || r.jenis === j).map((r) => ({ value: r.id, label: r.nama })),
    ];
  }, [ruanganOptions, layananAktif]);

  const pilihLayanan = (v: KunciLayanan | "semua") => {
    const k = v === "semua" ? null : v;
    setLayanan(k);
    // Ruangan terpilih harus milik layanan yang dipilih.
    if (k && ruanganOptions.find((r) => r.id === ruanganId)?.jenis !== jenisDariLayanan(k)) setRuanganId("");
  };

  const mode = q ? "cari" : "aktif";
  const items = result?.data ?? [];
  const per = result?.perLayanan;
  const segLayanan: SegmentItem<KunciLayanan | "semua">[] = [
    { value: "semua", label: "Semua", jumlah: per ? Object.values(per).reduce((a, b) => a + (b ?? 0), 0) : undefined },
    ...LAYANAN.filter((l) => layananOpsi.includes(l.jenis)).map((l) => ({
      value: l.kunci,
      label: l.label,
      labelSingkat: l.singkat,
      jumlah: per ? (per[l.jenis] ?? 0) : undefined,
    })),
  ];
  const r = result?.ringkas;
  const segStatus: SegmentItem<StatusFormPasien | "semua">[] = SARING.map((s) => ({
    value: s.nilai,
    label: s.label,
    jumlah: r ? (s.nilai === "semua" ? r.KOSONG + r.DRAF + r.FINAL : r[s.nilai]) : undefined,
  }));
  const meta = result?.meta;
  const awalBaris = meta ? (meta.page - 1) * meta.pageSize + 1 : 0;

  return (
    <div className="space-y-4">
      <Card className="rounded-xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          {pakaiLayanan && (
            <div className="min-w-0 lg:shrink-0">
              <span className="mb-1.5 block text-xs font-medium text-fg-muted">Layanan</span>
              <SegmentedControl
                label="Filter layanan pasien"
                items={segLayanan}
                value={layananAktif ?? "semua"}
                onChange={pilihLayanan}
                penuh
                jumlahPonsel={false}
                className="lg:shrink-0"
              />
            </div>
          )}
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <Label htmlFor="cari-pasien">Cari pasien</Label>
              <InputWithIcon
                id="cari-pasien"
                type="search"
                icon={<Search className="size-4" />}
                placeholder="No. RM, NIK, NOPEN, atau nama"
                value={cariInput}
                onChange={(e) => setCariInput(e.target.value)}
                autoComplete="off"
                aria-describedby="cari-pasien-bantu"
              />
            </div>
            {ruanganOptions.length > 0 && (
              <div className="min-w-0">
                <Label htmlFor="ruangan">Ruangan</Label>
                <Select
                  id="ruangan"
                  value={ruanganId}
                  onChange={setRuanganId}
                  options={opsiRuangan}
                  placeholder="Semua ruangan"
                  disabled={mode === "cari"}
                />
              </div>
            )}
          </div>
        </div>
        <p id="cari-pasien-bantu" className={cn("mt-2 text-xs", petunjuk ? "text-warning" : "text-fg-subtle")}>
          {petunjuk
            ? `Ketik minimal ${MIN_CARI} karakter: angka saja (No. RM / NIK / NOPEN) atau huruf saja (nama).`
            : mode === "cari"
              ? "Ruangan tidak berlaku saat mencari. Kosongkan kotak cari untuk kembali ke pasien aktif."
              : "Kosongkan kotak cari untuk menampilkan pasien aktif."}
        </p>
      </Card>

      <Card className="overflow-hidden rounded-xl">
        <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <SegmentedControl
            label="Saring status isian"
            items={segStatus}
            value={status}
            onChange={setStatus}
            penuh
            jumlahPonsel={false}
            className="sm:shrink-0"
          />
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <p className="text-xs text-fg-muted tabular" aria-live="polite">
              {result ? `Diperbarui ${formatJam(result.updatedAt)}` : "Memuat…"}
            </p>
            <button
              type="button"
              onClick={reload}
              aria-label="Muat ulang daftar pasien"
              title="Muat ulang"
              className="grid size-8 place-items-center rounded-lg border border-border text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        <p className="flex items-start gap-1.5 border-b border-border bg-surface-2/25 px-4 py-2 text-xs text-fg-muted">
          <Info className="mt-px size-3.5 shrink-0 text-fg-subtle" aria-hidden />
          {mode === "cari" ? (
            <span>
              Hasil pencarian <b className="font-semibold text-fg">“{q}”</b>: semua episode yang cocok, terbaru dulu.
            </span>
          ) : (
            <span>{keteranganAktif}.</span>
          )}
        </p>

        {loading && !result ? (
          <DaftarSkeleton />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : items.length === 0 ? (
          <Kosong
            judul={mode === "cari" ? "Pasien tidak ditemukan" : "Tidak ada pasien"}
            keterangan={
              mode === "cari"
                ? "Periksa No. RM / NIK / NOPEN, atau coba penggalan nama yang lain."
                : status !== "semua" || layananAktif
                  ? "Tidak ada pasien untuk saringan ini. Coba layanan atau status lain."
                  : "Belum ada pasien aktif untuk formulir ini. Cari pasien lain dengan No. RM, NIK, atau nama."
            }
            onReset={
              status !== "semua" || layananAktif
                ? () => {
                    setStatus("semua");
                    pilihLayanan("semua");
                  }
                : undefined
            }
          />
        ) : (
          <ul className={cn("divide-y divide-border transition-opacity", loading && "opacity-60")} aria-busy={loading}>
            {items.map((p) => (
              <li key={p.nopen} className="transition-colors hover:bg-surface-2/35">
                <BarisPasien p={p} kode={kode} bolehBuat={bolehBuat} berulang={berulang} />
              </li>
            ))}
          </ul>
        )}

        {meta && !error && meta.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
            <p className="text-xs text-fg-muted tabular">
              Menampilkan {awalBaris}–{awalBaris + items.length - 1} dari {meta.total} pasien
            </p>
            <NumberedPagination page={meta.page} totalPages={meta.totalPages} onPageChange={setHalaman} disabled={loading} />
          </div>
        )}
      </Card>
    </div>
  );
}

const KELAS_TOMBOL =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring";

function BarisPasien({
  p,
  kode,
  bolehBuat,
  berulang,
}: {
  p: PasienSasaran;
  kode: KodeForm;
  bolehBuat: boolean;
  berulang: boolean;
}) {
  const st = statusPasien(p.isian);
  const lay = layananDariJenis(p.jenis);
  return (
    // Kolom aksi lebar tetap → kolom tengah sejajar antarbaris (tiap baris grid sendiri).
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-4 py-3 md:grid-cols-[2.5rem_minmax(0,1.5fr)_minmax(0,1.4fr)_14rem] md:items-center">
      <span
        aria-hidden
        className="grid size-10 place-items-center rounded-full bg-surface-2/80 text-xs font-semibold text-fg-muted ring-1 ring-inset ring-border"
      >
        {inisialPasien(p.nama)}
      </span>

      <div className="min-w-0">
        <Link
          href={`/form-rm/pasien/${p.nopen}`}
          prefetch={false}
          className="block truncate text-sm font-semibold text-fg hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          title="Semua formulir pasien ini"
        >
          {p.nama}
        </Link>
        <p className="truncate font-mono text-xs text-fg-muted">
          RM {p.norm} · NOPEN {p.nopen}
        </p>
        <p className="text-xs text-fg-subtle">
          {p.jenisKelamin}
          {p.umur ? ` · ${p.umur}` : ""}
        </p>
      </div>

      <div className="col-start-2 min-w-0 space-y-1 text-[13px] md:col-start-auto">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 text-[11px] font-medium leading-5 text-fg-muted">
            <span className={cn("size-1.5 rounded-full", TITIK_LAYANAN[p.jenis])} aria-hidden />
            {lay?.label}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 text-[11px] font-medium leading-5",
              p.dirawat ? "bg-success-soft text-success" : "bg-surface-2 text-fg-muted",
            )}
          >
            <span className={cn("size-1.5 rounded-full", p.dirawat ? "bg-success" : "bg-fg-subtle")} aria-hidden />
            {p.dirawat ? "Masih dilayani" : "Sudah keluar"}
          </span>
          {p.rantai && <ChipRantai rantai={p.rantai} />}
        </div>
        <p className="flex min-w-0 items-start gap-1.5 text-fg">
          <DoorOpen className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" aria-hidden />
          <span className="min-w-0 truncate">{p.ruang}</span>
        </p>
        <p className="text-xs text-fg-muted">Masuk {formatDateTime(p.masuk)}</p>
      </div>

      {berulang && p.isian ? (
        // Form berulang (satu isian per tindakan): daftar isian di profil pasien + isian baru.
        <div className="col-start-2 flex items-center justify-between gap-2 md:col-start-auto md:justify-end">
          <Link
            href={`/form-rm/pasien/${p.nopen}#form-${kode}`}
            className={cn(KELAS_TOMBOL, "border-border bg-surface text-fg hover:bg-surface-2")}
            title="Lihat semua isian pasien ini"
          >
            <span className="tabular">{p.isian.jumlah}</span> isian
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          {bolehBuat && <BukaIsianButton kode={kode} nopen={p.nopen} className="min-h-9 rounded-lg py-1.5" label="Baru" varian="kedua" />}
        </div>
      ) : (
        <div className="col-start-2 flex items-center justify-between gap-3 md:col-start-auto md:justify-end">
          {p.isian ? (
            <StatusIsianBadge status={p.isian.status} />
          ) : (
            <span className="inline-flex items-center rounded-full border border-dashed border-border-strong px-2 text-[11px] font-medium leading-5 text-fg-subtle">
              Belum diisi
            </span>
          )}
          {p.isian ? (
            <Link
              href={urlIsian(kode, p.isian.id, p.nopen)}
              className={cn(
                KELAS_TOMBOL,
                st === "FINAL"
                  ? "border-border bg-surface text-fg hover:bg-surface-2"
                  : "border-brand bg-brand text-brand-fg hover:bg-brand-hover",
              )}
            >
              {st === "FINAL" ? "Lihat" : "Lanjutkan"}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : bolehBuat ? (
            <BukaIsianButton kode={kode} nopen={p.nopen} className="min-h-9 rounded-lg py-1.5" />
          ) : (
            <span className="text-xs text-fg-subtle">Tidak ada hak mengisi</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Rantai IGD → rawat inap episode RI (form berlanjut): ikon + teks, bukan warna saja. */
function ChipRantai({ rantai }: { rantai: NonNullable<PasienSasaran["rantai"]> }) {
  const { Ikon, teks, judul } =
    rantai.status === "terpisah"
      ? { Ikon: Split, teks: "Isian terpisah dari IGD", judul: "Petugas memilih dokumen sendiri untuk rawat inap ini" }
      : rantai.status === "konfirmasi"
        ? { Ikon: ArrowRightLeft, teks: "Asal IGD perlu konfirmasi", judul: `Episode IGD NOPEN ${rantai.akar} — dikonfirmasi saat form dibuka` }
        : { Ikon: GitMerge, teks: "Berlanjut dari IGD", judul: `Memakai dokumen episode IGD NOPEN ${rantai.akar}` };
  return (
    <span
      title={judul}
      className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 text-[11px] font-medium leading-5 text-brand-soft-fg"
    >
      <Ikon className="size-3" aria-hidden />
      {teks}
    </span>
  );
}

function Kosong({ judul, keterangan, onReset }: { judul: string; keterangan: string; onReset?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-3 grid size-11 place-items-center rounded-full bg-surface-2 text-fg-subtle">
        <UsersRound className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-fg">{judul}</p>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{keterangan}</p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-fg shadow-xs transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          Tampilkan semua pasien
        </button>
      )}
    </div>
  );
}

function DaftarSkeleton() {
  return (
    <ul className="divide-y divide-border" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="grid grid-cols-[2.5rem_1fr] gap-3 px-4 py-4 md:grid-cols-[2.5rem_1.5fr_1.4fr_14rem]">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
          <div className="hidden space-y-1.5 md:block">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-3 w-2/3 rounded" />
          </div>
          <Skeleton className="hidden h-9 w-28 justify-self-end rounded-lg md:block" />
        </li>
      ))}
    </ul>
  );
}
