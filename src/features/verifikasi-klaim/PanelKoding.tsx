"use client";

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  CornerUpLeft,
  FileCheck,
  Hourglass,
  Info,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelatif } from "@/lib/format";
import {
  hitungPerubahan,
  konteksKoding,
  kunciPerubahan,
  masalahUsulan,
  setDariUsulan,
  setKlaim,
  sisaPerubahan,
  usulanDariSet,
  usulanSama,
} from "@/server/modules/verifikasi-klaim/koding.rules";
import { BATAS, type AksiTahap2 } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { PREFIKS_KODING } from "@/server/modules/verifikasi-klaim/verifikasi.rules";
import type {
  DxKlaim,
  IcdInfo,
  JejakBukti,
  KoreksiItem,
  PetaIcd,
  RuangKerjaKlaim,
  UsulanKoding,
} from "@/server/modules/verifikasi-klaim/verifikasi.types";
import { IcdCombobox, TandaIcd } from "./IcdCombobox";
import { HasilIcon } from "./status-ui";

export type KirimKoding = (body: {
  aksi: AksiTahap2;
  versi: number | null;
  catatan?: string;
  usulan?: UsulanKoding;
}) => Promise<boolean>;

const GRID = "sm:grid-cols-[minmax(0,1fr)_8.5rem_14rem]";

/**
 * Tab Koding (Tahap 2, PRD §6.3-2): koding SIMRS sekarang vs usulan coder per
 * kode, peringatan aturan INA-CBG langsung (katalog yang sama dengan server),
 * lalu Ajukan koreksi / Loloskan klaim / Kembalikan ke Tahap 1. Usulan TIDAK
 * ditulis ke SIMRS — diterapkan petugas di SIMRS dan terdeteksi otomatis.
 * State form di-reset lewat `key` induk setiap kali versi berkas berubah.
 */
export function PanelKoding({
  data,
  kirim,
  mengirim,
}: {
  data: RuangKerjaKlaim;
  kirim: KirimKoding;
  mengirim: boolean;
}) {
  const s = data.snapshot;
  const { izin } = data;
  const [now] = useState(() => Date.now());
  const simrs = useMemo(() => setKlaim(s.fakta.koding), [s]);
  const aktif = data.koreksi.find((k) => k.status === "MENUNGGU_SIMRS") ?? null;
  const terakhir = data.koreksi[0] ?? null;
  const bisaEdit = izin.ajukanKoreksi;
  const bisaMemutus = izin.ajukanKoreksi || izin.loloskanKlaim || izin.kembalikan;

  // Titik awal editor: usulan yang sedang menunggu, atau koding SIMRS yang dirapikan.
  const awal = useMemo(
    () => data.koreksi.find((k) => k.status === "MENUNGGU_SIMRS")?.usulan ?? usulanDariSet(simrs),
    [data.koreksi, simrs],
  );
  const [usulan, setUsulan] = useState<UsulanKoding>(awal);
  const [icdBaru, setIcdBaru] = useState<PetaIcd>({ "10": {}, "9": {} });
  const [catatan, setCatatan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [aksiKirim, setAksiKirim] = useState<AksiTahap2 | null>(null);
  const catatanRef = useRef<HTMLTextAreaElement>(null);
  const diubah = !usulanSama(usulan, awal);

  const icd: PetaIcd = useMemo(
    () => ({ "10": { ...data.icd["10"], ...icdBaru["10"] }, "9": { ...data.icd["9"], ...icdBaru["9"] } }),
    [data.icd, icdBaru],
  );
  const perubahan = useMemo(() => hitungPerubahan(simrs, usulan), [simrs, usulan]);
  const masalah = useMemo(() => masalahUsulan(konteksKoding(s, icd, setDariUsulan(usulan))), [s, icd, usulan]);
  const sisa = useMemo(() => (aktif ? sisaPerubahan(simrs, aktif.usulan) : null), [aktif, simrs]);
  const samaDenganAktif = !!aktif && usulanSama(aktif.usulan, usulan);
  const perluAlasanLolos = data.cekKoding.gagal > 0 || !!aktif;
  const tlKoding = data.tindakLanjut.filter((t) => t.status === "OPEN" && t.aturan.startsWith(PREFIKS_KODING));

  /* ------------------------------------------------------------- mutasi */

  const kodeUsulanDx = new Set(usulan.diagnosa.map((d) => d.kode));
  const kodeUsulanPx = new Set(usulan.prosedur.map((p) => p.kode));

  const ubah = (f: (u: UsulanKoding) => UsulanKoding) => {
    setGalat(null);
    setUsulan(f);
  };
  const jadikan = (kode: string, utama: boolean) =>
    ubah((u) => ({
      ...u,
      diagnosa: u.diagnosa.map((d) => (d.kode === kode ? { ...d, utama } : utama ? { ...d, utama: false } : d)),
    }));
  const hapusDx = (kode: string) => ubah((u) => ({ ...u, diagnosa: u.diagnosa.filter((d) => d.kode !== kode) }));
  const pulihkanDx = (d: DxKlaim) =>
    ubah((u) => ({
      ...u,
      diagnosa: [...u.diagnosa, { kode: d.kode, utama: d.primer && !u.diagnosa.some((x) => x.utama) }],
    }));
  const tambahDx = (info: IcdInfo) => {
    setIcdBaru((p) => ({ ...p, "10": { ...p["10"], [info.kode]: info } }));
    ubah((u) => ({ ...u, diagnosa: [...u.diagnosa, { kode: info.kode, utama: !u.diagnosa.some((d) => d.utama) }] }));
  };
  const aturPx = (kode: string, ikut: boolean) =>
    ubah((u) => ({
      ...u,
      prosedur: ikut ? [...u.prosedur.filter((p) => p.kode !== kode), { kode }] : u.prosedur.filter((p) => p.kode !== kode),
    }));
  const tambahPx = (info: IcdInfo) => {
    setIcdBaru((p) => ({ ...p, "9": { ...p["9"], [info.kode]: info } }));
    aturPx(info.kode, true);
  };
  const reset = () => {
    setGalat(null);
    setUsulan(awal);
  };

  /* ---------------------------------------------------------- keputusan */

  async function kirimAksi(body: Parameters<KirimKoding>[0]) {
    setAksiKirim(body.aksi);
    try {
      await kirim(body);
    } finally {
      setAksiKirim(null);
    }
  }

  async function ajukan() {
    if (!izin.ajukanKoreksi || mengirim) return;
    if (masalah.length) return setGalat(`Usulan belum sesuai aturan INA-CBG: ${masalah.map((m) => m.pesan).join(" · ")}`);
    if (perubahan.length === 0) return setGalat("Usulan masih sama dengan koding SIMRS — ubah dulu, atau gunakan Loloskan klaim.");
    if (samaDenganAktif) return setGalat("Usulan sama dengan yang sedang menunggu SIMRS.");
    setGalat(null);
    await kirimAksi({ aksi: "AJUKAN_KOREKSI", versi: data.versi, catatan: catatan.trim() || undefined, usulan });
  }

  async function loloskan() {
    if (!izin.loloskanKlaim || mengirim) return;
    if (perluAlasanLolos && catatan.trim().length < BATAS.ALASAN_MIN) {
      setGalat(
        aktif
          ? `Usulan koreksi belum diterapkan di SIMRS (akan dibatalkan). Tulis alasan, min. ${BATAS.ALASAN_MIN} karakter.`
          : `Koding SIMRS masih melanggar ${data.cekKoding.gagal} aturan. Tulis alasan meloloskan, min. ${BATAS.ALASAN_MIN} karakter.`,
      );
      catatanRef.current?.focus();
      return;
    }
    setGalat(null);
    await kirimAksi({ aksi: "LOLOSKAN_KLAIM", versi: data.versi, catatan: catatan.trim() || undefined });
  }

  async function kembalikan() {
    if (!izin.kembalikan || mengirim) return;
    if (catatan.trim().length < BATAS.ALASAN_MIN) {
      setGalat(`Tulis alasan mengembalikan ke Tahap 1 (berkas RM apa yang kurang), min. ${BATAS.ALASAN_MIN} karakter.`);
      catatanRef.current?.focus();
      return;
    }
    setGalat(null);
    await kirimAksi({ aksi: "KEMBALIKAN_KE_RM", versi: data.versi, catatan: catatan.trim() });
  }

  /* -------------------------------------------------------------- baris */

  const barisDx = [
    ...simrs.diagnosa.map((d) => ({ kode: d.kode, simrs: d as DxKlaim | null })),
    ...usulan.diagnosa.filter((d) => !simrs.diagnosa.some((x) => x.kode === d.kode)).map((d) => ({ kode: d.kode, simrs: null })),
  ];
  const teksDx = (kode: string) => s.fakta.koding.diagnosa.find((b) => b.kode === kode && b.teks)?.teks ?? null;
  const teksKosong = s.fakta.koding.diagnosa.filter((b) => b.inacbg && !b.kode).map((b) => b.teks).filter(Boolean);
  const pxSimrs = new Set(simrs.prosedur);
  const pxLain = new Set(simrs.prosedurLain);
  const barisPx = [
    ...simrs.prosedur,
    ...simrs.prosedurLain,
    ...usulan.prosedur.map((p) => p.kode).filter((k) => !pxSimrs.has(k) && !pxLain.has(k)),
  ];
  const teksPx = (kode: string) => s.fakta.koding.prosedur.find((b) => b.kode === kode && b.teks)?.teks ?? null;
  const kolomUsulan = bisaEdit || !!aktif;
  const tahap1 = data.status === "BELUM_DIPERIKSA" || data.status === "TIDAK_LENGKAP";

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 px-5 py-4">
        {/* Pemeriksaan otomatis Tahap 2 */}
        <section aria-labelledby="kd-cek">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="kd-cek" className="text-sm font-semibold text-fg">
              Aturan INA-CBG terhadap koding SIMRS
            </h3>
            <p className="text-xs text-fg-muted">
              <span className="font-medium text-success">{data.cekKoding.lolos} lolos</span>
              {data.cekKoding.gagal > 0 && <> · <span className="font-medium text-danger">{data.cekKoding.gagal} gagal</span></>}
              {data.cekKoding.peringatan > 0 && <> · <span className="font-medium text-warning">{data.cekKoding.peringatan} peringatan</span></>}
            </p>
          </div>
          <ul className="grid gap-x-4 gap-y-1.5 rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3 sm:grid-cols-2">
            {data.cekKoding.hasil.map((h) => (
              <li key={h.key} className="flex min-w-0 gap-2 text-xs">
                <HasilIcon status={h.status} className="mt-px" />
                <span className="min-w-0">
                  <span className="font-medium text-fg">{h.label}</span>
                  <span className={cn("block", h.status === "lolos" ? "text-fg-subtle" : "text-fg-muted")}>{h.pesan}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Status usulan */}
        {aktif ? (
          <BannerMenunggu aktif={aktif} sisa={sisa!} tl={tlKoding} now={now} />
        ) : terakhir?.status === "SESUAI" ? (
          <BannerSesuai k={terakhir} />
        ) : null}

        {tahap1 && (
          <Catatan>Koding diputuskan setelah berkas lolos Tahap 1 (Kelengkapan). Tampilan ini pratinjau koding SIMRS.</Catatan>
        )}
        {!tahap1 && !bisaMemutus && (data.status === "LOLOS_RM" || data.status === "KOREKSI_KODING") && (
          <Catatan>Anda hanya dapat melihat. Keputusan koding membutuhkan izin Verifikasi Klaim / Coder (ubah).</Catatan>
        )}

        {/* Diagnosa */}
        <section aria-labelledby="kd-dx">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 id="kd-dx" className="text-sm font-semibold text-fg">
              Diagnosa ICD-10
            </h3>
            {bisaEdit && diubah && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                {aktif ? "Kembali ke usulan terkirim" : "Kembali ke SIMRS"}
              </button>
            )}
          </div>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
            <KepalaTabel kolomUsulan={kolomUsulan} label="Kode & diagnosa" />
            <ul className="divide-y divide-border">
              {barisDx.length === 0 && simrs.tanpaKode === 0 && (
                <li className="px-4 py-3 text-sm text-fg-muted">Belum ada diagnosa bertanda INA-CBG di SIMRS.</li>
              )}
              {barisDx.map(({ kode, simrs: sd }) => {
                const u = usulan.diagnosa.find((d) => d.kode === kode) ?? null;
                const berubah = perubahan.some((p) => p.jenis === "dx" && p.kode === kode);
                return (
                  <li key={kode} className={cn("grid grid-cols-1 gap-2 px-4 py-2.5 sm:items-center", GRID, berubah && kolomUsulan && "bg-brand-soft/25")}>
                    <KodeSel kode={kode} info={icd["10"][kode]} jenis="10" teks={teksDx(kode)} baru={!sd} />
                    <Sel label="SIMRS">
                      <PeranSimrs d={sd} />
                    </Sel>
                    {kolomUsulan && (
                      <Sel label="Usulan">
                        {bisaEdit ? (
                          u ? (
                            <span className="flex items-center gap-1.5">
                              <PilihPeran kode={kode} utama={u.utama} onPilih={(v) => jadikan(kode, v)} />
                              <IkonTombol label={`Hapus ${kode} dari usulan`} onClick={() => hapusDx(kode)}>
                                <Trash2 className="size-3.5" aria-hidden />
                              </IkonTombol>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <Badge tone="danger" className="px-2 py-0 text-[11px]">Dihapus</Badge>
                              {sd && (
                                <IkonTombol label={`Batalkan hapus ${kode}`} onClick={() => pulihkanDx(sd)}>
                                  <Undo2 className="size-3.5" aria-hidden />
                                </IkonTombol>
                              )}
                            </span>
                          )
                        ) : (
                          <PeranUsulan u={aktif?.usulan.diagnosa.find((d) => d.kode === kode) ?? null} />
                        )}
                      </Sel>
                    )}
                  </li>
                );
              })}
              {simrs.tanpaKode > 0 && (
                <li className={cn("grid grid-cols-1 gap-2 px-4 py-2.5 sm:items-center", GRID, kolomUsulan && "bg-brand-soft/25")}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-danger">{simrs.tanpaKode} baris diagnosa tanpa kode</p>
                    {teksKosong[0] && <p className="truncate text-[11px] text-fg-subtle">Tertulis: “{teksKosong[0]}”</p>}
                  </div>
                  <Sel label="SIMRS">
                    <Badge tone="danger" className="px-2 py-0 text-[11px]">Tanpa kode</Badge>
                  </Sel>
                  {kolomUsulan && (
                    <Sel label="Usulan">
                      <span className="text-xs text-fg-muted">Beri kode / hapus</span>
                    </Sel>
                  )}
                </li>
              )}
            </ul>
            {bisaEdit && (
              <div className="border-t border-border bg-surface-2/40 px-4 py-2.5">
                <IcdCombobox
                  jenis="10"
                  label="Tambah diagnosa ICD-10"
                  placeholder="Tambah diagnosa — ketik kode (K35.8) atau nama (appendicitis)…"
                  sudahAda={kodeUsulanDx}
                  onPilih={tambahDx}
                  disabled={mengirim || kodeUsulanDx.size >= BATAS.USULAN_MAKS}
                />
              </div>
            )}
          </div>
        </section>

        {/* Prosedur */}
        <section aria-labelledby="kd-px">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="kd-px" className="text-sm font-semibold text-fg">
              Prosedur ICD-9-CM
            </h3>
            {s.fakta.koding.bedah > 0 && (
              <span className="text-xs text-fg-muted">{s.fakta.koding.bedah} tindakan bedah tercatat di SIMRS</span>
            )}
          </div>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
            <KepalaTabel kolomUsulan={kolomUsulan} label="Kode & prosedur" />
            <ul className="divide-y divide-border">
              {barisPx.length === 0 && <li className="px-4 py-3 text-sm text-fg-muted">Belum ada prosedur di SIMRS.</li>}
              {barisPx.map((kode) => {
                const ikut = kodeUsulanPx.has(kode);
                const berubah = perubahan.some((p) => p.jenis === "px" && p.kode === kode);
                const diSimrs = pxSimrs.has(kode) || pxLain.has(kode);
                return (
                  <li key={kode} className={cn("grid grid-cols-1 gap-2 px-4 py-2.5 sm:items-center", GRID, berubah && kolomUsulan && "bg-brand-soft/25")}>
                    <KodeSel kode={kode} info={icd["9"][kode]} jenis="9" teks={teksPx(kode)} baru={!diSimrs} />
                    <Sel label="SIMRS">
                      {pxSimrs.has(kode) ? (
                        <Badge tone="success" className="px-2 py-0 text-[11px]">INA-CBG</Badge>
                      ) : pxLain.has(kode) ? (
                        <span className="text-xs text-fg-muted">tanpa tanda INA-CBG</span>
                      ) : (
                        <span className="text-xs text-fg-subtle">—</span>
                      )}
                    </Sel>
                    {kolomUsulan && (
                      <Sel label="Usulan">
                        {bisaEdit ? (
                          <span className="flex items-center gap-1.5">
                            <Badge tone={ikut ? "success" : "neutral"} className="px-2 py-0 text-[11px]">
                              {ikut ? "Ikut klaim" : "Tidak ikut"}
                            </Badge>
                            <button
                              type="button"
                              onClick={() => aturPx(kode, !ikut)}
                              className="rounded-full px-2 py-0.5 text-[11px] font-medium text-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                            >
                              {ikut ? (diSimrs ? "Keluarkan" : "Hapus") : "Ikutkan"}
                            </button>
                          </span>
                        ) : (
                          <Badge tone={aktif?.usulan.prosedur.some((p) => p.kode === kode) ? "success" : "neutral"} className="px-2 py-0 text-[11px]">
                            {aktif?.usulan.prosedur.some((p) => p.kode === kode) ? "Ikut klaim" : "Tidak ikut"}
                          </Badge>
                        )}
                      </Sel>
                    )}
                  </li>
                );
              })}
            </ul>
            {bisaEdit && (
              <div className="border-t border-border bg-surface-2/40 px-4 py-2.5">
                <IcdCombobox
                  jenis="9"
                  label="Tambah prosedur ICD-9-CM"
                  placeholder="Tambah prosedur — ketik kode (47.09) atau nama (appendectomy)…"
                  sudahAda={kodeUsulanPx}
                  onPilih={tambahPx}
                  disabled={mengirim || kodeUsulanPx.size >= BATAS.USULAN_MAKS}
                />
              </div>
            )}
          </div>
        </section>

        {/* Ringkasan usulan */}
        {bisaEdit && (perubahan.length > 0 || masalah.length > 0) && (
          <section aria-labelledby="kd-ringkas" className="rounded-[var(--radius-lg)] border border-brand/25 bg-brand-soft/30 px-4 py-3">
            <h3 id="kd-ringkas" className="text-sm font-semibold text-fg">
              {perubahan.length > 0 ? `Langkah yang akan dikirim ke SIMRS (${perubahan.length})` : "Usulan belum bisa dikirim"}
            </h3>
            {perubahan.length > 0 && (
              <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-xs text-fg">
                {perubahan.map((p) => (
                  <li key={kunciPerubahan(p)}>{p.teks}</li>
                ))}
              </ol>
            )}
            {perubahan.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-fg-muted">
                <UserRound className="size-3" aria-hidden />
                Diterapkan di SIMRS oleh:
                {perubahan.some((p) => p.jenis === "dx") && <span className="font-medium">DPJP (diagnosa)</span>}
                {perubahan.some((p) => p.jenis === "dx") && perubahan.some((p) => p.jenis === "px") && "·"}
                {perubahan.some((p) => p.jenis === "px") && <span className="font-medium">{s.ruang ?? "ruang perawatan"} (prosedur)</span>}
              </p>
            )}
            {masalah.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-danger">
                {masalah.map((m) => (
                  <li key={m.key} className="flex gap-1.5">
                    <HasilIcon status="gagal" className="mt-px" />
                    {m.pesan}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Keputusan */}
      {bisaMemutus && (
        <div className="sticky bottom-0 space-y-3 border-t border-border bg-surface px-5 py-4 shadow-[0_-4px_12px_-8px_rgb(0_0_0/0.15)]">
          <div>
            <label htmlFor="kd-catatan" className="mb-1.5 block text-xs font-medium text-fg-muted">
              Catatan untuk DPJP / unit · alasan meloloskan atau mengembalikan
            </label>
            <textarea
              id="kd-catatan"
              ref={catatanRef}
              rows={2}
              maxLength={BATAS.CATATAN_MAKS}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder={
                perluAlasanLolos
                  ? `Wajib bila diloloskan (${aktif ? "usulan belum diterapkan" : `${data.cekKoding.gagal} aturan gagal`}) atau dikembalikan`
                  : "Opsional — wajib bila dikembalikan ke Tahap 1"
              }
              className="w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40"
            />
          </div>
          {galat && (
            <p role="alert" className="text-xs text-danger">
              {galat}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {izin.kembalikan && (
              <Button
                variant="ghost"
                icon={<CornerUpLeft className="size-4" aria-hidden />}
                onClick={kembalikan}
                loading={aksiKirim === "KEMBALIKAN_KE_RM"}
                disabled={mengirim}
                className="mr-auto"
              >
                Kembalikan ke Tahap 1
              </Button>
            )}
            {izin.ajukanKoreksi && (
              <Button
                variant={perubahan.length > 0 ? "primary" : "secondary"}
                icon={<Send className="size-4" aria-hidden />}
                onClick={ajukan}
                loading={aksiKirim === "AJUKAN_KOREKSI"}
                disabled={mengirim || perubahan.length === 0 || masalah.length > 0 || samaDenganAktif}
              >
                {aktif ? "Revisi usulan" : "Ajukan koreksi"}
                {perubahan.length ? ` (${perubahan.length})` : ""}
              </Button>
            )}
            {izin.loloskanKlaim && (
              <Button
                variant={perubahan.length > 0 && !samaDenganAktif ? "secondary" : "primary"}
                icon={<FileCheck className="size-4" aria-hidden />}
                onClick={loloskan}
                loading={aksiKirim === "LOLOSKAN_KLAIM"}
                disabled={mengirim}
              >
                Loloskan klaim
              </Button>
            )}
          </div>
          {izin.loloskanKlaim && perubahan.length > 0 && !samaDenganAktif && (
            <p className="text-right text-[11px] text-fg-subtle">Loloskan klaim memakai koding SIMRS apa adanya — usulan di layar tidak dikirim.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- bagian */

function Catatan({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/60 px-3 py-2 text-xs text-fg-muted">
      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

function KepalaTabel({ kolomUsulan, label }: { kolomUsulan: boolean; label: string }) {
  return (
    <div className={cn("hidden gap-2 border-b border-border bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted sm:grid", GRID)}>
      <span>{label}</span>
      <span>Di SIMRS sekarang</span>
      {kolomUsulan && <span>Usulan coder</span>}
    </div>
  );
}

function Sel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] text-fg-subtle sm:hidden">{label}</span>
      {children}
    </div>
  );
}

function KodeSel({
  kode,
  info,
  jenis,
  teks,
  baru,
}: {
  kode: string;
  info: IcdInfo | undefined;
  jenis: "10" | "9";
  teks: string | null;
  baru: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-[13px] font-semibold text-fg">{kode}</span>
        <span className="text-sm text-fg">{info?.nama ?? "—"}</span>
        {baru && <Badge tone="brand" className="px-1.5 py-0 text-[10px]">Baru</Badge>}
      </p>
      {teks && info && teks.toLowerCase() !== info.nama.toLowerCase() && (
        <p className="truncate text-[11px] text-fg-subtle" title={teks}>
          Tertulis di SIMRS: “{teks}”
        </p>
      )}
      <TandaIcd info={info} jenis={jenis} className="mt-0.5" />
    </div>
  );
}

function PeranSimrs({ d }: { d: DxKlaim | null }) {
  if (!d) return <span className="text-xs text-fg-subtle">—</span>;
  if (d.primer && d.sekunder) return <Badge tone="danger" className="px-2 py-0 text-[11px]">Utama + sekunder</Badge>;
  return d.primer ? (
    <Badge tone="brand" className="px-2 py-0 text-[11px]">Utama</Badge>
  ) : (
    <Badge tone="neutral" className="px-2 py-0 text-[11px]">Sekunder</Badge>
  );
}

function PeranUsulan({ u }: { u: { utama: boolean } | null }) {
  if (!u) return <Badge tone="danger" className="px-2 py-0 text-[11px]">Dihapus</Badge>;
  return u.utama ? (
    <Badge tone="brand" className="px-2 py-0 text-[11px]">Utama</Badge>
  ) : (
    <Badge tone="neutral" className="px-2 py-0 text-[11px]">Sekunder</Badge>
  );
}

function PilihPeran({ kode, utama, onPilih }: { kode: string; utama: boolean; onPilih: (utama: boolean) => void }) {
  const opsi = [
    { v: true, t: "Utama" },
    { v: false, t: "Sekunder" },
  ];
  return (
    <span role="radiogroup" aria-label={`Peran ${kode} di usulan`} className="inline-flex rounded-full border border-border bg-surface p-0.5">
      {opsi.map((o) => (
        <button
          key={o.t}
          type="button"
          role="radio"
          aria-checked={utama === o.v}
          onClick={() => onPilih(o.v)}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
            utama === o.v ? (o.v ? "bg-brand text-brand-fg" : "bg-surface-2 text-fg") : "text-fg-muted hover:text-fg",
          )}
        >
          {o.t}
        </button>
      ))}
    </span>
  );
}

function IkonTombol({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-full p-1.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
    >
      {children}
    </button>
  );
}

function BannerMenunggu({
  aktif,
  sisa,
  tl,
  now,
}: {
  aktif: KoreksiItem;
  sisa: ReadonlySet<string>;
  tl: RuangKerjaKlaim["tindakLanjut"];
  now: number;
}) {
  const selesai = aktif.perubahan.filter((p) => !sisa.has(kunciPerubahan(p))).length;
  return (
    <section className="rounded-[var(--radius-lg)] border border-warning/30 bg-warning-soft/60 px-4 py-3" aria-labelledby="kd-menunggu">
      <div className="flex flex-wrap items-center gap-2">
        <Hourglass className="size-4 text-warning" aria-hidden />
        <h3 id="kd-menunggu" className="text-sm font-semibold text-fg">
          Menunggu diterapkan di SIMRS
        </h3>
        <span className="text-xs text-fg-muted">
          {selesai} dari {aktif.perubahan.length} langkah sudah sesuai
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-fg-muted">
        Diajukan {aktif.dibuatOlehNama ?? "—"} {formatRelatif(aktif.createdAt, now)}
        {tl.length > 0 && ` · menunggu ${tl.map((t) => t.sasaranNama ?? t.sasaranRef).join(", ")}`}. Berkas lolos klaim
        otomatis begitu koding SIMRS sama dengan usulan.
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        {aktif.perubahan.map((p) => {
          const ok = !sisa.has(kunciPerubahan(p));
          return (
            <li key={kunciPerubahan(p)} className="flex gap-1.5">
              {ok ? (
                <CheckCircle2 className="mt-px size-3.5 shrink-0 text-success" aria-label="Sudah sesuai" />
              ) : (
                <CircleDashed className="mt-px size-3.5 shrink-0 text-warning" aria-label="Belum" />
              )}
              <span className={cn(ok ? "text-fg-muted line-through decoration-fg-subtle/60" : "text-fg")}>
                {p.teks}
                {p.nama && <span className="text-fg-subtle"> — {p.nama}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {aktif.catatan && <p className="mt-1.5 text-xs italic text-fg-muted">“{aktif.catatan}”</p>}
    </section>
  );
}

const LABEL_KOLOM: Record<string, string> = {
  KODE: "kode",
  UTAMA: "utama/sekunder",
  STATUS: "hapus/aktif",
  INACBG: "tanda INA-CBG",
  INA_GROUPER: "grouper",
  DIAGNOSA: "teks",
  TINDAKAN: "teks",
};

function BannerSesuai({ k }: { k: KoreksiItem }) {
  const b = k.bukti;
  return (
    <section className="rounded-[var(--radius-lg)] border border-success/30 bg-success-soft/60 px-4 py-3" aria-labelledby="kd-sesuai">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="size-4 text-success" aria-hidden />
        <h3 id="kd-sesuai" className="text-sm font-semibold text-fg">
          Koreksi sudah diterapkan di SIMRS
        </h3>
        {k.sesuaiAt && <span className="text-xs text-fg-muted">terdeteksi {formatDateTime(k.sesuaiAt)}</span>}
      </div>
      <p className="mt-0.5 text-xs text-fg-muted">
        {b?.oleh ? (
          <>
            Diubah oleh <span className="font-medium text-fg">{b.oleh}</span>
            {b.pada && <> pada {formatDateTime(b.pada)}</>} (log SIMRS).
          </>
        ) : (
          "Tidak ada jejak perubahan tercatat di log SIMRS setelah usulan dibuat."
        )}
      </p>
      {b && b.jejak.length > 0 && (
        <details className="mt-1.5 text-xs">
          <summary className="cursor-pointer text-fg-muted hover:text-fg">Jejak perubahan ({b.jejak.length})</summary>
          <ul className="mt-1 space-y-0.5 text-fg-muted">
            {b.jejak.map((j: JejakBukti, i) => (
              <li key={i}>
                {formatDateTime(j.pada)} · {j.oleh ?? "—"} · {j.aksi === "tambah" ? "menambah" : "mengubah"} {j.tabel}{" "}
                {j.kode && <span className="font-mono">{j.kode}</span>}
                {j.kolom.length > 0 && ` (${j.kolom.map((c) => LABEL_KOLOM[c] ?? c.toLowerCase()).join(", ")})`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
