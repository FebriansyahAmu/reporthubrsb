"use client";

import { useState } from "react";
import Link from "next/link";
import { AlarmClock, ArrowRight, Link2Off, UserRoundPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime, formatRelatif } from "@/lib/format";
import type { KodeForm } from "@/features/form-rm/registry";
import { JAM_PERINGATAN_BELUM_TERTAUT, ringkasSementara, terlaluLamaBelumTertaut } from "@/features/form-rm/sementara";
import type { IsianBelumTertaut } from "@/server/modules/form-rm/isian.types";
import { IdentitasSementaraDialog } from "./IdentitasSementaraDialog";

/**
 * Isian yang dibuat sebelum pasien terdaftar di SIMRS (mis. triase saat tiba),
 * menunggu ditautkan ke pendaftaran. Tombol "Pasien belum terdaftar" membuat
 * isian baru dengan identitas sementara. `sekarang` dari server → render stabil.
 */
export function BelumTertautPanel({
  kode,
  items,
  sekarang,
  bolehBuat,
}: {
  kode: KodeForm;
  items: IsianBelumTertaut[];
  sekarang: string;
  bolehBuat: boolean;
}) {
  const [buat, setBuat] = useState(false);
  const now = new Date(sekarang).getTime();
  const lama = items.filter((it) => terlaluLamaBelumTertaut(it.dibuatAt, now)).length;

  return (
    <Card className="overflow-hidden">
      <section aria-labelledby="belum-tertaut">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <Link2Off className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0">
              <h2 id="belum-tertaut" className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                Belum tertaut
                <span className="tabular text-xs font-normal text-fg-muted">{items.length} isian</span>
                {lama > 0 && (
                  <Badge tone="danger" dot>
                    {lama} lebih dari {JAM_PERINGATAN_BELUM_TERTAUT} jam
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-fg-muted">
                Pasien yang diisi sebelum terdaftar di SIMRS. Setelah pasien didaftarkan, buka isiannya lalu pilih{" "}
                <b className="font-semibold text-fg">Tautkan ke pasien</b>.
              </p>
            </div>
          </div>
          {bolehBuat && (
            <Button size="sm" icon={<UserRoundPlus className="size-4" />} onClick={() => setBuat(true)}>
              Pasien belum terdaftar
            </Button>
          )}
        </header>

        {items.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-fg-muted">Tidak ada isian yang menunggu ditautkan.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((it) => {
              const terlalu = terlaluLamaBelumTertaut(it.dibuatAt, now);
              return (
                <li key={it.id}>
                  <Link
                    href={`/form-rm/isian/${it.id}`}
                    className="group grid grid-cols-1 gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_auto] md:items-center"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-semibold text-fg">{ringkasSementara(it)}</span>
                        {it.milikSaya && <Badge tone="brand">Anda</Badge>}
                      </span>
                      {it.ciri && <span className="line-clamp-2 text-xs text-fg-muted">{it.ciri}</span>}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
                      <span>Dibuat {formatDateTime(it.dibuatAt)}</span>
                      <span className={terlalu ? "inline-flex items-center gap-1 font-semibold text-danger" : ""}>
                        {terlalu && <AlarmClock className="size-3.5" aria-hidden />}
                        {formatRelatif(it.dibuatAt, now)}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-brand md:justify-self-end">
                      Buka
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {buat && <IdentitasSementaraDialog mode={{ jenis: "buat", kode }} onTutup={() => setBuat(false)} />}
    </Card>
  );
}
