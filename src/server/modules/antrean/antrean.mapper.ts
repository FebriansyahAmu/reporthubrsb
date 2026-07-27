import type { AntreanBpjs, AntreanStatus, AntreanTask, TaskId } from "@/lib/types";
import { LATE_THRESHOLD_MIN } from "@/lib/antrean-core";
import type { ReservasiRow, TaskActionRow } from "./antrean.dal";

const TASK_IDS: TaskId[] = [1, 2, 3, 4, 5, 6, 7];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * DATETIME dari adapter Prisma menaruh jam-dinding di field UTC (lihat catatan
 * `kunjungan.mapper`). Baca `getUTC*` → ISO lokal tanpa Z, mis "2026-07-27T12:02:27".
 */
function toWallClockIso(v: Date | string | null): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** DATE (atau string) → "YYYY-MM-DD". */
function toDateStr(v: Date | string | null): string {
  if (v == null) return "";
  if (typeof v === "string") return v.slice(0, 10);
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** "YYYY-MM-DD" dari komponen LOKAL sebuah Date (untuk menentukan "hari ini"). */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function noAntrean(pos: string | null, nomor: number | null): string {
  const p = pos?.trim();
  const n = nomor != null ? String(nomor).padStart(3, "0") : null;
  if (p && n) return `${p}-${n}`;
  return n ?? p ?? "—";
}

/**
 * Gabungkan baris reservasi + event task menjadi daftar `AntreanBpjs`.
 * Per (antrian, task) diambil TANGGAL PALING BARU (retry dianggap update).
 * Status & currentTaskId diturunkan dari task tertinggi yang tercatat — TIDAK
 * mengasumsikan task berurut dari 1 (BPJS sering mulai dari task 3).
 */
export function buildAntreanList(
  reservasi: ReservasiRow[],
  tasks: TaskActionRow[],
): AntreanBpjs[] {
  const now = new Date();
  const todayStr = localDateStr(now);

  // Peta ANTRIAN → (TASK_ID → waktu terbaru).
  const byAntrian = new Map<string, Map<number, string>>();
  for (const t of tasks) {
    const iso = toWallClockIso(t.TANGGAL);
    if (!iso) continue;
    let m = byAntrian.get(t.ANTRIAN);
    if (!m) {
      m = new Map();
      byAntrian.set(t.ANTRIAN, m);
    }
    const prev = m.get(t.TASK_ID);
    if (!prev || iso > prev) m.set(t.TASK_ID, iso);
  }

  return reservasi.map((r) => {
    const taskMap = byAntrian.get(r.ID) ?? new Map<number, string>();
    const tasksArr: AntreanTask[] = TASK_IDS.map((id) => ({
      taskId: id,
      waktu: taskMap.get(id) ?? null,
    }));

    const recorded = tasksArr.filter((t) => t.waktu);
    const maxRec = recorded.reduce((mx, t) => Math.max(mx, t.taskId), 0);
    const selesai = !!taskMap.get(7);

    const tanggal = toDateStr(r.TANGGALKUNJUNGAN);
    const isToday = tanggal === todayStr;

    // Menit tertahan: hanya bermakna untuk antrean HARI INI yang belum selesai.
    let menitTertahan = 0;
    if (!selesai && isToday && recorded.length > 0) {
      const last = Math.max(...recorded.map((t) => +new Date(t.waktu!)));
      menitTertahan = Math.max(0, Math.round((now.getTime() - last) / 60000));
    }

    const status: AntreanStatus = selesai
      ? "SELESAI"
      : menitTertahan >= LATE_THRESHOLD_MIN
        ? "TERLAMBAT"
        : "BERLANGSUNG";

    const currentTaskId = (selesai
      ? null
      : Math.min(maxRec + 1, 7)) as TaskId | null;

    const dokter = r.DOKTER?.trim();

    return {
      id: r.ID,
      tanggal,
      kodeBooking: r.ID, // nomor reservasi = ID
      noAntrean: noAntrean(r.POS_ANTRIAN, r.NOMOR_ANTRIAN),
      namaPasien: r.NAMA?.trim() || "—",
      noKartu: r.NO_KARTU_BPJS?.trim() || "—",
      poli: r.POLI_NAMA?.trim() || r.POLI_BPJS?.trim() || (r.POLI != null ? String(r.POLI) : "—"),
      dokter: dokter || "—",
      tasks: tasksArr,
      currentTaskId,
      status,
      menitTertahan,
    } satisfies AntreanBpjs;
  });
}
