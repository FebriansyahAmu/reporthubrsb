import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import {
  queryIgdNopenByRiNopen,
  queryRincianTagihan,
  queryTagihanHeader,
  TAGIHAN_KATEGORI,
} from "./berkas-klaim.dal";
import type {
  TagihanItem,
  TagihanKategori,
  TagihanLengkap,
  TagihanRingkas,
} from "./berkas-klaim.types";

/** DECIMAL SIMGOS datang sebagai string → number aman (0 bila invalid). */
function num(v: unknown): number {
  const n = typeof v === "bigint" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** DATE/DATETIME SIMGOS → "YYYY-MM-DD" (jam-dinding, baca getUTC*). "" bila null. */
function wallDate(v: Date | string | null): string {
  if (v == null) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const EMPTY: TagihanRingkas = { ada: false, total: 0, tanggal: "", kategori: [] };

/**
 * Ringkasan tagihan satu episode (`pembayaran.tagihan.ID` = NOPEN), READ-ONLY.
 * Mengembalikan total + komponen biaya bernilai > 0 (terurut menurun). `ada:false`
 * bila SIMGOS belum dikonfigurasi atau episode belum punya tagihan.
 */
export async function getTagihanRingkas(nopen: string): Promise<TagihanRingkas> {
  if (!isSimgosConfigured()) return EMPTY;
  const h = await queryTagihanHeader(nopen);
  if (!h) return EMPTY;

  const kategori: TagihanKategori[] = TAGIHAN_KATEGORI.map((k) => ({
    key: k.col,
    label: k.label,
    nilai: num(h[k.col]),
  }))
    .filter((k) => k.nilai > 0)
    .sort((a, b) => b.nilai - a.nilai);

  return { ada: true, total: num(h.TOTAL), tanggal: wallDate(h.TANGGAL), kategori };
}

/** Ringkasan + seluruh item rincian (untuk modal). READ-ONLY. */
export async function getTagihanLengkap(nopen: string): Promise<TagihanLengkap> {
  const ringkas = await getTagihanRingkas(nopen);
  if (!ringkas.ada) return { ...ringkas, items: [] };

  const rows = await queryRincianTagihan(nopen);
  const items: TagihanItem[] = rows.map((r) => ({
    jenis: num(r.JENIS),
    nama: r.NAMA?.trim() || "-",
    qty: num(r.QTY),
    tarif: num(r.TARIF),
    diskon: num(r.DISKON),
    subtotal: num(r.SUBTOTAL),
    tanggal: wallDate(r.TGL),
  }));

  return { ...ringkas, items };
}

/**
 * Ringkasan tagihan IGD asal untuk satu episode RI (via SPRI). READ-ONLY.
 * `null` bila episode tak lewat IGD / IGD belum punya tagihan.
 */
export async function getTagihanIgdRingkas(
  riNopen: string,
): Promise<{ nopen: string; total: number } | null> {
  if (!isSimgosConfigured()) return null;
  const igdNopen = await queryIgdNopenByRiNopen(riNopen);
  if (!igdNopen) return null;
  const r = await getTagihanRingkas(igdNopen);
  return r.ada ? { nopen: igdNopen, total: r.total } : null;
}

/** Gabung dua kategori biaya per `key` (jumlahkan nilai), buang 0, urut menurun. */
function mergeKategori(a: TagihanKategori[], b: TagihanKategori[]): TagihanKategori[] {
  const map = new Map<string, TagihanKategori>();
  for (const k of [...a, ...b]) {
    const cur = map.get(k.key);
    if (cur) cur.nilai += k.nilai;
    else map.set(k.key, { ...k });
  }
  return [...map.values()].filter((k) => k.nilai > 0).sort((x, y) => y.nilai - x.nilai);
}

/**
 * Tagihan GABUNGAN: episode RI + episode IGD asal (via SPRI) dalam satu tampilan.
 * Total & kategori dijumlahkan; item digabung (IGD dulu, kronologis) dengan tag
 * `sumber`. Bila episode tak punya IGD/tagihan IGD → kembalikan tagihan RI apa
 * adanya (tanpa tag sumber). READ-ONLY.
 */
export async function getTagihanGabungan(riNopen: string): Promise<TagihanLengkap> {
  const ri = await getTagihanLengkap(riNopen);
  const igdNopen = await queryIgdNopenByRiNopen(riNopen);
  if (!igdNopen) return ri;
  const igd = await getTagihanLengkap(igdNopen);
  if (!igd.ada) return ri;
  if (!ri.ada) return igd;

  return {
    ada: true,
    total: ri.total + igd.total,
    tanggal: ri.tanggal,
    kategori: mergeKategori(ri.kategori, igd.kategori),
    items: [
      ...igd.items.map((it) => ({ ...it, sumber: "IGD" as const })),
      ...ri.items.map((it) => ({ ...it, sumber: "RI" as const })),
    ],
  };
}
