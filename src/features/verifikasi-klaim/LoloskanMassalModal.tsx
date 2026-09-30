"use client";

import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { apiPost, pesanGalat } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import { BATAS } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import type { HasilMassal } from "@/server/modules/verifikasi-klaim/verifikasi.types";

export type FilterMassal = {
  from: string;
  to: string;
  cakupan: "bpjs" | "semua";
  kategori?: string;
  ruangan?: string;
  q?: string;
};

/**
 * Konfirmasi "loloskan semua yang lengkap otomatis" (PRD §6.2). Server mengecek
 * ulang tiap berkas secara segar; yang berubah / sudah diputuskan dilewati.
 */
export function LoloskanMassalModal({
  open,
  onClose,
  jumlah,
  filter,
  onSelesai,
}: {
  open: boolean;
  onClose: () => void;
  jumlah: number;
  filter: FilterMassal;
  onSelesai: () => void;
}) {
  const toast = useToast();
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [kirim, setKirim] = useState(false);

  async function jalankan() {
    setKirim(true);
    try {
      const r = await apiPost<HasilMassal>("/api/berkas-klaim/verifikasi/massal", { ...filter, konfirmasiManual: true });
      toast.success(
        `${formatNumber(r.disetujui.length)} berkas diloloskan`,
        r.dilewati.length ? `${r.dilewati.length} dilewati: ${r.dilewati[0].alasan.toLowerCase()}.` : "Semua tercatat di riwayat masing-masing berkas.",
      );
      setKonfirmasi(false);
      onSelesai();
      onClose();
    } catch (e) {
      toast.error("Gagal meloloskan berkas", pesanGalat(e));
    } finally {
      setKirim(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={kirim ? () => {} : onClose}
      dismissible={!kirim}
      title="Loloskan berkas lengkap otomatis"
      description="Berkas Belum Diperiksa yang semua pemeriksaan wajibnya lolos pada filter ini."
      icon={
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-success-soft text-success">
          <CheckCheck className="size-5" aria-hidden />
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={kirim}>
            Batal
          </Button>
          <Button onClick={jalankan} loading={kirim} disabled={!konfirmasi || jumlah === 0}>
            Loloskan {formatNumber(Math.min(jumlah, BATAS.MASSAL_MAKS))} berkas
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-fg-muted">
          <strong className="font-semibold text-fg">{formatNumber(jumlah)} berkas</strong> akan dicek ulang dari SIMRS
          lalu diloloskan ke Tahap 2 satu per satu (tercatat di riwayat masing-masing).
          {jumlah > BATAS.MASSAL_MAKS && ` Maksimal ${BATAS.MASSAL_MAKS} berkas per proses — ulangi untuk sisanya.`}
        </p>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface-2/60 p-3">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
            checked={konfirmasi}
            onChange={(e) => setKonfirmasi(e.target.checked)}
          />
          <span className="text-fg">
            Saya sudah memeriksa cek manual berkas-berkas ini (tanda tangan DPJP, identitas di semua lembar).
          </span>
        </label>
      </div>
    </Modal>
  );
}
