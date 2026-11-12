import { adalahStatusIsian, type StatusIsian } from "./isian.status";
import { penyusunFrame } from "./ttd-siaga/sse";

/**
 * ALIRAN ISIAN (SSE) form berlanjut IGD → rawat inap — protokol bersama server
 * & klien (docs/PRD_Form_RM_Berlanjut_IGD_RI.md §8.5). Event TIDAK PERNAH
 * membawa nilai kolom: hanya rev, status, path kolom, dan siapa/unit/ruang/jam.
 * Isi terbaru diambil lewat `GET …/terkini` (hak dicek ulang setiap kali).
 */

export const EVENT_ALIRAN_ISIAN = ["awal", "berubah", "status", "hadir", "segarkan", "detak"] as const;
export type EventAliranIsian = (typeof EVENT_ALIRAN_ISIAN)[number];

/** Satu-satunya jalan menulis ke aliran isian: nama event dari daftar tetap, data JSON satu baris. */
export const frameIsian = penyusunFrame(EVENT_ALIRAN_ISIAN);

/** Umur maksimum satu aliran → `segarkan` lalu ditutup; sambung ulang memeriksa sesi & hak lagi. */
export const UMUR_ALIRAN_MS = 10 * 60_000;
/** Aliran per pengguna (tab ke-9 → 429) dan total per proses (→ 503). */
export const MAKS_ALIRAN_PENGGUNA = 8;
export const MAKS_ALIRAN_TOTAL = 400;
/** Path kolom per event `berubah`; sisanya hanya dihitung (`lebih`) agar frame tetap kecil. */
export const MAKS_KOLOM_EVENT = 40;
/** Orang lain yang ditampilkan di "Juga membuka". */
export const MAKS_HADIR = 20;

export const UNIT_ALIRAN = ["IGD", "RI", "RJ", ""] as const;
export type UnitAliran = (typeof UNIT_ALIRAN)[number];

export type AwalAliran = { rev: number; status: StatusIsian };
export type BerubahAliran = {
  rev: number;
  oleh: string;
  unit: UnitAliran;
  ruang: string | null;
  /** Path kolom yang berubah (tanpa nilai). */
  kolom: string[];
  /** Jumlah kolom berubah di luar `kolom`. */
  lebih: number;
  waktu: string;
};
export type StatusAliran = { rev: number; status: StatusIsian; oleh: string };
export type OrangHadir = { nama: string; unit: UnitAliran; ruang: string | null };
export type HadirAliran = { daftar: OrangHadir[] };

/* ------------------------------------------------------------------ label */

const LABEL_UNIT: Record<UnitAliran, string> = { IGD: "IGD", RI: "Rawat Inap", RJ: "Rawat Jalan", "": "" };

export const labelUnit = (unit: string | null | undefined): string =>
  unit ? (LABEL_UNIT[unit as UnitAliran] ?? unit) : "";

/** "Rawat Inap · Bougenville" (bagian yang kosong dilewati). */
export const tempatUnit = (unit: string | null | undefined, ruang: string | null | undefined): string =>
  [labelUnit(unit), ruang ?? ""].filter(Boolean).join(" · ");

/** "Ns. Rina (Rawat Inap · Bougenville)" */
export function teksOrang(o: { nama: string; unit: string | null; ruang: string | null }): string {
  const t = tempatUnit(o.unit, o.ruang);
  return t ? `${o.nama} (${t})` : o.nama;
}

/* -------------------------------------------------- baca event (klien) */

const MAKS_TEKS = 191;
const MAKS_PATH = 160;

const objek = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const revSah = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1;
const teks = (v: unknown, maks = MAKS_TEKS): v is string => typeof v === "string" && v.length <= maks;
const unitSah = (v: unknown): v is UnitAliran => typeof v === "string" && (UNIT_ALIRAN as readonly string[]).includes(v);
const ruangSah = (v: unknown): v is string | null => v === null || teks(v);
const statusSah = (v: unknown): v is StatusIsian => typeof v === "string" && adalahStatusIsian(v);
const waktuSah = (v: unknown): v is string => teks(v, 40) && !Number.isNaN(Date.parse(v));

/** JSON data event (string) → objek; rusak → null. */
export function dataEvent(teksData: unknown): Record<string, unknown> | null {
  if (typeof teksData !== "string") return null;
  try {
    return objek(JSON.parse(teksData));
  } catch {
    return null;
  }
}

export function bacaAwal(v: unknown): AwalAliran | null {
  const o = objek(v);
  return o && revSah(o.rev) && statusSah(o.status) ? { rev: o.rev, status: o.status } : null;
}

export function bacaBerubah(v: unknown): BerubahAliran | null {
  const o = objek(v);
  if (!o || !revSah(o.rev) || !teks(o.oleh) || !unitSah(o.unit) || !ruangSah(o.ruang) || !waktuSah(o.waktu)) return null;
  if (!Array.isArray(o.kolom) || o.kolom.length > MAKS_KOLOM_EVENT || !o.kolom.every((p) => teks(p, MAKS_PATH))) return null;
  const lebih = typeof o.lebih === "number" && Number.isInteger(o.lebih) && o.lebih >= 0 ? o.lebih : 0;
  return { rev: o.rev, oleh: o.oleh, unit: o.unit, ruang: o.ruang, kolom: o.kolom as string[], lebih, waktu: o.waktu };
}

export function bacaStatus(v: unknown): StatusAliran | null {
  const o = objek(v);
  return o && revSah(o.rev) && statusSah(o.status) && teks(o.oleh) ? { rev: o.rev, status: o.status, oleh: o.oleh } : null;
}

export function bacaHadir(v: unknown): HadirAliran | null {
  const o = objek(v);
  if (!o || !Array.isArray(o.daftar) || o.daftar.length > MAKS_HADIR) return null;
  const daftar: OrangHadir[] = [];
  for (const x of o.daftar) {
    const h = objek(x);
    if (!h || !teks(h.nama) || !unitSah(h.unit) || !ruangSah(h.ruang)) return null;
    daftar.push({ nama: h.nama, unit: h.unit, ruang: h.ruang });
  }
  return { daftar };
}

/** Kolom event `berubah` yang terpotong: path pertama + jumlah sisanya. */
export function potongKolom(kolom: readonly string[]): { kolom: string[]; lebih: number } {
  const unik = [...new Set(kolom)];
  return { kolom: unik.slice(0, MAKS_KOLOM_EVENT), lebih: Math.max(0, unik.length - MAKS_KOLOM_EVENT) };
}
