"use client";

import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { TtdSayaProvider } from "@/features/form-rm/isian/TtdSayaProvider";

const TANPA_NAMA = { nama: "", onNama: () => {} };

/**
 * Penangkap TTD laporan BCKH: gambar / unggah / kamera / via HP (komponen Form RM),
 * plus "Pakai TTD saya" & "Simpan juga sebagai TTD saya" — TTD tersimpan yang sama
 * dengan Form RM, lewat `/api/bckh/ttd-saya` (izin BCKH, hanya milik sendiri).
 */
export function TtdBckh({ label, value, onChange, konteks }: { label: string; value: string; onChange: (dataUrl: string) => void; konteks?: string }) {
  return (
    <TtdSayaProvider endpoint="/api/bckh/ttd-saya">
      <SignaturePad label={label} value={value} onChange={onChange} context={konteks} petugas={TANPA_NAMA} />
    </TtdSayaProvider>
  );
}
