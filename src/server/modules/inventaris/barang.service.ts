import "server-only";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import type { SessionUser } from "@/server/auth/session";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/server/lib/errors";
import {
  STATUS_ASET,
  barangCreateSchema,
  isStatusAset,
  type BarangCreateInput,
  type BarangQuery,
  type BarangUpdateInput,
  type StatusAset,
} from "./barang.schema";

/* ------------------------------------------------------------------- tipe DTO */

export type BarangRefMini = { id: string; nama: string; kode?: string | null; tone?: string | null };

export type BarangListItem = {
  id: string;
  kodeBarang: string;
  register: number | null;
  nama: string;
  merk: string | null;
  nomorSeri: string | null;
  tahunPerolehan: number | null;
  tglPerolehan: string | null;
  harga: number | null;
  statusAset: StatusAset;
  keterangan: string | null;
  item: { id: string; nama: string } | null;
  kategori: BarangRefMini | null;
  sumberAnggaran: (BarangRefMini & { singkatan?: string | null }) | null;
  satuan: BarangRefMini | null;
  kondisi: (BarangRefMini & { tone: string }) | null;
  ruangan: { id: string; kodePrefix: string; nama: string; pjNama: string | null; pjNip: string | null };
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FormRefs = {
  satuan: { id: string; nama: string }[];
  kondisi: { id: string; nama: string; kode: string; tone: string }[];
  sumberAnggaran: { id: string; nama: string; singkatan: string }[];
  kategori: { id: string; nama: string }[];
  ruangan: { id: string; kodePrefix: string; nama: string; pjNama: string | null; pjNip: string | null }[];
  /** Katalog jenis barang (untuk autocomplete "Nama Barang" agar konsisten). */
  item: { id: string; nama: string }[];
};

const barangInclude = {
  item: { select: { id: true, nama: true } },
  kategori: { select: { id: true, nama: true } },
  sumberAnggaran: { select: { id: true, nama: true, singkatan: true } },
  satuan: { select: { id: true, nama: true } },
  kondisi: { select: { id: true, nama: true, kode: true, tone: true } },
  ruangan: { select: { id: true, kodePrefix: true, nama: true, pjNama: true, pjNip: true } },
} satisfies Prisma.InvBarangInclude;

type BarangWithRefs = Prisma.InvBarangGetPayload<{ include: typeof barangInclude }>;

const ymd = (d: Date | null): string | null => {
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
};

/** Serialisasi baris Prisma → DTO (BigInt harga → number; Date → string). */
function serialize(b: BarangWithRefs): BarangListItem {
  return {
    id: b.id,
    kodeBarang: b.kodeBarang,
    register: b.register ?? null,
    nama: b.nama,
    merk: b.merk ?? null,
    nomorSeri: b.nomorSeri ?? null,
    tahunPerolehan: b.tahunPerolehan ?? null,
    tglPerolehan: ymd(b.tglPerolehan),
    harga: b.harga == null ? null : Number(b.harga),
    statusAset: (isStatusAset(b.statusAset) ? b.statusAset : "AKTIF") as StatusAset,
    keterangan: b.keterangan ?? null,
    item: b.item ? { id: b.item.id, nama: b.item.nama } : null,
    kategori: b.kategori ? { id: b.kategori.id, nama: b.kategori.nama } : null,
    sumberAnggaran: b.sumberAnggaran
      ? { id: b.sumberAnggaran.id, nama: b.sumberAnggaran.nama, singkatan: b.sumberAnggaran.singkatan }
      : null,
    satuan: b.satuan ? { id: b.satuan.id, nama: b.satuan.nama } : null,
    kondisi: b.kondisi
      ? { id: b.kondisi.id, nama: b.kondisi.nama, kode: b.kondisi.kode, tone: b.kondisi.tone }
      : null,
    ruangan: {
      id: b.ruangan.id,
      kodePrefix: b.ruangan.kodePrefix,
      nama: b.ruangan.nama,
      pjNama: b.ruangan.pjNama ?? null,
      pjNip: b.ruangan.pjNip ?? null,
    },
    createdBy: b.createdBy ?? null,
    updatedBy: b.updatedBy ?? null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

function isUnique(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}
function isNotFound(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025";
}

/* --------------------------------------------------------------------- daftar */

export type BarangListResult = {
  data: BarangListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number; totalNilai: number };
};

function buildWhere(q: BarangQuery): Prisma.InvBarangWhereInput {
  const where: Prisma.InvBarangWhereInput = {};
  if (q.search) {
    const s = q.search.trim();
    where.OR = [
      { kodeBarang: { contains: s } },
      { nama: { contains: s } },
      { merk: { contains: s } },
      { nomorSeri: { contains: s } },
    ];
  }
  if (q.ruanganId) where.ruanganId = q.ruanganId;
  if (q.kategoriId) where.kategoriId = q.kategoriId;
  if (q.kondisiId) where.kondisiId = q.kondisiId;
  if (q.sumberAnggaranId) where.sumberAnggaranId = q.sumberAnggaranId;
  if (q.status) where.statusAset = q.status;
  if (q.tahun != null) where.tahunPerolehan = q.tahun;
  return where;
}

function buildOrderBy(sort: BarangQuery["sort"]): Prisma.InvBarangOrderByWithRelationInput {
  switch (sort) {
    case "kode":
      return { kodeBarang: "asc" };
    case "nama":
      return { nama: "asc" };
    case "tahun":
      return { tahunPerolehan: "desc" };
    case "harga":
      return { harga: "desc" };
    default:
      return { createdAt: "desc" };
  }
}

export async function listBarang(q: BarangQuery): Promise<BarangListResult> {
  const db = getAppDb();
  const where = buildWhere(q);
  const [total, rows, agg] = await Promise.all([
    db.invBarang.count({ where }),
    db.invBarang.findMany({
      where,
      include: barangInclude,
      orderBy: buildOrderBy(q.sort),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    db.invBarang.aggregate({ where, _sum: { harga: true } }),
  ]);
  return {
    data: rows.map(serialize),
    meta: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      totalNilai: agg._sum.harga == null ? 0 : Number(agg._sum.harga),
    },
  };
}

/** Seluruh baris untuk export (tanpa paginasi, ikut filter). */
export async function listBarangAll(q: BarangQuery): Promise<BarangListItem[]> {
  const db = getAppDb();
  const rows = await db.invBarang.findMany({
    where: buildWhere(q),
    include: barangInclude,
    orderBy: buildOrderBy(q.sort),
  });
  return rows.map(serialize);
}

export async function getBarang(id: string): Promise<BarangListItem> {
  const db = getAppDb();
  const row = await db.invBarang.findUnique({ where: { id }, include: barangInclude });
  if (!row) throw new NotFoundError("Barang tidak ditemukan.");
  return serialize(row);
}

/* --------------------------------------------------------------- form & ref */

export async function getFormRefs(): Promise<FormRefs> {
  const db = getAppDb();
  const [satuan, kondisi, sumber, kategori, ruangan, item] = await Promise.all([
    db.invSatuan.findMany({ where: { aktif: true }, orderBy: [{ urutan: "asc" }, { nama: "asc" }], select: { id: true, nama: true } }),
    db.invKondisi.findMany({ where: { aktif: true }, orderBy: [{ urutan: "asc" }, { nama: "asc" }], select: { id: true, nama: true, kode: true, tone: true } }),
    db.invSumberAnggaran.findMany({ where: { aktif: true }, orderBy: [{ urutan: "asc" }, { nama: "asc" }], select: { id: true, nama: true, singkatan: true } }),
    db.invKategori.findMany({ where: { aktif: true }, orderBy: [{ urutan: "asc" }, { nama: "asc" }], select: { id: true, nama: true } }),
    db.invRuangan.findMany({ where: { aktif: true }, orderBy: [{ urutan: "asc" }, { kodePrefix: "asc" }], select: { id: true, kodePrefix: true, nama: true, pjNama: true, pjNip: true } }),
    db.invItem.findMany({ where: { aktif: true }, orderBy: [{ nama: "asc" }], select: { id: true, nama: true } }),
  ]);
  return { satuan, kondisi, sumberAnggaran: sumber, kategori, ruangan, item };
}

/* ------------------------------------------------------- katalog item helper */

/** Normalisasi nama → kunci katalog (rapatkan spasi + huruf besar). */
export function normItemKey(nama: string): string {
  return nama.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Cari-atau-buat item katalog berdasar nama (ternormalkan). Mengembalikan
 * {id, nama baku}. `cache` opsional agar batch import tak query berulang.
 */
async function resolveItem(
  nama: string,
  opts: { satuanId?: string | null; kategoriId?: string | null; user: SessionUser },
  cache?: Map<string, { id: string; nama: string }>,
): Promise<{ id: string; nama: string } | null> {
  const clean = nama.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  const namaKey = clean.toUpperCase();
  if (cache?.has(namaKey)) return cache.get(namaKey)!;
  const db = getAppDb();
  let item = await db.invItem.findUnique({ where: { namaKey }, select: { id: true, nama: true } });
  if (!item) {
    try {
      item = await db.invItem.create({
        data: {
          nama: clean,
          namaKey,
          satuanId: opts.satuanId ?? null,
          kategoriId: opts.kategoriId ?? null,
          createdBy: opts.user.name,
          updatedBy: opts.user.name,
        },
        select: { id: true, nama: true },
      });
    } catch (e) {
      if (isUnique(e)) item = await db.invItem.findUnique({ where: { namaKey }, select: { id: true, nama: true } });
      else throw e;
    }
  }
  if (item && cache) cache.set(namaKey, item);
  return item;
}

/* ------------------------------------------------------- auto kode <PREFIX>-N */

const pad3 = (n: number) => String(n).padStart(3, "0");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Nomor urut berikutnya untuk sebuah prefix (dari kode existing yang cocok). */
async function nextSeq(prefix: string): Promise<number> {
  const db = getAppDb();
  const existing = await db.invBarang.findMany({
    where: { kodeBarang: { startsWith: `${prefix}-` } },
    select: { kodeBarang: true },
  });
  const re = new RegExp(`^${escapeRe(prefix)}-(\\d+)$`);
  let max = 0;
  for (const { kodeBarang } of existing) {
    const m = re.exec(kodeBarang);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** Preview kode berikutnya untuk sebuah ruangan (dipakai form). */
export async function previewNextKode(ruanganId: string): Promise<{ prefix: string; kode: string }> {
  const db = getAppDb();
  const r = await db.invRuangan.findUnique({ where: { id: ruanganId }, select: { kodePrefix: true } });
  if (!r) throw new NotFoundError("Ruangan tidak ditemukan.");
  const seq = await nextSeq(r.kodePrefix);
  return { prefix: r.kodePrefix, kode: `${r.kodePrefix}-${pad3(seq)}` };
}

/* --------------------------------------------------------------- create/update */

function toBig(n: number | undefined | null): bigint | null {
  return n == null ? null : BigInt(Math.round(n));
}
function toDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createBarang(input: BarangCreateInput, user: SessionUser): Promise<BarangListItem> {
  const db = getAppDb();
  const ruangan = await db.invRuangan.findUnique({ where: { id: input.ruanganId }, select: { kodePrefix: true } });
  if (!ruangan) throw new ValidationError({ ruanganId: ["Ruangan tidak ditemukan."] });

  // Katalog: cari-atau-buat item dari nama → nama baku konsisten + link agregasi.
  const item = await resolveItem(input.nama, { satuanId: input.satuanId, kategoriId: input.kategoriId, user });

  const manualKode = input.kodeBarang?.trim().toUpperCase();
  const data = {
    register: input.register ?? null,
    nama: item?.nama ?? input.nama,
    itemId: item?.id ?? null,
    merk: input.merk ?? null,
    nomorSeri: input.nomorSeri ?? null,
    kategoriId: input.kategoriId ?? null,
    sumberAnggaranId: input.sumberAnggaranId ?? null,
    satuanId: input.satuanId ?? null,
    kondisiId: input.kondisiId ?? null,
    ruanganId: input.ruanganId,
    tahunPerolehan: input.tahunPerolehan ?? null,
    tglPerolehan: toDate(input.tglPerolehan),
    harga: toBig(input.harga),
    statusAset: input.statusAset,
    keterangan: input.keterangan ?? null,
    createdBy: user.name,
    updatedBy: user.name,
  };

  // Kode manual: sekali coba (dup → error jelas). Kode otomatis: retry sampai unik.
  if (manualKode) {
    try {
      const created = await db.invBarang.create({ data: { ...data, kodeBarang: manualKode }, include: barangInclude });
      return serialize(created);
    } catch (e) {
      if (isUnique(e)) throw new BusinessRuleError(`Kode barang "${manualKode}" sudah dipakai.`);
      throw e;
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const seq = (await nextSeq(ruangan.kodePrefix)) + attempt;
    const kodeBarang = `${ruangan.kodePrefix}-${pad3(seq)}`;
    try {
      const created = await db.invBarang.create({ data: { ...data, kodeBarang }, include: barangInclude });
      return serialize(created);
    } catch (e) {
      if (isUnique(e)) continue; // tabrakan kode → coba nomor berikutnya
      throw e;
    }
  }
  throw new BusinessRuleError("Gagal membuat kode barang unik. Coba lagi.");
}

export async function updateBarang(id: string, input: BarangUpdateInput, user: SessionUser): Promise<BarangListItem> {
  const db = getAppDb();
  const item = await resolveItem(input.nama, { satuanId: input.satuanId, kategoriId: input.kategoriId, user });
  try {
    const updated = await db.invBarang.update({
      where: { id },
      data: {
        register: input.register ?? null,
        nama: item?.nama ?? input.nama,
        itemId: item?.id ?? null,
        merk: input.merk ?? null,
        nomorSeri: input.nomorSeri ?? null,
        kategoriId: input.kategoriId ?? null,
        sumberAnggaranId: input.sumberAnggaranId ?? null,
        satuanId: input.satuanId ?? null,
        kondisiId: input.kondisiId ?? null,
        ruanganId: input.ruanganId,
        tahunPerolehan: input.tahunPerolehan ?? null,
        tglPerolehan: toDate(input.tglPerolehan),
        harga: toBig(input.harga),
        statusAset: input.statusAset,
        keterangan: input.keterangan ?? null,
        updatedBy: user.name,
      },
      include: barangInclude,
    });
    return serialize(updated);
  } catch (e) {
    if (isNotFound(e)) throw new NotFoundError("Barang tidak ditemukan.");
    throw e;
  }
}

export async function deleteBarang(id: string): Promise<void> {
  const db = getAppDb();
  try {
    await db.invBarang.delete({ where: { id } });
  } catch (e) {
    if (isNotFound(e)) throw new NotFoundError("Barang tidak ditemukan.");
    throw e;
  }
}

/* ------------------------------------------------------------------- import */

/** Baris mentah hasil parse Excel (nilai apa adanya, akan divalidasi). */
export type ImportRowInput = {
  kodeBarang?: string;
  nama?: string;
  merk?: string;
  nomorSeri?: string;
  register?: string;
  kategori?: string;
  sumberAnggaran?: string;
  satuan?: string;
  kondisi?: string;
  ruangan?: string;
  /** Prefix untuk ruangan BARU yang di-auto-create (opsional). */
  kodeRuangan?: string;
  /** Jumlah unit (mekar jadi N unit). Default 1. */
  jumlah?: string;
  tahunPerolehan?: string;
  tglPerolehan?: string;
  harga?: string;
  status?: string;
  keterangan?: string;
};

export type ImportRowResult = {
  baris: number;
  kodeBarang: string | null;
  nama: string;
  ruangan: string | null;
  /** Jumlah unit yang akan/telah dibuat dari baris ini. */
  unit: number;
  status: "valid" | "duplikat" | "error";
  catatan: string[];
};

export type ImportPreview = {
  items: ImportRowResult[];
  ringkasan: {
    baris: number;
    unit: number;
    valid: number;
    duplikat: number;
    error: number;
    ruanganBaru: { nama: string; prefix: string }[];
    itemBaru: number;
  };
};

export type ImportCommitSummary = {
  masuk: number;
  dilewati: number;
  ruanganBaru: number;
  itemBaru: number;
};

const norm = (s: string | undefined | null) => (s ?? "").trim();
const key = (s: string) => s.trim().toLowerCase();

/** Muat seluruh referensi ke map untuk pencocokan cepat saat import. */
async function loadRefMaps() {
  const db = getAppDb();
  const [satuan, kondisi, sumber, kategori, ruangan] = await Promise.all([
    db.invSatuan.findMany({ select: { id: true, nama: true } }),
    db.invKondisi.findMany({ select: { id: true, nama: true, kode: true } }),
    db.invSumberAnggaran.findMany({ select: { id: true, nama: true, singkatan: true } }),
    db.invKategori.findMany({ select: { id: true, nama: true } }),
    db.invRuangan.findMany({ select: { id: true, nama: true, kodePrefix: true } }),
  ]);
  const satuanMap = new Map(satuan.map((s) => [key(s.nama), s.id]));
  const kondisiMap = new Map<string, string>();
  for (const k of kondisi) {
    kondisiMap.set(key(k.nama), k.id);
    kondisiMap.set(key(k.kode), k.id);
  }
  const sumberMap = new Map<string, string>();
  for (const s of sumber) {
    sumberMap.set(key(s.nama), s.id);
    sumberMap.set(key(s.singkatan), s.id);
  }
  const kategoriMap = new Map(kategori.map((k) => [key(k.nama), k.id]));
  const ruanganMap = new Map<string, { id: string; prefix: string }>();
  for (const r of ruangan) {
    ruanganMap.set(key(r.kodePrefix), { id: r.id, prefix: r.kodePrefix });
    ruanganMap.set(key(r.nama), { id: r.id, prefix: r.kodePrefix });
  }
  return { satuanMap, kondisiMap, sumberMap, kategoriMap, ruanganMap };
}

function parseIntSafe(s: string | undefined): number | null {
  const v = norm(s).replace(/[^\d-]/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function parseMoney(s: string | undefined): number | null {
  const raw = norm(s);
  if (!raw) return null;
  const v = raw.replace(/[^\d]/g, ""); // buang "Rp", titik ribuan, spasi
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function parseTgl(s: string | undefined): { date: Date | null; ok: boolean } {
  const raw = norm(s);
  if (!raw) return { date: null, ok: true };
  // Terima YYYY-MM-DD atau DD/MM/YYYY atau DD-MM-YYYY.
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) return { date: new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`), ok: true };
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    return { date: new Date(`${m[3]}-${mm}-${dd}T00:00:00Z`), ok: true };
  }
  return { date: null, ok: false };
}
function matchStatus(s: string | undefined): { status: StatusAset; ok: boolean } {
  const raw = key(norm(s));
  if (!raw) return { status: "AKTIF", ok: true };
  const found = STATUS_ASET.find((v) => v.toLowerCase() === raw);
  if (found) return { status: found, ok: true };
  // sinonim umum
  if (/aktif|baik|digunakan|pakai/.test(raw)) return { status: "AKTIF", ok: true };
  if (/perbaik|servis|rusak/.test(raw)) return { status: "PERBAIKAN", ok: true };
  if (/pinjam/.test(raw)) return { status: "DIPINJAM", ok: true };
  if (/hapus|afkir|musnah/.test(raw)) return { status: "DIHAPUS", ok: true };
  return { status: "AKTIF", ok: false };
}

/** Buat prefix ruangan dari nama (inisial/awalan), unik terhadap yang ada. */
function genPrefix(nama: string, taken: Set<string>): string {
  const words = nama.trim().split(/\s+/).filter(Boolean);
  let base = words.length >= 2 ? words.map((w) => w[0]).join("") : (words[0] ?? "RNG").slice(0, 4);
  base = base.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "RNG";
  let cand = base;
  let n = 1;
  while (taken.has(cand)) {
    n++;
    cand = `${base}${n}`.slice(0, 10);
  }
  return cand;
}

type RoomPlan = { pkey: string; prefix: string; nama: string; id?: string; isNew: boolean };

/**
 * Inti import: validasi + rencana (dry-run) ATAU tulis (commit). Menangani
 * auto-katalog (item dari Nama), auto-buat ruangan bila belum ada, dan mekar
 * kolom Jumlah menjadi N unit.
 */
async function processImport(
  rows: ImportRowInput[],
  user: SessionUser | null,
  commit: boolean,
): Promise<{ items: ImportRowResult[]; ringkasan: ImportPreview["ringkasan"]; masuk: number }> {
  const db = getAppDb();
  const maps = await loadRefMaps();

  const kodeDb = new Set((await db.invBarang.findMany({ select: { kodeBarang: true } })).map((e) => e.kodeBarang.toUpperCase()));
  const kodeSeen = new Set<string>();

  const takenPrefixes = new Set<string>();
  for (const [, v] of maps.ruanganMap) takenPrefixes.add(v.prefix.toUpperCase());
  const newRooms = new Map<string, RoomPlan>(); // key = nama ruangan (lower)

  const itemKeys = new Set((await db.invItem.findMany({ select: { namaKey: true } })).map((it) => it.namaKey));
  const newItemKeys = new Set<string>();
  const itemCache = new Map<string, { id: string; nama: string }>();

  const seqOf = new Map<string, number>();
  async function seqFor(prefix: string): Promise<number> {
    if (!seqOf.has(prefix)) seqOf.set(prefix, await nextSeq(prefix));
    return seqOf.get(prefix)!;
  }

  function resolveRoom(ruanganRaw: string, kodeRuanganRaw: string): RoomPlan | null {
    const existing = (kodeRuanganRaw && maps.ruanganMap.get(key(kodeRuanganRaw))) || maps.ruanganMap.get(key(ruanganRaw));
    if (existing) return { pkey: key(ruanganRaw), prefix: existing.prefix, nama: ruanganRaw, id: existing.id, isNew: false };
    const pkey = key(ruanganRaw);
    const pend = newRooms.get(pkey);
    if (pend) return pend;
    const prefix = kodeRuanganRaw
      ? kodeRuanganRaw.toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 15) || genPrefix(ruanganRaw, takenPrefixes)
      : genPrefix(ruanganRaw, takenPrefixes);
    takenPrefixes.add(prefix.toUpperCase());
    const plan: RoomPlan = { pkey, prefix, nama: ruanganRaw, isNew: true };
    newRooms.set(pkey, plan);
    return plan;
  }

  async function ensureRoomId(plan: RoomPlan): Promise<string> {
    if (plan.id) return plan.id;
    try {
      const created = await db.invRuangan.create({ data: { kodePrefix: plan.prefix, nama: plan.nama }, select: { id: true } });
      plan.id = created.id;
    } catch (e) {
      if (isUnique(e)) {
        const found = await db.invRuangan.findUnique({ where: { kodePrefix: plan.prefix }, select: { id: true } });
        if (found) plan.id = found.id;
        else throw e;
      } else throw e;
    }
    maps.ruanganMap.set(key(plan.nama), { id: plan.id!, prefix: plan.prefix });
    maps.ruanganMap.set(key(plan.prefix), { id: plan.id!, prefix: plan.prefix });
    return plan.id!;
  }

  const items: ImportRowResult[] = [];
  let totalUnit = 0;
  let masuk = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const baris = i + 2; // +1 header, +1 index→1-based
    const catatan: string[] = [];
    const nama = norm(raw.nama);
    const kodeManual = norm(raw.kodeBarang).toUpperCase() || null;

    const err = (msg: string, ruangan: string | null = norm(raw.ruangan) || null) =>
      items.push({ baris, kodeBarang: kodeManual, nama: nama || "—", ruangan, unit: 0, status: "error", catatan: [msg] });

    if (!nama) { err("Nama barang kosong."); continue; }
    const ruanganRaw = norm(raw.ruangan);
    if (!ruanganRaw) { err("Ruangan wajib diisi."); continue; }
    const room = resolveRoom(ruanganRaw, norm(raw.kodeRuangan));
    if (!room) { err("Ruangan tidak dapat dipetakan."); continue; }

    // Kode manual → cek duplikat & format.
    if (kodeManual) {
      if (!/^[A-Za-z0-9.\-/]+$/.test(kodeManual)) { err("Format kode tidak valid.", room.prefix); continue; }
      if (kodeDb.has(kodeManual) || kodeSeen.has(kodeManual)) {
        items.push({ baris, kodeBarang: kodeManual, nama, ruangan: room.prefix, unit: 0, status: "duplikat", catatan: ["Kode sudah ada — baris dilewati."] });
        continue;
      }
      kodeSeen.add(kodeManual);
    }

    // Jumlah (mekar unit).
    let qty = parseIntSafe(raw.jumlah) ?? 1;
    if (qty < 1) qty = 1;
    if (qty > 500) qty = 500;
    if (kodeManual && qty > 1) { qty = 1; catatan.push("Kode manual → 1 unit."); }

    // Referensi opsional.
    const kategoriId = norm(raw.kategori) ? maps.kategoriMap.get(key(raw.kategori!)) ?? null : null;
    if (norm(raw.kategori) && !kategoriId) catatan.push(`Kategori "${norm(raw.kategori)}" tidak dikenal — dikosongkan.`);
    const satuanId = norm(raw.satuan) ? maps.satuanMap.get(key(raw.satuan!)) ?? null : null;
    if (norm(raw.satuan) && !satuanId) catatan.push(`Satuan "${norm(raw.satuan)}" tidak dikenal — dikosongkan.`);
    const sumberAnggaranId = norm(raw.sumberAnggaran) ? maps.sumberMap.get(key(raw.sumberAnggaran!)) ?? null : null;
    if (norm(raw.sumberAnggaran) && !sumberAnggaranId) catatan.push(`Sumber anggaran "${norm(raw.sumberAnggaran)}" tidak dikenal — dikosongkan.`);
    const kondisiId = norm(raw.kondisi) ? maps.kondisiMap.get(key(raw.kondisi!)) ?? null : null;
    if (norm(raw.kondisi) && !kondisiId) catatan.push(`Kondisi "${norm(raw.kondisi)}" tidak dikenal — dikosongkan.`);

    const tahun = parseIntSafe(raw.tahunPerolehan);
    if (norm(raw.tahunPerolehan) && tahun == null) catatan.push("Tahun perolehan tidak valid — dikosongkan.");
    const tgl = parseTgl(raw.tglPerolehan);
    if (!tgl.ok) catatan.push("Tanggal perolehan tidak dikenali — dikosongkan.");
    const harga = parseMoney(raw.harga);
    if (norm(raw.harga) && harga == null) catatan.push("Harga tidak valid — dikosongkan.");
    const st = matchStatus(raw.status);
    if (!st.ok) catatan.push(`Status "${norm(raw.status)}" tidak dikenal — dipakai Aktif.`);

    // Katalog item (rencana).
    const namaClean = nama.replace(/\s+/g, " ");
    const itemKey = namaClean.toUpperCase();
    const isNewItem = !itemKeys.has(itemKey) && !newItemKeys.has(itemKey);
    if (isNewItem) newItemKeys.add(itemKey);

    catatan.unshift(kodeManual ? "Kode dari file dipakai." : `Kode otomatis (${room.prefix}-…).`);
    if (room.isNew) catatan.push(`Ruangan baru: ${ruanganRaw} → prefix ${room.prefix}.`);
    if (isNewItem) catatan.push(`Item katalog baru: ${namaClean}.`);
    if (qty > 1) catatan.push(`${qty} unit dibuat.`);

    if (commit && user) {
      const ruanganId = await ensureRoomId(room);
      const item = await resolveItem(namaClean, { satuanId, kategoriId, user }, itemCache);
      const base = {
        nama: item?.nama ?? namaClean,
        itemId: item?.id ?? null,
        register: parseIntSafe(raw.register),
        merk: norm(raw.merk) || null,
        nomorSeri: norm(raw.nomorSeri) || null,
        kategoriId,
        sumberAnggaranId,
        satuanId,
        kondisiId,
        ruanganId,
        tahunPerolehan: tahun,
        tglPerolehan: tgl.date,
        harga: harga == null ? null : BigInt(harga),
        statusAset: st.status,
        keterangan: norm(raw.keterangan) || null,
        createdBy: user.name,
        updatedBy: user.name,
      };
      for (let u = 0; u < qty; u++) {
        let kode = kodeManual;
        if (!kode) {
          const seq = await seqFor(room.prefix);
          kode = `${room.prefix}-${pad3(seq)}`;
          seqOf.set(room.prefix, seq + 1);
        }
        try {
          await db.invBarang.create({ data: { ...base, kodeBarang: kode } });
          masuk++;
        } catch (e) {
          if (isUnique(e)) {
            if (kodeManual) break;
            seqOf.set(room.prefix, await nextSeq(room.prefix)); // re-seed & ulangi unit ini
            u--;
            continue;
          }
          throw e;
        }
      }
    }

    totalUnit += qty;
    items.push({ baris, kodeBarang: kodeManual, nama: namaClean, ruangan: room.prefix, unit: qty, status: "valid", catatan });
  }

  const ringkasan: ImportPreview["ringkasan"] = {
    baris: rows.length,
    unit: totalUnit,
    valid: items.filter((i) => i.status === "valid").length,
    duplikat: items.filter((i) => i.status === "duplikat").length,
    error: items.filter((i) => i.status === "error").length,
    ruanganBaru: [...newRooms.values()].map((r) => ({ nama: r.nama, prefix: r.prefix })),
    itemBaru: newItemKeys.size,
  };
  return { items, ringkasan, masuk };
}

export async function previewImport(rows: ImportRowInput[]): Promise<ImportPreview> {
  const { items, ringkasan } = await processImport(rows, null, false);
  return { items, ringkasan };
}

export async function commitImport(rows: ImportRowInput[], user: SessionUser): Promise<ImportCommitSummary> {
  const { ringkasan, masuk } = await processImport(rows, user, true);
  if (masuk === 0) throw new BusinessRuleError("Tidak ada baris valid untuk diimpor.");
  return {
    masuk,
    dilewati: ringkasan.duplikat + ringkasan.error,
    ruanganBaru: ringkasan.ruanganBaru.length,
    itemBaru: ringkasan.itemBaru,
  };
}

/* ------------------------------------------------------- bulk (lembar/Excel) */

export type BulkRowResult = {
  index: number;
  status: "ok" | "error";
  id?: string;
  kodeBarang?: string;
  nama?: string;
  message?: string;
};

/** Scalar create data dari input tervalidasi (tanpa kode/audit). */
function createScalar(input: BarangCreateInput) {
  return {
    register: input.register ?? null,
    nama: input.nama,
    merk: input.merk ?? null,
    nomorSeri: input.nomorSeri ?? null,
    kategoriId: input.kategoriId ?? null,
    sumberAnggaranId: input.sumberAnggaranId ?? null,
    satuanId: input.satuanId ?? null,
    kondisiId: input.kondisiId ?? null,
    ruanganId: input.ruanganId,
    tahunPerolehan: input.tahunPerolehan ?? null,
    tglPerolehan: toDate(input.tglPerolehan),
    harga: toBig(input.harga),
    statusAset: input.statusAset,
    keterangan: input.keterangan ?? null,
  };
}

/**
 * Simpan banyak barang sekaligus (mode Lembar/Excel). Tiap baris divalidasi &
 * disimpan independen; mengembalikan hasil per-baris (ok/error) agar UI bisa
 * menandai baris yang berhasil dan mempertahankan yang gagal.
 */
export async function bulkCreateBarang(
  rawRows: unknown[],
  user: SessionUser,
): Promise<{ results: BulkRowResult[]; masuk: number }> {
  const db = getAppDb();
  const parsed = rawRows.map((r) => barangCreateSchema.safeParse(r));

  // Prefix ruangan (untuk auto-kode) hanya untuk baris valid.
  const ruanganIds = new Set<string>();
  for (const p of parsed) if (p.success) ruanganIds.add(p.data.ruanganId);
  const ruangans = await db.invRuangan.findMany({
    where: { id: { in: [...ruanganIds] } },
    select: { id: true, kodePrefix: true },
  });
  const prefixOf = new Map(ruangans.map((r) => [r.id, r.kodePrefix]));

  // Seed nomor urut per-prefix (untuk baris berkode otomatis).
  const prefixes = new Set<string>();
  for (const p of parsed) {
    if (p.success && !p.data.kodeBarang) {
      const pre = prefixOf.get(p.data.ruanganId);
      if (pre) prefixes.add(pre);
    }
  }
  const seqOf = new Map<string, number>();
  for (const pre of prefixes) seqOf.set(pre, await nextSeq(pre));

  const itemCache = new Map<string, { id: string; nama: string }>();
  const results: BulkRowResult[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    if (!p.success) {
      const first = p.error.issues[0];
      results.push({ index: i, status: "error", message: first ? first.message : "Data tidak valid" });
      continue;
    }
    const input = p.data;
    const prefix = prefixOf.get(input.ruanganId);
    if (!prefix) {
      results.push({ index: i, status: "error", nama: input.nama, message: "Ruangan tidak ditemukan." });
      continue;
    }
    const item = await resolveItem(input.nama, { satuanId: input.satuanId, kategoriId: input.kategoriId, user }, itemCache);
    const data = {
      ...createScalar(input),
      nama: item?.nama ?? input.nama,
      itemId: item?.id ?? null,
      createdBy: user.name,
      updatedBy: user.name,
    };
    const manual = input.kodeBarang?.trim().toUpperCase();

    let done = false;
    for (let attempt = 0; attempt < 3 && !done; attempt++) {
      let kode = manual;
      if (!kode) {
        const seq = seqOf.get(prefix)!;
        kode = `${prefix}-${pad3(seq)}`;
        seqOf.set(prefix, seq + 1);
      }
      try {
        const created = await db.invBarang.create({ data: { ...data, kodeBarang: kode } });
        results.push({ index: i, status: "ok", id: created.id, kodeBarang: created.kodeBarang, nama: created.nama });
        done = true;
      } catch (e) {
        if (isUnique(e)) {
          if (manual) {
            results.push({ index: i, status: "error", nama: input.nama, message: `Kode "${manual}" sudah dipakai.` });
            done = true;
          } else {
            // Tabrakan kode otomatis (langka) → re-seed & coba lagi.
            seqOf.set(prefix, await nextSeq(prefix));
          }
        } else {
          throw e;
        }
      }
    }
    if (!done) results.push({ index: i, status: "error", nama: input.nama, message: "Gagal membuat kode unik." });
  }

  return { results, masuk: results.filter((r) => r.status === "ok").length };
}
