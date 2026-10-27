"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { TagihanRincian } from "./TagihanRincian";
import { formatRupiah } from "@/lib/format";
import type { DasarIgdAsal, TagihanIgd, TagihanRingkas } from "@/server/modules/berkas-klaim/berkas-klaim.types";

/** Cara IGD asal ditemukan — ditampilkan agar petugas tahu dasar penggabungan. */
const DASAR_LABEL: Record<DasarIgdAsal, string> = {
  spri: "tertaut lewat SPRI",
  tagihan: "satu tagihan di SIMRS",
  "spri-tak-tertaut": "SPRI IGD belum tertaut ke NOPEN RI ini",
  waktu: "IGD tepat sebelum masuk RI (tanpa SPRI)",
};

/**
 * Blok "Total Tagihan" di header detail berkas. Menampilkan tagihan episode
 * (RI). Bila episode punya tagihan IGD asal, tampilkan opsi **Gabungkan Tagihan
 * IGD** — saat dicentang, total menjadi RI + IGD dan modal rincian menarik data
 * gabungan (`?igd=1`). Default: TIDAK digabung (opt-in). Bila IGD & RI sudah satu
 * tagihan di SIMRS, opsi diganti keterangan (total sudah termasuk IGD).
 */
export function TagihanPanel({
  nopen,
  tagihan,
  igd,
}: {
  nopen: string;
  tagihan: TagihanRingkas;
  /** Tagihan IGD asal, atau null bila tak ada. */
  igd: TagihanIgd | null;
}) {
  const [gabung, setGabung] = useState(false);
  /** IGD yang BOLEH digabung (belum satu tagihan di SIMRS). */
  const opsi = tagihan.ada && igd && !igd.sudahDigabung ? igd : null;
  const combined = opsi != null && gabung;
  const shownTotal = combined ? tagihan.total + opsi.total : tagihan.total;
  // NOPEN lain di tagihan yang sama selain IGD asal (mis. digabung kasir dari episode lain).
  const lain = tagihan.nopenLain.filter((n) => n !== igd?.nopen);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface-2/40 px-4 py-3">
      <div>
        <div className="text-xs text-fg-muted">
          Total Tagihan{combined || igd?.sudahDigabung ? " (RI + IGD)" : ""}
        </div>
        <div className="text-2xl font-bold text-fg tabular">
          {tagihan.ada ? formatRupiah(shownTotal) : "—"}
        </div>
        {!tagihan.ada && (
          <div className="mt-0.5 text-xs text-fg-subtle">Belum ada tagihan untuk episode ini</div>
        )}
        {combined && (
          <div className="mt-0.5 text-[11px] text-fg-subtle tabular">
            RI {formatRupiah(tagihan.total)} + IGD {formatRupiah(opsi.total)}
          </div>
        )}
        {tagihan.ada && igd?.sudahDigabung && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-fg-muted">
            <Link2 className="size-3 shrink-0" aria-hidden />
            <span>
              Sudah termasuk tagihan IGD NOPEN <span className="font-mono">{igd.nopen}</span> — digabung di SIMRS
            </span>
          </div>
        )}
        {tagihan.ada && lain.length > 0 && (
          <div className="mt-0.5 text-[11px] text-fg-muted">
            Tagihan ini juga mencakup NOPEN <span className="font-mono">{lain.join(", ")}</span> (digabung di SIMRS)
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {opsi && (
          <label className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2">
            <input
              type="checkbox"
              checked={gabung}
              onChange={(e) => setGabung(e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            <span>
              <span className="block">
                Gabungkan Tagihan IGD <span className="text-fg-subtle tabular">({formatRupiah(opsi.total)})</span>
              </span>
              <span className="block text-[11px] font-normal text-fg-muted">
                NOPEN <span className="font-mono">{opsi.nopen}</span> · {DASAR_LABEL[opsi.dasar]}
              </span>
            </span>
          </label>
        )}
        {tagihan.ada && (
          <TagihanRincian
            key={combined ? "gabung" : "ri"}
            nopen={nopen}
            total={shownTotal}
            igd={combined}
          />
        )}
      </div>
    </div>
  );
}
