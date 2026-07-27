/**
 * Logika ringkasan/pipeline/paginasi Antrean BPJS — MURNI (tanpa I/O, tanpa
 * `server-only`), sehingga dipakai bersama oleh service (data nyata SIMGOS) dan
 * mock, serta tipe-nya aman diimpor komponen client.
 *
 * Sumber data (reservasi + task_action_antrian) diubah ke `AntreanBpjs[]` oleh
 * pemanggil; di sini hanya menyaring, meringkas, dan memotong halaman.
 */
import type { AntreanBpjs, AntreanStatus, PageMeta, TaskId } from "@/lib/types";

/** Ambang (menit) sebuah task berjalan dianggap TERLAMBAT. */
export const LATE_THRESHOLD_MIN = 25;

export type AntreanFilter = {
  tanggal: string; // YYYY-MM-DD
  search?: string;
  poli?: string | "ALL";
  status?: AntreanStatus | "ALL";
  tahap?: number | "ALL"; // completedCount 1..7
  page?: number;
  pageSize?: number;
};

export type AntreanSummary = {
  total: number;
  selesai: number;
  berlangsung: number;
  terlambat: number;
  rataMenit: number | null; // rata-rata durasi layanan antrean selesai
};

export type PipelineStage = { taskId: TaskId; jumlah: number };

export type AntreanResult = {
  data: AntreanBpjs[];
  meta: PageMeta;
  summary: AntreanSummary;
  pipeline: PipelineStage[];
  /** Daftar nama poli unik pada tanggal terpilih (untuk dropdown filter). */
  poliOptions: string[];
  updatedAt: string;
};

/** Jumlah task (1..7) yang sudah punya waktu tercatat. */
export function completedCount(a: AntreanBpjs): number {
  return a.tasks.filter((t) => t.waktu).length;
}

/**
 * Durasi layanan (menit): dari task PALING AWAL yang tercatat s.d. T7 (farmasi
 * selesai). Null bila belum selesai. Task 1/2 sering tak dikirim BPJS, jadi
 * memakai task paling awal yang ada — bukan wajib T1.
 */
function durasiTotal(a: AntreanBpjs): number | null {
  const t7 = a.tasks[6]?.waktu;
  if (!t7) return null;
  const times = a.tasks
    .map((t) => (t.waktu ? +new Date(t.waktu) : null))
    .filter((n): n is number => n != null);
  if (times.length === 0) return null;
  return Math.round((+new Date(t7) - Math.min(...times)) / 60000);
}

const TAHAP: TaskId[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Saring `scoped` (sudah dibatasi tanggal) sesuai filter, hitung ringkasan &
 * pipeline atas SELURUH `scoped`, lalu potong halaman.
 */
export function buildAntreanResult(scoped: AntreanBpjs[], f: AntreanFilter): AntreanResult {
  const filtered = scoped.filter((a) => {
    if (f.poli && f.poli !== "ALL" && a.poli !== f.poli) return false;
    if (f.status && f.status !== "ALL" && a.status !== f.status) return false;
    if (f.tahap && f.tahap !== "ALL" && completedCount(a) !== f.tahap) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = `${a.namaPasien} ${a.noAntrean} ${a.kodeBooking} ${a.noKartu}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 10;
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  const durasiSelesai = scoped
    .map(durasiTotal)
    .filter((d): d is number => d != null);

  const summary: AntreanSummary = {
    total: scoped.length,
    selesai: scoped.filter((a) => a.status === "SELESAI").length,
    berlangsung: scoped.filter((a) => a.status === "BERLANGSUNG").length,
    terlambat: scoped.filter((a) => a.status === "TERLAMBAT").length,
    rataMenit: durasiSelesai.length
      ? Math.round(durasiSelesai.reduce((s, d) => s + d, 0) / durasiSelesai.length)
      : null,
  };

  const pipeline: PipelineStage[] = TAHAP.map((t) => ({
    taskId: t,
    jumlah: scoped.filter((a) => completedCount(a) === t).length,
  }));

  const poliOptions = Array.from(
    new Set(scoped.map((a) => a.poli).filter((p): p is string => !!p && p !== "—")),
  ).sort((a, b) => a.localeCompare(b, "id"));

  return {
    data,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    summary,
    pipeline,
    poliOptions,
    updatedAt: new Date().toISOString(),
  };
}
