import type { EpisodeSasaran } from "./form-rm.types";
import type { KandidatTautan } from "./isian.types";

/**
 * Fungsi MURNI penautan isian sementara ke pendaftaran (tanpa I/O, diuji unit):
 * waktu acuan, jendela pencarian pendaftaran, dan urutan saran. Semua waktu =
 * jam dinding WITA "YYYY-MM-DDTHH:mm[:ss]" seperti kolom SIMGOS.
 */

const JAM_MS = 3_600_000;
/** Pendaftaran bisa tercatat sedikit lebih awal dari jam di form (jam komputer berbeda, isian mundur). */
export const JENDELA_SEBELUM_JAM = 2;
/** Batas atas saran: pasien IGD didaftarkan dalam hitungan jam setelah triase. */
export const JENDELA_SESUDAH_JAM = 48;
export const MAKS_KANDIDAT = 20;

const DINDING_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const keDinding = (ms: number) => new Date(ms).toISOString().slice(0, 19);

/** Instan → jam dinding WITA (UTC+8, tanpa musim panas). */
export const dindingWita = (d: Date): string => keDinding(d.getTime() + 8 * JAM_MS);

/**
 * Jam dinding → milidetik pembanding (dihitung seolah UTC; hanya untuk selisih
 * & rentang). null bila format atau tanggalnya tidak valid (mis. 31 Februari).
 */
export function msDinding(s: string): number | null {
  const m = DINDING_RE.exec(s);
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  return keDinding(ms).slice(0, 16) === `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` ? ms : null;
}

/** Waktu acuan: dari isi form bila valid, selain itu waktu isian dibuat. */
export function waktuAcuan(dariForm: string, dibuat: Date): string {
  const ms = msDinding(dariForm.trim());
  return ms === null ? dindingWita(dibuat) : keDinding(ms);
}

/** Rentang MASUK pendaftaran yang disarankan: [acuan − 2 jam, acuan + 48 jam), format SQL. */
export function jendelaKandidat(acuan: string): { from: string; toExclusive: string } {
  const ms = msDinding(acuan);
  if (ms === null) throw new Error(`Waktu acuan tidak valid: ${acuan}`);
  const sql = (t: number) => keDinding(t).replace("T", " ");
  return { from: sql(ms - JENDELA_SEBELUM_JAM * JAM_MS), toExclusive: sql(ms + JENDELA_SESUDAH_JAM * JAM_MS) };
}

/**
 * Lengkapi episode dengan isian aktif form ini & selisih terhadap acuan. `urutkan`
 * (mode saran): yang belum punya isian lebih dulu, lalu selisih masuk terkecil;
 * tanpa `urutkan` (mode cari) urutan asal — terbaru dulu — dipertahankan.
 */
export function kandidatDari(
  episode: readonly EpisodeSasaran[],
  acuan: string,
  isianLain: ReadonlyMap<string, string>,
  urutkan: boolean,
): KandidatTautan[] {
  const a = msDinding(acuan) ?? 0;
  const hasil = episode.map((e) => ({
    ...e,
    isianLain: isianLain.get(e.nopen) ?? null,
    selisihMenit: Math.round(Math.abs((msDinding(e.masuk) ?? a) - a) / 60_000),
  }));
  if (urutkan) {
    hasil.sort((x, y) => Number(x.isianLain !== null) - Number(y.isianLain !== null) || x.selisihMenit - y.selisihMenit);
  }
  return hasil.slice(0, MAKS_KANDIDAT);
}
