import "server-only";
import type { SessionUser } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";
import { hakDari, PASANGAN_HAK, type AksiForm, type HakForm } from "@/features/form-rm/hak";
import { MODUL_KELOLA_FORM_RM } from "@/features/form-rm/kategori";
import { DEFINISI_FORM, type DefinisiForm } from "@/features/form-rm/registry";

/**
 * Resolusi hak Form RM per kategori untuk satu pengguna (PRD §8.4, §10.2).
 * `can()` di-cache per peran, jadi resolusi ini murah dan dijalankan sekali
 * per permintaan.
 */
export async function hakFormRm(user: SessionUser): Promise<HakForm> {
  const [hasil, kelola] = await Promise.all([
    Promise.all(PASANGAN_HAK.map(([m, a]) => can(user.role, m, a))),
    can(user.role, MODUL_KELOLA_FORM_RM, "update"),
  ]);
  const izin = new Set(PASANGAN_HAK.filter((_, i) => hasil[i]).map(([m, a]) => `${m}:${a}`));
  return hakDari(izin, kelola);
}

/** Form yang boleh dikenai `aksi` oleh pemegang hak, dalam urutan registri. */
export const formBoleh = (hak: HakForm, aksi: AksiForm = "view"): DefinisiForm[] =>
  DEFINISI_FORM.filter((d) => hak.boleh(d.kategori, aksi));
