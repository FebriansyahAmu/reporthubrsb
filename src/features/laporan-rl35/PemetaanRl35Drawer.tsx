"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Info, Route } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select, type SelectGroup } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { apiGet, apiPut, pesanGalat } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import { JK_GAWAT_DARURAT } from "@/server/modules/rl35/rl35.constants";
import type { TujuanPetaRl35 } from "@/server/modules/rl35/rl35.schema";
import type { DaftarPemetaan, KategoriRl35, RuanganPemetaan } from "@/server/modules/rl35/rl35.types";

const URL_PEMETAAN = "/api/laporan/rl35/pemetaan";

/** Nilai Select: "bawaan" (tanpa baris tersimpan) | "kecualikan" | ID jenis kegiatan. */
const pilihanAwal = (r: RuanganPemetaan): string =>
  r.status === "terpetakan" && r.rlId != null ? String(r.rlId) : r.status === "dikecualikan" ? "kecualikan" : "bawaan";
const tujuan = (p: string): TujuanPetaRl35 => (p === "bawaan" ? "kosongkan" : p === "kecualikan" ? "kecualikan" : Number(p));

const KELOMPOK = [
  { judul: "Poliklinik (rawat jalan)", gd: false },
  { judul: "Gawat darurat", gd: true },
] as const;

/**
 * Panel pemetaan poliklinik & ruang IGD → jenis kegiatan RL 3.5 (pengganti
 * `master.rl35_ruangan_revisi` SIMGOS yang kosong). Ruangan tanpa pemetaan
 * tersimpan memakai saran dari nama ruangan (bawaan). Hanya-baca tanpa izin `update`.
 */
export function PemetaanRl35Drawer({
  open,
  onClose,
  bolehUbah,
  onTersimpan,
}: {
  open: boolean;
  onClose: () => void;
  bolehUbah: boolean;
  onTersimpan: () => void;
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Pemetaan ruangan RL 3.5"
      size="lg"
      header={
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
            <Route className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-fg">Pemetaan ruangan RL 3.5</p>
            <p className="text-xs text-fg-muted">Poliklinik & ruang IGD → jenis kegiatan</p>
          </div>
        </div>
      }
    >
      {open && <IsiPemetaan bolehUbah={bolehUbah} onTersimpan={onTersimpan} onClose={onClose} />}
    </Drawer>
  );
}

function IsiPemetaan({ bolehUbah, onTersimpan, onClose }: { bolehUbah: boolean; onTersimpan: () => void; onClose: () => void }) {
  const toast = useToast();
  const { result, loading, error, reload } = useAsyncData<DaftarPemetaan>(() => apiGet(URL_PEMETAAN), []);
  const [tersimpan, setTersimpan] = useState<DaftarPemetaan | null>(null);
  const [draf, setDraf] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState(false);

  const data = tersimpan ?? result;
  const asli = useMemo(() => new Map((data?.ruangan ?? []).map((r) => [r.id, pilihanAwal(r)])), [data]);
  const kategoriById = useMemo(() => new Map((data?.kategori ?? []).map((k) => [k.id, k])), [data]);

  const nilai = (id: string) => draf[id] ?? asli.get(id) ?? "bawaan";
  const ubah = Object.entries(draf).filter(([id, p]) => asli.get(id) !== p);
  // Bawaan yang bisa ditetapkan sekaligus (masih memakai saran, belum diubah di draf).
  const bawaan = (data?.ruangan ?? []).filter((r) => r.status === "bawaan" && r.saran != null && nilai(r.id) === "bawaan");

  async function simpan() {
    if (ubah.length === 0) return;
    setMenyimpan(true);
    try {
      const hasil = await apiPut<DaftarPemetaan>(URL_PEMETAAN, {
        perubahan: ubah.map(([ruanganId, p]) => ({ ruanganId, tujuan: tujuan(p) })),
      });
      setTersimpan(hasil);
      setDraf({});
      toast.success("Pemetaan disimpan", `${ubah.length} perubahan disimpan. Laporan dimuat ulang.`);
      onTersimpan();
    } catch (e) {
      toast.error("Pemetaan gagal disimpan", pesanGalat(e));
    } finally {
      setMenyimpan(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-3 p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-[var(--radius-md)]" />
        ))}
      </div>
    );
  }
  if (error || !data) return <ErrorState onRetry={reload} />;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-4 p-5">
        <div className="flex gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface-2/60 px-3.5 py-3 text-xs leading-relaxed text-fg-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          <p>
            Kunjungan tiap ruangan dijumlahkan ke jenis kegiatan yang dipilih. Ruangan yang belum ditetapkan memakai{" "}
            <strong className="font-semibold text-fg">bawaan</strong> dari nama ruangan (ruang IGD selalu Rawat Darurat). Pilih{" "}
            <strong className="font-semibold text-fg">Tidak dilaporkan</strong> bila ruangan memang tidak dihitung. Kunjungan
            Kesehatan Anak / Obgyn / Bedah Saraf / Saraf yang berdiagnosis neonatal / kehamilan / stroke tetap dipindah otomatis
            ke baris khususnya. Perubahan berlaku untuk semua periode dan tercatat di audit.
          </p>
        </div>

        {!bolehUbah && (
          <p className="text-xs text-fg-subtle">Anda hanya dapat melihat pemetaan. Perubahan butuh izin Pemetaan Laporan RL (ubah).</p>
        )}

        {data.ruangan.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">Tidak ada poliklinik atau ruang IGD di SIMGOS.</p>
        ) : (
          KELOMPOK.map(({ judul, gd }) => {
            const daftar = data.ruangan.filter((r) => (r.jenisKunjungan === JK_GAWAT_DARURAT) === gd);
            if (daftar.length === 0) return null;
            return (
              <section key={judul} aria-label={judul} className="space-y-2">
                <h3 className="text-xs font-semibold text-fg-muted">
                  {judul} <span className="font-normal text-fg-subtle">· {daftar.length} ruangan</span>
                </h3>
                <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
                  {daftar.map((r) => {
                    const p = nilai(r.id);
                    const berubah = draf[r.id] !== undefined && asli.get(r.id) !== p;
                    const saran = r.saran != null ? kategoriById.get(r.saran) : undefined;
                    return (
                      <li
                        key={r.id}
                        data-ruangan={r.id}
                        className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center", berubah && "bg-brand-soft/40")}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-fg">
                            {r.nama}
                            {!r.aktif && <span className="ml-1.5 text-xs font-normal text-fg-subtle">(nonaktif)</span>}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-subtle">
                            <span className="font-mono">{r.id}</span>
                            {r.status === "terpetakan" && r.diubahOleh && r.diubahAt && (
                              <span>· ditetapkan {r.diubahOleh}, {formatDateTime(r.diubahAt)}</span>
                            )}
                            {r.status === "dikecualikan" && r.diubahOleh && r.diubahAt && (
                              <span>· dikecualikan {r.diubahOleh}, {formatDateTime(r.diubahAt)}</span>
                            )}
                            {r.status === "bawaan" && !berubah && <Badge className="px-2 py-0 text-[11px]">Bawaan</Badge>}
                            {r.status === "belum" && !berubah && (
                              <Badge tone="warning" dot className="px-2 py-0 text-[11px]">
                                Belum dipetakan
                              </Badge>
                            )}
                          </p>
                        </div>
                        <div className="w-full sm:w-64">
                          <Select
                            value={p}
                            options={opsi(data.kategori, saran)}
                            disabled={!bolehUbah || menyimpan}
                            onChange={(v) => setDraf((d) => ({ ...d, [r.id]: v }))}
                            invalid={p === "bawaan" && !saran}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>

      {bolehUbah && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-surface px-5 py-3">
          <p className="mr-auto text-xs text-fg-muted tabular">
            {ubah.length > 0 ? `${ubah.length} perubahan belum disimpan` : "Tidak ada perubahan"}
          </p>
          {bawaan.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              icon={<CheckCheck className="size-4" />}
              disabled={menyimpan}
              onClick={() => setDraf((d) => ({ ...d, ...Object.fromEntries(bawaan.map((r) => [r.id, String(r.saran)])) }))}
            >
              Tetapkan semua bawaan ({bawaan.length})
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            disabled={menyimpan}
            onClick={() => {
              if (ubah.length === 0) return onClose();
              setDraf({});
            }}
          >
            {ubah.length > 0 ? "Batalkan perubahan" : "Tutup"}
          </Button>
          <Button size="sm" loading={menyimpan} disabled={ubah.length === 0} onClick={simpan}>
            Simpan pemetaan
          </Button>
        </div>
      )}
    </div>
  );
}

function opsi(kategori: KategoriRl35[], saran: KategoriRl35 | undefined): SelectGroup[] {
  return [
    {
      label: "",
      options: [
        { value: "bawaan", label: saran ? `Bawaan: ${saran.kode}. ${saran.deskripsi}` : "Belum dipetakan" },
        { value: "kecualikan", label: "Tidak dilaporkan" },
      ],
    },
    { label: "Jenis kegiatan RL 3.5", options: kategori.map((k) => ({ value: String(k.id), label: `${k.kode}. ${k.deskripsi}` })) },
  ];
}
