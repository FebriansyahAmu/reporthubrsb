"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRightLeft, CalendarRange, LogIn, MapPin, MousePointerClick, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { Input, InputWithIcon, Label } from "@/components/ui/Field";
import { NumberedPagination } from "@/components/ui/NumberedPagination";
import { Select, type SelectGroup, type SelectOption } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { addDays, formatDate, formatDateTime, formatNumber, toLocalDateInput } from "@/lib/format";
import { cn } from "@/lib/cn";
import { JENIS_LABEL, JENIS_TONE } from "@/server/modules/audit-rme/audit.constants";
import { KATEGORI, KATEGORI_KEYS, RENTANG_MAKS_HARI, SUMBER, SUMBER_KEYS } from "@/server/modules/audit-rme/kunjungan.constants";
import { fetchAuditRefs, fetchLog, type AuditRefs, type LogBaris, type LogFilter, type LogPage } from "./audit.client";
import { AuditDetailBody } from "./AuditDetailModal";
import { JejakKunjunganDrawer } from "./JejakKunjunganDrawer";
import { KATEGORI_TONE } from "./RekamList";
import { PetugasAvatar } from "./SkorParts";

const PAGE_SIZE = 25;
const PRESETS = [
  { days: 1, label: "Hari ini" },
  { days: 7, label: "7 hari" },
  { days: RENTANG_MAKS_HARI, label: `${RENTANG_MAKS_HARI} hari` },
];
type Sumber = LogFilter["sumber"];

const todayIso = () => toLocalDateInput(new Date());
const shiftIso = (iso: string, n: number) => toLocalDateInput(addDays(new Date(`${iso}T00:00:00`), n));
const tglFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });

/** Objek log dikelompokkan per kategori RME (7 sumber data aktual). */
const OBJEK_OPSI: SelectGroup[] = [
  { label: "", options: [{ value: "", label: "Semua objek RME" }] },
  ...KATEGORI_KEYS.map((k) => ({
    label: KATEGORI[k].label,
    options: SUMBER_KEYS.filter((s) => SUMBER[s].kategori === k).map((s) => ({ value: SUMBER[s].objek, label: SUMBER[s].label })),
  })),
];
const AKSI_OPSI: SelectOption[] = [
  { value: "", label: "Semua aksi" },
  { value: "C", label: "Penambahan" },
  { value: "U", label: "Perubahan (termasuk pembatalan)" },
];

/**
 * Log Aktivitas (Fase 2 · K4): tabel ringkas berpaginasi bernomor dengan
 * kolom pasien/ruangan; detail diff di panel samping (layar lebar) atau
 * drawer (layar kecil) — tabel tetap terlihat saat menelusuri.
 */
export function LogAktivitasView() {
  const refs = useAsyncData<AuditRefs>(() => fetchAuditRefs(), []);
  const [to, setTo] = useState(todayIso);
  const [from, setFrom] = useState(() => shiftIso(todayIso(), -6));
  const [sumber, setSumber] = useState<Sumber>("SEMUA");
  const [objek, setObjek] = useState("");
  const [aksi, setAksi] = useState<"" | "C" | "U">("");
  const [pengguna, setPengguna] = useState("");
  const [qInput, setQInput] = useState("");
  const q = useDebounce(qInput.trim(), 350);
  const [page, setPage] = useState(1);
  const [pilih, setPilih] = useState<LogBaris | null>(null);
  const [jejak, setJejak] = useState<string | null>(null);
  const lebar = useMediaQuery("(min-width: 1024px)");
  const topRef = useRef<HTMLDivElement>(null);

  // Semua pengubah filter kembali ke halaman 1 & menutup detail (tanpa effect).
  const ubah = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => {
    fn(...a);
    setPage(1);
    setPilih(null);
  };

  const hanyaLogin = sumber === "LOGIN";
  const filter: LogFilter = useMemo(
    () => ({
      from,
      to,
      sumber,
      objek: !hanyaLogin && objek ? objek : undefined,
      aksi: !hanyaLogin && aksi ? aksi : undefined,
      pengguna: pengguna || undefined,
      q: !hanyaLogin && q ? q : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [from, to, sumber, objek, aksi, pengguna, q, page, hanyaLogin],
  );
  const log = useAsyncData<LogPage>(() => fetchLog(filter), [JSON.stringify(filter)]);
  const data = log.result;
  const activePreset = PRESETS.find((p) => to === todayIso() && from === shiftIso(to, -(p.days - 1)))?.days;

  const penggunaOpsi = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "Semua pengguna" },
      ...(refs.result?.users ?? []).map((u) => ({ value: u.id, label: u.nama ? `${u.nama}${u.login ? ` · ${u.login}` : ""}` : (u.login ?? u.id) })),
    ],
    [refs.result],
  );

  function reset() {
    const t = todayIso();
    setTo(t);
    setFrom(shiftIso(t, -6));
    setSumber("SEMUA");
    setObjek("");
    setAksi("");
    setPengguna("");
    setQInput("");
    setPage(1);
    setPilih(null);
  }

  function pindah(delta: number) {
    if (!data || !pilih) return;
    const i = data.items.findIndex((x) => x.uid === pilih.uid);
    const next = data.items[i + delta];
    if (next) {
      setPilih(next);
      document.getElementById(`log-${next.uid}`)?.focus();
    }
  }

  return (
    <div ref={topRef} className="scroll-mt-4 space-y-4">
      {/* Filter */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[auto_300px_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Label>Rentang</Label>
            <div className="flex flex-wrap gap-1 rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
              {PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  aria-pressed={activePreset === p.days}
                  onClick={ubah(() => {
                    const t = todayIso();
                    setTo(t);
                    setFrom(shiftIso(t, -(p.days - 1)));
                  })}
                  className={cn(
                    "rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    activePreset === p.days ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="lg-from">Dari</Label>
              <Input id="lg-from" type="date" value={from} min={shiftIso(to, -(RENTANG_MAKS_HARI - 1))} max={to} onChange={ubah((e: React.ChangeEvent<HTMLInputElement>) => e.target.value && setFrom(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="lg-to">Sampai</Label>
              <Input
                id="lg-to"
                type="date"
                value={to}
                min={from}
                max={todayIso()}
                onChange={ubah((e: React.ChangeEvent<HTMLInputElement>) => {
                  const v = e.target.value;
                  if (!v) return;
                  setTo(v);
                  if (from < shiftIso(v, -(RENTANG_MAKS_HARI - 1))) setFrom(shiftIso(v, -(RENTANG_MAKS_HARI - 1)));
                  if (from > v) setFrom(v);
                })}
              />
            </div>
          </div>
          <div>
            <Label>Sumber</Label>
            <div className="inline-flex h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 p-1" role="group" aria-label="Sumber log">
              {(["SEMUA", "RME", "LOGIN"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={sumber === s}
                  onClick={ubah(() => setSumber(s))}
                  className={cn(
                    "flex-1 rounded-[var(--radius-sm)] px-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    sumber === s ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {s === "SEMUA" ? "Semua" : s === "RME" ? "RME" : "Login"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="lg-user">Pengguna</Label>
            <Select id="lg-user" value={pengguna} onChange={ubah(setPengguna)} options={penggunaOpsi} placeholder="Semua pengguna" />
          </div>
          {!hanyaLogin && (
            <>
              <div>
                <Label htmlFor="lg-objek">Objek RME</Label>
                <Select id="lg-objek" value={objek} onChange={ubah(setObjek)} options={OBJEK_OPSI} />
              </div>
              <div>
                <Label htmlFor="lg-aksi">Aksi</Label>
                <Select id="lg-aksi" value={aksi} onChange={ubah((v: string) => setAksi(v as "" | "C" | "U"))} options={AKSI_OPSI} />
              </div>
              <div className="xl:col-span-2">
                <Label htmlFor="lg-q">Cari ID record (REF)</Label>
                <InputWithIcon id="lg-q" icon={<Search className="size-4" />} placeholder="Awalan ID record…" value={qInput} onChange={ubah((e: React.ChangeEvent<HTMLInputElement>) => setQInput(e.target.value))} />
              </div>
            </>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
            <CalendarRange className="size-3.5" />
            {formatDate(from)} – {formatDate(to)}
            {data && (
              <>
                {" · "}
                <b className="tabular text-fg">{formatNumber(data.total)}</b> aktivitas (RME {formatNumber(data.jumlah.rme)} · login {formatNumber(data.jumlah.login)})
              </>
            )}
          </p>
          <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={reset}>
            Atur ulang
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Tabel */}
        <Card className="min-w-0 overflow-hidden">
          {log.loading && !data ? (
            <TabelSkeleton />
          ) : log.error ? (
            <ErrorState onRetry={log.reload} />
          ) : !data || data.items.length === 0 ? (
            <EmptyState title="Tidak ada aktivitas" description="Tidak ada log pada rentang & filter ini. Coba perlebar rentang atau ubah filter." />
          ) : (
            <>
              <div className={cn("relative overflow-x-auto transition-opacity", log.loading && "pointer-events-none opacity-60")}>
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/50 text-left text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
                      <th scope="col" className="w-24 px-4 py-2">Waktu</th>
                      <th scope="col" className="px-2 py-2">Petugas</th>
                      <th scope="col" className="px-2 py-2">Aktivitas</th>
                      <th scope="col" className="px-2 py-2">Objek</th>
                      <th scope="col" className="px-4 py-2">Pasien · ruangan</th>
                    </tr>
                  </thead>
                  <tbody
                    className="divide-y divide-border"
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault();
                        pindah(e.key === "ArrowDown" ? 1 : -1);
                      }
                    }}
                  >
                    {data.items.map((x) => (
                      <Baris key={x.uid} x={x} aktif={pilih?.uid === x.uid} onPilih={() => setPilih(x)} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
                <p className="text-xs text-fg-muted">
                  <b className="tabular text-fg">
                    {formatNumber((data.page - 1) * data.pageSize + 1)}–{formatNumber((data.page - 1) * data.pageSize + data.items.length)}
                  </b>{" "}
                  dari <b className="tabular text-fg">{formatNumber(data.total)}</b> · ↑/↓ berpindah baris
                </p>
                <NumberedPagination
                  page={data.page}
                  totalPages={data.totalPages}
                  disabled={log.loading}
                  onPageChange={(p) => {
                    setPage(p);
                    setPilih(null);
                    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
              </div>
            </>
          )}
        </Card>

        {/* Panel detail (layar lebar) */}
        {lebar && (
          <aside aria-label="Detail aktivitas" className="min-w-0">
            <Card className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto p-4">
              <PanelDetail x={pilih} onOpenKunjungan={setJejak} />
            </Card>
          </aside>
        )}
      </div>

      {/* Layar kecil: detail sebagai drawer */}
      {!lebar && (
        <Drawer open={!!pilih} onClose={() => setPilih(null)} title="Detail aktivitas" size="md" dismissible={!jejak}>
          <div className="p-5">
            <PanelDetail x={pilih} onOpenKunjungan={setJejak} />
          </div>
        </Drawer>
      )}
      <JejakKunjunganDrawer nomor={jejak} onClose={() => setJejak(null)} />
    </div>
  );
}

function Baris({ x, aktif, onPilih }: { x: LogBaris; aktif: boolean; onPilih: () => void }) {
  const login = x.sumber === "LOGIN";
  return (
    <tr onClick={onPilih} aria-selected={aktif} className={cn("cursor-pointer transition-colors", aktif ? "bg-brand-soft" : "hover:bg-surface-2/50")}>
      <td className="px-4 py-2 align-top">
        <button
          id={`log-${x.uid}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPilih();
          }}
          className="rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          aria-label={`Lihat detail ${JENIS_LABEL[x.jenis]} ${x.objek?.label ?? ""} oleh ${x.pengguna.nama ?? x.pengguna.id}`}
        >
          <span className="block font-mono text-xs text-fg tabular">{x.ts.slice(11, 16).replace(":", ".")}</span>
          <span className="block text-[10px] text-fg-subtle">{tglFmt.format(new Date(x.ts))}</span>
        </button>
      </td>
      <td className="px-2 py-2">
        <span className="flex items-center gap-2">
          <PetugasAvatar nama={x.pengguna.nama} profesi={x.pengguna.profesi} />
          <span className="min-w-0">
            <span className="block max-w-36 truncate text-xs font-medium text-fg" title={x.pengguna.nama ?? undefined}>{x.pengguna.nama ?? `#${x.pengguna.id}`}</span>
            <span className="block text-[10px] text-fg-subtle">{x.pengguna.profesiLabel}</span>
          </span>
        </span>
      </td>
      <td className="px-2 py-2">
        <Badge tone={JENIS_TONE[x.jenis]} dot className="px-2 text-[10px]">{JENIS_LABEL[x.jenis]}</Badge>
      </td>
      <td className="px-2 py-2">
        {x.objek ? (
          <span className="flex flex-col items-start gap-0.5">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <Badge tone={KATEGORI_TONE[x.objek.kategori]} className="px-1.5 text-[10px]">{KATEGORI[x.objek.kategori].short}</Badge>
              <span className="text-xs text-fg">{x.objek.label}</span>
            </span>
            {x.ref && <span className="font-mono text-[10px] text-fg-subtle">#{x.ref}</span>}
          </span>
        ) : login ? (
          <span className="inline-flex items-center gap-1 text-xs text-fg-muted"><LogIn className="size-3.5" /> Sistem</span>
        ) : null}
      </td>
      <td className="px-4 py-2">
        {x.kunjungan ? (
          <span className="block min-w-0">
            <span className="block max-w-44 truncate text-xs font-medium text-fg" title={x.kunjungan.pasien ?? undefined}>{x.kunjungan.pasien ?? "Tanpa nama"}</span>
            <span className="block max-w-44 truncate text-[10px] text-fg-muted" title={x.kunjungan.ruangan}>{x.kunjungan.jenisShort} · {x.kunjungan.ruangan}</span>
          </span>
        ) : login && x.ip ? (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-fg-muted"><MapPin className="size-3" /> {x.ip}</span>
        ) : (
          <span className="text-xs text-fg-subtle">—</span>
        )}
      </td>
    </tr>
  );
}

function PanelDetail({ x, onOpenKunjungan }: { x: LogBaris | null; onOpenKunjungan: (nomor: string) => void }) {
  if (!x) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-fg-muted">
        <MousePointerClick className="size-6 text-fg-subtle" />
        Pilih baris untuk melihat perubahan data.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {x.kunjungan && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface-2/40 px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-fg">{x.kunjungan.pasien ?? "Tanpa nama"}</span>
            <span className="block truncate text-[11px] text-fg-muted">
              <span className="font-mono">RM {x.kunjungan.norm}</span> · {x.kunjungan.jenisShort} · {x.kunjungan.ruangan}
            </span>
          </span>
          <Button variant="secondary" size="sm" icon={<ArrowRightLeft className="size-3.5" />} onClick={() => onOpenKunjungan(x.kunjungan!.nomor)}>
            Jejak kunjungan
          </Button>
        </div>
      )}
      {x.logId ? (
        <AuditDetailBody key={x.logId} logId={x.logId} />
      ) : (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-border bg-surface-2/40 p-3 text-sm">
          <Badge tone={JENIS_TONE.LOGIN} dot>{JENIS_LABEL.LOGIN}</Badge>
          <p className="text-fg"><b>{x.pengguna.nama ?? `#${x.pengguna.id}`}</b> masuk ke SIMGOS</p>
          <p className="text-xs text-fg-muted">{formatDateTime(x.ts)} · dari <span className="font-mono">{x.ip ?? "—"}</span></p>
        </div>
      )}
    </div>
  );
}

function TabelSkeleton() {
  return (
    <div className="divide-y divide-border" aria-busy="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-12 rounded" />
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-3.5 w-40 rounded" />
          <Skeleton className="ml-auto h-3.5 w-32 rounded" />
        </div>
      ))}
    </div>
  );
}
