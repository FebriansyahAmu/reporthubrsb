import "server-only";
import { z } from "zod";
import { getAppDb } from "@/server/db/app.client";
import { writeAudit } from "@/server/lib/audit";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { normalkanPng } from "@/server/lib/png";
import { fullName } from "@/features/master/master.constants";
import { TTD_DATA_URL_PREFIX, TTD_MAKS_KARAKTER } from "@/features/form-rm/skema";
import { JENIS_TTD_SAYA, type DataTtdSaya, type JenisTtdSaya } from "@/features/form-rm/ttd-saya";
import { sha256Hex } from "./isian.segel";

/**
 * TTD TERSIMPAN MILIK PETUGAS — baca/simpan/hapus TTD & paraf pengguna login.
 * Setiap fungsi hanya menyentuh baris `userId` pemanggil (id dari sesi, bukan
 * dari klien) → tak ada jalur membaca TTD pengguna lain. Gambar dinormalkan
 * server seperti TTD isian (chunk non-gambar dibuang).
 */

export type AktorTtdSaya = { id: string; nama: string; ip: string | null };

export const jenisTtdSayaSchema = z.enum(JENIS_TTD_SAYA);

const DATA_URL_RE = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

export const simpanTtdSayaSchema = z
  .object({
    jenis: jenisTtdSayaSchema,
    png: z.string().max(TTD_MAKS_KARAKTER).regex(DATA_URL_RE, "Tanda tangan harus berupa gambar PNG"),
  })
  .strict();

const dataUrl = (png: Uint8Array) => `${TTD_DATA_URL_PREFIX}${Buffer.from(png).toString("base64")}`;

/** Nama lengkap bergelar pengguna + TTD/paraf tersimpannya. */
export async function bacaTtdSaya(userId: string): Promise<DataTtdSaya> {
  const db = getAppDb();
  const [user, rows] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { gelarDepan: true, name: true, gelarBelakang: true } }),
    db.formRmTtdPetugas.findMany({ where: { userId }, select: { jenis: true, png: true, updatedAt: true } }),
  ]);
  if (!user) throw new NotFoundError("Pengguna tidak ditemukan");
  const item: DataTtdSaya["item"] = {};
  for (const r of rows) {
    const jenis = jenisTtdSayaSchema.safeParse(r.jenis);
    if (jenis.success) item[jenis.data] = { dataUrl: dataUrl(r.png), diperbarui: r.updatedAt.toISOString() };
  }
  return { nama: fullName(user), item };
}

/** Simpan / ganti TTD atau paraf pengguna. Mengembalikan data terbaru. */
export async function simpanTtdSaya(input: z.output<typeof simpanTtdSayaSchema>, aktor: AktorTtdSaya): Promise<DataTtdSaya> {
  const hasil = normalkanPng(Buffer.from(input.png.slice(TTD_DATA_URL_PREFIX.length), "base64"));
  if (!hasil.ok) throw new ValidationError({ formErrors: [], fieldErrors: { png: [hasil.alasan] } });
  const sha256 = sha256Hex(hasil.png);
  const isi = { png: hasil.png, sha256, ukuran: hasil.png.byteLength };
  await getAppDb().formRmTtdPetugas.upsert({
    where: { userId_jenis: { userId: aktor.id, jenis: input.jenis } },
    create: { userId: aktor.id, jenis: input.jenis, ...isi },
    update: isi,
  });
  await writeAudit({
    actorId: aktor.id,
    actorName: aktor.nama,
    action: "form-rm.ttd-saya.simpan",
    targetId: aktor.id,
    metadata: { jenis: input.jenis, sha256: sha256.slice(0, 16), ukuran: isi.ukuran },
    ip: aktor.ip,
  });
  return bacaTtdSaya(aktor.id);
}

/** Hapus TTD atau paraf tersimpan pengguna (isian yang sudah memakainya tidak berubah). */
export async function hapusTtdSaya(jenis: JenisTtdSaya, aktor: AktorTtdSaya): Promise<DataTtdSaya> {
  const { count } = await getAppDb().formRmTtdPetugas.deleteMany({ where: { userId: aktor.id, jenis } });
  if (count > 0) {
    await writeAudit({
      actorId: aktor.id,
      actorName: aktor.nama,
      action: "form-rm.ttd-saya.hapus",
      targetId: aktor.id,
      metadata: { jenis },
      ip: aktor.ip,
    });
  }
  return bacaTtdSaya(aktor.id);
}
