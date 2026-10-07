"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, DoorOpen, Info, RefreshCw, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDateTime, formatJam } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { MIN_CARI, tafsirCari } from "./cari";
import { statusPasien } from "./kelengkapan";
import type { JenisKunjungan, KodeForm } from "./registry";
import { BukaIsianButton } from "./isian/BukaIsianButton";
import { StatusIsianBadge } from "./isian/StatusIsianBadge";
import type { DaftarPasienForm, PasienSasaran, StatusFormPasien } from "@/server/modules/form-rm/form-rm.types";

const LABEL_JENIS: Record<JenisKunjungan, string> = { 1: "Rawat Jalan", 2: "IGD", 3: "Rawat Inap" };
const NADA_JENIS: Record<JenisKunjungan, "neutral" | "warning" | "brand"> = { 1: "neutral", 2: "warning", 3: "brand" };

const SARING: { nilai: StatusFormPasien | ""; label: string }[] = [
  { nilai: "", label: "Semua" },
  { nilai: "KOSONG", label: "Belum diisi" },
  { nilai: "DRAF", label: "Draf" },
  { nilai: "FINAL", label: "Final" },
];

/**
 * Pemilih pasien satu form (PRD §6.1): bawaan = pasien aktif sesuai sasaran
 * form; kata kunci ≥ 3 karakter mencari No.RM / NIK / NOPEN / nama di semua
 * episode sasaran. Pasien yang sudah punya isian form ini membuka isian itu.
 */
export function PemilihPasien({
  kode,
  keteranganAktif,
  ruanganOptions,
  bolehBuat,
}: {
  kode: KodeForm;
  /** Penjelasan daftar bawaan, mis. "Pasien IGD yang masuk 24 jam terakhir atau masih dilayani". */
  keteranganAktif: string;
  ruanganOptions: { id: string; nama: string }[];
  bolehBuat: boolean;
}) {
  const [cariInput, setCariInput] = useState("");
  const [ruanganId, setRuanganId] = useState("");
  const [status, setStatus] = useState<StatusFormPasien | "">("");
  const [halaman, setHalaman] = useState(1);
  const cari = useDebounce(cariInput, 400).trim();

  const cariSah = cari !== "" && tafsirCari(cari) !== null;
  const q = cariSah ? cari : "";
  const petunjuk = cariInput.trim() !== "" && tafsirCari(cariInput) === null;

  const kunciSaring = `${q}|${ruanganId}|${status}`;
  const [kunciLama, setKunciLama] = useState(kunciSaring);
  if (kunciLama !== kunciSaring) {
    setKunciLama(kunciSaring);
    setHalaman(1);
  }

  const { result, loading, error, reload } = useAsyncData<DaftarPasienForm>(() => {
    const p = new URLSearchParams({ halaman: String(halaman) });
    if (q) p.set("q", q);
    else if (ruanganId) p.set("ruangan", ruanganId);
    if (status) p.set("status", status);
    return apiGet<DaftarPasienForm>(`/api/form-rm/f/${encodeURIComponent(kode)}/pasien?${p.toString()}`);
  }, [kode, q, ruanganId, status, halaman]);

  const opsiRuangan = useMemo<SelectOption[]>(
    () => [{ value: "", label: "Semua ruangan" }, ...ruanganOptions.map((r) => ({ value: r.id, label: r.nama }))],
    [ruanganOptions],
  );
  const mode = q ? "cari" : "aktif";
  const items = result?.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <Label htmlFor="cari-pasien">Cari pasien</Label>
            <InputWithIcon
              id="cari-pasien"
              type="search"
              icon={<Search className="size-4" />}
              placeholder="No. RM, NIK, NOPEN, atau nama pasien"
              value={cariInput}
              onChange={(e) => setCariInput(e.target.value)}
              autoComplete="off"
              aria-describedby="cari-pasien-bantu"
            />
            <p id="cari-pasien-bantu" className={cn("mt-1 text-xs", petunjuk ? "text-warning" : "text-fg-subtle")}>
              {petunjuk
                ? `Ketik minimal ${MIN_CARI} karakter: angka saja (No. RM / NIK / NOPEN) atau huruf saja (nama).`
                : "Kosongkan untuk kembali ke daftar pasien aktif."}
            </p>
          </div>
          {ruanganOptions.length > 0 && (
            <div>
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
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Saring status isian" className="flex flex-wrap gap-1.5">
          {SARING.map((s) => {
            const n = s.nilai ? result?.ringkas[s.nilai] : result ? result.ringkas.KOSONG + result.ringkas.DRAF + result.ringkas.FINAL : undefined;
            return (
              <button
                key={s.label}
                type="button"
                aria-pressed={status === s.nilai}
                onClick={() => setStatus(s.nilai)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                  status === s.nilai
                    ? "border-brand bg-brand-soft text-brand-soft-fg"
                    : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {s.label}
                {n !== undefined && <span className="tabular text-xs opacity-80">{n}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <Clock className="size-3.5" />
          {result ? <span className="tabular">Diperbarui {formatJam(result.updatedAt)}</span> : <span>Memuat…</span>}
          <Button variant="secondary" size="sm" icon={<RefreshCw className={cn("size-4", loading && "animate-spin")} />} onClick={reload}>
            Muat ulang
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-fg-muted">
        <Info className="mt-px size-3.5 shrink-0 text-fg-subtle" />
        {mode === "cari" ? (
          <span>
            Hasil pencarian <b className="font-semibold text-fg">“{q}”</b> — semua episode yang cocok, terbaru dulu.
          </span>
        ) : (
          <span>{keteranganAktif}.</span>
        )}
      </p>

      <Card className="overflow-hidden">
        {loading && !result ? (
          <DaftarSkeleton />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState
            title={mode === "cari" ? "Pasien tidak ditemukan" : "Tidak ada pasien"}
            description={
              mode === "cari"
                ? "Periksa No. RM / NIK / NOPEN, atau coba penggalan nama yang lain."
                : status
                  ? "Tidak ada pasien dengan status isian ini."
                  : "Belum ada pasien aktif untuk formulir ini. Cari pasien lain dengan No. RM, NIK, atau nama."
            }
          />
        ) : (
          <ul className={cn("divide-y divide-border", loading && "opacity-60")} aria-busy={loading}>
            {items.map((p) => (
              <li key={p.nopen}>
                <BarisPasien p={p} kode={kode} bolehBuat={bolehBuat} />
              </li>
            ))}
          </ul>
        )}
        {result && !error && result.meta.total > 0 && <Pagination meta={result.meta} onPageChange={setHalaman} />}
      </Card>
    </div>
  );
}

function BarisPasien({ p, kode, bolehBuat }: { p: PasienSasaran; kode: KodeForm; bolehBuat: boolean }) {
  const st = statusPasien(p.isian);
  return (
    // Kolom aksi lebar tetap → kolom tengah sejajar antarbaris (tiap baris grid sendiri).
    <div className="grid grid-cols-1 gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_14.5rem] md:items-center">
      <div className="min-w-0">
        <Link
          href={`/form-rm/pasien/${p.nopen}`}
          prefetch={false}
          className="block truncate font-semibold text-fg hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          title="Semua formulir pasien ini"
        >
          {p.nama}
        </Link>
        <p className="font-mono text-xs text-fg-muted">
          {p.norm} · NOPEN {p.nopen}
        </p>
        <p className="text-xs text-fg-muted">
          {p.jenisKelamin}
          {p.umur ? ` · ${p.umur}` : ""}
        </p>
      </div>

      <div className="min-w-0 space-y-1 text-[13px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={NADA_JENIS[p.jenis]}>{LABEL_JENIS[p.jenis]}</Badge>
          <Badge tone={p.dirawat ? "success" : "neutral"} dot>
            {p.dirawat ? "Masih dilayani" : "Sudah keluar"}
          </Badge>
        </div>
        <div className="flex items-start gap-1.5 text-fg">
          <DoorOpen className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
          <span className="min-w-0">{p.ruang}</span>
        </div>
        <div className="text-xs text-fg-muted">Masuk {formatDateTime(p.masuk)}</div>
      </div>

      <div className="flex items-center justify-between gap-3 md:justify-end">
        {p.isian ? <StatusIsianBadge status={p.isian.status} /> : <Badge tone="neutral">Belum ada</Badge>}
        {p.isian ? (
          <Link
            href={`/form-rm/isian/${p.isian.id}`}
            className={cn(
              "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
              st === "FINAL"
                ? "border-border bg-surface text-fg hover:bg-surface-2"
                : "border-brand bg-brand text-brand-fg hover:bg-brand-hover",
            )}
          >
            {st === "FINAL" ? "Lihat" : "Lanjutkan"}
            <ArrowRight className="size-4" />
          </Link>
        ) : bolehBuat ? (
          <BukaIsianButton kode={kode} nopen={p.nopen} className="" />
        ) : (
          <span className="text-xs text-fg-subtle">Belum diisi</span>
        )}
      </div>
    </div>
  );
}

function DaftarSkeleton() {
  return (
    <ul className="divide-y divide-border" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[1.6fr_1.4fr_14.5rem]">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-3 w-2/3 rounded" />
          </div>
          <Skeleton className="h-10 w-28 rounded-[var(--radius-md)]" />
        </li>
      ))}
    </ul>
  );
}
