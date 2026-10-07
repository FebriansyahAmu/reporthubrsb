import "server-only";
import type { FormRm, Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import { ValidationError } from "@/server/lib/errors";
import { definisiDariJenisLama } from "@/features/form-rm/registry";
import { bersihkanDataLama } from "@/features/form-rm/skema";
import { getFormRmHeader } from "./form-rm.service";
import { auditIsian } from "./isian.audit";
import { pisahkanTtd } from "./isian.ttd";
import type { Aktor } from "./isian.types";

/**
 * MIGRASI DATA LAMA (PRD §8.5, K5) — baris tabel lama `form_rm` (satu per
 * NOPEN+jenis, tanpa status) dipindah menjadi isian v2 berstatus DRAF; TTD
 * data-URL diekstrak ke `form_rm_ttd`. Tabel lama hanya DIBACA.
 *
 * Idempoten: baris dilewati bila form itu sudah punya isian (status apa pun)
 * untuk NOPEN yang sama. Dipicu pengelola RM (sekaligus semua) atau otomatis
 * saat isian form itu dibuka pertama kali, agar data lama tak pernah tertutup
 * isian baru.
 */

export type HasilPindahBaris =
  | { hasil: "dipindah"; isianId: string }
  | { hasil: "dilewati"; alasan: string }
  | { hasil: "gagal"; alasan: string };

export type RingkasanPindah = {
  dipindah: number;
  dilewati: number;
  gagal: { kode: string; nopen: string; alasan: string }[];
};

const isUnik = (e: unknown) => (e as { code?: string } | null)?.code === "P2002";
const kunci = (kode: string, subjek: string) => `${kode}|${subjek}`;
const isi = (s: string | null | undefined) => (s && s !== "—" ? s : "");

/** Tabel lama mencatat USERNAME; isian v2 mencatat id pengguna. */
async function idPengguna(username: string | null): Promise<string | null> {
  if (!username) return null;
  const u = await getAppDb().user.findUnique({ where: { username }, select: { id: true } });
  return u?.id ?? null;
}

/** Pindahkan satu baris lama menjadi isian DRAF. */
export async function pindahkanBarisLama(row: FormRm, aktor: Aktor): Promise<HasilPindahBaris> {
  const def = definisiDariJenisLama(row.jenis);
  if (!def) return { hasil: "dilewati", alasan: `Jenis form lama "${row.jenis}" tidak dikenal` };
  const db = getAppDb();
  const ada = await db.formRmIsian.findFirst({ where: { formKode: def.kode, subjek: row.nopen }, select: { id: true } });
  if (ada) return { hasil: "dilewati", alasan: "Form ini sudah punya isian untuk pendaftaran tersebut" };

  const data = bersihkanDataLama(def.skema, row.data);
  if (!data) return { hasil: "gagal", alasan: "Data lama tidak sesuai skema formulir" };

  // Identitas dari SIMGOS (sumber kebenaran); kolom lama hanya cadangan.
  const [header, dibuatOlehId, diubahOlehId] = await Promise.all([
    getFormRmHeader(row.nopen).catch(() => null),
    idPengguna(row.createdBy),
    idPengguna(row.updatedBy ?? row.createdBy),
  ]);
  const norm = isi(header?.norm) || isi(row.norm);
  const namaPasien = isi(header?.nama) || isi(row.namaPasien);
  if (!norm || !namaPasien) return { hasil: "gagal", alasan: "Identitas pasien tidak ditemukan" };

  try {
    const isian = await db.$transaction(async (tx) => {
      const dibuat = await tx.formRmIsian.create({
        data: {
          formKode: def.kode,
          formVersi: def.versi,
          subjek: row.nopen,
          nopen: row.nopen,
          urutan: 1,
          norm,
          namaPasien,
          ruang: isi(header?.ruang) || isi(row.ruang) || null,
          status: "DRAF",
          rev: 1,
          data: {},
          asal: {},
          dibuatOlehId,
          diubahOlehId,
          createdAt: row.createdAt,
        },
        select: { id: true },
      });
      const bersih = await pisahkanTtd(tx, dibuat.id, def, data, dibuatOlehId);
      return tx.formRmIsian.update({
        where: { id: dibuat.id },
        data: { data: bersih as Prisma.InputJsonValue, updatedAt: row.updatedAt },
      });
    });
    await auditIsian(aktor, "pindah-lama", isian);
    return { hasil: "dipindah", isianId: isian.id };
  } catch (e) {
    if (isUnik(e)) return { hasil: "dilewati", alasan: "Form ini sudah punya isian untuk pendaftaran tersebut" };
    if (e instanceof ValidationError) return { hasil: "gagal", alasan: "Gambar tanda tangan lama tidak valid" };
    throw e;
  }
}

/** Baris lama (id) yang jenisnya dikenal dan belum punya isian. */
async function barisTertunda(): Promise<{ id: string; kode: string; nopen: string }[]> {
  const db = getAppDb();
  const lama = await db.formRm.findMany({ select: { id: true, nopen: true, jenis: true }, orderBy: { createdAt: "asc" } });
  if (lama.length === 0) return [];
  const isian = await db.formRmIsian.findMany({
    where: { subjek: { in: [...new Set(lama.map((l) => l.nopen))] } },
    select: { formKode: true, subjek: true },
  });
  const ada = new Set(isian.map((i) => kunci(i.formKode, i.subjek)));
  return lama.flatMap((l) => {
    const def = definisiDariJenisLama(l.jenis);
    return def && !ada.has(kunci(def.kode, l.nopen)) ? [{ id: l.id, kode: def.kode, nopen: l.nopen }] : [];
  });
}

/** Jumlah baris lama yang masih menunggu dipindahkan. */
export async function hitungDataLamaTertunda(): Promise<number> {
  return (await barisTertunda()).length;
}

/** Pindahkan semua baris lama yang tertunda (berurutan; aman diulang). */
export async function pindahkanSemuaDataLama(aktor: Aktor): Promise<RingkasanPindah> {
  const db = getAppDb();
  const ringkas: RingkasanPindah = { dipindah: 0, dilewati: 0, gagal: [] };
  for (const t of await barisTertunda()) {
    const row = await db.formRm.findUnique({ where: { id: t.id } });
    const h = row ? await pindahkanBarisLama(row, aktor) : ({ hasil: "dilewati", alasan: "" } as const);
    if (h.hasil === "dipindah") ringkas.dipindah++;
    else if (h.hasil === "dilewati") ringkas.dilewati++;
    else ringkas.gagal.push({ kode: t.kode, nopen: t.nopen, alasan: h.alasan });
  }
  return ringkas;
}
