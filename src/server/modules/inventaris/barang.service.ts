import "server-only";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import type { SessionUser } from "@/server/auth/session";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/server/lib/errors";
import {
  STATUS_ASET,
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
};

const barangInclude = {
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
  const [satuan, kondisi, sumber, kategori, ruangan] = await Promise.all([
    db.invSatuan.findMany({ where: { aktif: true }, orderBy: [{ urutan: "asc" }, { nama: "asc" }], select: { id: true, nama: true } }),
    db.invKondisi.findMany({ where: { aktif: true }, orderBy: [{ urutan: "asc" }, { nama: "asc" }], select: { id: true, nama: true, kode: true, tone: true } }),
    db.invSumberAnggaran.findMany({ where: { aktif: true }, orderBy: [{ urutan: "asc" }, { nama: "asc" }], select: { id: true, nama: true, singkatan: true } }),
    db.invKategori.findMany({ where: { aktif: true }, orderBy: [{ urutan: "asc" }, { nama: "asc" }], select: { id: true, nama: true } }),
    db.invRuangan.findMany({ where: { aktif: true }, orderBy: [{ urutan: "asc" }, { kodePrefix: "asc" }], select: { id: true, kodePrefix: true, nama: true, pjNama: true, pjNip: true } }),
  ]);
  return { satuan, kondisi, sumberAnggaran: sumber, kategori, ruangan };
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

  const manualKode = input.kodeBarang?.trim().toUpperCase();
  const data = {
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
  try {
    const updated = await db.invBarang.update({
      where: { id },
      data: {
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
  status: "valid" | "duplikat" | "error";
  catatan: string[];
};

export type ImportPreview = {
  items: ImportRowResult[];
  ringkasan: { total: number; valid: number; duplikat: number; error: number };
};

type ResolvedRow = {
  result: ImportRowResult;
  /** Payload siap-insert bila valid (kode diselesaikan saat commit). */
  data?: {
    kodeManual: string | null;
    prefix: string;
    payload: Omit<Prisma.InvBarangCreateManyInput, "kodeBarang" | "createdBy" | "updatedBy">;
  };
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

/** Validasi & cocokkan seluruh baris import (tanpa menulis DB). */
export async function resolveImport(rows: ImportRowInput[]): Promise<ResolvedRow[]> {
  const db = getAppDb();
  const maps = await loadRefMaps();
  const out: ResolvedRow[] = [];
  const kodeSeen = new Set<string>();
  // Kode existing di DB (untuk cek duplikat sekali jalan).
  const existing = await db.invBarang.findMany({ select: { kodeBarang: true } });
  const kodeDb = new Set(existing.map((e) => e.kodeBarang.toUpperCase()));

  rows.forEach((raw, i) => {
    const baris = i + 2; // +1 header, +1 index→1-based
    const catatan: string[] = [];
    const nama = norm(raw.nama);
    const kodeManual = norm(raw.kodeBarang).toUpperCase() || null;

    if (!nama) {
      out.push({
        result: { baris, kodeBarang: kodeManual, nama: "—", ruangan: norm(raw.ruangan) || null, status: "error", catatan: ["Nama barang kosong."] },
      });
      return;
    }

    // Ruangan wajib.
    const ruanganRaw = norm(raw.ruangan);
    const ruangan = ruanganRaw ? maps.ruanganMap.get(key(ruanganRaw)) : undefined;
    if (!ruangan) {
      out.push({
        result: { baris, kodeBarang: kodeManual, nama, ruangan: ruanganRaw || null, status: "error", catatan: [ruanganRaw ? `Ruangan "${ruanganRaw}" tidak dikenal.` : "Ruangan wajib diisi."] },
      });
      return;
    }

    // Kode manual → cek duplikat (DB + dalam batch).
    if (kodeManual) {
      if (!/^[A-Za-z0-9.\-/]+$/.test(kodeManual)) {
        out.push({ result: { baris, kodeBarang: kodeManual, nama, ruangan: ruangan.prefix, status: "error", catatan: ["Format kode tidak valid."] } });
        return;
      }
      if (kodeDb.has(kodeManual) || kodeSeen.has(kodeManual)) {
        out.push({ result: { baris, kodeBarang: kodeManual, nama, ruangan: ruangan.prefix, status: "duplikat", catatan: ["Kode sudah ada — baris dilewati."] } });
        return;
      }
      kodeSeen.add(kodeManual);
    }

    // Referensi opsional.
    const kategoriId = raw.kategori && norm(raw.kategori) ? maps.kategoriMap.get(key(raw.kategori)) ?? null : null;
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

    if (kodeManual) catatan.unshift("Kode dari file dipakai.");
    else catatan.unshift(`Kode otomatis (${ruangan.prefix}-…).`);

    out.push({
      result: { baris, kodeBarang: kodeManual, nama, ruangan: ruangan.prefix, status: "valid", catatan },
      data: {
        kodeManual,
        prefix: ruangan.prefix,
        payload: {
          register: parseIntSafe(raw.register),
          nama,
          merk: norm(raw.merk) || null,
          nomorSeri: norm(raw.nomorSeri) || null,
          kategoriId,
          sumberAnggaranId,
          satuanId,
          kondisiId,
          ruanganId: ruangan.id,
          tahunPerolehan: tahun,
          tglPerolehan: tgl.date,
          harga: harga == null ? null : BigInt(harga),
          statusAset: st.status,
          keterangan: norm(raw.keterangan) || null,
        },
      },
    });
  });

  return out;
}

export async function previewImport(rows: ImportRowInput[]): Promise<ImportPreview> {
  const resolved = await resolveImport(rows);
  const items = resolved.map((r) => r.result);
  return {
    items,
    ringkasan: {
      total: items.length,
      valid: items.filter((i) => i.status === "valid").length,
      duplikat: items.filter((i) => i.status === "duplikat").length,
      error: items.filter((i) => i.status === "error").length,
    },
  };
}

export async function commitImport(rows: ImportRowInput[], user: SessionUser): Promise<{ masuk: number; dilewati: number }> {
  const db = getAppDb();
  const resolved = await resolveImport(rows);
  const valid = resolved.filter((r) => r.data);
  if (valid.length === 0) throw new BusinessRuleError("Tidak ada baris valid untuk diimpor.");

  // Seed nomor urut per-prefix dari DB agar auto-kode berurutan tanpa query per-baris.
  const prefixes = new Set(valid.map((r) => r.data!.prefix));
  const seqOf = new Map<string, number>();
  for (const p of prefixes) seqOf.set(p, await nextSeq(p));

  let masuk = 0;
  for (const r of valid) {
    const d = r.data!;
    let kode = d.kodeManual;
    if (!kode) {
      const seq = seqOf.get(d.prefix)!;
      kode = `${d.prefix}-${pad3(seq)}`;
      seqOf.set(d.prefix, seq + 1);
    }
    try {
      await db.invBarang.create({
        data: { ...d.payload, kodeBarang: kode, createdBy: user.name, updatedBy: user.name },
      });
      masuk++;
    } catch (e) {
      if (isUnique(e)) continue; // tabrakan langka → lewati
      throw e;
    }
  }
  return { masuk, dilewati: resolved.length - masuk };
}
