"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange, Layers, LogIn, MapPin, Pencil, Plus, RotateCcw, Search, Trash2, UserRound,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, InputWithIcon, Label } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  JENIS_LABEL, JENIS_TONE, type BadgeTone, type JenisAktivitas,
} from "@/server/modules/audit-rme/audit.constants";
import {
  fetchAuditEvents, fetchAuditRefs, type AuditEvent, type AuditRefs, type EventsFilter,
} from "./audit.client";
import { AuditDetailModal } from "./AuditDetailModal";

type Sumber = "SEMUA" | "RME" | "LOGIN";
type Aksi = "" | "C" | "U";

const p2 = (n: number) => String(n).padStart(2, "0");
function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

const JENIS_VERB: Record<JenisAktivitas, string> = {
  PENAMBAHAN: "menambahkan",
  PERUBAHAN: "mengubah",
  PENGHAPUSAN: "menghapus",
  AKSES: "mengakses",
  LOGIN: "login ke sistem",
  LOGOUT: "logout",
};
const JENIS_ICON: Record<JenisAktivitas, typeof Plus> = {
  PENAMBAHAN: Plus,
  PERUBAHAN: Pencil,
  PENGHAPUSAN: Trash2,
  AKSES: Layers,
  LOGIN: LogIn,
  LOGOUT: LogIn,
};

const DOT_BG: Record<BadgeTone, string> = {
  brand: "bg-brand text-white",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  danger: "bg-danger text-white",
  accent: "bg-accent text-white",
  neutral: "bg-surface-2 text-fg-muted",
};

function initials(nama: string | null, login: string | null): string {
  const s = (nama || login || "?").trim();
  const parts = s.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AuditTimelineView() {
  const refsState = useAsyncData<AuditRefs>(() => fetchAuditRefs(), []);
  const refs = refsState.result;

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [sumber, setSumber] = useState<Sumber>("SEMUA");
  const [aksi, setAksi] = useState<Aksi>("");
  const [objek, setObjek] = useState("");
  const [pengguna, setPengguna] = useState("");
  const [qInput, setQInput] = useState("");
  const q = useDebounce(qInput, 300);

  // Default rentang: 7 hari terakhir berdasarkan cakupan (agar langsung ada data).
  if (refs && !initialized) {
    setInitialized(true);
    const max = refs.coverage.maxDate ?? isoToday();
    setTo(max);
    setFrom(addDaysIso(max, -6));
  }

  const loginOnly = sumber === "LOGIN";

  const objekOpts = useMemo<SelectOption[]>(
    () => [{ value: "", label: "Semua objek RME" }, ...(refs?.scope ?? []).map((o) => ({ value: o.objek, label: o.label }))],
    [refs],
  );
  const penggunaOpts = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "Semua pengguna" },
      ...(refs?.users ?? []).map((u) => ({
        value: u.id,
        label: u.nama ? `${u.nama}${u.login ? ` · ${u.login}` : ""}` : (u.login ?? u.id),
      })),
    ],
    [refs],
  );
  const aksiOpts: SelectOption[] = [
    { value: "", label: "Semua aksi" },
    { value: "C", label: "Penambahan" },
    { value: "U", label: "Perubahan" },
  ];

  // ---- events (keyset) --------------------------------------------------------
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const reqRef = useRef(0);

  const baseFilter: EventsFilter = useMemo(
    () => ({
      from,
      to,
      sumber,
      aksi: !loginOnly && aksi ? aksi : undefined,
      objek: !loginOnly && objek ? objek : undefined,
      pengguna: pengguna || undefined,
      q: !loginOnly && q.trim() ? q.trim() : undefined,
      limit: 30,
    }),
    [from, to, sumber, aksi, objek, pengguna, q, loginOnly],
  );
  const filterKey = JSON.stringify(baseFilter);

  useEffect(() => {
    if (!from || !to) return;
    const rid = ++reqRef.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronisasi state fetch (loading) memang perlu di sini
    setLoading(true);
    setError(false);
    fetchAuditEvents(baseFilter)
      .then((res) => {
        if (rid !== reqRef.current) return;
        setItems(res.items);
        setCursor(res.nextCursor);
        setHasMore(res.hasMore);
      })
      .catch(() => {
        if (rid === reqRef.current) setError(true);
      })
      .finally(() => {
        if (rid === reqRef.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, reloadTick]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetchAuditEvents({ ...baseFilter, cursor });
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch {
      /* diamkan; tombol tetap bisa dicoba lagi */
    } finally {
      setLoadingMore(false);
    }
  }

  function resetFilter() {
    setSumber("SEMUA");
    setAksi("");
    setObjek("");
    setPengguna("");
    setQInput("");
    if (refs) {
      const max = refs.coverage.maxDate ?? isoToday();
      setTo(max);
      setFrom(addDaysIso(max, -6));
    }
  }

  const groups = useMemo(() => groupByDate(items), [items]);
  const [detailEvent, setDetailEvent] = useState<AuditEvent | null>(null);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <Label htmlFor="au-from">Dari tanggal</Label>
            <Input id="au-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="au-to">Sampai tanggal</Label>
            <Input id="au-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="au-user">Pengguna</Label>
            <Select id="au-user" value={pengguna} onChange={setPengguna} options={penggunaOpts} placeholder="Semua pengguna" />
          </div>
          <div>
            <Label>Sumber</Label>
            <Segmented
              value={sumber}
              onChange={(v) => setSumber(v as Sumber)}
              items={[
                { key: "SEMUA", label: "Semua" },
                { key: "RME", label: "RME" },
                { key: "LOGIN", label: "Login" },
              ]}
            />
          </div>
          {!loginOnly && (
            <>
              <div>
                <Label htmlFor="au-objek">Objek RME</Label>
                <Select id="au-objek" value={objek} onChange={setObjek} options={objekOpts} placeholder="Semua objek" />
              </div>
              <div>
                <Label htmlFor="au-aksi">Jenis aksi</Label>
                <Select id="au-aksi" value={aksi} onChange={(v) => setAksi(v as Aksi)} options={aksiOpts} />
              </div>
              <div className="xl:col-span-2">
                <Label htmlFor="au-q">Cari (No. rekam / ID record)</Label>
                <InputWithIcon id="au-q" icon={<Search className="size-4" />} placeholder="Awalan REF…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-fg-muted">
            {refs?.coverage.minDate && refs.coverage.maxDate ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarRange className="size-3.5" /> Data tersedia {formatDate(refs.coverage.minDate)} – {formatDate(refs.coverage.maxDate)}
              </span>
            ) : null}
          </p>
          <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={resetFilter}>
            Atur ulang
          </Button>
        </div>
      </Card>

      {/* Timeline */}
      {loading ? (
        <TimelineSkeleton />
      ) : error ? (
        <Card className="overflow-hidden"><ErrorState onRetry={() => setReloadTick((t) => t + 1)} /></Card>
      ) : items.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState title="Tidak ada aktivitas" description="Tidak ada log pada rentang & filter ini. Coba perlebar rentang tanggal atau ubah filter." />
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.date}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-fg">{formatDate(g.date)}</h3>
                <span className="text-xs text-fg-subtle">{g.rows.length} aktivitas</span>
              </div>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-border">
                  {g.rows.map((ev) => (
                    <EventRow key={ev.id} ev={ev} onOpen={ev.logId ? () => setDetailEvent(ev) : undefined} />
                  ))}
                </ul>
              </Card>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-1">
              <Button variant="secondary" size="sm" onClick={loadMore} loading={loadingMore}>
                Muat lebih banyak
              </Button>
            </div>
          )}
          {!hasMore && <p className="pt-1 text-center text-xs text-fg-subtle">— akhir dari hasil —</p>}
        </div>
      )}

      <AuditDetailModal event={detailEvent} onClose={() => setDetailEvent(null)} />
    </div>
  );
}

function EventRow({ ev, onOpen }: { ev: AuditEvent; onOpen?: () => void }) {
  const tone = JENIS_TONE[ev.jenis];
  const Icon = JENIS_ICON[ev.jenis];
  const time = ev.ts.slice(11, 16);
  const nama = ev.pengguna.nama || ev.pengguna.login || `#${ev.pengguna.id}`;
  const clickable = !!onOpen;

  return (
    <li
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors",
        clickable ? "cursor-pointer hover:bg-surface-2/60" : "hover:bg-surface-2/50",
      )}
      onClick={onOpen}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } : undefined}
      aria-label={clickable ? `Lihat detail: ${JENIS_LABEL[ev.jenis]} ${ev.objek?.label ?? ""}` : undefined}
    >
      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", DOT_BG[tone])} title={JENIS_LABEL[ev.jenis]}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={tone} dot>{JENIS_LABEL[ev.jenis]}</Badge>
          <span className="text-sm text-fg">
            <b className="font-semibold">{nama}</b> {JENIS_VERB[ev.jenis]}
            {ev.objek ? <> <span className="font-medium text-brand">{ev.objek.label}</span></> : null}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
          {ev.ref && (
            <span className="inline-flex items-center gap-1">
              <span className="text-fg-subtle">Ref</span>
              <span className="font-mono text-fg-muted">{ev.ref}</span>
            </span>
          )}
          {ev.ip && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> <span className="font-mono">{ev.ip}</span>
            </span>
          )}
          {ev.pengguna.login && (
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3" /> {ev.pengguna.login}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-fg-muted" title={nama}>
          {initials(ev.pengguna.nama, ev.pengguna.login)}
        </span>
        <span className="w-10 text-right font-mono text-xs tabular-nums text-fg-subtle">{time}</span>
      </div>
    </li>
  );
}

function Segmented({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: { key: string; label: string }[] }) {
  return (
    <div className="inline-flex h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            aria-pressed={active}
            className={cn(
              "flex-1 rounded-[var(--radius-sm)] px-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
              active ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function groupByDate(items: AuditEvent[]): { date: string; rows: AuditEvent[] }[] {
  const out: { date: string; rows: AuditEvent[] }[] = [];
  let cur: { date: string; rows: AuditEvent[] } | null = null;
  for (const ev of items) {
    const d = ev.ts.slice(0, 10);
    if (!cur || cur.date !== d) {
      cur = { date: d, rows: [] };
      out.push(cur);
    }
    cur.rows.push(ev);
  }
  return out;
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32 rounded" />
      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-56 rounded" />
                <Skeleton className="h-3 w-40 rounded" />
              </div>
              <Skeleton className="h-3 w-10 rounded" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
