import "server-only";
import { createLimiter } from "@/server/lib/limiter";
import { createTtlCache } from "@/server/lib/ttl-cache";
import { BATAS, JENIS_ICD, type JenisIcd } from "./verifikasi.constants";
import { queryCariIcdKode, queryCariIcdTeks, queryIcdKode } from "./koding.dal";
import type { IcdInfo, PetaIcd } from "./verifikasi.types";

/**
 * Cache master ICD INA-CBG (PRD §7.2-6). Memuat seluruh master butuh 6–9 dtk
 * (diukur 1 Okt 2026) sehingga cache diisi SESUAI KEBUTUHAN:
 *  - info per kode (termasuk "tidak ada") — kode yang belum dikenal diambil
 *    sekaligus satu query `IN (…)`;
 *  - hasil pencarian per (jenis, kata kunci) — single-flight, maks
 *    `BATAS.ICD_PARALEL` pencarian ke SIMGOS bersamaan.
 * Keduanya berumur 24 jam dan tersimpan di `globalThis` (satu per proses).
 */

type Entri = { at: number; info: IcdInfo | null };
const MAKS_KODE = 20_000;

const g = globalThis as unknown as { __icdKode?: Map<string, Entri> };
const kodeCache: Map<string, Entri> = (g.__icdKode ??= new Map());

const cacheCari = createTtlCache<IcdInfo[]>("icd-cari", { ttlMs: BATAS.ICD_TTL_MS, max: 500 });
const batasIcd = createLimiter("icd-cari", BATAS.ICD_PARALEL);

const kunci = (jenis: JenisIcd, kode: string) => `${jenis}:${kode}`;

function simpan(jenis: JenisIcd, kode: string, info: IcdInfo | null) {
  const k = kunci(jenis, kode);
  kodeCache.delete(k);
  kodeCache.set(k, { at: Date.now(), info });
  while (kodeCache.size > MAKS_KODE) {
    const tertua = kodeCache.keys().next().value;
    if (tertua === undefined) break;
    kodeCache.delete(tertua);
  }
}

/** Info ICD untuk kode-kode ini; kode yang tak ada di master tidak tercantum. */
export async function infoIcd(jenis: JenisIcd, kodes: readonly string[]): Promise<Record<string, IcdInfo>> {
  const out: Record<string, IcdInfo> = {};
  const kurang: string[] = [];
  const kini = Date.now();
  for (const kode of new Set(kodes.filter(Boolean))) {
    const e = kodeCache.get(kunci(jenis, kode));
    if (e && kini - e.at < BATAS.ICD_TTL_MS) {
      if (e.info) out[kode] = e.info;
    } else kurang.push(kode);
  }
  if (kurang.length) {
    const rows = await queryIcdKode(jenis, kurang);
    const ada = new Map(rows.map((r) => [r.kode, r]));
    for (const kode of kurang) {
      const info = ada.get(kode) ?? null;
      simpan(jenis, kode, info);
      if (info) out[kode] = info;
    }
  }
  return out;
}

/** Peta info ICD untuk kumpulan kode per jenis (query hanya untuk kode yang belum dikenal). */
export async function petaIcd(kode: Record<JenisIcd, readonly string[]>): Promise<PetaIcd> {
  const peta = {} as PetaIcd;
  for (const j of JENIS_ICD) peta[j] = kode[j].length ? await infoIcd(j, kode[j]) : {};
  return peta;
}

/* --------------------------------------------------------------- pencarian */

/** Stopword FULLTEXT InnoDB bawaan (token ini diabaikan mesin → jangan diwajibkan). */
const STOPWORD = new Set(["about", "are", "com", "for", "from", "how", "that", "the", "this", "was", "what", "when", "where", "who", "will", "with", "und", "www"]);

/** Normalisasi kode ketikan: "k358" → "K35.8", "4709" → "47.09". */
function prefiksKode(jenis: JenisIcd, q: string): string | null {
  const u = q.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9.]+$/.test(u) || !/\d/.test(u)) return null;
  if (jenis === "10") return u.replace(/^([A-Z]\d{2})(\d{1,4})$/, "$1.$2");
  return u.replace(/^(\d{2})(\d{1,3})$/, "$1.$2");
}

/** Token teks → ekspresi FULLTEXT mode boolean (`+token*`), hanya [a-z0-9]. */
function ekspresiTeks(q: string): { ekspresi: string; token: string[] } | null {
  const token = [...new Set(q.toLowerCase().split(/[^a-z0-9]+/))].filter((t) => t.length >= 3 && !STOPWORD.has(t)).slice(0, 6);
  return token.length ? { ekspresi: token.map((t) => `+${t}*`).join(" "), token } : null;
}

/** Nama yang diawali token pertama naik ke atas; kode valid sebelum kode kategori. */
function urutkan(hasil: IcdInfo[], token: readonly string[]): IcdInfo[] {
  const skor = (i: IcdInfo) => {
    const n = i.nama.toLowerCase();
    return (i.valid ? 0 : 4) + (n.startsWith(token[0]) ? 0 : new RegExp(`\\b${token[0]}`).test(n) ? 1 : 2);
  };
  return hasil
    .map((i, idx) => ({ i, idx, s: skor(i) }))
    .sort((a, b) => a.s - b.s || a.idx - b.idx)
    .map((x) => x.i);
}

/**
 * Cari kode ICD INA-CBG per kode (awalan) atau per teks (nama, bahasa Inggris
 * sesuai master). Hasil maks `BATAS.ICD_HASIL`, di-cache 24 jam.
 */
export async function cariIcd(jenis: JenisIcd, q: string): Promise<IcdInfo[]> {
  const bersih = q.trim().replace(/\s+/g, " ");
  if (!bersih) return [];
  const prefiks = prefiksKode(jenis, bersih);
  const teks = prefiks ? null : ekspresiTeks(bersih);
  if (!prefiks && !teks) return [];
  const kunciCari = `${jenis}|${prefiks ? `k:${prefiks}` : `t:${teks!.token.join(" ")}`}`;

  const { value } = await cacheCari.get(kunciCari, () =>
    batasIcd(async () => {
      const hasil = prefiks
        ? await queryCariIcdKode(jenis, prefiks, BATAS.ICD_HASIL)
        : urutkan(await queryCariIcdTeks(jenis, teks!.ekspresi, BATAS.ICD_HASIL * 3), teks!.token).slice(0, BATAS.ICD_HASIL);
      for (const i of hasil) simpan(jenis, i.kode, i);
      return hasil;
    }),
  );
  return value;
}
