import "server-only";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import type { SessionUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/lib/errors";
import { isStatusAset, type StatusAset } from "./barang.schema";
import {
  SOON_DAYS,
  type DueStatus,
  type HasilPemeliharaan,
  type JenisPemeliharaan,
  type PemeliharaanCreateInput,
  type PemeliharaanQuery,
  type PemeliharaanUpdateInput,
} from "./pemeliharaan.schema";

/* ------------------------------------------------------------------ helpers */

const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date | null): string | null =>
  d ? `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}` : null;

/** Hari ini (WITA) sebagai "YYYY-MM-DD". */
function todayWita(): string {
  const w = new Date(Date.now() + 8 * 3600 * 1000);
  return `${w.getUTCFullYear()}-${p2(w.getUTCMonth() + 1)}-${p2(w.getUTCDate())}`;
}
/** Tambah n hari ke string "YYYY-MM-DD". */
function addDaysStr(s: string, n: number): string {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}
function toDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function toBig(n: number | undefined | null): bigint | null {
  return n == null ? null : BigInt(Math.round(n));
}
function isNotFound(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025";
}

function computeStatus(next: string | null, today: string, soonLimit: string): DueStatus {
  if (!next) return "none";
  if (next < today) return "overdue";
  if (next <= soonLimit) return "soon";
  return "scheduled";
}

/* -------------------------------------------------------------------- tipe */

export type PemeliharaanBarangRow = {
  id: string;
  kodeBarang: string;
  nama: string;
  merk: string | null;
  statusAset: StatusAset;
  ruangan: { kodePrefix: string; nama: string };
  kondisi: { nama: string; tone: string } | null;
  terakhir: string | null;
  jatuhTempo: string | null;
  jumlah: number;
  status: DueStatus;
};

export type PemeliharaanStats = { overdue: number; soon: number; scheduled: number; none: number; total: number };

export type PemeliharaanListResult = {
  data: PemeliharaanBarangRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  stats: PemeliharaanStats;
};

export type RiwayatRow = {
  id: string;
  tanggal: string | null;
  jenis: JenisPemeliharaan;
  hasil: HasilPemeliharaan | null;
  kondisiSesudahId: string | null;
  kondisiSesudah: string | null;
  petugas: string | null;
  biaya: number | null;
  catatan: string | null;
  jatuhTempoBerikutnya: string | null;
  createdBy: string | null;
  createdAt: string;
};

/* ------------------------------------------------------------------- daftar */

export async function listPemeliharaan(q: PemeliharaanQuery): Promise<PemeliharaanListResult> {
  const db = getAppDb();
  const where: Prisma.InvBarangWhereInput = {};
  if (q.ruanganId) where.ruanganId = q.ruanganId;
  if (q.search) {
    const s = q.search.trim();
    where.OR = [{ kodeBarang: { contains: s } }, { nama: { contains: s } }, { merk: { contains: s } }];
  }

  const barang = await db.invBarang.findMany({
    where,
    select: {
      id: true, kodeBarang: true, nama: true, merk: true, statusAset: true,
      ruangan: { select: { kodePrefix: true, nama: true } },
      kondisi: { select: { nama: true, tone: true } },
    },
  });

  const ids = barang.map((b) => b.id);
  const agg = ids.length
    ? await db.invPemeliharaan.groupBy({
        by: ["barangId"],
        where: { barangId: { in: ids } },
        _max: { tanggal: true, jatuhTempoBerikutnya: true },
        _count: { _all: true },
      })
    : [];
  const map = new Map(agg.map((a) => [a.barangId, a]));

  const today = todayWita();
  const soonLimit = addDaysStr(today, SOON_DAYS);

  const rows: PemeliharaanBarangRow[] = barang.map((b) => {
    const a = map.get(b.id);
    const jatuhTempo = ymd(a?._max.jatuhTempoBerikutnya ?? null);
    return {
      id: b.id,
      kodeBarang: b.kodeBarang,
      nama: b.nama,
      merk: b.merk ?? null,
      statusAset: (isStatusAset(b.statusAset) ? b.statusAset : "AKTIF") as StatusAset,
      ruangan: { kodePrefix: b.ruangan.kodePrefix, nama: b.ruangan.nama },
      kondisi: b.kondisi ? { nama: b.kondisi.nama, tone: b.kondisi.tone } : null,
      terakhir: ymd(a?._max.tanggal ?? null),
      jatuhTempo,
      jumlah: a?._count._all ?? 0,
      status: computeStatus(jatuhTempo, today, soonLimit),
    };
  });

  const stats: PemeliharaanStats = {
    overdue: rows.filter((r) => r.status === "overdue").length,
    soon: rows.filter((r) => r.status === "soon").length,
    scheduled: rows.filter((r) => r.status === "scheduled").length,
    none: rows.filter((r) => r.status === "none").length,
    total: rows.length,
  };

  const filtered = q.status ? rows.filter((r) => r.status === q.status) : rows;

  // Urut: paling mendesak dulu (jatuh tempo → segera → terjadwal → belum),
  // lalu tanggal jatuh tempo naik, lalu kode.
  const order: Record<DueStatus, number> = { overdue: 0, soon: 1, scheduled: 2, none: 3 };
  filtered.sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    const ad = a.jatuhTempo ?? "9999-99-99";
    const bd = b.jatuhTempo ?? "9999-99-99";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.kodeBarang.localeCompare(b.kodeBarang);
  });

  const total = filtered.length;
  const start = (q.page - 1) * q.pageSize;
  return {
    data: filtered.slice(start, start + q.pageSize),
    meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
    stats,
  };
}

/* ------------------------------------------------------------------- refs */

export async function getPemeliharaanRefs() {
  const db = getAppDb();
  const [kondisi, ruangan] = await Promise.all([
    db.invKondisi.findMany({
      where: { aktif: true },
      orderBy: [{ urutan: "asc" }, { nama: "asc" }],
      select: { id: true, nama: true, kode: true, tone: true },
    }),
    db.invRuangan.findMany({
      where: { aktif: true },
      orderBy: [{ urutan: "asc" }, { kodePrefix: "asc" }],
      select: { id: true, kodePrefix: true, nama: true },
    }),
  ]);
  return { kondisi, ruangan };
}

/* ------------------------------------------------------------------ riwayat */

const riwayatSelect = {
  id: true, tanggal: true, jenis: true, hasil: true, kondisiSesudahId: true,
  petugas: true, biaya: true, catatan: true, jatuhTempoBerikutnya: true, createdBy: true, createdAt: true,
  kondisiSesudah: { select: { nama: true } },
} satisfies Prisma.InvPemeliharaanSelect;

type RiwayatDb = Prisma.InvPemeliharaanGetPayload<{ select: typeof riwayatSelect }>;

function serializeRiwayat(r: RiwayatDb): RiwayatRow {
  return {
    id: r.id,
    tanggal: ymd(r.tanggal),
    jenis: r.jenis as JenisPemeliharaan,
    hasil: (r.hasil ?? null) as HasilPemeliharaan | null,
    kondisiSesudahId: r.kondisiSesudahId ?? null,
    kondisiSesudah: r.kondisiSesudah?.nama ?? null,
    petugas: r.petugas ?? null,
    biaya: r.biaya == null ? null : Number(r.biaya),
    catatan: r.catatan ?? null,
    jatuhTempoBerikutnya: ymd(r.jatuhTempoBerikutnya),
    createdBy: r.createdBy ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listRiwayat(barangId: string): Promise<{ barang: { id: string; kodeBarang: string; nama: string }; riwayat: RiwayatRow[] }> {
  const db = getAppDb();
  const barang = await db.invBarang.findUnique({ where: { id: barangId }, select: { id: true, kodeBarang: true, nama: true } });
  if (!barang) throw new NotFoundError("Barang tidak ditemukan.");
  const rows = await db.invPemeliharaan.findMany({
    where: { barangId },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
    select: riwayatSelect,
  });
  return { barang, riwayat: rows.map(serializeRiwayat) };
}

/* -------------------------------------------------------------- create/update */

export async function createPemeliharaan(barangId: string, input: PemeliharaanCreateInput, user: SessionUser): Promise<RiwayatRow> {
  const db = getAppDb();
  const barang = await db.invBarang.findUnique({ where: { id: barangId }, select: { id: true } });
  if (!barang) throw new NotFoundError("Barang tidak ditemukan.");

  const created = await db.invPemeliharaan.create({
    data: {
      barangId,
      tanggal: toDate(input.tanggal)!,
      jenis: input.jenis,
      hasil: input.hasil,
      kondisiSesudahId: input.kondisiSesudahId ?? null,
      petugas: input.petugas ?? null,
      biaya: toBig(input.biaya),
      catatan: input.catatan ?? null,
      jatuhTempoBerikutnya: toDate(input.jatuhTempoBerikutnya),
      createdBy: user.name,
    },
    select: riwayatSelect,
  });

  // Perbarui kondisi fisik barang bila diisi kondisi sesudah servis.
  if (input.kondisiSesudahId) {
    await db.invBarang.update({ where: { id: barangId }, data: { kondisiId: input.kondisiSesudahId, updatedBy: user.name } });
  }

  return serializeRiwayat(created);
}

export async function updatePemeliharaan(id: string, input: PemeliharaanUpdateInput, user: SessionUser): Promise<RiwayatRow> {
  const db = getAppDb();
  const existing = await db.invPemeliharaan.findUnique({ where: { id }, select: { barangId: true } });
  if (!existing) throw new NotFoundError("Catatan pemeliharaan tidak ditemukan.");

  try {
    const updated = await db.invPemeliharaan.update({
      where: { id },
      data: {
        tanggal: toDate(input.tanggal)!,
        jenis: input.jenis,
        hasil: input.hasil,
        kondisiSesudahId: input.kondisiSesudahId ?? null,
        petugas: input.petugas ?? null,
        biaya: toBig(input.biaya),
        catatan: input.catatan ?? null,
        jatuhTempoBerikutnya: toDate(input.jatuhTempoBerikutnya),
      },
      select: riwayatSelect,
    });
    if (input.kondisiSesudahId) {
      await db.invBarang.update({ where: { id: existing.barangId }, data: { kondisiId: input.kondisiSesudahId, updatedBy: user.name } });
    }
    return serializeRiwayat(updated);
  } catch (e) {
    if (isNotFound(e)) throw new NotFoundError("Catatan pemeliharaan tidak ditemukan.");
    throw e;
  }
}
