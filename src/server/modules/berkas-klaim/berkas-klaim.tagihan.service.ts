import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import {
  queryIgdAsalByRiNopen,
  queryRincianTagihan,
  queryTagihanHeader,
  TAGIHAN_KATEGORI,
} from "./berkas-klaim.dal";
import type {
  TagihanIgd,
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

const EMPTY: TagihanRingkas = { ada: false, tagihanId: "", total: 0, tanggal: "", kategori: [], nopenLain: [] };

/**
 * Ringkasan tagihan yang menagih satu episode (via `tagihan_pendaftaran`), READ-ONLY.
 * Mengembalikan total + komponen biaya bernilai > 0 (terurut menurun) + NOPEN lain
 * di tagihan yang sama. `ada:false` bila SIMGOS belum dikonfigurasi atau episode
 * belum punya tagihan.
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

  return {
    ada: true,
    tagihanId: String(h.ID).trim(),
    total: num(h.TOTAL),
    tanggal: wallDate(h.TANGGAL),
    kategori,
    nopenLain: (h.NOPEN_LAIN ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

/** Ringkasan + seluruh item rincian (untuk modal). READ-ONLY. */
export async function getTagihanLengkap(nopen: string): Promise<TagihanLengkap> {
  const ringkas = await getTagihanRingkas(nopen);
  if (!ringkas.ada) return { ...ringkas, items: [] };

  const rows = await queryRincianTagihan(ringkas.tagihanId);
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
 * Tagihan IGD asal untuk satu episode RI — READ-ONLY. IGD dicari lewat SPRI,
 * tagihan SIMGOS yang sama, atau IGD tepat sebelum masuk RI (`queryIgdAsalByRiNopen`).
 * `sudahDigabung` = IGD & RI sudah SATU tagihan di SIMGOS (total RI sudah memuat
 * IGD). `null` bila tak ada IGD asal / IGD belum punya tagihan.
 */
export async function getTagihanIgdRingkas(riNopen: string): Promise<TagihanIgd | null> {
  if (!isSimgosConfigured()) return null;
  const [asal, riTagihan] = await Promise.all([queryIgdAsalByRiNopen(riNopen), getTagihanRingkas(riNopen)]);
  if (!asal) return null;
  const igd = await getTagihanRingkas(asal.nopen);
  if (!igd.ada) return null;
  return {
    nopen: asal.nopen,
    total: igd.total,
    dasar: asal.dasar,
    sudahDigabung: riTagihan.ada && igd.tagihanId === riTagihan.tagihanId,
  };
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
 * Tagihan GABUNGAN: episode RI + episode IGD asal dalam satu tampilan.
 * Total & kategori dijumlahkan; item digabung (IGD dulu, kronologis) dengan tag
 * `sumber`. Bila tak ada IGD/tagihan IGD, atau keduanya SUDAH satu tagihan di
 * SIMGOS (tak boleh dijumlah dua kali) → tagihan RI apa adanya. READ-ONLY.
 */
export async function getTagihanGabungan(riNopen: string): Promise<TagihanLengkap> {
  const [ri, asal] = await Promise.all([getTagihanLengkap(riNopen), queryIgdAsalByRiNopen(riNopen)]);
  if (!asal) return ri;
  const igd = await getTagihanLengkap(asal.nopen);
  if (!igd.ada || (ri.ada && igd.tagihanId === ri.tagihanId)) return ri;
  if (!ri.ada) return { ...igd, igdNopen: asal.nopen };

  return {
    ada: true,
    tagihanId: ri.tagihanId,
    total: ri.total + igd.total,
    tanggal: ri.tanggal,
    kategori: mergeKategori(ri.kategori, igd.kategori),
    nopenLain: ri.nopenLain,
    igdNopen: asal.nopen,
    items: [
      ...igd.items.map((it) => ({ ...it, sumber: "IGD" as const })),
      ...ri.items.map((it) => ({ ...it, sumber: "RI" as const })),
    ],
  };
}
