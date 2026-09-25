import "server-only";
import { getAppDb } from "@/server/db/app.client";
import type { SessionUser } from "@/server/auth/session";
import { BusinessRuleError, NotFoundError } from "@/server/lib/errors";
import { isStatusAset, type StatusAset } from "./barang.schema";
import {
  isFrekuensi,
  type CompleteInput,
  type ExportQuery,
  type Frekuensi,
  type OverviewQuery,
  type PeriksaInput,
  type RiwayatQuery,
} from "./checklist.schema";

/* ------------------------------------------------------------ periode (WITA) */

const WITA_MS = 8 * 3600 * 1000;
const p2 = (n: number) => String(n).padStart(2, "0");
const BLN_PANJANG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const BLN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function nowWita(): Date {
  return new Date(Date.now() + WITA_MS);
}
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}
function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function isoWeek(d0: Date): { year: number; week: number } {
  const d = dateOnly(d0);
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThu.getTime()) / (7 * 86400000));
  return { year: d.getUTCFullYear(), week };
}
function weekRange(d0: Date): { start: Date; end: Date } {
  const d = dateOnly(d0);
  const dayNum = (d.getUTCDay() + 6) % 7;
  const start = addDays(d, -dayNum);
  return { start, end: addDays(start, 6) };
}

export type PeriodeInfo = { key: string; label: string; prevKey: string };

/** Info periode berjalan + kunci periode sebelumnya untuk sebuah frekuensi. */
export function periodeInfo(frekuensi: Frekuensi, base: Date = nowWita()): PeriodeInfo {
  if (frekuensi === "HARIAN") {
    const start = dateOnly(base);
    return {
      key: ymd(start),
      label: `Hari ini · ${start.getUTCDate()} ${BLN_PENDEK[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
      prevKey: ymd(addDays(start, -1)),
    };
  }
  if (frekuensi === "MINGGUAN") {
    const { year, week } = isoWeek(base);
    const { start, end } = weekRange(base);
    const sameMonth = start.getUTCMonth() === end.getUTCMonth();
    const label = sameMonth
      ? `Minggu ini · ${start.getUTCDate()}–${end.getUTCDate()} ${BLN_PENDEK[end.getUTCMonth()]} ${end.getUTCFullYear()}`
      : `Minggu ini · ${start.getUTCDate()} ${BLN_PENDEK[start.getUTCMonth()]}–${end.getUTCDate()} ${BLN_PENDEK[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
    const prev = isoWeek(addDays(base, -7));
    return { key: `${year}-W${p2(week)}`, label, prevKey: `${prev.year}-W${p2(prev.week)}` };
  }
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const prevY = m === 0 ? y - 1 : y;
  const prevM = m === 0 ? 12 : m;
  return { key: `${y}-${p2(m + 1)}`, label: `Bulan ini · ${BLN_PANJANG[m]} ${y}`, prevKey: `${prevY}-${p2(prevM)}` };
}

/** Senin (00:00 UTC) dari minggu-ISO ke-`week` tahun `year`. */
function mondayOfIsoWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7; // Senin=0
  const week1Mon = addDays(jan4, -jan4Dow);
  return addDays(week1Mon, (week - 1) * 7);
}

/** Label ramah untuk sebuah kunci periode historis (bukan periode berjalan). */
export function labelForPeriodeKey(frekuensi: Frekuensi, key: string): string {
  if (frekuensi === "HARIAN") {
    const [Y, M, D] = key.split("-").map(Number);
    if (!Y || !M || !D) return key;
    const d = new Date(Date.UTC(Y, M - 1, D));
    return `${HARI[d.getUTCDay()]}, ${D} ${BLN_PENDEK[M - 1]} ${Y}`;
  }
  if (frekuensi === "MINGGUAN") {
    const m = /^(\d{4})-W(\d{2})$/.exec(key);
    if (!m) return key;
    const year = Number(m[1]);
    const week = Number(m[2]);
    const start = mondayOfIsoWeek(year, week);
    const end = addDays(start, 6);
    const sameMonth = start.getUTCMonth() === end.getUTCMonth();
    const range = sameMonth
      ? `${start.getUTCDate()}–${end.getUTCDate()} ${BLN_PENDEK[end.getUTCMonth()]} ${end.getUTCFullYear()}`
      : `${start.getUTCDate()} ${BLN_PENDEK[start.getUTCMonth()]}–${end.getUTCDate()} ${BLN_PENDEK[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
    return `Minggu ke-${week} · ${range}`;
  }
  const [Y, M] = key.split("-").map(Number);
  if (!Y || !M) return key;
  return `${BLN_PANJANG[M - 1]} ${Y}`;
}

function asFrekuensi(v: string): Frekuensi {
  return isFrekuensi(v) ? v : "HARIAN";
}

/* -------------------------------------------------------------------- tipe */

export type ChecklistBarangRow = {
  barangId: string;
  kodeBarang: string;
  nama: string;
  merk: string | null;
  statusAset: StatusAset;
  kondisiSaatIni: { id: string; nama: string; tone: string } | null;
  checked: boolean;
  kondisiId: string | null;
  catatan: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
};

export type ChecklistStats = {
  harian: { done: number; total: number };
  mingguan: { done: number; total: number };
  bulanan: { done: number; total: number };
};

export type ChecklistOverview = {
  ruangan: { id: string; kodePrefix: string; nama: string };
  frekuensi: Frekuensi;
  periodeKey: string;
  periodeLabel: string;
  selesai: boolean;
  selesaiAt: string | null;
  selesaiBy: string | null;
  terlewat: boolean;
  total: number;
  done: number;
  rows: ChecklistBarangRow[];
  stats: ChecklistStats;
};

export type PeriksaState = {
  barangId: string | null;
  checked: boolean;
  kondisiId: string | null;
  catatan: string | null;
  checkedAt: string | null;
  done: number;
  total: number;
  selesai: boolean;
  selesaiAt: string | null;
  selesaiBy: string | null;
};

/* ------------------------------------------------------------------ helpers */

async function requireRuangan(id: string) {
  const db = getAppDb();
  const r = await db.invRuangan.findUnique({ where: { id }, select: { id: true, kodePrefix: true, nama: true } });
  if (!r) throw new NotFoundError("Ruangan tidak ditemukan.");
  return r;
}

/** Unit barang di ruangan yang perlu diperiksa (kecuali yang sudah dihapus). */
async function barangDiRuangan(ruanganId: string) {
  const db = getAppDb();
  return db.invBarang.findMany({
    where: { ruanganId, statusAset: { not: "DIHAPUS" } },
    orderBy: [{ kodeBarang: "asc" }],
    select: {
      id: true, kodeBarang: true, nama: true, merk: true, statusAset: true,
      kondisi: { select: { id: true, nama: true, tone: true } },
    },
  });
}

async function ensureRun(ruanganId: string, frekuensi: Frekuensi, periodeKey: string, user: SessionUser) {
  const db = getAppDb();
  const existing = await db.invChecklistRun.findUnique({
    where: { ruanganId_frekuensi_periodeKey: { ruanganId, frekuensi, periodeKey } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await db.invChecklistRun.create({
    data: { ruanganId, frekuensi, periodeKey, createdBy: user.name, updatedBy: user.name },
    select: { id: true },
  });
  return created.id;
}

/** Sinkronkan selesai run: selesai bila semua barang sudah diperiksa. */
async function syncRunSelesai(runId: string, totalBarang: number, user: SessionUser) {
  const db = getAppDb();
  const done = await db.invChecklistPeriksa.count({ where: { runId } });
  const run = await db.invChecklistRun.findUnique({ where: { id: runId }, select: { selesaiAt: true } });
  const shouldDone = totalBarang > 0 && done >= totalBarang;
  if (shouldDone && !run?.selesaiAt) {
    await db.invChecklistRun.update({ where: { id: runId }, data: { selesaiAt: new Date(), selesaiBy: user.name, updatedBy: user.name } });
  } else if (!shouldDone && run?.selesaiAt) {
    await db.invChecklistRun.update({ where: { id: runId }, data: { selesaiAt: null, selesaiBy: null, updatedBy: user.name } });
  }
  return done;
}

/* --------------------------------------------------------------- overview */

export async function listChecklist(q: OverviewQuery): Promise<ChecklistOverview> {
  const db = getAppDb();
  const ruangan = await requireRuangan(q.ruanganId);
  const barang = await barangDiRuangan(ruangan.id);
  const total = barang.length;

  const info = periodeInfo(q.frekuensi);
  const infoH = periodeInfo("HARIAN");
  const infoM = periodeInfo("MINGGUAN");
  const infoB = periodeInfo("BULANAN");

  // Run periode berjalan (frekuensi terpilih) + detail pemeriksaan.
  const run = await db.invChecklistRun.findUnique({
    where: { ruanganId_frekuensi_periodeKey: { ruanganId: ruangan.id, frekuensi: q.frekuensi, periodeKey: info.key } },
    select: {
      selesaiAt: true, selesaiBy: true,
      periksa: { select: { barangId: true, kondisiId: true, catatan: true, checkedBy: true, checkedAt: true } },
    },
  });
  const periksaMap = new Map((run?.periksa ?? []).map((p) => [p.barangId, p]));

  // Statistik ketiga frekuensi (periode berjalan) untuk ruangan ini.
  const statRuns = await db.invChecklistRun.findMany({
    where: {
      ruanganId: ruangan.id,
      OR: [
        { frekuensi: "HARIAN", periodeKey: infoH.key },
        { frekuensi: "MINGGUAN", periodeKey: infoM.key },
        { frekuensi: "BULANAN", periodeKey: infoB.key },
      ],
    },
    select: { frekuensi: true, _count: { select: { periksa: true } } },
  });
  const doneByFreq = new Map(statRuns.map((r) => [r.frekuensi, r._count.periksa]));
  const stats: ChecklistStats = {
    harian: { done: doneByFreq.get("HARIAN") ?? 0, total },
    mingguan: { done: doneByFreq.get("MINGGUAN") ?? 0, total },
    bulanan: { done: doneByFreq.get("BULANAN") ?? 0, total },
  };

  // Terlewat: periode sebelumnya pernah dijalankan tapi tak diselesaikan.
  const prev = await db.invChecklistRun.findUnique({
    where: { ruanganId_frekuensi_periodeKey: { ruanganId: ruangan.id, frekuensi: q.frekuensi, periodeKey: info.prevKey } },
    select: { selesaiAt: true, id: true },
  });
  const terlewat = !!prev && !prev.selesaiAt && total > 0;

  const rows: ChecklistBarangRow[] = barang.map((b) => {
    const p = periksaMap.get(b.id);
    return {
      barangId: b.id,
      kodeBarang: b.kodeBarang,
      nama: b.nama,
      merk: b.merk ?? null,
      statusAset: (isStatusAset(b.statusAset) ? b.statusAset : "AKTIF") as StatusAset,
      kondisiSaatIni: b.kondisi ? { id: b.kondisi.id, nama: b.kondisi.nama, tone: b.kondisi.tone } : null,
      checked: !!p,
      kondisiId: p?.kondisiId ?? null,
      catatan: p?.catatan ?? null,
      checkedBy: p?.checkedBy ?? null,
      checkedAt: p?.checkedAt ? p.checkedAt.toISOString() : null,
    };
  });

  return {
    ruangan,
    frekuensi: q.frekuensi,
    periodeKey: info.key,
    periodeLabel: info.label,
    selesai: !!run?.selesaiAt,
    selesaiAt: run?.selesaiAt ? run.selesaiAt.toISOString() : null,
    selesaiBy: run?.selesaiBy ?? null,
    terlewat,
    total,
    done: rows.filter((r) => r.checked).length,
    rows,
    stats,
  };
}

/* ------------------------------------------------------------------- refs */

export async function getChecklistRefs() {
  const db = getAppDb();
  const [ruangan, kondisi] = await Promise.all([
    db.invRuangan.findMany({
      where: { aktif: true },
      orderBy: [{ urutan: "asc" }, { kodePrefix: "asc" }],
      select: { id: true, kodePrefix: true, nama: true },
    }),
    db.invKondisi.findMany({
      where: { aktif: true },
      orderBy: [{ urutan: "asc" }, { nama: "asc" }],
      select: { id: true, nama: true, kode: true, tone: true },
    }),
  ]);
  return { ruangan, kondisi };
}

/* ----------------------------------------------------------------- mutasi */

async function runSummary(ruanganId: string, frekuensi: Frekuensi, periodeKey: string, total: number) {
  const db = getAppDb();
  const run = await db.invChecklistRun.findUnique({
    where: { ruanganId_frekuensi_periodeKey: { ruanganId, frekuensi, periodeKey } },
    select: { selesaiAt: true, selesaiBy: true, _count: { select: { periksa: true } } },
  });
  return {
    done: run?._count.periksa ?? 0,
    total,
    selesai: !!run?.selesaiAt,
    selesaiAt: run?.selesaiAt ? run.selesaiAt.toISOString() : null,
    selesaiBy: run?.selesaiBy ?? null,
  };
}

/** Centang / ubah / hapus pemeriksaan satu barang pada periode berjalan. */
export async function periksaBarang(input: PeriksaInput, user: SessionUser): Promise<PeriksaState> {
  const db = getAppDb();
  await requireRuangan(input.ruanganId);
  const barang = await db.invBarang.findUnique({ where: { id: input.barangId }, select: { id: true, ruanganId: true } });
  if (!barang) throw new NotFoundError("Barang tidak ditemukan.");
  if (barang.ruanganId !== input.ruanganId) throw new BusinessRuleError("Barang tidak berada di ruangan ini.");

  // Validasi kondisi bila diisi.
  if (input.kondisiId) {
    const k = await db.invKondisi.findUnique({ where: { id: input.kondisiId }, select: { id: true } });
    if (!k) throw new NotFoundError("Kondisi tidak ditemukan.");
  }

  const info = periodeInfo(input.frekuensi);
  const runId = await ensureRun(input.ruanganId, input.frekuensi, info.key, user);

  let checkedAt: Date | null = null;
  if (input.checked) {
    const existing = await db.invChecklistPeriksa.findUnique({
      where: { runId_barangId: { runId, barangId: input.barangId } },
      select: { id: true },
    });
    if (existing) {
      const up = await db.invChecklistPeriksa.update({
        where: { id: existing.id },
        data: { kondisiId: input.kondisiId ?? null, catatan: input.catatan ?? null, checkedBy: user.name, checkedAt: new Date() },
        select: { checkedAt: true },
      });
      checkedAt = up.checkedAt;
    } else {
      const cr = await db.invChecklistPeriksa.create({
        data: { runId, barangId: input.barangId, kondisiId: input.kondisiId ?? null, catatan: input.catatan ?? null, checkedBy: user.name },
        select: { checkedAt: true },
      });
      checkedAt = cr.checkedAt;
    }
    // Kondisi hasil periksa → perbarui kondisi aset di Master.
    if (input.kondisiId) {
      await db.invBarang.update({ where: { id: input.barangId }, data: { kondisiId: input.kondisiId, updatedBy: user.name } });
    }
  } else {
    await db.invChecklistPeriksa.deleteMany({ where: { runId, barangId: input.barangId } });
  }

  // Total barang di ruangan (untuk sinkron selesai).
  const total = await db.invBarang.count({ where: { ruanganId: input.ruanganId, statusAset: { not: "DIHAPUS" } } });
  await syncRunSelesai(runId, total, user);
  const sum = await runSummary(input.ruanganId, input.frekuensi, info.key, total);

  return {
    barangId: input.barangId,
    checked: input.checked,
    kondisiId: input.checked ? input.kondisiId ?? null : null,
    catatan: input.checked ? input.catatan ?? null : null,
    checkedAt: checkedAt ? checkedAt.toISOString() : null,
    ...sum,
  };
}

/** Tandai seluruh ruangan selesai (periksa semua barang) / batalkan. */
export async function completeRun(input: CompleteInput, user: SessionUser): Promise<PeriksaState> {
  const db = getAppDb();
  await requireRuangan(input.ruanganId);
  const barang = await barangDiRuangan(input.ruanganId);
  const total = barang.length;
  const info = periodeInfo(input.frekuensi);
  const runId = await ensureRun(input.ruanganId, input.frekuensi, info.key, user);

  if (input.selesai) {
    const existing = await db.invChecklistPeriksa.findMany({ where: { runId }, select: { barangId: true } });
    const have = new Set(existing.map((p) => p.barangId));
    const toAdd = barang.filter((b) => !have.has(b.id));
    if (toAdd.length) {
      await db.invChecklistPeriksa.createMany({
        data: toAdd.map((b) => ({ runId, barangId: b.id, checkedBy: user.name })),
        skipDuplicates: true,
      });
    }
    await db.invChecklistRun.update({
      where: { id: runId },
      data: { selesaiAt: new Date(), selesaiBy: user.name, catatan: input.catatan ?? null, updatedBy: user.name },
    });
  } else {
    await db.invChecklistPeriksa.deleteMany({ where: { runId } });
    await db.invChecklistRun.update({
      where: { id: runId },
      data: { selesaiAt: null, selesaiBy: null, catatan: null, updatedBy: user.name },
    });
  }

  const sum = await runSummary(input.ruanganId, input.frekuensi, info.key, total);
  return { barangId: null, checked: input.selesai, kondisiId: null, catatan: null, checkedAt: null, ...sum };
}

/* ---------------------------------------------------------------- riwayat */

export type RiwayatRun = {
  id: string;
  periodeKey: string;
  periodeLabel: string;
  selesai: boolean;
  selesaiAt: string | null;
  selesaiBy: string | null;
  done: number;
  total: number;
  /** Apakah baris ini = periode yang sedang berjalan. */
  current: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RiwayatOverview = {
  ruangan: { id: string; kodePrefix: string; nama: string };
  frekuensi: Frekuensi;
  /** Jumlah unit barang di ruangan saat ini (acuan progres). */
  total: number;
  runs: RiwayatRun[];
};

export type RunDetailRow = {
  barangId: string;
  kodeBarang: string;
  nama: string;
  merk: string | null;
  checked: boolean;
  /** Kondisi hasil periksa saat itu (bukan kondisi terkini aset). */
  kondisi: { nama: string; tone: string } | null;
  catatan: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
};

export type RunDetail = {
  id: string | null;
  ruangan: { id: string; kodePrefix: string; nama: string };
  frekuensi: Frekuensi;
  periodeKey: string;
  periodeLabel: string;
  selesai: boolean;
  selesaiAt: string | null;
  selesaiBy: string | null;
  catatan: string | null;
  done: number;
  total: number;
  rows: RunDetailRow[];
};

type PeriksaLite = {
  barangId: string;
  catatan: string | null;
  checkedBy: string | null;
  checkedAt: Date;
  kondisi: { nama: string; tone: string } | null;
};

/** Bangun baris detail: seluruh barang ruangan + status periksa pada satu run. */
async function detailRows(ruanganId: string, periksa: PeriksaLite[]): Promise<RunDetailRow[]> {
  const barang = await barangDiRuangan(ruanganId);
  const pmap = new Map(periksa.map((p) => [p.barangId, p]));
  return barang.map((b) => {
    const p = pmap.get(b.id);
    return {
      barangId: b.id,
      kodeBarang: b.kodeBarang,
      nama: b.nama,
      merk: b.merk ?? null,
      checked: !!p,
      kondisi: p?.kondisi ? { nama: p.kondisi.nama, tone: p.kondisi.tone } : null,
      catatan: p?.catatan ?? null,
      checkedBy: p?.checkedBy ?? null,
      checkedAt: p?.checkedAt ? p.checkedAt.toISOString() : null,
    };
  });
}

/** Daftar pelaksanaan checklist (per periode) satu ruangan/frekuensi, terbaru dulu. */
export async function listRiwayat(q: RiwayatQuery): Promise<RiwayatOverview> {
  const db = getAppDb();
  const ruangan = await requireRuangan(q.ruanganId);
  const total = await db.invBarang.count({ where: { ruanganId: ruangan.id, statusAset: { not: "DIHAPUS" } } });
  const info = periodeInfo(q.frekuensi);

  const runs = await db.invChecklistRun.findMany({
    where: { ruanganId: ruangan.id, frekuensi: q.frekuensi },
    orderBy: [{ periodeKey: "desc" }],
    take: q.limit,
    select: {
      id: true, periodeKey: true, selesaiAt: true, selesaiBy: true,
      createdAt: true, updatedAt: true, _count: { select: { periksa: true } },
    },
  });

  return {
    ruangan,
    frekuensi: q.frekuensi,
    total,
    runs: runs.map((r) => ({
      id: r.id,
      periodeKey: r.periodeKey,
      periodeLabel: labelForPeriodeKey(q.frekuensi, r.periodeKey),
      selesai: !!r.selesaiAt,
      selesaiAt: r.selesaiAt ? r.selesaiAt.toISOString() : null,
      selesaiBy: r.selesaiBy ?? null,
      done: r._count.periksa,
      total,
      current: r.periodeKey === info.key,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

/** Detail satu pelaksanaan checklist (per run id). */
export async function getRunDetail(runId: string): Promise<RunDetail> {
  const db = getAppDb();
  const run = await db.invChecklistRun.findUnique({
    where: { id: runId },
    select: {
      id: true, ruanganId: true, frekuensi: true, periodeKey: true,
      selesaiAt: true, selesaiBy: true, catatan: true,
      ruangan: { select: { id: true, kodePrefix: true, nama: true } },
      periksa: {
        select: { barangId: true, catatan: true, checkedBy: true, checkedAt: true, kondisi: { select: { nama: true, tone: true } } },
      },
    },
  });
  if (!run) throw new NotFoundError("Riwayat checklist tidak ditemukan.");
  const frekuensi = asFrekuensi(run.frekuensi);
  const rows = await detailRows(run.ruanganId, run.periksa);
  return {
    id: run.id,
    ruangan: run.ruangan,
    frekuensi,
    periodeKey: run.periodeKey,
    periodeLabel: labelForPeriodeKey(frekuensi, run.periodeKey),
    selesai: !!run.selesaiAt,
    selesaiAt: run.selesaiAt ? run.selesaiAt.toISOString() : null,
    selesaiBy: run.selesaiBy ?? null,
    catatan: run.catatan ?? null,
    done: rows.filter((r) => r.checked).length,
    total: rows.length,
    rows,
  };
}

/** Detail checklist satu periode (default periode berjalan) — dipakai ekspor. */
export async function periodeDetail(ruanganId: string, frekuensi: Frekuensi, periodeKey?: string): Promise<RunDetail> {
  const db = getAppDb();
  const ruangan = await requireRuangan(ruanganId);
  const info = periodeInfo(frekuensi);
  const key = periodeKey?.trim() || info.key;
  const isCurrent = key === info.key;

  const run = await db.invChecklistRun.findUnique({
    where: { ruanganId_frekuensi_periodeKey: { ruanganId, frekuensi, periodeKey: key } },
    select: {
      id: true, selesaiAt: true, selesaiBy: true, catatan: true,
      periksa: {
        select: { barangId: true, catatan: true, checkedBy: true, checkedAt: true, kondisi: { select: { nama: true, tone: true } } },
      },
    },
  });
  const rows = await detailRows(ruangan.id, run?.periksa ?? []);
  return {
    id: run?.id ?? null,
    ruangan,
    frekuensi,
    periodeKey: key,
    periodeLabel: isCurrent ? periodeInfo(frekuensi).label.replace(/^[^·]*·\s*/, "") : labelForPeriodeKey(frekuensi, key),
    selesai: !!run?.selesaiAt,
    selesaiAt: run?.selesaiAt ? run.selesaiAt.toISOString() : null,
    selesaiBy: run?.selesaiBy ?? null,
    catatan: run?.catatan ?? null,
    done: rows.filter((r) => r.checked).length,
    total: rows.length,
    rows,
  };
}

export type { ExportQuery };
