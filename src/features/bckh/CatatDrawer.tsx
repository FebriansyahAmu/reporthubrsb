"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CopyPlus, Plus, Trash2, X } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input, Label } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { ApiError, apiDelete, apiGet, apiPut, pesanGalat } from "@/lib/api-client";
import { kunciUraian, tambahHari, tanggalPanjang, tanggalPalingAwal } from "@/server/modules/bckh/bckh.aturan";
import {
  INFO_KATEGORI,
  KATEGORI,
  LABEL_STATUS,
  MAKS_KEGIATAN_PER_HARI,
  MAKS_KETERANGAN,
  MAKS_URAIAN,
  STATUS_BEKERJA,
  STATUS_HARI,
  TEKS_LAPORAN_STATUS,
  saranKategori,
  type Kategori,
  type StatusHari,
  type Target,
} from "@/server/modules/bckh/bckh.constants";
import type { HariDto, KegiatanRutin } from "@/server/modules/bckh/bckh.types";
import { TitikKategori } from "./ui";

type Butir = { kunci: string; id: string | null; uraian: string; kategori: Kategori; target: Target; kategoriManual: boolean };

let urutKunci = 0;
const kunciBaru = () => `b${++urutKunci}`;
const butirDari = (k: { id?: string | null; uraian: string; kategori: Kategori; target: Target }, pakaiId: boolean): Butir => ({
  kunci: kunciBaru(),
  id: pakaiId ? (k.id ?? null) : null,
  uraian: k.uraian,
  kategori: k.kategori,
  target: k.target,
  kategoriManual: true,
});
const butirKosong = (): Butir => ({ kunci: kunciBaru(), id: null, uraian: "", kategori: "tugas-pokok", target: "SELESAI", kategoriManual: false });

type Isian = { status: StatusHari; keterangan: string; butir: Butir[] };
const sidik = (i: Isian) =>
  JSON.stringify([i.status, i.keterangan.trim(), STATUS_BEKERJA.has(i.status) ? i.butir.filter((b) => b.uraian.trim()).map((b) => [b.id, b.uraian.trim(), b.kategori, b.target]) : []]);

/**
 * Panel "Catat kegiatan" (drawer kanan; layar penuh di ponsel). Satu simpan =
 * satu entri log pengisian. Konflik versi (409) → muat ulang catatan.
 */
export function CatatDrawer({
  open,
  tanggalAwal,
  tambahanAwal,
  hariIni,
  rutin,
  onClose,
  onTersimpan,
}: {
  open: boolean;
  tanggalAwal: string;
  /** Kegiatan yang langsung ditambahkan saat dibuka (klik kartu kegiatan rutin). */
  tambahanAwal?: KegiatanRutin | null;
  hariIni: string;
  rutin: KegiatanRutin[];
  onClose: () => void;
  onTersimpan: (tanggal: string) => void;
}) {
  const toast = useToast();
  const idDaftar = useId();
  const [tanggal, setTanggal] = useState(tanggalAwal);
  const [muat, setMuat] = useState(false);
  const [lama, setLama] = useState<HariDto | null>(null);
  const [isian, setIsian] = useState<Isian>({ status: "MASUK", keterangan: "", butir: [butirKosong()] });
  const [awal, setAwal] = useState("");
  const [sumberSalin, setSumberSalin] = useState<HariDto | null>(null);
  const [riwayat, setRiwayat] = useState<string[]>([]);
  const [simpan, setSimpan] = useState(false);
  const [yakinHapus, setYakinHapus] = useState(false);
  const fokusBaruRef = useRef<string | null>(null);
  const batasAwal = tanggalPalingAwal(hariIni);

  const isiDari = useCallback((h: HariDto | null, tambahan?: KegiatanRutin | null) => {
    const butir = h?.kegiatan.length ? h.kegiatan.map((k) => butirDari(k, true)) : [];
    const baru: Isian = { status: h?.status ?? "MASUK", keterangan: h?.keterangan ?? "", butir: butir.length ? butir : [butirKosong()] };
    setAwal(sidik(baru));
    if (tambahan && !baru.butir.some((b) => kunciUraian(b.uraian) === kunciUraian(tambahan.uraian))) {
      const kosong = baru.butir.length === 1 && !baru.butir[0].uraian;
      baru.butir = [...(kosong ? [] : baru.butir), butirDari({ ...tambahan, target: "SELESAI" }, false)];
    }
    setIsian(baru);
  }, []);

  // Muat catatan tanggal terpilih + 31 hari sebelumnya (salin & saran uraian).
  const muatTanggal = useCallback(
    async (t: string, tambahan?: KegiatanRutin | null) => {
      setMuat(true);
      setYakinHapus(false);
      try {
        const [h, sebelum] = await Promise.all([
          apiGet<HariDto | null>(`/api/bckh/hari/${t}`),
          apiGet<HariDto[]>(`/api/bckh/hari?${new URLSearchParams({ dari: tambahHari(t, -31), sampai: tambahHari(t, -1) })}`),
        ]);
        setLama(h);
        isiDari(h, tambahan);
        const dulu = sebelum.filter((x) => x.tanggal < t);
        setSumberSalin([...dulu].reverse().find((x) => x.kegiatan.length > 0) ?? null);
        setRiwayat([...new Map(dulu.flatMap((x) => x.kegiatan).map((k) => [kunciUraian(k.uraian), k.uraian])).values()]);
      } catch (e) {
        toast.error("Gagal memuat catatan", pesanGalat(e));
      } finally {
        setMuat(false);
      }
    },
    [isiDari, toast],
  );

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron tanggal saat panel dibuka
    setTanggal(tanggalAwal);
    void muatTanggal(tanggalAwal, tambahanAwal);
  }, [open, tanggalAwal, tambahanAwal, muatTanggal]);

  useEffect(() => {
    const k = fokusBaruRef.current;
    if (!k) return;
    fokusBaruRef.current = null;
    document.querySelector<HTMLInputElement>(`[data-butir="${k}"]`)?.focus();
  });

  const kotor = sidik(isian) !== awal;
  const bekerja = STATUS_BEKERJA.has(isian.status);
  const terisi = isian.butir.filter((b) => b.uraian.trim());
  const saran = useMemo(() => [...new Set([...rutin.map((r) => r.uraian), ...riwayat])].slice(0, 40), [rutin, riwayat]);

  const ubahButir = (kunci: string, ubah: Partial<Butir>) =>
    setIsian((s) => ({
      ...s,
      butir: s.butir.map((b) => {
        if (b.kunci !== kunci) return b;
        const baru = { ...b, ...ubah };
        if (ubah.uraian !== undefined && !b.kategoriManual) baru.kategori = saranKategori(ubah.uraian);
        return baru;
      }),
    }));

  const tambah = (k?: { uraian: string; kategori: Kategori }) => {
    if (isian.butir.length >= MAKS_KEGIATAN_PER_HARI) return;
    if (k && isian.butir.some((b) => kunciUraian(b.uraian) === kunciUraian(k.uraian))) return;
    const b = k ? butirDari({ ...k, target: "SELESAI" }, false) : butirKosong();
    if (!k) fokusBaruRef.current = b.kunci;
    setIsian((s) => {
      const kosong = s.butir.length === 1 && !s.butir[0].uraian.trim() && !s.butir[0].id;
      return { ...s, butir: [...(kosong && k ? [] : s.butir), b] };
    });
  };

  const salin = () => {
    if (!sumberSalin) return;
    setIsian((s) => {
      const ada = new Set(s.butir.filter((b) => b.uraian.trim()).map((b) => kunciUraian(b.uraian)));
      const baru = sumberSalin.kegiatan.filter((k) => !ada.has(kunciUraian(k.uraian))).map((k) => butirDari(k, false));
      const tetap = s.butir.filter((b) => b.uraian.trim() || b.id);
      return { ...s, status: STATUS_BEKERJA.has(s.status) ? s.status : "MASUK", butir: [...tetap, ...baru].slice(0, MAKS_KEGIATAN_PER_HARI) };
    });
  };

  const geser = (i: number, arah: -1 | 1) =>
    setIsian((s) => {
      const b = [...s.butir];
      const j = i + arah;
      if (j < 0 || j >= b.length) return s;
      [b[i], b[j]] = [b[j], b[i]];
      return { ...s, butir: b };
    });

  const hapusButir = (kunci: string) =>
    setIsian((s) => {
      const b = s.butir.filter((x) => x.kunci !== kunci);
      return { ...s, butir: b.length ? b : [butirKosong()] };
    });

  const tutup = () => {
    if (kotor && !window.confirm("Perubahan belum disimpan. Tutup tanpa menyimpan?")) return;
    onClose();
  };

  const gantiTanggal = (t: string) => {
    if (!t || t === tanggal) return;
    if (kotor && !window.confirm("Perubahan belum disimpan. Pindah tanggal tanpa menyimpan?")) return;
    setTanggal(t);
    void muatTanggal(t);
  };

  const konflik = async (e: unknown) => {
    toast.error("Catatan tidak tersimpan", pesanGalat(e));
    if (e instanceof ApiError && e.status === 409) await muatTanggal(tanggal);
  };

  const kirim = async () => {
    if (simpan || muat) return;
    if (isian.status === "MASUK" && terisi.length === 0) {
      toast.warning("Tambahkan minimal satu kegiatan", "Hari masuk wajib berisi kegiatan. Pilih status lain bila tidak bekerja.");
      return;
    }
    setSimpan(true);
    try {
      await apiPut<HariDto>(`/api/bckh/hari/${tanggal}`, {
        status: isian.status,
        keterangan: isian.keterangan,
        kegiatan: bekerja ? terisi.map((b) => ({ id: b.id, uraian: b.uraian, kategori: b.kategori, target: b.target })) : [],
        versi: lama?.versi ?? null,
      });
      toast.success(lama ? "Catatan diperbarui" : "Catatan tersimpan", tanggalPanjang(tanggal));
      onTersimpan(tanggal);
    } catch (e) {
      await konflik(e);
    } finally {
      setSimpan(false);
    }
  };

  const hapus = async () => {
    if (!lama) return;
    setSimpan(true);
    try {
      await apiDelete(`/api/bckh/hari/${tanggal}?${new URLSearchParams({ versi: lama.versi })}`);
      toast.success("Catatan dihapus", tanggalPanjang(tanggal));
      onTersimpan(tanggal);
    } catch (e) {
      await konflik(e);
    } finally {
      setSimpan(false);
      setYakinHapus(false);
    }
  };

  const akanHilang = !bekerja ? (lama?.kegiatan.length ?? 0) : 0;

  return (
    <Drawer
      open={open}
      onClose={tutup}
      title={lama ? "Ubah catatan kegiatan" : "Catat kegiatan"}
      size="md"
      header={
        <div>
          <p className="text-sm font-semibold text-fg">{lama ? "Ubah catatan kegiatan" : "Catat kegiatan"}</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {tanggalPanjang(tanggal)}
            {lama && <> · dicatat {new Date(lama.dibuat).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</>}
          </p>
        </div>
      }
    >
      <form
        className="flex min-h-full flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void kirim();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void kirim();
          }
        }}
      >
        <fieldset disabled={muat || simpan} className="flex-1 space-y-6 px-5 py-5">
          <div>
            <Label htmlFor="bckh-tanggal">Tanggal</Label>
            <DatePicker id="bckh-tanggal" value={tanggal} onChange={gantiTanggal} min={batasAwal} max={hariIni} clearable={false} />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-fg-muted" id="bckh-status-label">
              Status hari
            </p>
            <div role="radiogroup" aria-labelledby="bckh-status-label" className="flex flex-wrap gap-1.5">
              {STATUS_HARI.map((s) => {
                const pilih = isian.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={pilih}
                    onClick={() => setIsian((x) => ({ ...x, status: s }))}
                    className={cn(
                      "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                      pilih ? "border-fg bg-fg text-white" : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
                    )}
                  >
                    {LABEL_STATUS[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {bekerja ? (
            <div>
              <div className="mb-2 flex items-end justify-between gap-3">
                <p className="text-xs font-medium text-fg-muted">
                  Kegiatan <span className="tabular text-fg-subtle">({terisi.length}/{MAKS_KEGIATAN_PER_HARI})</span>
                </p>
                {sumberSalin && (
                  <button
                    type="button"
                    onClick={salin}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                  >
                    <CopyPlus className="size-3.5" aria-hidden />
                    Salin dari {tanggalPanjang(sumberSalin.tanggal).split(",")[0]}, {Number(sumberSalin.tanggal.slice(8))}/{Number(sumberSalin.tanggal.slice(5, 7))}
                  </button>
                )}
              </div>

              <ol className="space-y-2">
                {isian.butir.map((b, i) => (
                  <li key={b.kunci} className="rounded-[var(--radius-md)] border border-border bg-surface p-2.5 shadow-xs">
                    <div className="flex items-start gap-2">
                      <span className="mt-2.5 w-5 shrink-0 text-right text-xs tabular text-fg-subtle">{i + 1}.</span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <Input
                          data-butir={b.kunci}
                          value={b.uraian}
                          maxLength={MAKS_URAIAN}
                          list={idDaftar}
                          placeholder="Uraian kegiatan, mis. Monitoring status jaringan"
                          aria-label={`Uraian kegiatan ${i + 1}`}
                          onChange={(e) => ubahButir(b.kunci, { uraian: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                              e.preventDefault();
                              if (b.uraian.trim()) tambah();
                            }
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="relative inline-flex min-w-0 items-center">
                            <span className="sr-only">Kategori kegiatan {i + 1}</span>
                            <TitikKategori kategori={b.kategori} className="pointer-events-none absolute left-2.5" />
                            <select
                              value={b.kategori}
                              onChange={(e) => ubahButir(b.kunci, { kategori: e.target.value as Kategori, kategoriManual: true })}
                              className="h-8 max-w-[14rem] cursor-pointer appearance-none truncate rounded-full border border-border bg-surface pl-7 pr-3 text-xs font-medium text-fg transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                            >
                              {KATEGORI.map((k) => (
                                <option key={k} value={k}>
                                  {INFO_KATEGORI[k].label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div role="radiogroup" aria-label={`Target kegiatan ${i + 1}`} className="inline-flex rounded-full border border-border p-0.5">
                            {(["SELESAI", "PROSES"] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                role="radio"
                                aria-checked={b.target === t}
                                onClick={() => ubahButir(b.kunci, { target: t })}
                                className={cn(
                                  "h-7 rounded-full px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                                  b.target === t ? (t === "SELESAI" ? "bg-success-soft text-success" : "bg-warning-soft text-warning") : "text-fg-subtle hover:text-fg",
                                )}
                              >
                                {t === "SELESAI" ? "Selesai" : "Proses"}
                              </button>
                            ))}
                          </div>
                          <div className="ml-auto flex items-center">
                            <IkonTombol label={`Naikkan kegiatan ${i + 1}`} onClick={() => geser(i, -1)} disabled={i === 0}>
                              <ArrowUp className="size-3.5" />
                            </IkonTombol>
                            <IkonTombol label={`Turunkan kegiatan ${i + 1}`} onClick={() => geser(i, 1)} disabled={i === isian.butir.length - 1}>
                              <ArrowDown className="size-3.5" />
                            </IkonTombol>
                            <IkonTombol label={`Hapus kegiatan ${i + 1}`} onClick={() => hapusButir(b.kunci)} bahaya>
                              <X className="size-3.5" />
                            </IkonTombol>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <datalist id={idDaftar}>
                {saran.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>

              <Button type="button" variant="ghost" size="sm" className="mt-2" icon={<Plus className="size-4" />} onClick={() => tambah()} disabled={isian.butir.length >= MAKS_KEGIATAN_PER_HARI}>
                Tambah kegiatan
              </Button>

              {rutin.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-medium text-fg-muted">Kegiatan rutin — klik untuk menambahkan</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rutin.map((r) => {
                      const ada = isian.butir.some((b) => kunciUraian(b.uraian) === kunciUraian(r.uraian));
                      return (
                        <button
                          key={r.uraian}
                          type="button"
                          disabled={ada}
                          onClick={() => tambah(r)}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-fg transition-colors hover:border-border-strong hover:bg-surface-2 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                        >
                          <TitikKategori kategori={r.kategori} className="size-2" />
                          <span className="truncate">{r.uraian}</span>
                          {!ada && <Plus className="size-3 shrink-0 text-fg-subtle" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-surface-2/50 px-4 py-3 text-sm text-fg-muted">
              Hari ini dicatat sebagai <b className="font-semibold text-fg">{LABEL_STATUS[isian.status]}</b> — tanpa kegiatan. Di laporan tercetak
              &quot;{TEKS_LAPORAN_STATUS[isian.status]}&quot;.
              {akanHilang > 0 && <span className="mt-1 block text-warning">{akanHilang} kegiatan tersimpan akan dihapus saat disimpan.</span>}
            </p>
          )}

          <div>
            <Label htmlFor="bckh-ket">Keterangan (kolom KET laporan, opsional)</Label>
            <Input
              id="bckh-ket"
              value={isian.keterangan}
              maxLength={MAKS_KETERANGAN}
              placeholder={bekerja ? "Kosongkan bila tidak ada" : `Bawaan: ${LABEL_STATUS[isian.status].toUpperCase()}`}
              onChange={(e) => setIsian((s) => ({ ...s, keterangan: e.target.value }))}
            />
          </div>
        </fieldset>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-surface px-5 py-3">
          {lama &&
            (yakinHapus ? (
              <>
                <Button type="button" variant="danger" size="sm" onClick={() => void hapus()} loading={simpan}>
                  Ya, hapus catatan
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setYakinHapus(false)}>
                  Batal
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="text-danger hover:text-danger" icon={<Trash2 className="size-4" />} onClick={() => setYakinHapus(true)} disabled={simpan || muat}>
                Hapus
              </Button>
            ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[11px] text-fg-subtle sm:inline">Ctrl + Enter</span>
            <Button type="button" variant="secondary" size="sm" onClick={tutup}>
              Tutup
            </Button>
            <Button type="submit" size="sm" loading={simpan} disabled={muat || (!kotor && !!lama)}>
              {lama ? "Simpan perubahan" : "Simpan catatan"}
            </Button>
          </div>
        </div>
      </form>
    </Drawer>
  );
}

function IkonTombol({ label, onClick, disabled, bahaya, children }: { label: string; onClick: () => void; disabled?: boolean; bahaya?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-7 place-items-center rounded-[var(--radius-sm)] text-fg-subtle transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        bahaya ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
