import "server-only";
import { AppError } from "@/server/lib/errors";
import { toWallClockIso } from "./antrean.mapper";
import { queryLatestTaskRow, updateTask5Tanggal } from "./antrean.write.dal";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Kurangi satu menit dari jam-dinding ISO ("YYYY-MM-DDTHH:MM:SS"). Digit
 * diperlakukan sebagai UTC agar aritmetika (rollover menit/jam/hari) aman &
 * TIDAK bergeser timezone; hasilnya tetap jam-dinding.
 */
function minusOneMinute(wallIso: string): string {
  const d = new Date(`${wallIso}Z`);
  d.setUTCMinutes(d.getUTCMinutes() - 1);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** "YYYY-MM-DDTHH:MM:SS" → "YYYY-MM-DD HH:MM:SS" untuk literal DATETIME MySQL. */
function toMysqlDateTime(wallIso: string): string {
  return wallIso.replace("T", " ");
}

export type SesuaikanTaskResult = {
  antrian: string;
  /** Waktu Task 5 sebelum koreksi (jam-dinding ISO). */
  sebelum: string;
  /** Waktu Task 5 setelah koreksi (= Task 6 − 1 menit). */
  sesudah: string;
  task6: string;
};

/**
 * Koreksi urutan: set Task 5 = Task 6 − 1 menit, HANYA bila saat ini Task 5 >
 * Task 6 (keduanya harus sudah tercatat). Server memvalidasi ulang kondisi ini
 * agar aman dari race / pemanggilan yang tak sesuai.
 */
export async function sesuaikanTask5(antrian: string): Promise<SesuaikanTaskResult> {
  const [t5, t6] = await Promise.all([
    queryLatestTaskRow(antrian, 5),
    queryLatestTaskRow(antrian, 6),
  ]);

  if (!t5) throw new AppError("Task 5 belum tercatat untuk antrean ini.", "TASK5_NOT_FOUND", 400);
  if (!t6) throw new AppError("Task 6 belum tercatat untuk antrean ini.", "TASK6_NOT_FOUND", 400);

  const t5w = toWallClockIso(t5.TANGGAL);
  const t6w = toWallClockIso(t6.TANGGAL);
  if (!t5w || !t6w) throw new AppError("Waktu task tidak valid.", "INVALID_TIME", 400);

  // Bandingkan jam-dinding (format seragam → aman dibandingkan sbg string).
  if (t5w <= t6w) {
    throw new AppError(
      "Task 5 sudah lebih awal dari Task 6 — tidak perlu disesuaikan.",
      "NOT_APPLICABLE",
      400,
    );
  }

  const sesudah = minusOneMinute(t6w);
  const affected = await updateTask5Tanggal(t5.ID, toMysqlDateTime(sesudah));
  if (affected < 1) {
    throw new AppError("Gagal memperbarui waktu Task 5.", "UPDATE_FAILED", 500);
  }

  return { antrian, sebelum: t5w, sesudah, task6: t6w };
}
