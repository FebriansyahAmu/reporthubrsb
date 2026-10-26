"use client";

import { Saran } from "@/features/form-rm/persetujuan/saran";
import { useTerkunci } from "@/features/form-rm/isian/kunci";
import { useNamaSaya } from "@/features/form-rm/isian/TtdSayaProvider";
import { namaSama } from "@/features/form-rm/ttd-saya";

/**
 * Saran satu-klik "Nama saya: <nama pengguna login>" di bawah kolom nama
 * petugas/dokter/saksi. Tidak tampil bila nama sudah sama, isian terkunci, atau
 * di luar halaman Form RM. Kolomnya tetap bisa diketik manual.
 */
export function SaranNamaSaya({ nama, onPilih }: { nama: string; onPilih: (nama: string) => void }) {
  const saya = useNamaSaya();
  const terkunci = useTerkunci();
  if (!saya || terkunci || namaSama(nama, saya)) return null;
  return <Saran onClick={() => onPilih(saya)}>Nama saya: {saya}</Saran>;
}
