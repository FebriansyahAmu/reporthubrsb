import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Segel integritas revisi Form RM: HMAC-SHA256 berantai per isian.
 *
 *   hash_n = HMAC(kunci, hash_(n-1) ‖ "\n" ‖ JSON-kanonik(isi revisi n))
 *
 * Isi revisi memuat data isian, metadata transisi, waktu, dan sha256 setiap
 * gambar TTD yang dirujuk. Karena memakai kunci rahasia server, orang yang hanya
 * punya akses DB tidak bisa membuat ulang segel → perubahan langsung terdeteksi.
 * Murni (kunci disuntikkan) → mudah diuji.
 */

export type IsiSegel = {
  isianId: string;
  formKode: string;
  formVersi: number;
  subjek: string;
  urutan: number;
  rev: number;
  aksi: string;
  status: string;
  data: unknown;
  /** id TTD → sha256 PNG yang dirujuk data (dihitung dari bytes, bukan kolom). */
  ttd: Record<string, string>;
  alasan: string | null;
  olehId: string | null;
  /** ISO 8601 dengan milidetik (= created_at revisi). */
  waktu: string;
};

/** JSON dengan kunci objek terurut (stabil terhadap urutan kunci dari DB). */
export function kanonik(nilai: unknown): string {
  if (nilai === null || typeof nilai !== "object") return JSON.stringify(nilai) ?? "null";
  if (Array.isArray(nilai)) return `[${nilai.map(kanonik).join(",")}]`;
  const isi = Object.entries(nilai as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${kanonik(v)}`);
  return `{${isi.join(",")}}`;
}

export const sha256Hex = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

export function segel(kunci: Uint8Array, hashSebelum: string | null, isi: IsiSegel): string {
  return createHmac("sha256", kunci)
    .update(`${hashSebelum ?? ""}\n${kanonik(isi)}`)
    .digest("hex");
}

const samaWaktuKonstan = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export type RevisiTersegel = { rev: number; hash: string; hashSebelum: string | null; isi: IsiSegel };

/** Periksa rantai revisi (urut rev naik). Mengembalikan daftar masalah; kosong = utuh. */
export function periksaRantai(kunci: Uint8Array, revisi: readonly RevisiTersegel[]): string[] {
  const masalah: string[] = [];
  let sebelum: string | null = null;
  for (const r of revisi) {
    if (r.hashSebelum !== sebelum) masalah.push(`Revisi ${r.rev}: tautan ke revisi sebelumnya terputus`);
    if (!samaWaktuKonstan(segel(kunci, r.hashSebelum, r.isi), r.hash)) {
      masalah.push(`Revisi ${r.rev}: isi tidak cocok dengan segel`);
    }
    sebelum = r.hash;
  }
  return masalah;
}
