import "server-only";
import {
  getKunjunganResumeList as getMock,
  type KunjunganResumeItem,
  type KategoriKunjungan,
} from "@/lib/mock/kunjungan";

export type { KunjunganResumeItem, KategoriKunjungan };

/**
 * Daftar kunjungan untuk katalog cetak Resume Medis.
 *
 * SEKARANG: memakai data simulasi.
 *
 * NANTI (butuh discovery skema): query lintas-DB read-only —
 *   FROM pendaftaran.kunjungan k
 *   JOIN master.ruangan r ON r.ID = k.RUANGAN
 *   (klasifikasi RI/RJ Klinik/IGD dari r.<jenis>, kolom KELUAR utk status final)
 * lalu difilter per minggu di WHERE. Bentuk DTO tetap `KunjunganResumeItem`
 * sehingga UI tidak berubah saat sumber diganti ke DB.
 */
export async function getKunjunganResumeList(): Promise<KunjunganResumeItem[]> {
  return getMock();
}
