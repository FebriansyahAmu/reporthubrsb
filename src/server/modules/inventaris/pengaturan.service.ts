import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { BusinessRuleError, NotFoundError } from "@/server/lib/errors";
import type { RefEntity, RefInput } from "./pengaturan.schema";

/** Deteksi pelanggaran unik Prisma (P2002). */
function isUniqueError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

const DUP_MSG: Record<RefEntity, string> = {
  satuan: "Nama satuan sudah ada.",
  kondisi: "Kode kondisi sudah ada.",
  "sumber-anggaran": "Singkatan sumber anggaran sudah ada.",
  kategori: "Nama kategori sudah ada.",
  ruangan: "Kode prefix ruangan sudah ada.",
};

/** Daftar seluruh baris referensi (urut: urutan, lalu nama). */
export async function listRef(entity: RefEntity) {
  const db = getAppDb();
  switch (entity) {
    case "satuan":
      return db.invSatuan.findMany({ orderBy: [{ urutan: "asc" }, { nama: "asc" }] });
    case "kondisi":
      return db.invKondisi.findMany({ orderBy: [{ urutan: "asc" }, { nama: "asc" }] });
    case "sumber-anggaran":
      return db.invSumberAnggaran.findMany({ orderBy: [{ urutan: "asc" }, { nama: "asc" }] });
    case "kategori":
      return db.invKategori.findMany({ orderBy: [{ urutan: "asc" }, { nama: "asc" }] });
    case "ruangan":
      return db.invRuangan.findMany({ orderBy: [{ urutan: "asc" }, { kodePrefix: "asc" }] });
  }
}

/** Buat baris referensi baru. Melempar BusinessRuleError bila duplikat unik. */
export async function createRef(entity: RefEntity, input: RefInput) {
  const db = getAppDb();
  try {
    switch (entity) {
      case "satuan":
        return await db.invSatuan.create({ data: { nama: input.nama!, urutan: input.urutan, aktif: input.aktif } });
      case "kondisi":
        return await db.invKondisi.create({
          data: { nama: input.nama!, kode: input.kode!, tone: input.tone ?? "neutral", urutan: input.urutan, aktif: input.aktif },
        });
      case "sumber-anggaran":
        return await db.invSumberAnggaran.create({
          data: { nama: input.nama!, singkatan: input.singkatan!, urutan: input.urutan, aktif: input.aktif },
        });
      case "kategori":
        return await db.invKategori.create({
          data: { nama: input.nama!, kode: input.kode ?? null, urutan: input.urutan, aktif: input.aktif },
        });
      case "ruangan":
        return await db.invRuangan.create({
          data: {
            kodePrefix: input.kodePrefix!.toUpperCase(),
            nama: input.nama!,
            pjNama: input.pjNama ?? null,
            pjNip: input.pjNip ?? null,
            urutan: input.urutan,
            aktif: input.aktif,
          },
        });
    }
  } catch (e) {
    if (isUniqueError(e)) throw new BusinessRuleError(DUP_MSG[entity]);
    throw e;
  }
}

/** Perbarui baris referensi. */
export async function updateRef(entity: RefEntity, id: string, input: RefInput) {
  const db = getAppDb();
  try {
    switch (entity) {
      case "satuan":
        return await db.invSatuan.update({ where: { id }, data: { nama: input.nama!, urutan: input.urutan, aktif: input.aktif } });
      case "kondisi":
        return await db.invKondisi.update({
          where: { id },
          data: { nama: input.nama!, kode: input.kode!, tone: input.tone ?? "neutral", urutan: input.urutan, aktif: input.aktif },
        });
      case "sumber-anggaran":
        return await db.invSumberAnggaran.update({
          where: { id },
          data: { nama: input.nama!, singkatan: input.singkatan!, urutan: input.urutan, aktif: input.aktif },
        });
      case "kategori":
        return await db.invKategori.update({
          where: { id },
          data: { nama: input.nama!, kode: input.kode ?? null, urutan: input.urutan, aktif: input.aktif },
        });
      case "ruangan":
        return await db.invRuangan.update({
          where: { id },
          data: {
            kodePrefix: input.kodePrefix!.toUpperCase(),
            nama: input.nama!,
            pjNama: input.pjNama ?? null,
            pjNip: input.pjNip ?? null,
            urutan: input.urutan,
            aktif: input.aktif,
          },
        });
    }
  } catch (e) {
    if (isUniqueError(e)) throw new BusinessRuleError(DUP_MSG[entity]);
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") {
      throw new NotFoundError("Data tidak ditemukan.");
    }
    throw e;
  }
}

/** Hitung berapa barang/relasi yang masih memakai referensi ini. */
async function usageCount(entity: RefEntity, id: string): Promise<number> {
  const db = getAppDb();
  switch (entity) {
    case "satuan":
      return db.invBarang.count({ where: { satuanId: id } });
    case "kondisi": {
      const [a, b] = await Promise.all([
        db.invBarang.count({ where: { kondisiId: id } }),
        db.invPemeliharaan.count({ where: { kondisiSesudahId: id } }),
      ]);
      return a + b;
    }
    case "sumber-anggaran":
      return db.invBarang.count({ where: { sumberAnggaranId: id } });
    case "kategori":
      return db.invBarang.count({ where: { kategoriId: id } });
    case "ruangan": {
      const [a, b] = await Promise.all([
        db.invBarang.count({ where: { ruanganId: id } }),
        db.invMutasi.count({ where: { OR: [{ dariRuanganId: id }, { keRuanganId: id }] } }),
      ]);
      return a + b;
    }
  }
}

/** Hapus baris referensi. Ditolak (409) bila masih dipakai — sarankan nonaktifkan. */
export async function deleteRef(entity: RefEntity, id: string) {
  const db = getAppDb();
  const used = await usageCount(entity, id);
  if (used > 0) {
    throw new BusinessRuleError(
      `Tidak dapat dihapus — masih dipakai ${used} data. Nonaktifkan saja bila tak terpakai.`,
    );
  }
  try {
    switch (entity) {
      case "satuan":
        return await db.invSatuan.delete({ where: { id } });
      case "kondisi":
        return await db.invKondisi.delete({ where: { id } });
      case "sumber-anggaran":
        return await db.invSumberAnggaran.delete({ where: { id } });
      case "kategori":
        return await db.invKategori.delete({ where: { id } });
      case "ruangan":
        return await db.invRuangan.delete({ where: { id } });
    }
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") {
      throw new NotFoundError("Data tidak ditemukan.");
    }
    throw e;
  }
}
