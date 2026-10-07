import { DAFTAR_KATEGORI, MODUL_FORM_RM, modulKategori, type KategoriForm } from "./kategori";

/**
 * Hak akses Form RM per kategori (PRD §8.4), murni & teruji unit. Pemberian
 * izin diresolusi server (`server/modules/form-rm/form-rm.akses.ts`).
 *
 * - Modul `form-rm` = semua kategori; modul `form-rm.<kategori>` = satu kategori.
 * - `view` adalah dasar: aksi lain (create/update/print) tak berlaku tanpa `view`
 *   pada kategori yang sama — pengguna tak pernah bisa menulis ke form yang tak
 *   boleh dilihatnya.
 */

export const AKSI_FORM = ["view", "create", "update", "print"] as const;
export type AksiForm = (typeof AKSI_FORM)[number];

export type HakForm = {
  boleh(kategori: KategoriForm, aksi: AksiForm): boolean;
  /** Buka koreksi / batalkan isian FINAL (`form-rm.kelola` update). */
  readonly kelola: boolean;
};

/** Pasangan modul × aksi yang perlu diresolusi untuk membangun `HakForm`. */
export const PASANGAN_HAK: readonly (readonly [string, AksiForm])[] = [MODUL_FORM_RM, ...DAFTAR_KATEGORI.map(modulKategori)].flatMap(
  (m) => AKSI_FORM.map((a) => [m, a] as const),
);

/** `izin` = himpunan "modul:aksi" yang dimiliki peran (subset `PASANGAN_HAK`). */
export function hakDari(izin: ReadonlySet<string>, kelola: boolean): HakForm {
  const punya = (k: KategoriForm, a: AksiForm) => izin.has(`${MODUL_FORM_RM}:${a}`) || izin.has(`${modulKategori(k)}:${a}`);
  return {
    boleh: (k, a) => punya(k, "view") && punya(k, a),
    kelola,
  };
}
