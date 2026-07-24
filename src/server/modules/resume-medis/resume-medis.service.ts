import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { mapCetakMR2 } from "@/features/resume-medis/mapper";
import type { ResumeMedisDto } from "@/features/resume-medis/types";
import {
  getResumeMedisById as getMockById,
  getResumeMedisList as getMockList,
  type ResumeMedisRingkas,
} from "@/lib/mock/resume-medis";
import { callCetakMR2 } from "./resume-medis.dal";

export type { ResumeMedisRingkas };

/**
 * Service Resume Medis. Sumber data:
 *  - SIMGOS terkonfigurasi → SP `CetakMR2` (read-only) lalu di-map ke DTO.
 *  - belum terkonfigurasi   → data simulasi (mock) agar UI tetap bisa dipakai.
 *
 * Dipakai baik oleh Server Component (halaman cetak) maupun API route.
 */
export async function getResumeMedis(id: string): Promise<ResumeMedisDto | null> {
  if (!isSimgosConfigured()) {
    return getMockById(id);
  }
  const rows = await callCetakMR2(id);
  const row = rows[0];
  return row ? mapCetakMR2(row, id) : null;
}

/**
 * Daftar pasien untuk katalog cetak. Belum ada SP daftar khusus, jadi memakai
 * data simulasi. Ganti dengan query kunjungan-selesai saat DAL daftar tersedia.
 */
export async function getResumeMedisList(): Promise<ResumeMedisRingkas[]> {
  return getMockList();
}
