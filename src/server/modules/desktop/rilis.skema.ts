import { z } from "zod";

/**
 * Bagian murni rilis aplikasi desktop: skema manifest `rilis.json`, parameter
 * endpoint updater, perbandingan versi, dan jawaban format updater Tauri.
 */

const VERSI_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
export const BERKAS_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.exe$/;
const TANDA_TANGAN_RE = /^[A-Za-z0-9+/=]{40,4096}$/;

export const TARGET = ["windows"] as const;
export const ARSITEKTUR = ["x86_64", "aarch64", "i686"] as const;
export type Target = (typeof TARGET)[number];
export type Arsitektur = (typeof ARSITEKTUR)[number];

const platformSchema = z.strictObject({
  berkas: z.string().regex(BERKAS_RE),
  tandaTangan: z.string().regex(TANDA_TANGAN_RE),
});

export const manifestSchema = z.strictObject({
  versi: z.string().regex(VERSI_RE),
  catatan: z.string().max(2000).optional(),
  terbit: z.iso.datetime({ offset: true }),
  platform: z.partialRecord(z.enum(["windows-x86_64", "windows-aarch64", "windows-i686"]), platformSchema),
});
export type ManifestRilis = z.infer<typeof manifestSchema>;

export const paramPembaruanSchema = z.strictObject({
  target: z.enum(TARGET),
  arch: z.enum(ARSITEKTUR),
  versi: z.string().regex(VERSI_RE),
});
export type ParamPembaruan = z.infer<typeof paramPembaruanSchema>;

/** Bandingkan versi `a.b.c` secara numerik: > 0 bila `a` lebih baru. */
export function bandingVersi(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

export type JawabanPembaruan = { version: string; notes: string; pub_date: string; url: string; signature: string };

/** Jawaban format updater Tauri, atau null bila tidak ada pembaruan untuk klien ini. */
export function jawabanPembaruan(m: ManifestRilis, p: ParamPembaruan, asal: string): JawabanPembaruan | null {
  if (bandingVersi(m.versi, p.versi) <= 0) return null;
  const plat = m.platform[`${p.target}-${p.arch}`];
  if (!plat) return null;
  return {
    version: m.versi,
    notes: m.catatan ?? "",
    pub_date: m.terbit,
    url: `${asal}/api/desktop/unduh/${encodeURIComponent(plat.berkas)}`,
    signature: plat.tandaTangan,
  };
}
