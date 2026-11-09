import type { JenisKunjungan } from "./registry";

/**
 * Filter layanan katalog Form RM (Rawat Jalan / IGD / Rawat Inap) — murni dan
 * ringan (tanpa registri form) agar aman dipakai komponen klien. Dasar
 * pencocokan = `sasaran.jenis` form (`master.ruangan.JENIS_KUNJUNGAN`).
 */
export const LAYANAN = [
  { kunci: "rj", jenis: 1, label: "Rawat Jalan", singkat: "R. Jalan" },
  { kunci: "igd", jenis: 2, label: "IGD", singkat: "IGD" },
  { kunci: "ri", jenis: 3, label: "Rawat Inap", singkat: "R. Inap" },
] as const satisfies readonly { kunci: string; jenis: JenisKunjungan; label: string; singkat: string }[];

export type Layanan = (typeof LAYANAN)[number];
export type KunciLayanan = Layanan["kunci"];

const BY_KUNCI = new Map<string, Layanan>(LAYANAN.map((l) => [l.kunci, l]));
const BY_JENIS = new Map<number, Layanan>(LAYANAN.map((l) => [l.jenis, l]));

/** Nilai `?layanan=` yang dikenal, atau null (= semua layanan). */
export const layananDariParam = (v: unknown): KunciLayanan | null =>
  typeof v === "string" && BY_KUNCI.has(v) ? (v as KunciLayanan) : null;

export const layananDariJenis = (j: number): Layanan | undefined => BY_JENIS.get(j);

/** Form dengan sasaran `jenis` cocok dengan filter layanan (null = semua). */
export const cocokLayanan = (jenis: readonly number[], kunci: KunciLayanan | null): boolean =>
  kunci === null || jenis.includes(BY_KUNCI.get(kunci)!.jenis);
