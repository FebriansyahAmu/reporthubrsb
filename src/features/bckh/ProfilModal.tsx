"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { apiPut, pesanGalat } from "@/lib/api-client";
import type { ProfilDto } from "@/server/modules/bckh/bckh.types";
import { PemilihAkun, usePenyetuju } from "./PemilihAkun";

type Isian = Pick<ProfilDto, "namaLengkap" | "namaTtd" | "jabatan" | "nip" | "unit" | "atasanNama" | "atasanNip" | "atasanId">;
const KOSONG: Isian = { namaLengkap: "", namaTtd: "", jabatan: "", nip: "", unit: "", atasanNama: "", atasanNip: "", atasanId: null };

type Bidang = { k: Exclude<keyof Isian, "atasanId">; label: string; bantu?: string; maks: number; mode?: "numeric"; lebar?: boolean };

const IDENTITAS: Bidang[] = [
  { k: "namaLengkap", label: "Nama lengkap (sampul)", bantu: "Mis. Nama Lengkap, S.Kom", maks: 191, lebar: true },
  { k: "namaTtd", label: "Nama di tanda tangan", bantu: "Mis. NAMA L. LENGKAP, S.KOM", maks: 191, lebar: true },
  { k: "jabatan", label: "Jabatan", maks: 191, lebar: true },
  { k: "nip", label: "NIP", bantu: "Kosongkan bila tidak ada (tercetak \"-\")", maks: 40, mode: "numeric" },
  { k: "unit", label: "Unit / instalasi", maks: 191 },
];
const ATASAN_CETAK: Bidang[] = [
  { k: "atasanNama", label: "Nama atasan (tercetak)", maks: 191 },
  { k: "atasanNip", label: "NIP atasan (tercetak)", maks: 40, mode: "numeric" },
];

/**
 * Profil laporan SENDIRI (sampul + blok tanda tangan Laporan Kinerja Harian) dan
 * AKUN atasan langsung — tujuan pengajuan tanda tangan; memilih akun mengisi nama &
 * NIP atasan untuk cetak (tetap bisa disesuaikan).
 */
export function ProfilModal({ open, profil, onClose, onTersimpan }: { open: boolean; profil: ProfilDto; onClose: () => void; onTersimpan: () => void }) {
  const toast = useToast();
  const [isi, setIsi] = useState<Isian>(KOSONG);
  const [simpan, setSimpan] = useState(false);
  const akun = usePenyetuju(open);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- isi ulang formulir tiap modal dibuka
    setIsi({
      namaLengkap: profil.namaLengkap,
      namaTtd: profil.namaTtd,
      jabatan: profil.jabatan,
      nip: profil.nip,
      unit: profil.unit,
      atasanNama: profil.atasanNama,
      atasanNip: profil.atasanNip,
      atasanId: profil.atasanId,
    });
  }, [open, profil]);

  const kirim = async () => {
    setSimpan(true);
    try {
      await apiPut("/api/bckh/profil", isi);
      toast.success("Profil laporan disimpan");
      onTersimpan();
    } catch (e) {
      toast.error("Profil tidak tersimpan", pesanGalat(e));
    } finally {
      setSimpan(false);
    }
  };

  const bidang = (b: Bidang) => (
    <div key={b.k} className={b.lebar ? "sm:col-span-2" : undefined}>
      <Label htmlFor={`profil-${b.k}`}>{b.label}</Label>
      <Input
        id={`profil-${b.k}`}
        value={isi[b.k]}
        maxLength={b.maks}
        inputMode={b.mode}
        placeholder={b.bantu}
        onChange={(e) => setIsi((s) => ({ ...s, [b.k]: e.target.value }))}
      />
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Ubah profil laporan"
      description="Tercetak di sampul dan blok tanda tangan Laporan Kinerja Harian."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" loading={simpan} onClick={() => void kirim()} disabled={!isi.namaLengkap.trim() || !isi.namaTtd.trim()}>
            Simpan profil
          </Button>
        </>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void kirim();
        }}
      >
        <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
          <legend className="sr-only">Identitas</legend>
          {IDENTITAS.map(bidang)}
        </fieldset>

        <fieldset className="min-w-0 space-y-4 rounded-[var(--radius-md)] border border-border bg-surface-2/40 p-4">
          <legend className="px-1 text-sm font-semibold text-fg">Atasan langsung</legend>
          <PemilihAkun
            label="Akun atasan (tujuan pengajuan tanda tangan)"
            akun={akun}
            nilai={isi.atasanId}
            kecuali={profil.userId}
            onPilih={(a) =>
              setIsi((s) => ({
                ...s,
                atasanId: a?.id ?? null,
                ...(a ? { atasanNama: a.namaTtd, atasanNip: a.nip } : {}),
              }))
            }
            bantuan="Laporan yang Anda ajukan masuk ke kotak persetujuan akun ini. Nama & NIP di bawah terisi otomatis."
          />
          <div className="grid gap-4 sm:grid-cols-2">{ATASAN_CETAK.map(bidang)}</div>
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
