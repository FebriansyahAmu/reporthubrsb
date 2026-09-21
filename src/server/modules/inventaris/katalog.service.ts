import "server-only";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import type { SessionUser } from "@/server/auth/session";
import { BusinessRuleError, NotFoundError } from "@/server/lib/errors";
import type { KatalogQuery, KatalogUpdateInput } from "./katalog.schema";

export type KatalogItem = {
  id: string;
  nama: string;
  kategori: { id: string; nama: string } | null;
  satuan: { id: string; nama: string } | null;
  spesifikasi: string | null;
  aktif: boolean;
  jumlahUnit: number;
  totalNilai: number;
};

export type KatalogListResult = {
  data: KatalogItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

function isUnique(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}
function isNotFound(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025";
}

export async function listKatalog(q: KatalogQuery): Promise<KatalogListResult> {
  const db = getAppDb();
  const where: Prisma.InvItemWhereInput = {};
  if (q.search) where.nama = { contains: q.search.trim() };

  const [total, items] = await Promise.all([
    db.invItem.count({ where }),
    db.invItem.findMany({
      where,
      orderBy: [{ nama: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true, nama: true, spesifikasi: true, aktif: true,
        kategori: { select: { id: true, nama: true } },
        satuan: { select: { id: true, nama: true } },
      },
    }),
  ]);

  const ids = items.map((i) => i.id);
  const grouped = ids.length
    ? await db.invBarang.groupBy({ by: ["itemId"], where: { itemId: { in: ids } }, _count: { _all: true }, _sum: { harga: true } })
    : [];
  const stat = new Map(grouped.map((g) => [g.itemId, { unit: g._count._all, nilai: g._sum.harga == null ? 0 : Number(g._sum.harga) }]));

  return {
    data: items.map((i) => ({
      id: i.id,
      nama: i.nama,
      kategori: i.kategori ? { id: i.kategori.id, nama: i.kategori.nama } : null,
      satuan: i.satuan ? { id: i.satuan.id, nama: i.satuan.nama } : null,
      spesifikasi: i.spesifikasi ?? null,
      aktif: i.aktif,
      jumlahUnit: stat.get(i.id)?.unit ?? 0,
      totalNilai: stat.get(i.id)?.nilai ?? 0,
    })),
    meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
  };
}

export async function updateKatalog(id: string, input: KatalogUpdateInput, user: SessionUser): Promise<{ id: string }> {
  const db = getAppDb();
  const namaClean = input.nama.trim().replace(/\s+/g, " ");
  const namaKey = namaClean.toUpperCase();
  try {
    await db.invItem.update({
      where: { id },
      data: {
        nama: namaClean,
        namaKey,
        kategoriId: input.kategoriId ?? null,
        satuanId: input.satuanId ?? null,
        spesifikasi: input.spesifikasi ?? null,
        aktif: input.aktif,
        updatedBy: user.name,
      },
    });
    // Propagasi nama baku ke seluruh unit tertaut (jaga konsistensi tampilan).
    await db.invBarang.updateMany({ where: { itemId: id }, data: { nama: namaClean } });
    return { id };
  } catch (e) {
    if (isUnique(e)) throw new BusinessRuleError(`Nama item "${namaClean}" sudah ada di katalog.`);
    if (isNotFound(e)) throw new NotFoundError("Item katalog tidak ditemukan.");
    throw e;
  }
}

export async function deleteKatalog(id: string): Promise<void> {
  const db = getAppDb();
  const used = await getAppDb().invBarang.count({ where: { itemId: id } });
  if (used > 0) {
    throw new BusinessRuleError(`Tidak dapat dihapus — masih dipakai ${used} unit. Nonaktifkan saja bila tak terpakai.`);
  }
  try {
    await db.invItem.delete({ where: { id } });
  } catch (e) {
    if (isNotFound(e)) throw new NotFoundError("Item katalog tidak ditemukan.");
    throw e;
  }
}
