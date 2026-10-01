import "server-only";
import type { KlaimLampiran, KlaimPaket } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import { MIME_LAMPIRAN, STATUS_PAKET, type MimeLampiran, type StatusPaket } from "./verifikasi.constants";
import type { ItemManifest, ItemSusunan, LampiranItem, ManifestPaket, PaketInfo, PaketRingkas } from "./verifikasi.types";

/**
 * Repository Paket Klaim di DB aplikasi `reporthub` (`klaim_lampiran`,
 * `klaim_paket`). Berkas fisiknya di penyimpanan disk (`server/lib/storage`).
 */

const MIME_SET = new Set<string>(MIME_LAMPIRAN);
const STATUS_PAKET_SET = new Set<string>(STATUS_PAKET);

export function keLampiranItem(r: KlaimLampiran): LampiranItem {
  return {
    id: r.id,
    nama: r.namaBerkas,
    mime: (MIME_SET.has(r.mime) ? r.mime : "application/pdf") as MimeLampiran,
    ukuran: r.ukuran,
    halaman: r.halaman ?? 1,
    keterangan: r.keterangan,
    diunggahOlehNama: r.diunggahOlehNama,
    createdAt: r.createdAt.toISOString(),
  };
}

const larik = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

/** Baca JSON manifest secara defensif (data lama / rusak → kosong). */
export function bacaManifest(x: unknown): ManifestPaket {
  const o = (x ?? {}) as Record<string, unknown>;
  const sah = (i: unknown): i is ItemSusunan => {
    const r = i as Record<string, unknown> | null;
    return !!r && ((r.tipe === "komponen" && typeof r.key === "string") || (r.tipe === "lampiran" && typeof r.id === "string"));
  };
  return {
    items: larik<ItemManifest>(o.items).filter(sah),
    nonaktif: larik<ItemSusunan>(o.nonaktif).filter(sah),
    sidik: typeof o.sidik === "string" ? o.sidik : "",
    durasiMs: typeof o.durasiMs === "number" ? o.durasiMs : 0,
  };
}

export const statusPaket = (s: string): StatusPaket => (STATUS_PAKET_SET.has(s) ? (s as StatusPaket) : "DRAF");

export function kePaketInfo(r: KlaimPaket): PaketInfo {
  return {
    versi: r.versi,
    status: statusPaket(r.status),
    hash: r.hash,
    halaman: r.halaman,
    ukuran: r.ukuran,
    manifest: bacaManifest(r.manifest),
    dibuatOlehNama: r.dibuatOlehNama,
    digabungPada: r.updatedAt.toISOString(),
  };
}

/** Sisipan aktif (belum dihapus) satu berkas, urutan unggah. */
export function findLampiranAktif(nopen: string) {
  return getAppDb().klaimLampiran.findMany({
    where: { nopen, dihapusAt: null },
    orderBy: [{ urutan: "asc" }, { createdAt: "asc" }],
  });
}

export function findPaket(nopen: string) {
  return getAppDb().klaimPaket.findUnique({ where: { nopen } });
}

/** Ringkasan paket per NOPEN (kolom antrean). */
export async function findPaketRingkas(nopens: readonly string[]): Promise<Map<string, PaketRingkas>> {
  if (nopens.length === 0) return new Map();
  const rows = await getAppDb().klaimPaket.findMany({
    where: { nopen: { in: [...nopens] } },
    select: { nopen: true, versi: true, status: true, halaman: true },
  });
  return new Map(rows.map((r) => [r.nopen, { versi: r.versi, status: statusPaket(r.status), halaman: r.halaman }]));
}
