"use client";

import { useState } from "react";
import { Ban, CircleAlert, Lock, LockOpen } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { AksiIsian } from "@/features/form-rm/isian.status";
import { ALASAN_TIDAK_TERDAFTAR, SYARAT_TERTAUT } from "@/features/form-rm/sementara";
import type { KendaliIsian } from "./useIsian";

const ALASAN_MIN = 5;
const ALASAN_MAKS = 500;

/** Kekurangan syarat FINAL menurut isi form di layar (server tetap memeriksa ulang). */
function kekuranganFinal<T>(k: KendaliIsian<T>): string[] {
  const tautan = k.isian.tertaut ? [] : [SYARAT_TERTAUT];
  const sah = k.def.skema.safeParse(k.form);
  if (!sah.success) return [...tautan, "Ada isian yang tidak valid — simpan dulu untuk melihat rinciannya"];
  return [...tautan, ...k.def.syaratFinal(sah.data)];
}

/** Konfirmasi FINALKAN, atau alasan untuk BUKA_KOREKSI / BATALKAN. */
export function AksiIsianDialog<T>({
  kendali: k,
  aksi,
  onTutup,
  onBerhasil,
}: {
  kendali: KendaliIsian<T>;
  aksi: AksiIsian | null;
  onTutup: () => void;
  onBerhasil: (aksi: AksiIsian) => void;
}) {
  if (aksi === "FINALKAN") return <FinalkanDialog kendali={k} onTutup={onTutup} onBerhasil={() => onBerhasil(aksi)} />;
  return <AlasanDialog key={aksi ?? "tutup"} kendali={k} aksi={aksi} onTutup={onTutup} onBerhasil={onBerhasil} />;
}

function FinalkanDialog<T>({
  kendali: k,
  onTutup,
  onBerhasil,
}: {
  kendali: KendaliIsian<T>;
  onTutup: () => void;
  onBerhasil: () => void;
}) {
  const kurang = k.galat?.kurang.length ? k.galat.kurang : kekuranganFinal(k);
  const sibuk = k.sibuk !== null;

  async function finalkan() {
    if (await k.jalankan("FINALKAN")) onBerhasil();
  }

  return (
    <Modal
      open
      onClose={onTutup}
      dismissible={!sibuk}
      title={kurang.length ? "Belum bisa difinalkan" : "Finalkan isian?"}
      icon={<Lock className="mt-0.5 size-4 text-brand" />}
      footer={
        <>
          <Button variant="secondary" onClick={onTutup} disabled={sibuk}>
            {kurang.length ? "Tutup" : "Batal"}
          </Button>
          {kurang.length === 0 && (
            <Button onClick={finalkan} loading={sibuk} icon={<Lock className="size-4" />}>
              Finalkan
            </Button>
          )}
        </>
      }
    >
      {kurang.length ? (
        <div className="space-y-2 text-sm">
          <p className="text-fg-muted">Lengkapi dulu:</p>
          <ul className="space-y-1.5">
            {kurang.map((s) => (
              <li key={s} className="flex items-start gap-2 text-fg">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-2 text-sm text-fg-muted">
          <p>
            Isian akan <b className="text-fg">dikunci</b> dan disimpan sebagai revisi bersegel di riwayat. Dokumen cetak
            menjadi resmi (tanpa tanda air DRAF).
          </p>
          <p>Perubahan sesudahnya hanya lewat <b className="text-fg">Buka koreksi</b> oleh pengelola rekam medis.</p>
          {k.kotor && <p className="text-warning">Perubahan yang belum disimpan akan disimpan lebih dulu.</p>}
          {k.galat && !k.galat.kurang.length && <p className="text-danger">{k.galat.pesan}</p>}
        </div>
      )}
    </Modal>
  );
}

const TEKS_ALASAN: Record<Exclude<AksiIsian, "FINALKAN">, { judul: string; keterangan: string; tombol: string }> = {
  BUKA_KOREKSI: {
    judul: "Buka isian untuk koreksi",
    keterangan: "Isian kembali menjadi DRAF dan bisa diubah. Versi FINAL saat ini tetap tersimpan di riwayat.",
    tombol: "Buka koreksi",
  },
  BATALKAN: {
    judul: "Batalkan isian",
    keterangan: "Isian tidak berlaku lagi (mis. salah pasien) dan tidak bisa diubah. Isian tidak dihapus — tetap ada di riwayat.",
    tombol: "Batalkan isian",
  },
};

/** Membatalkan isian belum tertaut = menutupnya karena pasien tak pernah didaftarkan. */
const TEKS_TUTUP = {
  judul: "Tutup isian tanpa pendaftaran",
  keterangan:
    "Untuk pasien yang tidak pernah didaftarkan (pulang, menolak, dirujuk, atau meninggal sebelum terdaftar) atau isian ganda. Isian tidak dihapus — tetap ada di riwayat.",
  tombol: "Tutup isian",
};

function AlasanDialog<T>({
  kendali: k,
  aksi,
  onTutup,
  onBerhasil,
}: {
  kendali: KendaliIsian<T>;
  aksi: AksiIsian | null;
  onTutup: () => void;
  onBerhasil: (aksi: AksiIsian) => void;
}) {
  const [alasan, setAlasan] = useState("");
  const tutup = aksi === "BATALKAN" && !k.isian.tertaut;
  const teks = tutup ? TEKS_TUTUP : aksi && aksi !== "FINALKAN" ? TEKS_ALASAN[aksi] : null;
  const sibuk = k.sibuk !== null;
  const cukup = alasan.trim().length >= ALASAN_MIN;

  async function kirim() {
    if (!aksi || !cukup) return;
    if (await k.jalankan(aksi, alasan.trim())) onBerhasil(aksi);
  }

  return (
    <Modal
      open={teks !== null}
      onClose={onTutup}
      dismissible={!sibuk}
      title={teks?.judul ?? ""}
      description={teks?.keterangan}
      icon={
        aksi === "BATALKAN" ? (
          <Ban className="mt-0.5 size-4 text-danger" />
        ) : (
          <LockOpen className="mt-0.5 size-4 text-brand" />
        )
      }
      footer={
        <>
          <Button variant="secondary" onClick={onTutup} disabled={sibuk}>
            Kembali
          </Button>
          <Button variant={aksi === "BATALKAN" ? "danger" : "primary"} onClick={kirim} disabled={!cukup} loading={sibuk}>
            {teks?.tombol}
          </Button>
        </>
      }
    >
      {tutup && (
        <div role="group" aria-label="Alasan umum" className="mb-3 flex flex-wrap gap-1.5">
          {ALASAN_TIDAK_TERDAFTAR.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={alasan === a}
              onClick={() => setAlasan(a)}
              className={cn(
                "inline-flex min-h-8 items-center rounded-full border px-3 text-[13px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                alasan === a
                  ? "border-brand bg-brand-soft text-brand-soft-fg"
                  : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      )}
      <Label htmlFor="alasan-aksi">Alasan (wajib, tercatat di riwayat)</Label>
      <textarea
        id="alasan-aksi"
        rows={3}
        autoFocus
        maxLength={ALASAN_MAKS}
        value={alasan}
        onChange={(e) => setAlasan(e.target.value)}
        placeholder={aksi === "BATALKAN" ? "mis. Formulir terisi untuk pasien yang salah" : "mis. Koreksi tanggal & jam triase"}
        className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      />
      <div className="mt-1 flex justify-between text-[11px] text-fg-subtle">
        <span>{cukup ? "" : `Minimal ${ALASAN_MIN} karakter`}</span>
        <span className="tabular-nums">
          {alasan.length}/{ALASAN_MAKS}
        </span>
      </div>
      {k.galat && <p className="mt-2 text-xs text-danger">{k.galat.pesan}</p>}
    </Modal>
  );
}
