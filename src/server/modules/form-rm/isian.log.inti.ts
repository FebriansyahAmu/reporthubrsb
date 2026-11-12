import { createHmac, timingSafeEqual } from "node:crypto";
import { samaNilai } from "@/features/form-rm/asal";
import { tumpang, type Perubahan } from "@/features/form-rm/gabung";
import { kanonik } from "./isian.segel";

/**
 * INTI LOG PERUBAHAN ISIAN (PRD Berlanjut IGD → RI §8.4) — murni, kunci
 * disuntikkan → mudah diuji. Satu entri per simpan yang mengubah kolom;
 * simpan beruntun orang & konteks yang sama ≤ 5 menit digabung ke entri
 * TERAKHIR (K7). Setiap entri disegel HMAC-SHA256 berantai per isian, domain
 * terpisah dari segel revisi ("form-rm.log|").
 */

export const AKSI_LOG = ["SIMPAN", "TIMPA", "MUAT_SIMRS", "BEKU_TERTAUT"] as const;
export type AksiLog = (typeof AKSI_LOG)[number];
export const adalahAksiLog = (v: string): v is AksiLog => (AKSI_LOG as readonly string[]).includes(v);

export const UNIT_KONTEKS = ["IGD", "RI", "RJ", ""] as const;
export type UnitKonteks = (typeof UNIT_KONTEKS)[number];

/** K7: jeda penggabungan entri log. */
export const JEDA_GABUNG_LOG_MS = 5 * 60_000;

/** Isi satu entri log yang disegel (semua kolom baris kecuali id & hash). */
export type IsiSegelLog = {
  isianId: string;
  urut: number;
  revAwal: number;
  revAkhir: number;
  aksi: string;
  olehId: string | null;
  olehNama: string | null;
  konteksNopen: string;
  konteksUnit: string;
  konteksRuang: string | null;
  perubahan: unknown;
  /** ISO 8601 dengan milidetik. */
  createdAt: string;
  updatedAt: string;
  hashSebelum: string | null;
};

export function segelLog(kunci: Uint8Array, isi: IsiSegelLog): string {
  return createHmac("sha256", kunci).update(`form-rm.log|${kanonik(isi)}`).digest("hex");
}

const samaWaktuKonstan = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Periksa rantai log (urut naik). Kosong = utuh. */
export function periksaRantaiLog(kunci: Uint8Array, entri: readonly { hash: string; isi: IsiSegelLog }[]): string[] {
  const masalah: string[] = [];
  let sebelum: string | null = null;
  entri.forEach((e, i) => {
    if (e.isi.urut !== i + 1) masalah.push(`Log ${e.isi.urut}: nomor urut tidak berurutan (seharusnya ${i + 1})`);
    if (e.isi.hashSebelum !== sebelum) masalah.push(`Log ${e.isi.urut}: tautan ke entri sebelumnya terputus`);
    if (!samaWaktuKonstan(segelLog(kunci, e.isi), e.hash)) masalah.push(`Log ${e.isi.urut}: isi tidak cocok dengan segel`);
    sebelum = e.hash;
  });
  return masalah;
}

/** Entri terakhir yang relevan untuk keputusan penggabungan. */
export type EntriTerakhir = {
  aksi: string;
  olehId: string | null;
  konteksNopen: string;
  revAkhir: number;
  updatedAt: Date;
  perubahan: unknown;
};

/** Perubahan tersimpan → bentuk baku (entri rusak dibuang). */
export function bacaPerubahan(raw: unknown): Perubahan[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    if (!x || typeof x !== "object" || typeof (x as { p?: unknown }).p !== "string") return [];
    const e = x as { p: string; s?: unknown; j?: unknown; t?: unknown };
    return [{ p: e.p, s: e.s ?? null, j: e.j ?? null, ...(e.t === true ? { t: true as const } : {}) }];
  });
}

/**
 * Gabungkan perubahan baru ke entri lama (K7): nilai sebelum tetap yang paling
 * awal, sesudah yang terbaru; kolom yang kembali ke nilai awal dibuang. null =
 * tak bisa digabung (path tumpang tak sama persis → entri baru).
 */
export function gabungPerubahan(lama: readonly Perubahan[], baru: readonly Perubahan[]): Perubahan[] | null {
  const peta = new Map<string, Perubahan>(lama.map((x) => [x.p, { ...x }]));
  for (const b of baru) {
    for (const p of peta.keys()) if (p !== b.p && tumpang(p, b.p)) return null;
    const ada = peta.get(b.p);
    if (ada) ada.j = b.j;
    else peta.set(b.p, { ...b });
  }
  return [...peta.values()].filter((x) => !samaNilai(x.s, x.j));
}

/**
 * Entri baru boleh digabung ke entri terakhir: orang & konteks sama, keduanya
 * SIMPAN, tak ada rev lain di antaranya, dan entri terakhir diperbarui ≤ 5 menit lalu.
 */
export function bolehGabungLog(
  terakhir: EntriTerakhir | null,
  baru: { aksi: AksiLog; olehId: string; konteksNopen: string; revAwal: number },
  sekarang: Date,
): boolean {
  return (
    terakhir !== null &&
    terakhir.aksi === "SIMPAN" &&
    baru.aksi === "SIMPAN" &&
    terakhir.olehId === baru.olehId &&
    terakhir.konteksNopen === baru.konteksNopen &&
    terakhir.revAkhir === baru.revAwal - 1 &&
    sekarang.getTime() - terakhir.updatedAt.getTime() <= JEDA_GABUNG_LOG_MS
  );
}
