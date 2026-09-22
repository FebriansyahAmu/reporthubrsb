import "server-only";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import type { SessionUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/lib/errors";
import { buildDiff, snapshot, writeKlaimAudit } from "./klaim.audit";
import type {
  JenisKlaim,
  JenisLayanan,
  KategoriKlaim,
  KlaimCreateInput,
  KlaimListQuery,
  KlaimUpdateInput,
  StatusKlaim,
} from "./klaim.schema";

/** Field yang dilacak audit (nama field model, camelCase). */
const AUDIT_FIELDS = [
  "nomorKlaim", "jenisKlaim", "jenisLayanan", "kategori", "bulanPelayanan",
  "tahunPelayanan", "jumlah", "jumlahDiajukan", "jumlahKasus", "tglMasukRekening",
  "status", "refBa", "catatan",
] as const;

const withCount = { _count: { select: { potongan: true } } } satisfies Prisma.KlaimKlaimInclude;
type KlaimRow = Prisma.KlaimKlaimGetPayload<{ include: typeof withCount }>;

export type KlaimItem = {
  id: string;
  nomorKlaim: string | null;
  jenisKlaim: JenisKlaim;
  jenisLayanan: JenisLayanan;
  kategori: KategoriKlaim;
  bulanPelayanan: number;
  tahunPelayanan: number;
  jumlah: number;
  jumlahDiajukan: number | null;
  /** Selisih = diajukan − diterima (bila keduanya ada). */
  selisih: number | null;
  jumlahKasus: number | null;
  tglMasukRekening: string | null;
  status: StatusKlaim;
  refBa: string | null;
  catatan: string | null;
  jumlahPotongan: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KlaimListMeta = {
  total: number;
  totalNilai: number;
  tahunTersedia: number[];
};

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function serialize(k: KlaimRow): KlaimItem {
  const jumlah = Number(k.jumlah);
  const diajukan = k.jumlahDiajukan == null ? null : Number(k.jumlahDiajukan);
  return {
    id: k.id,
    nomorKlaim: k.nomorKlaim,
    jenisKlaim: k.jenisKlaim as JenisKlaim,
    jenisLayanan: k.jenisLayanan as JenisLayanan,
    kategori: k.kategori as KategoriKlaim,
    bulanPelayanan: k.bulanPelayanan,
    tahunPelayanan: k.tahunPelayanan,
    jumlah,
    jumlahDiajukan: diajukan,
    selisih: diajukan == null ? null : diajukan - jumlah,
    jumlahKasus: k.jumlahKasus,
    tglMasukRekening: isoDate(k.tglMasukRekening),
    status: k.status as StatusKlaim,
    refBa: k.refBa,
    catatan: k.catatan,
    jumlahPotongan: k._count.potongan,
    createdBy: k.createdBy,
    updatedBy: k.updatedBy,
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------- list */

export async function listKlaim(q: KlaimListQuery): Promise<{ data: KlaimItem[]; meta: KlaimListMeta }> {
  const db = getAppDb();
  const where: Prisma.KlaimKlaimWhereInput = {};
  if (q.tahun) where.tahunPelayanan = q.tahun;
  if (q.bulan) where.bulanPelayanan = q.bulan;
  if (q.jenisKlaim) where.jenisKlaim = q.jenisKlaim;
  if (q.jenisLayanan) where.jenisLayanan = q.jenisLayanan;
  if (q.kategori) where.kategori = q.kategori;
  if (q.status) where.status = q.status;
  if (q.q) {
    where.OR = [
      { nomorKlaim: { contains: q.q } },
      { catatan: { contains: q.q } },
      { refBa: { contains: q.q } },
    ];
  }

  const [rows, agg, years] = await Promise.all([
    db.klaimKlaim.findMany({
      where,
      orderBy: [{ tahunPelayanan: "desc" }, { bulanPelayanan: "desc" }, { createdAt: "desc" }],
      include: withCount,
      take: 2000,
    }),
    db.klaimKlaim.aggregate({ where, _sum: { jumlah: true }, _count: true }),
    db.klaimKlaim.findMany({
      distinct: ["tahunPelayanan"],
      select: { tahunPelayanan: true },
      orderBy: { tahunPelayanan: "desc" },
    }),
  ]);

  return {
    data: rows.map(serialize),
    meta: {
      total: agg._count,
      totalNilai: Number(agg._sum.jumlah ?? 0),
      tahunTersedia: years.map((y) => y.tahunPelayanan),
    },
  };
}

export async function getKlaim(id: string): Promise<KlaimItem> {
  const db = getAppDb();
  const k = await db.klaimKlaim.findUnique({ where: { id }, include: withCount });
  if (!k) throw new NotFoundError("Klaim tidak ditemukan.");
  return serialize(k);
}

/* ------------------------------------------------------------ create/update */

/** Bangun data tulis dari input (money → BigInt, tanggal → Date). */
function writeData(input: KlaimCreateInput) {
  return {
    nomorKlaim: input.nomorKlaim ?? null,
    jenisKlaim: input.jenisKlaim,
    jenisLayanan: input.jenisLayanan,
    kategori: input.kategori,
    bulanPelayanan: input.bulanPelayanan,
    tahunPelayanan: input.tahunPelayanan,
    jumlah: BigInt(input.jumlah),
    jumlahDiajukan: input.jumlahDiajukan == null ? null : BigInt(input.jumlahDiajukan),
    jumlahKasus: input.jumlahKasus ?? null,
    tglMasukRekening: input.tglMasukRekening ?? null,
    status: input.status,
    refBa: input.refBa ?? null,
    catatan: input.catatan ?? null,
  };
}

export async function createKlaim(input: KlaimCreateInput, user: SessionUser): Promise<KlaimItem> {
  const db = getAppDb();
  const created = await db.klaimKlaim.create({
    data: { ...writeData(input), createdBy: user.name, updatedBy: user.name },
    include: withCount,
  });
  await writeKlaimAudit({
    user, entity: "klaim", action: "create", targetId: created.id,
    extra: { data: snapshot(created, AUDIT_FIELDS) },
  });
  return serialize(created);
}

export async function updateKlaim(id: string, input: KlaimUpdateInput, user: SessionUser): Promise<KlaimItem> {
  const db = getAppDb();
  const before = await db.klaimKlaim.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Klaim tidak ditemukan.");

  const data: Prisma.KlaimKlaimUpdateInput = { updatedBy: user.name };
  if (input.nomorKlaim !== undefined) data.nomorKlaim = input.nomorKlaim ?? null;
  if (input.jenisKlaim !== undefined) data.jenisKlaim = input.jenisKlaim;
  if (input.jenisLayanan !== undefined) data.jenisLayanan = input.jenisLayanan;
  if (input.kategori !== undefined) data.kategori = input.kategori;
  if (input.bulanPelayanan !== undefined) data.bulanPelayanan = input.bulanPelayanan;
  if (input.tahunPelayanan !== undefined) data.tahunPelayanan = input.tahunPelayanan;
  if (input.jumlah !== undefined) data.jumlah = BigInt(input.jumlah);
  if (input.jumlahDiajukan !== undefined) data.jumlahDiajukan = input.jumlahDiajukan == null ? null : BigInt(input.jumlahDiajukan);
  if (input.jumlahKasus !== undefined) data.jumlahKasus = input.jumlahKasus ?? null;
  if (input.tglMasukRekening !== undefined) data.tglMasukRekening = input.tglMasukRekening ?? null;
  if (input.status !== undefined) data.status = input.status;
  if (input.refBa !== undefined) data.refBa = input.refBa ?? null;
  if (input.catatan !== undefined) data.catatan = input.catatan ?? null;

  const updated = await db.klaimKlaim.update({ where: { id }, data, include: withCount });
  const diffs = buildDiff(before, updated, AUDIT_FIELDS);
  if (diffs.length) {
    await writeKlaimAudit({ user, entity: "klaim", action: "update", targetId: id, diffs });
  }
  return serialize(updated);
}

export async function deleteKlaim(id: string, user: SessionUser): Promise<void> {
  const db = getAppDb();
  const before = await db.klaimKlaim.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Klaim tidak ditemukan.");
  await db.klaimKlaim.delete({ where: { id } });
  await writeKlaimAudit({
    user, entity: "klaim", action: "delete", targetId: id,
    extra: { data: snapshot(before, AUDIT_FIELDS) },
  });
}
