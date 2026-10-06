import "server-only";
import type { Prisma } from "@/generated/app/client";
import { ValidationError } from "@/server/lib/errors";
import { normalkanPng } from "@/server/lib/png";
import type { DefinisiForm } from "@/features/form-rm/registry";
import { adalahDataUrlTtd, idDariRefTtd, refTtd, TTD_DATA_URL_PREFIX } from "@/features/form-rm/skema";
import { sha256Hex } from "./isian.segel";

/**
 * TANDA TANGAN ISIAN — gambar disimpan terpisah di `form_rm_ttd` (sekali tulis);
 * JSON isian hanya memuat referensi `ttd:<id>`. Dipakai service isian & migrasi
 * data lama.
 */

type Tx = Prisma.TransactionClient;

/** TTD baru per sekali simpan. */
const MAKS_TTD_BARU = 25;

/** Id TTD yang dirujuk data (urutan slot). */
export function rujukanTtd(def: DefinisiForm, data: object): string[] {
  const ids: string[] = [];
  def.petaTtd(data, (v) => {
    const id = idDariRefTtd(v);
    if (id) ids.push(id);
    return v;
  });
  return ids;
}

/**
 * Pisahkan TTD dari data: PNG data-URL baru dinormalkan & disimpan di
 * `form_rm_ttd` (dipakai ulang bila sha256 sama), lalu diganti referensi
 * `ttd:<id>`. Referensi yang ada harus milik isian INI (bukan isian lain).
 */
export async function pisahkanTtd(tx: Tx, isianId: string, def: DefinisiForm, data: object, olehId: string | null): Promise<object> {
  const baru = new Map<string, string>(); // data-URL → slot pertama
  const dirujuk = new Set<string>();
  def.petaTtd(data, (v, slot) => {
    if (adalahDataUrlTtd(v)) {
      if (!baru.has(v)) baru.set(v, slot);
    } else {
      const id = idDariRefTtd(v);
      if (id) dirujuk.add(id);
    }
    return v;
  });

  if (baru.size > MAKS_TTD_BARU) throw new ValidationError({ formErrors: ["Terlalu banyak tanda tangan baru"], fieldErrors: {} });
  if (dirujuk.size > 0) {
    const milik = await tx.formRmTtd.count({ where: { id: { in: [...dirujuk] }, isianId } });
    if (milik !== dirujuk.size) {
      throw new ValidationError({ formErrors: ["Referensi tanda tangan tidak dikenal"], fieldErrors: {} });
    }
  }

  const ganti = new Map<string, string>();
  for (const [dataUrl, slot] of baru) {
    const hasil = normalkanPng(Buffer.from(dataUrl.slice(TTD_DATA_URL_PREFIX.length), "base64"));
    if (!hasil.ok) throw new ValidationError({ formErrors: [], fieldErrors: { [slot]: [hasil.alasan] } });
    const sha256 = sha256Hex(hasil.png);
    const ada = await tx.formRmTtd.findUnique({ where: { isianId_sha256: { isianId, sha256 } }, select: { id: true } });
    const id =
      ada?.id ??
      (
        await tx.formRmTtd.create({
          data: { isianId, slot, png: hasil.png, sha256, ukuran: hasil.png.byteLength, dibuatOlehId: olehId },
          select: { id: true },
        })
      ).id;
    ganti.set(dataUrl, refTtd(id));
  }
  return baru.size === 0 ? data : def.petaTtd(data, (v) => ganti.get(v) ?? v);
}

/** id TTD → sha256 dihitung ulang dari bytes (bukan kolom sha256) untuk segel. */
export async function sidikTtd(db: Tx, isianId: string, ids: readonly string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const rows = await db.formRmTtd.findMany({ where: { id: { in: [...ids] }, isianId }, select: { id: true, png: true } });
  return Object.fromEntries(rows.map((r) => [r.id, sha256Hex(r.png)]));
}

/**
 * Referensi TTD → PNG data-URL (untuk dokumen cetak, yang dirender sekali di
 * server tanpa permintaan gambar tambahan). Referensi yatim → "" (kosong).
 */
export async function sisipkanTtd(db: Tx, isianId: string, def: DefinisiForm, data: object): Promise<object> {
  const ids = rujukanTtd(def, data);
  if (ids.length === 0) return data;
  const rows = await db.formRmTtd.findMany({ where: { id: { in: ids }, isianId }, select: { id: true, png: true } });
  const png = new Map(rows.map((r) => [r.id, `${TTD_DATA_URL_PREFIX}${Buffer.from(r.png).toString("base64")}`]));
  return def.petaTtd(data, (v) => {
    const id = idDariRefTtd(v);
    return id ? (png.get(id) ?? "") : v;
  });
}
