"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CircleAlert, DatabaseZap, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { apiGet, pesanGalat } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { BandingSimrs, KolomBanding } from "@/server/modules/form-rm/isian.types";
import { formatNilaiIsian } from "./TandaAsal";
import type { KendaliIsian } from "./useIsian";

type Muat = { tahap: "muat" } | { tahap: "galat"; pesan: string } | { tahap: "siap"; banding: BandingSimrs };

const bisaDipilih = (k: KolomBanding) => k.status === "ada" && !k.sama;

/**
 * "Muat ulang dari SIMRS" (PRD Â§6.4 butir 3): perbandingan nilai isian dengan
 * nilai SIMRS terkini per bagian; petugas memilih kolom yang diganti. Nilai
 * yang diterapkan diambil ulang di server, bukan dikirim dari sini.
 * Dibuka hanya setelah perubahan di layar tersimpan (lihat IsianFrame).
 */
export function MuatUlangSimrs<T>({ kendali: k, onTutup }: { kendali: KendaliIsian<T>; onTutup: () => void }) {
  const toast = useToast();
  const [muat, setMuat] = useState<Muat>({ tahap: "muat" });
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [coba, setCoba] = useState(0);
  const id = k.isian.id;

  useEffect(() => {
    let aktif = true;
    apiGet<BandingSimrs>(`/api/form-rm/isian/${id}/simrs`)
      .then((banding) => {
        if (!aktif) return;
        setMuat({ tahap: "siap", banding });
        setPilih(new Set(banding.bagian.flatMap((b) => b.kolom.filter(bisaDipilih).map((x) => x.path))));
      })
      .catch((e: unknown) => aktif && setMuat({ tahap: "galat", pesan: pesanGalat(e) }));
    return () => {
      aktif = false;
    };
  }, [id, coba]);

  const sibuk = k.sibuk === "simrs";
  const ubah = (paths: string[], aktif: boolean) =>
    setPilih((s) => {
      const baru = new Set(s);
      for (const p of paths) {
        if (aktif) baru.add(p);
        else baru.delete(p);
      }
      return baru;
    });

  async function terapkan() {
    const diterapkan = await k.terapkanSimrs([...pilih]);
    if (!diterapkan) return;
    toast.success(`${diterapkan.length} kolom diperbarui dari SIMRS`);
    onTutup();
  }

  const banding = muat.tahap === "siap" ? muat.banding : null;
  const igd = banding?.bagian.flatMap((b) => b.kolom).find((x) => x.episodeIgd)?.episodeIgd;

  return (
    <Modal
      open
      onClose={onTutup}
      dismissible={!sibuk}
      size="lg"
      title="Muat ulang dari SIMRS"
      description="Bandingkan isian dengan data SIMRS saat ini, lalu pilih kolom yang ingin diganti."
      icon={<DatabaseZap className="mt-0.5 size-4 text-brand" />}
      footer={
        <>
          <Button variant="secondary" onClick={onTutup} disabled={sibuk}>
            Batal
          </Button>
          <Button onClick={terapkan} loading={sibuk} disabled={pilih.size === 0 || !banding}>
            Ganti {pilih.size > 0 ? `${pilih.size} kolom` : "kolom"}
          </Button>
        </>
      }
    >
      <div className="max-h-[min(62vh,36rem)] space-y-4 overflow-y-auto pr-1">
        {muat.tahap === "muat" && <p className="py-6 text-center text-sm text-fg-muted">Membaca data SIMRSâ€¦</p>}
        {muat.tahap === "galat" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            <span>{muat.pesan}</span>
            <Button
              size="sm"
              variant="secondary"
              icon={<RotateCw className="size-4" />}
              onClick={() => {
                setMuat({ tahap: "muat" });
                setCoba((c) => c + 1);
              }}
            >
              Coba lagi
            </Button>
          </div>
        )}
        {banding && (
          <>
            {igd && (
              <p className="rounded-[var(--radius-md)] border border-border bg-surface-2/60 px-3 py-2 text-xs text-fg-muted">
                Episode ini rawat inap; data asesmen diambil dari episode IGD asal <b className="font-mono text-fg">{igd}</b>.
              </p>
            )}
            {banding.bagian.map((b) => (
              <BagianBanding key={b.id} judul={b.judul} kolom={b.kolom} pilih={pilih} onUbah={ubah} terkunci={sibuk} />
            ))}
          </>
        )}
        {k.galat && !k.galat.konflik && <p className="text-xs text-danger">{k.galat.pesan}</p>}
      </div>
    </Modal>
  );
}

function BagianBanding({
  judul,
  kolom,
  pilih,
  onUbah,
  terkunci,
}: {
  judul: string;
  kolom: KolomBanding[];
  pilih: Set<string>;
  onUbah: (paths: string[], aktif: boolean) => void;
  terkunci: boolean;
}) {
  const ada = kolom.filter((x) => x.status === "ada");
  const kosong = kolom.filter((x) => x.status === "kosong");
  const gagal = kolom.filter((x) => x.status === "gagal");
  const pilihan = ada.filter((x) => !x.sama).map((x) => x.path);
  const semua = pilihan.length > 0 && pilihan.every((p) => pilih.has(p));

  return (
    <section aria-label={judul} className="rounded-[var(--radius-md)] border border-border">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-2/40 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{judul}</h3>
        {pilihan.length > 0 && (
          <label className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
            <input
              type="checkbox"
              checked={semua}
              disabled={terkunci}
              onChange={(e) => onUbah(pilihan, e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            Pilih yang berbeda
          </label>
        )}
      </header>
      <ul className="divide-y divide-border">
        {ada.map((x) => (
          <li key={x.path} className={cn("px-3 py-2", x.sama && "text-fg-subtle")}>
            <label className={cn("flex items-start gap-2.5", x.sama ? "cursor-default" : "cursor-pointer")}>
              <input
                type="checkbox"
                checked={pilih.has(x.path)}
                disabled={x.sama || terkunci}
                onChange={(e) => onUbah([x.path], e.target.checked)}
                aria-label={`Ganti ${x.label} dengan data SIMRS`}
                className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="text-[13px] font-medium text-fg">{x.label}</span>
                  {x.sama && <span className="text-[11px]">sudah sama</span>}
                </span>
                {!x.sama && (
                  <span className="mt-0.5 grid grid-cols-1 items-center gap-x-2 gap-y-0.5 text-[13px] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                    <span className="break-words text-fg-muted line-through decoration-fg-subtle/60">
                      {formatNilaiIsian(x.sekarang)}
                    </span>
                    <ArrowRight className="hidden size-3.5 text-fg-subtle sm:block" aria-hidden />
                    <span className="break-words font-medium text-fg">
                      <span className="sr-only">Data SIMRS: </span>
                      {formatNilaiIsian(x.simrs)}
                    </span>
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {(kosong.length > 0 || gagal.length > 0) && (
        <div className="space-y-1 border-t border-border px-3 py-2 text-xs text-fg-subtle">
          {ada.length === 0 && gagal.length === 0 && <p>Tidak ada data SIMRS untuk bagian ini.</p>}
          {kosong.length > 0 && ada.length > 0 && (
            <p>Tanpa nilai SIMRS yang cocok dengan pilihan formulir: {kosong.map((x) => x.label).join(", ")}.</p>
          )}
          {gagal.length > 0 && (
            <p className="inline-flex items-center gap-1.5 text-warning">
              <CircleAlert className="size-3.5" aria-hidden />
              Data SIMRS gagal dibaca: {gagal.map((x) => x.label).join(", ")}. Coba lagi nanti.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
