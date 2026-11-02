"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPut, pesanGalat } from "@/lib/api-client";
import type { PengaturanLaporan } from "@/server/modules/bckh/bckh.constants";

type PengaturanDto = PengaturanLaporan & { tersimpan: boolean; diubahOleh: string | null; diubahAt: string | null };

const BIDANG: { k: keyof PengaturanLaporan; label: string; maks: number }[] = [
  { k: "kop1", label: "Kop sampul baris 1", maks: 120 },
  { k: "kop2", label: "Kop sampul baris 2", maks: 120 },
  { k: "instansi1", label: "Kotak instansi baris 1", maks: 120 },
  { k: "instansi2", label: "Kotak instansi baris 2", maks: 120 },
  { k: "mengetahuiJabatan", label: "Jabatan \"Mengetahui\"", maks: 191 },
  { k: "mengetahuiNama", label: "Nama \"Mengetahui\"", maks: 191 },
  { k: "mengetahuiNip", label: "NIP \"Mengetahui\"", maks: 40 },
];

/** Pengaturan laporan GLOBAL (kop & penandatangan "Mengetahui") — `bckh.pengaturan:update`, diaudit. */
export function PengaturanModal({ open, onClose, onTersimpan }: { open: boolean; onClose: () => void; onTersimpan: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<PengaturanDto | null>(null);
  const [simpan, setSimpan] = useState(false);

  useEffect(() => {
    if (!open) return;
    let batal = false;
    apiGet<PengaturanDto>("/api/bckh/pengaturan")
      .then((d) => !batal && setData(d))
      .catch((e) => !batal && toast.error("Gagal memuat pengaturan", pesanGalat(e)));
    return () => {
      batal = true;
    };
  }, [open, toast]);

  const kirim = async () => {
    if (!data) return;
    setSimpan(true);
    try {
      await apiPut("/api/bckh/pengaturan", Object.fromEntries(BIDANG.map((b) => [b.k, data[b.k]])));
      toast.success("Pengaturan laporan disimpan", "Berlaku untuk laporan semua pegawai.");
      onTersimpan();
    } catch (e) {
      toast.error("Pengaturan tidak tersimpan", pesanGalat(e));
    } finally {
      setSimpan(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Pengaturan laporan"
      description={`Kop sampul & penandatangan "Mengetahui" — berlaku untuk laporan semua pegawai.`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" loading={simpan} disabled={!data} onClick={() => void kirim()}>
            Simpan pengaturan
          </Button>
        </>
      }
    >
      {!data ? (
        <p className="py-6 text-center text-sm text-fg-muted">Memuat…</p>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void kirim();
          }}
        >
          {BIDANG.map((b) => (
            <div key={b.k}>
              <Label htmlFor={`atur-${b.k}`}>{b.label}</Label>
              <Input id={`atur-${b.k}`} value={data[b.k]} maxLength={b.maks} onChange={(e) => setData((d) => d && { ...d, [b.k]: e.target.value })} />
            </div>
          ))}
          <p className="text-[11px] text-fg-subtle">
            {data.tersimpan && data.diubahAt
              ? `Terakhir diubah ${data.diubahOleh ?? "-"} · ${new Date(data.diubahAt).toLocaleString("id-ID")}`
              : "Masih memakai nilai bawaan dokumen contoh."}
          </p>
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
}
