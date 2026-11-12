"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ApiError, apiGet } from "@/lib/api-client";
import { formatDateTime, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AksiIsian } from "@/features/form-rm/isian.status";
import { labelKolom, ringkasNilai, ringkasTtd, slotTtd } from "@/features/form-rm/label-kolom";
import { definisiForm } from "@/features/form-rm/registry";
import type { EntriLogIsian, LogIsian, RevisiIsian, RiwayatIsian } from "@/server/modules/form-rm/isian.types";
import { StatusIsianBadge } from "./StatusIsianBadge";

const LABEL_AKSI: Record<AksiIsian, string> = {
  FINALKAN: "Difinalkan",
  BUKA_KOREKSI: "Dibuka untuk koreksi",
  BATALKAN: "Dibatalkan",
};

const LABEL_AKSI_LOG: Record<string, string> = {
  SIMPAN: "Disimpan",
  TIMPA: "Disimpan menimpa isi petugas lain",
  MUAT_SIMRS: "Dimuat ulang dari SIMRS",
  BEKU_TERTAUT: "Dibekukan dari SIMRS saat difinalkan",
};

const LABEL_UNIT: Record<string, string> = { IGD: "IGD", RI: "Rawat Inap", RJ: "Rawat Jalan" };

type Muat<D> = { status: "memuat" } | { status: "ok"; data: D } | { status: "galat"; pesan: string };

const pesanGalat = (e: unknown, apa: string) =>
  e instanceof ApiError && e.status === 503
    ? "Pemeriksaan segel belum tersedia: kunci integritas server belum dikonfigurasi."
    : `${apa} gagal dimuat. Coba lagi.`;

/** Muat JSON saat drawer terbuka (dan ulang saat `rev` berubah). */
function useMuat<D>(url: string | null, rev: number, apa: string): Muat<D> {
  const [muat, setMuat] = useState<Muat<D>>({ status: "memuat" });
  useEffect(() => {
    if (!url) return;
    const batal = new AbortController();
    apiGet<D>(url, { signal: batal.signal })
      .then((data) => setMuat({ status: "ok", data }))
      .catch((e: unknown) => {
        if (!batal.signal.aborted) setMuat({ status: "galat", pesan: pesanGalat(e, apa) });
      });
    return () => {
      batal.abort();
      setMuat({ status: "memuat" });
    };
  }, [url, rev, apa]);
  return muat;
}

type Tab = "perubahan" | "revisi";

/**
 * Riwayat isian: revisi tersegel + pemeriksaan segel (dihitung ulang server
 * setiap dibuka). Form berlanjut IGD → RI (`kode` diisi) juga punya tab
 * PERUBAHAN: log per kolom sebelum → sesudah, siapa, kapan, dari unit mana
 * (PRD Berlanjut §5.6), satu linimasa dengan transisi status.
 */
export function RiwayatIsianDrawer({
  open,
  onClose,
  isianId,
  rev,
  kode = null,
}: {
  open: boolean;
  onClose: () => void;
  isianId: string;
  /** Muat ulang saat rev berubah (setelah aksi). */
  rev: number;
  /** Kode form berlanjut (tab Perubahan); null = hanya revisi. */
  kode?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("perubahan");
  const adaLog = kode !== null;
  const riwayat = useMuat<RiwayatIsian>(open ? `/api/form-rm/isian/${isianId}/riwayat` : null, rev, "Riwayat");
  const log = useMuat<LogIsian>(open && adaLog && tab === "perubahan" ? `/api/form-rm/isian/${isianId}/log` : null, rev, "Log perubahan");

  return (
    <Drawer open={open} onClose={onClose} title="Riwayat isian" size="md">
      <div className="space-y-4 p-5">
        {adaLog && (
          <SegmentedControl<Tab>
            label="Tampilan riwayat"
            penuh
            value={tab}
            onChange={setTab}
            items={[
              { value: "perubahan", label: "Perubahan" },
              { value: "revisi", label: "Segel & revisi" },
            ]}
          />
        )}
        {adaLog && tab === "perubahan" ? (
          <TabPerubahan kode={kode} log={log} riwayat={riwayat} />
        ) : (
          <TabRevisi riwayat={riwayat} />
        )}
      </div>
    </Drawer>
  );
}

function Memuat({ teks }: { teks: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-fg-muted">
      <Loader2 className="size-4 animate-spin" /> {teks}
    </p>
  );
}

function Integritas({ utuh, masalah, utuhTeks }: { utuh: boolean; masalah: string[]; utuhTeks: string }) {
  return utuh ? (
    <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-success/30 bg-success-soft px-3 py-2.5 text-[13px] text-success">
      <ShieldCheck className="mt-0.5 size-4 shrink-0" />
      <span>{utuhTeks}</span>
    </div>
  ) : (
    <div className="rounded-[var(--radius-md)] border border-danger/40 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
      <p className="flex items-center gap-2 font-semibold">
        <ShieldAlert className="size-4 shrink-0" /> Segel tidak utuh — kemungkinan diubah di luar aplikasi
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
        {masalah.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------- revisi */

function TabRevisi({ riwayat }: { riwayat: Muat<RiwayatIsian> }) {
  if (riwayat.status === "memuat") return <Memuat teks="Memeriksa riwayat & segel…" />;
  if (riwayat.status === "galat") return <p className="text-sm text-danger">{riwayat.pesan}</p>;
  const { revisi, integritas } = riwayat.data;
  return (
    <>
      <Integritas
        {...integritas}
        utuhTeks="Segel utuh — setiap revisi cocok dengan segelnya dan tidak ada perubahan di luar aplikasi."
      />
      {revisi.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Belum ada revisi. Revisi dicatat setiap kali isian difinalkan, dibuka untuk koreksi, atau dibatalkan.
        </p>
      ) : (
        <ol className="space-y-3">
          {[...revisi].reverse().map((r) => (
            <KartuRevisi key={r.rev} r={r} />
          ))}
        </ol>
      )}
    </>
  );
}

function KartuRevisi({ r }: { r: RevisiIsian }) {
  return (
    <li className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-fg">{LABEL_AKSI[r.aksi]}</span>
        <StatusIsianBadge status={r.status} />
      </div>
      <p className="mt-1 text-xs text-fg-muted">
        {r.olehNama ?? "—"} · {formatDateTime(r.waktu)} · rev {r.rev}
      </p>
      {r.alasan && <p className="mt-2 border-l-2 border-border pl-2 text-[13px] text-fg">{r.alasan}</p>}
    </li>
  );
}

/* -------------------------------------------------------- perubahan */

type ItemLinimasa = { jenis: "log"; waktu: string; e: EntriLogIsian } | { jenis: "revisi"; waktu: string; r: RevisiIsian };

function TabPerubahan({ kode, log, riwayat }: { kode: string; log: Muat<LogIsian>; riwayat: Muat<RiwayatIsian> }) {
  const ttd = useMemo(() => slotTtd(kode, definisiForm(kode)?.kosong()), [kode]);
  if (log.status === "memuat") return <Memuat teks="Memuat log perubahan & memeriksa segel…" />;
  if (log.status === "galat") return <p className="text-sm text-danger">{log.pesan}</p>;

  const revisi = riwayat.status === "ok" ? riwayat.data.revisi : [];
  const item: ItemLinimasa[] = [
    ...log.data.entri.map((e): ItemLinimasa => ({ jenis: "log", waktu: e.diperbaruiAt, e })),
    ...revisi.map((r): ItemLinimasa => ({ jenis: "revisi", waktu: r.waktu, r })),
  ].sort((a, b) => (a.waktu < b.waktu ? 1 : a.waktu > b.waktu ? -1 : 0));

  return (
    <>
      <Integritas
        {...log.data.integritas}
        utuhTeks="Log perubahan utuh — setiap entri cocok dengan segelnya."
      />
      {item.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Belum ada perubahan tercatat. Setiap simpan yang mengubah kolom dicatat di sini: siapa, kapan, dari unit mana, dan
          isi sebelum → sesudah.
        </p>
      ) : (
        <ol className="space-y-3">
          {item.map((x) =>
            x.jenis === "log" ? (
              <KartuLog key={`log-${x.e.urut}`} kode={kode} e={x.e} ttd={ttd} />
            ) : (
              <KartuRevisi key={`rev-${x.r.rev}`} r={x.r} />
            ),
          )}
        </ol>
      )}
    </>
  );
}

function KartuLog({ kode, e, ttd }: { kode: string; e: EntriLogIsian; ttd: ReadonlySet<string> }) {
  const tempat = [e.unit ? (LABEL_UNIT[e.unit] ?? e.unit) : null, e.ruang].filter(Boolean).join(" · ");
  const rentang = e.dibuatAt === e.diperbaruiAt ? formatDateTime(e.dibuatAt) : `${formatDateTime(e.dibuatAt)}–${formatTime(e.diperbaruiAt)}`;
  return (
    <li className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-sm">
      <p className={cn("font-semibold", e.aksi === "TIMPA" ? "text-warning" : "text-fg")}>{LABEL_AKSI_LOG[e.aksi] ?? e.aksi}</p>
      <p className="mt-0.5 text-xs text-fg-muted">
        {e.olehNama ?? "—"}
        {tempat ? ` · ${tempat}` : ""} · {rentang}
      </p>
      {e.perubahan.length === 0 ? (
        <p className="mt-2 text-[13px] text-fg-muted">Semua kolom kembali ke isi semula.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {e.perubahan.map((c) => (
            <li key={c.p} className="text-[13px] leading-snug">
              <span className="font-medium text-fg">{labelKolom(kode, c.p)}</span>
              {c.t && (
                <span className="ml-1.5 rounded-full bg-warning-soft px-1.5 py-px text-[11px] font-semibold text-warning">ditimpa</span>
              )}
              <span className="text-fg-muted">: </span>
              {ttd.has(c.p) ? (
                <span className="text-fg">{ringkasTtd(c.s, c.j)}</span>
              ) : (
                <span className="break-words">
                  <span className="sr-only">dari </span>
                  <del className="text-fg-subtle">{ringkasNilai(c.s)}</del>
                  <span aria-hidden className="mx-1 text-fg-subtle">
                    →
                  </span>
                  <span className="sr-only"> menjadi </span>
                  <ins className="text-fg no-underline">{ringkasNilai(c.j)}</ins>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
