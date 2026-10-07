import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { KODE_FORM, type KodeForm } from "@/features/form-rm/registry";
import { adalahStatusIsian } from "@/features/form-rm/isian.status";
import type { RingkasIsian } from "./isian.types";

/**
 * Pencarian isian (reporthub) — query baca murni tanpa efek & tanpa audit,
 * dipakai katalog, pemilih pasien, daftar & profil pasien, dan rute lama.
 */

/** id isian aktif (bukan BATAL, urutan terakhir) untuk (form, NOPEN), atau null. */
export async function cariIsianAktif(kode: KodeForm, nopen: string): Promise<string | null> {
  const row = await getAppDb().formRmIsian.findFirst({
    where: { formKode: kode, subjek: nopen, status: { not: "BATAL" } },
    orderBy: { urutan: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

/** Isian aktif per NOPEN per form — satu query untuk banyak NOPEN (daftar & profil pasien). */
export async function isianAktifPerNopen(
  nopens: readonly string[],
  kodes: readonly KodeForm[] = KODE_FORM,
): Promise<Map<string, Partial<Record<KodeForm, RingkasIsian>>>> {
  const peta = new Map<string, Partial<Record<KodeForm, RingkasIsian>>>();
  if (nopens.length === 0 || kodes.length === 0) return peta;
  const rows = await getAppDb().formRmIsian.findMany({
    where: { nopen: { in: [...new Set(nopens)] }, formKode: { in: [...kodes] }, status: { not: "BATAL" } },
    select: { id: true, formKode: true, nopen: true, status: true, rev: true, updatedAt: true },
    orderBy: { urutan: "asc" }, // urutan terakhir menimpa → isian aktif terbaru
  });
  for (const r of rows) {
    if (!adalahStatusIsian(r.status)) continue;
    const perForm = peta.get(r.nopen) ?? {};
    perForm[r.formKode as KodeForm] = { id: r.id, status: r.status, rev: r.rev, updatedAt: r.updatedAt.toISOString() };
    peta.set(r.nopen, perForm);
  }
  return peta;
}

/** Jumlah draf per form: milik pengguna (yang membuat) dan seluruhnya — katalog. */
export async function hitungDraf(
  kodes: readonly KodeForm[],
  userId: string,
): Promise<Partial<Record<KodeForm, { saya: number; semua: number }>>> {
  if (kodes.length === 0) return {};
  const db = getAppDb();
  const where = { formKode: { in: [...kodes] }, status: "DRAF" };
  const [semua, saya] = await Promise.all([
    db.formRmIsian.groupBy({ by: ["formKode"], where, _count: { _all: true } }),
    db.formRmIsian.groupBy({ by: ["formKode"], where: { ...where, dibuatOlehId: userId }, _count: { _all: true } }),
  ]);
  const hasil: Partial<Record<KodeForm, { saya: number; semua: number }>> = {};
  for (const r of semua) hasil[r.formKode as KodeForm] = { saya: 0, semua: r._count._all };
  for (const r of saya) {
    const h = hasil[r.formKode as KodeForm];
    if (h) h.saya = r._count._all;
  }
  return hasil;
}

/** Draf terbaru yang dibuat pengguna untuk satu form (identitas = snapshot isian). */
export type DrafSaya = { id: string; nopen: string; norm: string; namaPasien: string; ruang: string | null; updatedAt: string };

export async function drafSaya(kode: KodeForm, userId: string, batas = 12): Promise<DrafSaya[]> {
  const rows = await getAppDb().formRmIsian.findMany({
    where: { formKode: kode, status: "DRAF", dibuatOlehId: userId },
    select: { id: true, nopen: true, norm: true, namaPasien: true, ruang: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: batas,
  });
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}
