"use client";

import { UsersRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  JENIS_KUNJUNGAN,
  KATEGORI,
  KATEGORI_KEYS,
  STATUS_KUNJUNGAN_LABEL,
} from "@/server/modules/audit-rme/kunjungan.constants";
import type { KunjunganCard } from "./audit.client";
import { KelengkapanMeter, MiniPip, fmtWaktu } from "./KunjunganCardView";

/**
 * Mode ringkas papan kunjungan: satu baris per kunjungan (± 1 layar per
 * halaman). Informasi sama dengan kartu, dipadatkan ke tabel.
 */
export function KunjunganRowList({ items }: { items: KunjunganCard[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-190 text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/60 text-left text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
              <th scope="col" className="py-2.5 pr-2 pl-4">Pasien</th>
              <th scope="col" className="px-2 py-2.5">Layanan</th>
              {KATEGORI_KEYS.map((k) => (
                <th key={k} scope="col" className="w-11 px-0.5 py-2.5 text-center" title={KATEGORI[k].label}>
                  {KATEGORI[k].short}
                  {KATEGORI[k].perEpisode && <sup>e</sup>}
                </th>
              ))}
              <th scope="col" className="px-4 py-2.5 text-right">Petugas · Lengkap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((k) => {
              const tone = (k.jenis.id != null ? JENIS_KUNJUNGAN[k.jenis.id]?.tone : undefined) ?? "neutral";
              const wajib = new Set(k.kelengkapan.wajib);
              const batal = k.status === "BATAL";
              return (
                <tr key={k.nomor} className={cn("transition-colors hover:bg-surface-2/50", batal && "bg-danger-soft/20")}>
                  <td className="py-2.5 pr-2 pl-4">
                    <p className={cn("max-w-48 truncate font-medium text-fg", batal && "line-through decoration-danger/60")} title={k.pasien.nama ?? undefined}>
                      {k.pasien.nama ?? "Tanpa nama"}
                    </p>
                    <p className="text-[11px] text-fg-muted">
                      <span className="font-mono">RM {k.norm}</span>
                      {k.pasien.jenisKelamin && <> · {k.pasien.jenisKelamin}</>}
                      {k.pasien.umur != null && <> · {k.pasien.umur} th</>}
                    </p>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={tone} className="px-2">{k.jenis.short}</Badge>
                      <span className="max-w-40 truncate text-xs text-fg" title={k.ruangan.nama}>{k.ruangan.nama}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-fg-muted">
                      {fmtWaktu(k.masuk)}
                      {k.jenis.id === 3 && <> · <span className="font-medium text-accent">Hari ke-{k.hariRawat}</span></>}
                      {k.status !== "SELESAI" && (
                        <> · <span className={batal ? "font-medium text-danger" : "font-medium text-accent"}>{STATUS_KUNJUNGAN_LABEL[k.status]}</span></>
                      )}
                    </p>
                  </td>
                  {KATEGORI_KEYS.map((key) => (
                    <td key={key} className="px-0.5 py-2.5 text-center">
                      <MiniPip kategori={key} stat={k.kategori[key]} wajib={wajib.has(key)} />
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-3">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-fg tabular"
                        title={k.petugas.profesi.length ? k.petugas.profesi.map((p) => `${p.label} ${p.n}`).join(" · ") : "Belum ada input"}
                      >
                        <UsersRound className="size-3.5 text-fg-muted" />
                        {k.petugas.total}
                      </span>
                      <KelengkapanMeter wajib={k.kelengkapan.wajib} terpenuhi={k.kelengkapan.terpenuhi} persen={k.kelengkapan.persen} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
