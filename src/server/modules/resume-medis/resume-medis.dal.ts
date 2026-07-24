import "server-only";
import { callProcedure } from "@/server/db/call-procedure";
import type { CetakMR2Row } from "@/features/resume-medis/types";

/**
 * DAL Resume Medis — satu-satunya lapisan yang bicara ke SIMGOS untuk fitur ini.
 * Memanggil SP read-only `medicalrecord.CetakMR2(nopen)`.
 */

/**
 * Driver bisa mengembalikan angka/bigint/Date untuk kolom tertentu, sedangkan
 * mapper & tipe `CetakMR2Row` bekerja dengan `string | null`. Normalisasi di sini
 * menjaga kontrak tipe tetap jujur, apa pun typing driver.
 */
function normalizeRow(raw: Record<string, unknown>): CetakMR2Row {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = v == null ? null : String(v);
  }
  return out as unknown as CetakMR2Row;
}

/** Ambil baris CetakMR2 untuk satu pendaftaran (NOPEN). Kosong bila tak ada. */
export async function callCetakMR2(nopen: string): Promise<CetakMR2Row[]> {
  const rows = await callProcedure<Record<string, unknown>>("CETAK_MR2", nopen);
  return rows.map(normalizeRow);
}
