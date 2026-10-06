"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { ApiError, apiGet } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { AksiIsian } from "@/features/form-rm/isian.status";
import type { RiwayatIsian } from "@/server/modules/form-rm/isian.types";
import { StatusIsianBadge } from "./StatusIsianBadge";

const LABEL_AKSI: Record<AksiIsian, string> = {
  FINALKAN: "Difinalkan",
  BUKA_KOREKSI: "Dibuka untuk koreksi",
  BATALKAN: "Dibatalkan",
};

type Muat = { status: "memuat" } | { status: "ok"; data: RiwayatIsian } | { status: "galat"; pesan: string };

/** Riwayat revisi isian + hasil pemeriksaan segel (dihitung ulang server setiap dibuka). */
export function RiwayatIsianDrawer({
  open,
  onClose,
  isianId,
  rev,
}: {
  open: boolean;
  onClose: () => void;
  isianId: string;
  /** Muat ulang saat rev berubah (setelah aksi). */
  rev: number;
}) {
  const [muat, setMuat] = useState<Muat>({ status: "memuat" });

  useEffect(() => {
    if (!open) return;
    const batal = new AbortController();
    apiGet<RiwayatIsian>(`/api/form-rm/isian/${isianId}/riwayat`, { signal: batal.signal })
      .then((data) => setMuat({ status: "ok", data }))
      .catch((e: unknown) => {
        if (batal.signal.aborted) return;
        setMuat({
          status: "galat",
          pesan:
            e instanceof ApiError && e.status === 503
              ? "Pemeriksaan segel belum tersedia: kunci integritas server belum dikonfigurasi."
              : "Riwayat gagal dimuat. Coba lagi.",
        });
      });
    return () => {
      batal.abort();
      setMuat({ status: "memuat" });
    };
  }, [open, isianId, rev]);

  return (
    <Drawer open={open} onClose={onClose} title="Riwayat isian" size="md">
      <div className="space-y-4 p-5">
        {muat.status === "memuat" ? (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 className="size-4 animate-spin" /> Memeriksa riwayat & segel…
          </p>
        ) : muat.status === "galat" ? (
          <p className="text-sm text-danger">{muat.pesan}</p>
        ) : (
          <>
            {muat.data.integritas.utuh ? (
              <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-success/30 bg-success-soft px-3 py-2.5 text-[13px] text-success">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                <span>Segel utuh — setiap revisi cocok dengan segelnya dan tidak ada perubahan di luar aplikasi.</span>
              </div>
            ) : (
              <div className="rounded-[var(--radius-md)] border border-danger/40 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
                <p className="flex items-center gap-2 font-semibold">
                  <ShieldAlert className="size-4 shrink-0" /> Segel tidak utuh — kemungkinan diubah di luar aplikasi
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
                  {muat.data.integritas.masalah.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {muat.data.revisi.length === 0 ? (
              <p className="text-sm text-fg-muted">
                Belum ada revisi. Revisi dicatat setiap kali isian difinalkan, dibuka untuk koreksi, atau dibatalkan.
              </p>
            ) : (
              <ol className="space-y-3">
                {[...muat.data.revisi].reverse().map((r) => (
                  <li key={r.rev} className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-fg">{LABEL_AKSI[r.aksi]}</span>
                      <StatusIsianBadge status={r.status} />
                    </div>
                    <p className="mt-1 text-xs text-fg-muted">
                      {r.olehNama ?? "—"} · {formatDateTime(r.waktu)} · rev {r.rev}
                    </p>
                    {r.alasan && <p className="mt-2 border-l-2 border-border pl-2 text-[13px] text-fg">{r.alasan}</p>}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
