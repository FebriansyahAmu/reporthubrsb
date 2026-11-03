"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Ban, CircleX, Download, FilePen, FilePlus2, FileX2, Send, Undo2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { NumberedPagination } from "@/components/ui/NumberedPagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";
import { formatNumber, formatRelatif } from "@/lib/format";
import { tanggalPanjang, tanggalWita } from "@/server/modules/bckh/bckh.aturan";
import { LABEL_PERAN_TTD, LABEL_STATUS, type AksiLog, type JenisLog } from "@/server/modules/bckh/bckh.constants";
import type { LogDto, LogResult } from "@/server/modules/bckh/bckh.types";
import { labelBulan } from "./ui";

const IKON: Record<AksiLog, { ikon: typeof FilePlus2; kelas: string; kata: string }> = {
  BUAT: { ikon: FilePlus2, kelas: "bg-success-soft text-success", kata: "Mencatat" },
  UBAH: { ikon: FilePen, kelas: "bg-brand-soft text-brand", kata: "Mengubah catatan" },
  HAPUS: { ikon: FileX2, kelas: "bg-danger-soft text-danger", kata: "Menghapus catatan" },
  EKSPOR: { ikon: Download, kelas: "bg-surface-2 text-fg-muted", kata: "Mengunduh laporan" },
  AJUKAN: { ikon: Send, kelas: "bg-brand-soft text-brand", kata: "Mengajukan tanda tangan" },
  TARIK: { ikon: Undo2, kelas: "bg-surface-2 text-fg-muted", kata: "Menarik pengajuan" },
  SETUJU: { ikon: BadgeCheck, kelas: "bg-success-soft text-success", kata: "Menyetujui & menandatangani" },
  TOLAK: { ikon: CircleX, kelas: "bg-danger-soft text-danger", kata: "Menolak" },
  BATAL: { ikon: Ban, kelas: "bg-warning-soft text-warning", kata: "Membatalkan persetujuan" },
};

const FILTER: { k: JenisLog; label: string }[] = [
  { k: "semua", label: "Semua" },
  { k: "catatan", label: "Catatan" },
  { k: "laporan", label: "Unduhan" },
  { k: "persetujuan", label: "Persetujuan" },
];

const jamFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit" });

/**
 * Log pengisian ala riwayat commit: dikelompokkan per tanggal aksi (WITA), terbaru
 * di atas, BERHALAMAN (20 per halaman, nomor halaman) dengan filter jenis aksi —
 * hanya satu halaman yang dimuat & dirender. Setiap simpan = satu entri
 * (+ditambah ~diubah −dihapus); pengajuan & persetujuan laporan ikut tercatat.
 */
export function TabLog({ u, segar }: { u: string | null; segar: number }) {
  const [halaman, setHalaman] = useState(1);
  const [jenis, setJenis] = useState<JenisLog>("semua");
  const [data, setData] = useState<LogResult | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState(false);
  const [coba, setCoba] = useState(0);
  const [kini] = useState(() => Date.now());
  const atas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tanda memuat untuk halaman yang diminta
    setMemuat(true);
    const q = new URLSearchParams({ halaman: String(halaman), jenis, ...(u ? { u } : {}) });
    apiGet<LogResult>(`/api/bckh/log?${q}`, { signal: ac.signal })
      .then((r) => {
        setData(r);
        setGalat(false);
        // Server menjepit halaman di luar jangkauan (mis. setelah filter) → ikuti.
        if (r.halaman !== halaman) setHalaman(r.halaman);
      })
      .catch(() => !ac.signal.aborted && setGalat(true))
      .finally(() => !ac.signal.aborted && setMemuat(false));
    return () => ac.abort();
  }, [u, segar, coba, halaman, jenis]);

  const keHalaman = (h: number) => {
    setHalaman(h);
    atas.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  if (galat && !data) return <ErrorState onRetry={() => setCoba((c) => c + 1)} />;
  if (!data) return <Skeleton className="h-64 w-full" />;

  const kelompok = new Map<string, LogDto[]>();
  for (const l of data.log) {
    const k = tanggalWita(l.dibuat);
    kelompok.set(k, [...(kelompok.get(k) ?? []), l]);
  }
  const dari = data.total ? (data.halaman - 1) * data.perHalaman + 1 : 0;
  const sampai = (data.halaman - 1) * data.perHalaman + data.log.length;

  return (
    <div ref={atas} className="scroll-mt-20 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Jenis aktivitas" className="inline-flex flex-wrap gap-1 rounded-[var(--radius-md)] border border-border bg-surface p-0.5">
          {FILTER.map((f) => (
            <button
              key={f.k}
              type="button"
              role="radio"
              aria-checked={jenis === f.k}
              onClick={() => {
                setJenis(f.k);
                setHalaman(1);
              }}
              className={cn(
                "h-8 rounded-[var(--radius-sm)] px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                jenis === f.k ? "bg-fg text-white" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs tabular text-fg-muted" aria-live="polite">
          {data.total ? (
            <>
              Menampilkan <b className="font-semibold text-fg">{formatNumber(dari)}–{formatNumber(sampai)}</b> dari {formatNumber(data.total)} aktivitas
            </>
          ) : null}
        </p>
      </div>

      {data.total === 0 ? (
        <EmptyState
          title={jenis === "semua" ? "Belum ada aktivitas pengisian" : "Tidak ada aktivitas jenis ini"}
          description={
            jenis === "semua"
              ? "Setiap kali catatan disimpan, diubah, dihapus, laporan diunduh, atau diajukan untuk ditandatangani, jejaknya muncul di sini."
              : "Pilih jenis lain untuk melihat aktivitas lainnya."
          }
        />
      ) : (
        <div className={cn("space-y-6 transition-opacity", memuat && "opacity-60")} aria-busy={memuat}>
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
        </div>
      )}

      {data.jumlahHalaman > 1 && (
        <div className="flex flex-col items-center gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
          <p className="text-xs tabular text-fg-subtle">
            Halaman {data.halaman} dari {data.jumlahHalaman}
          </p>
          <NumberedPagination page={data.halaman} totalPages={data.jumlahHalaman} onPageChange={keHalaman} disabled={memuat} />
        </div>
      )}
    </div>
  );
}

function BarisLog({ l, kini }: { l: LogDto; kini: number }) {
  const { ikon: Ikon, kelas, kata } = IKON[l.aksi];
  const r = l.rincian;
  const tentangLaporan = l.aksi === "EKSPOR" || ["AJUKAN", "TARIK", "SETUJU", "TOLAK", "BATAL"].includes(l.aksi);
  const sasaran = tentangLaporan ? `Laporan ${r.bulan ? labelBulan(r.bulan) : ""}` : tanggalPanjang(l.tanggal);
  const perubahan = [
    r.tambah ? { t: `+${r.tambah}`, k: "text-success" } : null,
    r.ubah ? { t: `~${r.ubah}`, k: "text-brand" } : null,
    r.hapus ? { t: `−${r.hapus}`, k: "text-danger" } : null,
  ].filter(Boolean) as { t: string; k: string }[];
  const keteranganPersetujuan =
    l.aksi === "AJUKAN" && r.peran
      ? r.peran === "MENGETAHUI"
        ? "sampai Mengetahui"
        : "sampai atasan langsung"
      : (l.aksi === "SETUJU" || l.aksi === "TOLAK" || l.aksi === "BATAL") && r.peran
        ? `sebagai ${LABEL_PERAN_TTD[r.peran].toLowerCase()}${l.aksi === "SETUJU" && r.ke === "DISETUJUI" ? " · laporan disahkan" : ""}`
        : null;

  return (
    <li className="flex gap-3 px-4 py-3">
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", kelas)}>
        <Ikon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg">
          {kata} <b className="font-semibold">{sasaran}</b>
          {!tentangLaporan && r.status?.ke && (r.status.dari === null || r.status.dari !== r.status.ke) && (
            <span className="text-fg-muted">
              {" "}
              · {r.status.dari && r.status.dari !== r.status.ke ? `${LABEL_STATUS[r.status.dari]} → ` : ""}
              {LABEL_STATUS[r.status.ke]}
            </span>
          )}
          {keteranganPersetujuan && <span className="text-fg-muted"> · {keteranganPersetujuan}</span>}
        </p>
        {r.alasan && <p className="mt-0.5 text-xs text-fg-muted [overflow-wrap:anywhere]">Alasan: {r.alasan}</p>}
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
