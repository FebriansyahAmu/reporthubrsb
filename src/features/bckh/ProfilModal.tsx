"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { apiPut, pesanGalat } from "@/lib/api-client";
import type { ProfilDto } from "@/server/modules/bckh/bckh.types";

type Isian = Pick<ProfilDto, "namaLengkap" | "namaTtd" | "jabatan" | "nip" | "unit" | "atasanNama" | "atasanNip">;
const KOSONG: Isian = { namaLengkap: "", namaTtd: "", jabatan: "", nip: "", unit: "", atasanNama: "", atasanNip: "" };

const BIDANG: { k: keyof Isian; label: string; bantu?: string; maks: number; mode?: "numeric" }[] = [
  { k: "namaLengkap", label: "Nama lengkap (sampul)", bantu: "Mis. Nama Lengkap, S.Kom", maks: 191 },
  { k: "namaTtd", label: "Nama di tanda tangan", bantu: "Mis. NAMA L. LENGKAP, S.KOM", maks: 191 },
  { k: "jabatan", label: "Jabatan", maks: 191 },
  { k: "nip", label: "NIP", bantu: "Kosongkan bila tidak ada (tercetak \"-\")", maks: 40, mode: "numeric" },
  { k: "unit", label: "Unit / instalasi", maks: 191 },
  { k: "atasanNama", label: "Nama atasan langsung", maks: 191 },
  { k: "atasanNip", label: "NIP atasan langsung", maks: 40, mode: "numeric" },
];

/** Profil laporan SENDIRI (sampul + blok tanda tangan Laporan Kinerja Harian). */
export function ProfilModal({ open, profil, onClose, onTersimpan }: { open: boolean; profil: ProfilDto; onClose: () => void; onTersimpan: () => void }) {
  const toast = useToast();
  const [isi, setIsi] = useState<Isian>(KOSONG);
  const [simpan, setSimpan] = useState(false);

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
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void kirim();
        }}
      >
        {BIDANG.map((b) => (
          <div key={b.k} className={b.k === "namaLengkap" || b.k === "namaTtd" || b.k === "jabatan" ? "sm:col-span-2" : undefined}>
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
        ))}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
