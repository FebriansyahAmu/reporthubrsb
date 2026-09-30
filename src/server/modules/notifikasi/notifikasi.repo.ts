import "server-only";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import { BATAS_NOTIFIKASI } from "./notifikasi.constants";
import type { NotifikasiBaru, NotifikasiItem } from "./notifikasi.types";
import type { Penerima } from "./penerima";

/** Klien DB atau klien transaksi — agar pengirim bisa menulis dalam transaksinya. */
type Db = Prisma.TransactionClient;

const sejak = () => new Date(Date.now() - BATAS_NOTIFIKASI.UMUR_HARI * 86_400_000);

/** Filter "ditujukan ke penerima ini" (pengguna / NIP / ruangan / peran), dalam jendela umur. */
function untuk(p: Penerima): Prisma.NotifikasiWhereInput {
  const or: Prisma.NotifikasiWhereInput[] = [
    { sasaranJenis: "USER", sasaranRef: p.userId },
    { sasaranJenis: "PERAN", sasaranRef: p.role },
  ];
  if (p.nip) or.push({ sasaranJenis: "NIP", sasaranRef: p.nip });
  if (p.ruangan.length) or.push({ sasaranJenis: "RUANGAN", sasaranRef: { in: p.ruangan } });
  return { createdAt: { gte: sejak() }, OR: or };
}

export async function simpanNotifikasi(db: Db, items: readonly NotifikasiBaru[]): Promise<void> {
  if (items.length === 0) return;
  await db.notifikasi.createMany({
    data: items.map((n) => ({
      jenis: n.jenis,
      judul: n.judul.slice(0, 191),
      pesan: n.pesan?.slice(0, 500) ?? null,
      tautan: n.tautan ?? null,
      sasaranJenis: n.sasaranJenis,
      sasaranRef: n.sasaranRef,
      refTipe: n.refTipe ?? null,
      refId: n.refId ?? null,
      dibuatOlehId: n.dibuatOlehId ?? null,
    })),
  });
}

export async function daftarNotifikasi(p: Penerima, limit: number): Promise<NotifikasiItem[]> {
  const rows = await getAppDb().notifikasi.findMany({
    where: untuk(p),
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, jenis: true, judul: true, pesan: true, tautan: true, createdAt: true,
      baca: { where: { userId: p.userId }, select: { dibacaAt: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    jenis: r.jenis,
    judul: r.judul,
    pesan: r.pesan,
    tautan: r.tautan,
    createdAt: r.createdAt.toISOString(),
    dibaca: r.baca.length > 0,
  }));
}

export async function hitungBelumDibaca(p: Penerima): Promise<number> {
  return getAppDb().notifikasi.count({ where: { ...untuk(p), baca: { none: { userId: p.userId } } } });
}

/**
 * Tandai dibaca — HANYA notifikasi yang memang ditujukan ke penerima (id asing
 * diabaikan). `ids` null = semua yang belum dibaca. Idempoten.
 */
export async function tandaiDibaca(p: Penerima, ids: readonly string[] | null): Promise<number> {
  const db = getAppDb();
  const milik = await db.notifikasi.findMany({
    where: { ...untuk(p), ...(ids ? { id: { in: [...ids] } } : {}), baca: { none: { userId: p.userId } } },
    select: { id: true },
    take: ids ? ids.length : 500,
  });
  if (milik.length === 0) return 0;
  const r = await db.notifikasiBaca.createMany({
    data: milik.map((m) => ({ notifikasiId: m.id, userId: p.userId })),
    skipDuplicates: true,
  });
  return r.count;
}
