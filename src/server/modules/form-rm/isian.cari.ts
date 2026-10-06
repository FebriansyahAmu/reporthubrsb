import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { KODE_FORM, type KodeForm } from "@/features/form-rm/registry";
import { adalahStatusIsian } from "@/features/form-rm/isian.status";
import type { RingkasIsian } from "./isian.types";

/**
 * Pencarian isian aktif (bukan BATAL) — query baca murni tanpa efek & tanpa
 * audit, dipakai daftar pasien, profil pasien, dan pengalihan rute lama.
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
): Promise<Map<string, Partial<Record<KodeForm, RingkasIsian>>>> {
  const peta = new Map<string, Partial<Record<KodeForm, RingkasIsian>>>();
  if (nopens.length === 0) return peta;
  const rows = await getAppDb().formRmIsian.findMany({
    where: { nopen: { in: [...new Set(nopens)] }, formKode: { in: [...KODE_FORM] }, status: { not: "BATAL" } },
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
