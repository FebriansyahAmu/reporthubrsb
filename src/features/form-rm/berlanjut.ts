import { DEFINISI_FORM, definisiForm } from "./registry";

/**
 * Form BERLANJUT IGD → rawat inap (docs/PRD_Form_RM_Berlanjut_IGD_RI.md) —
 * bantuan murni untuk tampilan (aman untuk klien & server).
 */

/** Kode form berlanjut (urut registri). */
export const KODE_BERLANJUT = DEFINISI_FORM.filter((d) => d.berlanjut === "igd-ri").map((d) => d.kode);

/**
 * Form berlanjut yang biasanya difinalkan saat pasien PULANG (K6): FINALKAN
 * selagi pasien masih dirawat tetap boleh, tetapi dialog memperingatkan.
 */
export const FINAL_SAAT_PULANG: ReadonlySet<string> = new Set(["RM.01", "RM.21"]);

/**
 * URL halaman isian. Form berlanjut membawa episode tempat petugas membuka
 * isian (`dari`, divalidasi server sebagai anggota rantai) — penentu konteks
 * IGD / rawat inap di halaman isian.
 */
export const urlIsian = (kode: string, id: string, nopen: string): string =>
  definisiForm(kode)?.berlanjut ? `/form-rm/isian/${id}?dari=${encodeURIComponent(nopen)}` : `/form-rm/isian/${id}`;
