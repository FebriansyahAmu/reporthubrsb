import "server-only";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import type { SessionUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/lib/errors";
import { buildDiff, snapshot, writeKlaimAudit } from "./klaim.audit";
import type { PotonganCreateInput, PotonganJenis, PotonganUpdateInput } from "./klaim.schema";

const AUDIT_FIELDS = ["jenis", "jumlah", "cicilanKe", "totalCicilan", "refBa", "deskripsi", "tglTerapkan"] as const;

export type PotonganItem = {
  id: string;
  klaimId: string;
  jenis: PotonganJenis;
  jumlah: number;
  cicilanKe: number | null;
  totalCicilan: number | null;
  refBa: string | null;
  deskripsi: string | null;
  tglTerapkan: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type PotonganListResult = {
  data: PotonganItem[];
  meta: {
    total: number;
    totalPotongan: number;
    /** Ringkas klaim induk untuk header panel. */
    klaim: { id: string; jumlah: number; bulanPelayanan: number; tahunPelayanan: number; jenisKlaim: string; jenisLayanan: string };
  };
};

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function serialize(p: {
  id: string; klaimId: string; jenis: string; jumlah: bigint; cicilanKe: number | null;
  totalCicilan: number | null; refBa: string | null; deskripsi: string | null;
  tglTerapkan: Date | null; createdBy: string | null; createdAt: Date;
}): PotonganItem {
  return {
    id: p.id,
    klaimId: p.klaimId,
    jenis: p.jenis as PotonganJenis,
    jumlah: Number(p.jumlah),
    cicilanKe: p.cicilanKe,
    totalCicilan: p.totalCicilan,
    refBa: p.refBa,
    deskripsi: p.deskripsi,
    tglTerapkan: isoDate(p.tglTerapkan),
    createdBy: p.createdBy,
    createdAt: p.createdAt.toISOString(),
  };
}

/** Daftar potongan sebuah klaim + total + ringkas klaim induk. */
export async function listPotongan(klaimId: string): Promise<PotonganListResult> {
  const db = getAppDb();
  const klaim = await db.klaimKlaim.findUnique({
    where: { id: klaimId },
    select: { id: true, jumlah: true, bulanPelayanan: true, tahunPelayanan: true, jenisKlaim: true, jenisLayanan: true },
  });
  if (!klaim) throw new NotFoundError("Klaim tidak ditemukan.");

  const [rows, agg] = await Promise.all([
    db.klaimPotongan.findMany({
      where: { klaimId },
      orderBy: [{ tglTerapkan: "asc" }, { createdAt: "asc" }],
    }),
    db.klaimPotongan.aggregate({ where: { klaimId }, _sum: { jumlah: true }, _count: true }),
  ]);

  return {
    data: rows.map(serialize),
    meta: {
      total: agg._count,
      totalPotongan: Number(agg._sum.jumlah ?? 0),
      klaim: {
        id: klaim.id,
        jumlah: Number(klaim.jumlah),
        bulanPelayanan: klaim.bulanPelayanan,
        tahunPelayanan: klaim.tahunPelayanan,
        jenisKlaim: klaim.jenisKlaim,
        jenisLayanan: klaim.jenisLayanan,
      },
    },
  };
}

export async function createPotongan(input: PotonganCreateInput, user: SessionUser): Promise<PotonganItem> {
  const db = getAppDb();
  const klaim = await db.klaimKlaim.findUnique({ where: { id: input.klaimId }, select: { id: true } });
  if (!klaim) throw new NotFoundError("Klaim tidak ditemukan.");

  const created = await db.klaimPotongan.create({
    data: {
      klaimId: input.klaimId,
      jenis: input.jenis,
      jumlah: BigInt(input.jumlah),
      cicilanKe: input.cicilanKe ?? null,
      totalCicilan: input.totalCicilan ?? null,
      refBa: input.refBa ?? null,
      deskripsi: input.deskripsi ?? null,
      tglTerapkan: input.tglTerapkan ?? null,
      createdBy: user.name,
    },
  });
  await writeKlaimAudit({
    user, entity: "potongan", action: "create", targetId: created.id,
    extra: { klaimId: input.klaimId, data: snapshot(created, AUDIT_FIELDS) },
  });
  return serialize(created);
}

export async function updatePotongan(id: string, input: PotonganUpdateInput, user: SessionUser): Promise<PotonganItem> {
  const db = getAppDb();
  const before = await db.klaimPotongan.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Potongan tidak ditemukan.");

  const data: Prisma.KlaimPotonganUpdateInput = {};
  if (input.jenis !== undefined) data.jenis = input.jenis;
  if (input.jumlah !== undefined) data.jumlah = BigInt(input.jumlah);
  if (input.cicilanKe !== undefined) data.cicilanKe = input.cicilanKe ?? null;
  if (input.totalCicilan !== undefined) data.totalCicilan = input.totalCicilan ?? null;
  if (input.refBa !== undefined) data.refBa = input.refBa ?? null;
  if (input.deskripsi !== undefined) data.deskripsi = input.deskripsi ?? null;
  if (input.tglTerapkan !== undefined) data.tglTerapkan = input.tglTerapkan ?? null;

  const updated = await db.klaimPotongan.update({ where: { id }, data });
  const diffs = buildDiff(before, updated, AUDIT_FIELDS);
  if (diffs.length) {
    await writeKlaimAudit({ user, entity: "potongan", action: "update", targetId: id, diffs, extra: { klaimId: before.klaimId } });
  }
  return serialize(updated);
}

export async function deletePotongan(id: string, user: SessionUser): Promise<void> {
  const db = getAppDb();
  const before = await db.klaimPotongan.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Potongan tidak ditemukan.");
  await db.klaimPotongan.delete({ where: { id } });
  await writeKlaimAudit({
    user, entity: "potongan", action: "delete", targetId: id,
    extra: { klaimId: before.klaimId, data: snapshot(before, AUDIT_FIELDS) },
  });
}
