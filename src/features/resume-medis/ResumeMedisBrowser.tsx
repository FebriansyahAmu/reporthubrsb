"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  Printer,
  RotateCw,
  Search,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/motion/Motion";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import {
  addDays,
  formatDateTime,
  formatWeekRange,
  startOfWeek,
  toLocalDateInput,
} from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import type {
  KategoriKunjungan,
  KunjunganResumeItem,
  RuanganOption,
} from "@/server/modules/kunjungan/kunjungan.types";

type Filter = "Semua" | KategoriKunjungan;

const KATEGORI: KategoriKunjungan[] = ["Rawat Inap", "Rawat Jalan Klinik", "IGD"];

const KATEGORI_TONE: Record<KategoriKunjungan, "brand" | "accent" | "warning"> = {
  "Rawat Inap": "brand",
  "Rawat Jalan Klinik": "accent",
  IGD: "warning",
};

async function fetchKunjungan(
  from: string,
  to: string,
  ruanganId: string,
): Promise<KunjunganResumeItem[]> {
  const p = new URLSearchParams({ from, to });
  if (ruanganId) p.set("ruangan", ruanganId);
  const res = await fetch(`/api/laporan/kunjungan?${p.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat kunjungan");
  const json = (await res.json()) as { data: KunjunganResumeItem[] };
  return json.data;
}

export function ResumeMedisBrowser({
  ruanganOptions,
  nowIso,
}: {
  ruanganOptions: RuanganOption[];
  nowIso: string;
}) {
  const today = useMemo(() => new Date(nowIso), [nowIso]);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(today));
  const [ruanganId, setRuanganId] = useState("");
  const [kategori, setKategori] = useState<Filter>("Semua");
  const [q, setQ] = useState("");

  const from = toLocalDateInput(weekStart);
  const to = toLocalDateInput(addDays(weekStart, 7));

  const { result, loading, error, reload } = useAsyncData<KunjunganResumeItem[]>(
    () => fetchKunjungan(from, to, ruanganId),
    [from, to, ruanganId],
  );

  const query = q.trim().toLowerCase();
  const searched = useMemo(() => {
    const base = result ?? [];
    if (!query) return base;
    return base.filter((it) =>
      [it.nama, it.norm, it.diagnosa ?? "", it.dpjp ?? "", it.ruang]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [result, query]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      Semua: searched.length,
      "Rawat Inap": 0,
      "Rawat Jalan Klinik": 0,
      IGD: 0,
    };
    for (const it of searched) c[it.kategori] += 1;
    return c;
  }, [searched]);

  const visible =
    kategori === "Semua" ? searched : searched.filter((it) => it.kategori === kategori);

  const isThisWeek = weekStart.getTime() === startOfWeek(today).getTime();
  const belumFinal = searched.filter((it) => !it.tglKeluar).length;

  // Kelompokkan ruangan per kategori untuk <optgroup>.
  const ruanganByKategori = useMemo(() => {
    const g: Record<KategoriKunjungan, RuanganOption[]> = {
      "Rawat Inap": [],
      "Rawat Jalan Klinik": [],
      IGD: [],
    };
    for (const r of ruanganOptions) g[r.kategori]?.push(r);
    return g;
  }, [ruanganOptions]);

  return (
    <FadeIn className="space-y-4">
      {/* Toolbar: minggu + ruangan + pencarian */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-[var(--radius-md)] border border-border bg-surface">
            <button
              type="button"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              className="flex h-9 w-9 items-center justify-center rounded-l-[var(--radius-md)] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label="Minggu sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="flex h-9 items-center gap-2 border-x border-border px-3 text-sm font-medium text-fg">
              <CalendarDays className="size-4 text-fg-subtle" />
              {formatWeekRange(weekStart)}
            </span>
            <button
              type="button"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className="flex h-9 w-9 items-center justify-center rounded-r-[var(--radius-md)] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label="Minggu berikutnya"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekStart(startOfWeek(today))}
            disabled={isThisWeek}
          >
            Minggu ini
          </Button>

          <select
            value={ruanganId}
            onChange={(e) => setRuanganId(e.target.value)}
            className="h-9 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            aria-label="Filter ruangan"
          >
            <option value="">Semua ruangan</option>
            {KATEGORI.map((k) =>
              ruanganByKategori[k].length ? (
                <optgroup key={k} label={k}>
                  {ruanganByKategori[k].map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nama}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </select>
        </div>

        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, No. RM…"
            className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          />
        </div>
      </div>

      {/* Tab kategori (klasifikasi dari ruangan) */}
      <div className="flex flex-wrap items-center gap-2">
        {(["Semua", ...KATEGORI] as Filter[]).map((k) => {
          const active = kategori === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKategori(k)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-brand bg-brand-soft text-brand-soft-fg"
                  : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {k}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  active ? "bg-brand/15 text-brand-soft-fg" : "bg-surface-2 text-fg-subtle",
                )}
              >
                {counts[k]}
              </span>
            </button>
          );
        })}
        {belumFinal > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-danger">
            <TriangleAlert className="size-3.5" />
            {belumFinal} belum difinalkan
          </span>
        )}
      </div>

      {/* Konten */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-[var(--radius-lg)] border border-danger/40 bg-danger-soft px-6 py-12 text-center">
          <p className="text-sm font-medium text-danger">Gagal memuat data kunjungan</p>
          <p className="mt-1 text-xs text-fg-muted">
            Periksa koneksi ke SIMGOS, lalu coba lagi.
          </p>
          <Button variant="secondary" size="sm" icon={<RotateCw className="size-4" />} onClick={reload} className="mt-4">
            Coba lagi
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface px-6 py-16 text-center">
          <p className="text-sm font-medium text-fg">Tidak ada kunjungan</p>
          <p className="mt-1 text-xs text-fg-muted">
            Tidak ada data untuk minggu / filter ini. Coba minggu lain, ruangan lain, atau ubah pencarian.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((it) => (
            <KunjunganCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </FadeIn>
  );
}

function KunjunganCard({ item }: { item: KunjunganResumeItem }) {
  const final = !!item.tglKeluar;

  return (
    <div
      className={cn(
        "flex flex-col rounded-[var(--radius-lg)] border p-4 shadow-xs transition-colors",
        final
          ? "border-border bg-surface hover:border-border-strong"
          : "border-danger/40 bg-danger-soft",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg">{item.nama}</p>
          <p className="font-mono text-xs text-fg-muted">
            {item.norm} · {item.jenisKelamin}
            {item.umur ? ` · ${item.umur}` : ""}
          </p>
        </div>
        <Badge tone={KATEGORI_TONE[item.kategori]}>{item.kategori}</Badge>
      </div>

      <div className="mt-3 space-y-1.5 text-[13px]">
        <Row icon={<DoorOpen className="size-3.5" />} value={item.ruang} />
        {item.dpjp && <Row icon={<Stethoscope className="size-3.5" />} value={item.dpjp} />}
        <Row
          icon={<Clock className="size-3.5" />}
          value={
            <>
              Masuk {formatDateTime(item.tglMasuk)}
              {final ? (
                <> · Keluar {formatDateTime(item.tglKeluar!)}</>
              ) : (
                <span className="font-medium text-danger"> · belum keluar</span>
              )}
            </>
          }
        />
        {item.diagnosa && <p className="pt-0.5 text-sm text-fg">{item.diagnosa}</p>}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        {final ? (
          <Badge tone="success" dot>
            Siap cetak
          </Badge>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger">
            <TriangleAlert className="size-3.5" />
            Belum difinalkan
          </span>
        )}

        {final ? (
          <Link
            href={`/print/resume-medis/${item.id}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-fg transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Printer className="size-4 text-fg-muted" />
            Lihat &amp; Cetak
          </Link>
        ) : (
          <span className="text-xs text-fg-subtle">Menunggu KELUAR diisi</span>
        )}
      </div>
    </div>
  );
}

function Row({ icon, value }: { icon: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-fg-muted">
      <span className="mt-0.5 shrink-0 text-fg-subtle">{icon}</span>
      <span className="min-w-0 text-fg">{value}</span>
    </div>
  );
}
