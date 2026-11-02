"use client";

import { useEffect, useState } from "react";
import { Download, FilePlus2, FilePen, FileX2, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { formatRelatif } from "@/lib/format";
import { tanggalPanjang, tanggalWita } from "@/server/modules/bckh/bckh.aturan";
import { LABEL_STATUS, type AksiLog } from "@/server/modules/bckh/bckh.constants";
import type { LogDto, LogResult } from "@/server/modules/bckh/bckh.types";
import { labelBulan } from "./ui";

const IKON: Record<AksiLog, { ikon: typeof FilePlus2; kelas: string; kata: string }> = {
  BUAT: { ikon: FilePlus2, kelas: "bg-success-soft text-success", kata: "Mencatat" },
  UBAH: { ikon: FilePen, kelas: "bg-brand-soft text-brand", kata: "Mengubah catatan" },
  HAPUS: { ikon: FileX2, kelas: "bg-danger-soft text-danger", kata: "Menghapus catatan" },
  EKSPOR: { ikon: Download, kelas: "bg-surface-2 text-fg-muted", kata: "Mengunduh laporan" },
};

const jamFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit" });

/**
 * Log pengisian ala riwayat commit: dikelompokkan per tanggal aksi (WITA),
 * terbaru di atas. Setiap simpan = satu entri (+ditambah ~diubah −dihapus).
 */
export function TabLog({ u, segar }: { u: string | null; segar: number }) {
  const [log, setLog] = useState<LogDto[] | null>(null);
  const [berikutnya, setBerikutnya] = useState<number | null>(null);
  const [galat, setGalat] = useState(false);
  const [muatLagi, setMuatLagi] = useState(false);
  const [kini] = useState(() => Date.now());
  const [coba, setCoba] = useState(0);

  const ambil = async (sebelum?: number) => {
    const q = new URLSearchParams({ ...(sebelum ? { sebelum: String(sebelum) } : {}), ...(u ? { u } : {}) });
    return apiGet<LogResult>(`/api/bckh/log?${q}`);
  };

  useEffect(() => {
    let batal = false;
    ambil()
      .then((r) => {
        if (batal) return;
        setLog(r.log);
        setBerikutnya(r.berikutnya);
        setGalat(false);
      })
      .catch(() => !batal && setGalat(true));
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u, segar, coba]);

  const lagi = async () => {
    if (!berikutnya) return;
    setMuatLagi(true);
    try {
      const r = await ambil(berikutnya);
      setLog((l) => [...(l ?? []), ...r.log]);
      setBerikutnya(r.berikutnya);
    } finally {
      setMuatLagi(false);
    }
  };

  if (galat && !log) return <ErrorState onRetry={() => setCoba((c) => c + 1)} />;
  if (!log) return <Skeleton className="h-64 w-full" />;
  if (log.length === 0) return <EmptyState title="Belum ada aktivitas pengisian" description="Setiap kali catatan disimpan, diubah, dihapus, atau laporan diunduh, jejaknya muncul di sini." />;

  const kelompok = new Map<string, LogDto[]>();
  for (const l of log) {
    const k = tanggalWita(l.dibuat);
    kelompok.set(k, [...(kelompok.get(k) ?? []), l]);
  }

  return (
    <div className="space-y-6">
      {[...kelompok.entries()].map(([tgl, isi]) => (
        <section key={tgl} aria-label={`Aktivitas ${tanggalPanjang(tgl)}`}>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-fg-muted">
            <span className="size-2 rounded-full border-2 border-fg-subtle" aria-hidden />
            Aktivitas pada {tanggalPanjang(tgl)}
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface">
            {isi.map((l) => (
              <BarisLog key={l.id} l={l} kini={kini} />
            ))}
          </ul>
        </section>
      ))}
      {berikutnya && (
        <button
          type="button"
          onClick={() => void lagi()}
          disabled={muatLagi}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface py-2 text-sm font-medium text-brand transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          {muatLagi && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Muat aktivitas sebelumnya
        </button>
      )}
    </div>
  );
}

function BarisLog({ l, kini }: { l: LogDto; kini: number }) {
  const { ikon: Ikon, kelas, kata } = IKON[l.aksi];
  const r = l.rincian;
  const sasaran = l.aksi === "EKSPOR" ? `Laporan ${r.bulan ? labelBulan(r.bulan) : ""}` : tanggalPanjang(l.tanggal);
  const perubahan = [
    r.tambah ? { t: `+${r.tambah}`, k: "text-success" } : null,
    r.ubah ? { t: `~${r.ubah}`, k: "text-brand" } : null,
    r.hapus ? { t: `−${r.hapus}`, k: "text-danger" } : null,
  ].filter(Boolean) as { t: string; k: string }[];

  return (
    <li className="flex gap-3 px-4 py-3">
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", kelas)}>
        <Ikon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg">
          {kata} <b className="font-semibold">{sasaran}</b>
          {l.aksi !== "EKSPOR" && r.status?.ke && (r.status.dari === null || r.status.dari !== r.status.ke) && (
            <span className="text-fg-muted">
              {" "}
              · {r.status.dari && r.status.dari !== r.status.ke ? `${LABEL_STATUS[r.status.dari]} → ` : ""}
              {LABEL_STATUS[r.status.ke]}
            </span>
          )}
        </p>
        {(r.contoh?.length || r.urutan || r.keterangan) && (
          <p className="mt-0.5 truncate text-xs text-fg-muted">
            {r.contoh?.join(" · ")}
            {r.contoh?.length && r.tambah && r.tambah > r.contoh.length ? ` · +${r.tambah - r.contoh.length} lainnya` : ""}
            {r.urutan && <span>{r.contoh?.length ? " · " : ""}urutan diubah</span>}
            {r.keterangan && <span>{r.contoh?.length || r.urutan ? " · " : ""}keterangan diubah</span>}
          </p>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-fg-subtle">
          <time dateTime={l.dibuat} title={new Date(l.dibuat).toLocaleString("id-ID")}>
            {jamFmt.format(new Date(l.dibuat))} · {formatRelatif(l.dibuat, kini)}
          </time>
          {!l.olehPemilik && <span>oleh {l.aktorNama}</span>}
          {l.terlambat > 0 && <span className="rounded-full bg-warning-soft px-1.5 py-px font-semibold text-warning">terlambat {l.terlambat} hari</span>}
        </p>
      </div>
      {perubahan.length > 0 && (
        <span className="shrink-0 self-center font-mono text-xs font-semibold tabular" aria-label={perubahan.map((p) => p.t).join(" ")}>
          {perubahan.map((p) => (
            <span key={p.t} className={cn("ml-1.5", p.k)}>
              {p.t}
            </span>
          ))}
        </span>
      )}
    </li>
  );
}
