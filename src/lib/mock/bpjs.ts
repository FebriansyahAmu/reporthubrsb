import type {
  AntreanBpjs,
  AntreanStatus,
  AntreanTask,
  TaskId,
} from "@/lib/types";

/**
 * MOCK Antrean BPJS (Task 1..7) — untuk pengembangan UI monitoring.
 * Nanti diganti data nyata dari SIMGOS / bridging Antrean RS BPJS (read-only).
 */

export const POLI_BPJS = [
  "Poli Umum",
  "Poli Penyakit Dalam",
  "Poli Anak",
  "Poli Mata",
  "Poli Bedah",
  "Poli Gigi",
  "Poli Jantung",
];

const DOKTER_BPJS: Record<string, string> = {
  "Poli Umum": "dr. Andi Kusuma",
  "Poli Penyakit Dalam": "dr. Rudi Hartono, Sp.PD",
  "Poli Anak": "dr. Nina Kartika, Sp.A",
  "Poli Mata": "dr. Yoga Pratama, Sp.M",
  "Poli Bedah": "dr. Reza Fahlevi, Sp.B",
  "Poli Gigi": "dr. Sari Melati, Sp.KG",
  "Poli Jantung": "dr. Hesti Wijayanti, Sp.JP",
};

const NAMA = [
  "Budi Santoso", "Siti Rahmawati", "Andi Wijaya", "Dewi Lestari", "Rizky Pratama",
  "Nur Aisyah", "Agus Setiawan", "Maya Putri", "Hendra Gunawan", "Ratna Sari",
  "Joko Susilo", "Lina Marlina", "Fajar Nugroho", "Indah Permata", "Bayu Aditya",
  "Sri Wahyuni", "Doni Kurniawan", "Wulan Sari", "Eko Prasetyo", "Fitri Handayani",
  "Taufik Hidayat", "Yuni Astuti", "Rahmat Hakim", "Citra Dewi", "Irfan Maulana",
  "Sinta Bella", "Galih Saputra", "Mega Utami", "Arif Rahman", "Dina Fitria",
  "Bagus Prasetyo", "Elis Suryani",
];

/** "Sekarang" simulasi — pertengahan pagi hari ini. */
const NOW = new Date("2026-07-23T10:30:00");
const TODAY_0700 = new Date("2026-07-23T07:00:00");

const SEG_BASE = [7, 4, 14, 9, 5, 11]; // menit tipikal: T1→T2 ... T6→T7

function pad(n: number, len = 3) {
  return String(n).padStart(len, "0");
}

function segMenit(i: number, seg: number): number {
  return SEG_BASE[seg] + ((i * 7 + seg * 13) % 9);
}

function bookingCode(i: number): string {
  const base = (i * 2654435761) % 1000000;
  return `BK${pad(base, 6)}`;
}

function buildAntrean(i: number): AntreanBpjs {
  const poli = POLI_BPJS[i % POLI_BPJS.length];

  // completedCount 1..7 tersebar untuk variasi tahap.
  const completed = (((i * 3) % 7) + 1) as number;

  // lama tertahan di tahap kini (menit); sebagian sengaja "stuck".
  let menitTertahan = 3 + ((i * 5) % 12);
  if (i % 6 === 2) menitTertahan += 26; // kasus terlambat

  const times: (Date | null)[] = Array(7).fill(null);

  if (completed >= 7) {
    // Selesai: T7 tercatat beberapa menit lalu.
    const t7 = new Date(NOW.getTime() - (5 + (i % 20)) * 60000);
    times[6] = t7;
    for (let k = 5; k >= 0; k--) {
      times[k] = new Date(times[k + 1]!.getTime() - segMenit(i, k) * 60000);
    }
  } else {
    // Berjalan: task terakhir selesai `menitTertahan` menit lalu, backfill ke belakang.
    const last = new Date(NOW.getTime() - menitTertahan * 60000);
    times[completed - 1] = last;
    for (let k = completed - 2; k >= 0; k--) {
      times[k] = new Date(times[k + 1]!.getTime() - segMenit(i, k) * 60000);
    }
  }

  // Pastikan T1 tidak sebelum jam buka (kosmetik).
  if (times[0] && times[0] < TODAY_0700) times[0] = new Date(TODAY_0700);

  const tasks: AntreanTask[] = times.map((t, idx) => ({
    taskId: (idx + 1) as TaskId,
    waktu: t ? t.toISOString() : null,
  }));

  const currentTaskId = (completed >= 7 ? null : completed + 1) as TaskId | null;

  const status: AntreanStatus =
    completed >= 7 ? "SELESAI" : menitTertahan >= 25 ? "TERLAMBAT" : "BERLANGSUNG";

  return {
    id: String(2000 + i),
    kodeBooking: bookingCode(i),
    noAntrean: `${poli.split(" ").pop()?.[0] ?? "A"}-${pad((i % 40) + 1, 3)}`,
    namaPasien: NAMA[i % NAMA.length],
    noKartu: `000${pad(1000000000 + i * 137, 10)}`.slice(-13),
    poli,
    dokter: DOKTER_BPJS[poli],
    tasks,
    currentTaskId,
    status,
    menitTertahan: completed >= 7 ? 0 : menitTertahan,
  };
}

const ANTREAN = Array.from({ length: 32 }, (_, i) => buildAntrean(i));

export function completedCount(a: AntreanBpjs): number {
  return a.tasks.filter((t) => t.waktu).length;
}

/** Durasi total (menit) T1→T7 untuk antrean selesai; null bila belum selesai. */
function durasiTotal(a: AntreanBpjs): number | null {
  const t1 = a.tasks[0].waktu;
  const t7 = a.tasks[6].waktu;
  if (!t1 || !t7) return null;
  return Math.round((+new Date(t7) - +new Date(t1)) / 60000);
}

export type AntreanFilter = {
  search?: string;
  poli?: string | "ALL";
  status?: AntreanStatus | "ALL";
  tahap?: number | "ALL"; // completedCount 1..7
};

export type AntreanSummary = {
  total: number;
  selesai: number;
  berlangsung: number;
  terlambat: number;
  rataMenit: number | null; // rata-rata durasi total antrean selesai
};

export type PipelineStage = { taskId: TaskId; jumlah: number };

function delay<T>(v: T, ms = 400): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms));
}

export async function getAntreanBpjs(f: AntreanFilter): Promise<{
  data: AntreanBpjs[];
  summary: AntreanSummary;
  pipeline: PipelineStage[];
  updatedAt: string;
}> {
  const all = ANTREAN;

  const data = all.filter((a) => {
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

  const durasiSelesai = all
    .map(durasiTotal)
    .filter((d): d is number => d != null);

  const summary: AntreanSummary = {
    total: all.length,
    selesai: all.filter((a) => a.status === "SELESAI").length,
    berlangsung: all.filter((a) => a.status === "BERLANGSUNG").length,
    terlambat: all.filter((a) => a.status === "TERLAMBAT").length,
    rataMenit: durasiSelesai.length
      ? Math.round(durasiSelesai.reduce((s, d) => s + d, 0) / durasiSelesai.length)
      : null,
  };

  const pipeline: PipelineStage[] = ([1, 2, 3, 4, 5, 6, 7] as TaskId[]).map((t) => ({
    taskId: t,
    jumlah: all.filter((a) => completedCount(a) === t).length,
  }));

  return delay({ data, summary, pipeline, updatedAt: new Date().toISOString() });
}
