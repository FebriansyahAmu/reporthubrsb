/**
 * RANTAI EPISODE IGD → RAWAT INAP — inti MURNI (tanpa I/O, diuji unit).
 * docs/PRD_Form_RM_Berlanjut_IGD_RI.md §5.2, §6.
 *
 * Episode RI (lanjutan) yang berasal dari IGD memakai isian form berlanjut milik
 * episode IGD asalnya (akar). Keputusan dibuat dari tautan tersimpan
 * (`form_rm_tautan_episode`) dan kandidat akar yang dihitung SIMGOS (SPRI /
 * pendaftaran IGD ≤ 24 jam, NORM sama — lihat `rantai.dal.ts`).
 */

import type { StatusIsian } from "@/features/form-rm/isian.status";
import type { KodeForm } from "@/features/form-rm/registry";

export const DASAR_TAUTAN = ["SPRI", "WAKTU", "TANPA"] as const;
export type DasarTautan = (typeof DASAR_TAUTAN)[number];

export const adalahDasarTautan = (s: string): s is DasarTautan => (DASAR_TAUTAN as readonly string[]).includes(s);

export const LABEL_DASAR_TAUTAN: Record<DasarTautan, string> = {
  SPRI: "lewat SPRI",
  WAKTU: "pendaftaran IGD ≤ 24 jam, dikonfirmasi petugas",
  TANPA: "isian terpisah (dipilih petugas)",
};

/** Tautan aktif satu episode lanjutan (null = belum pernah diputuskan / sudah dilepas). */
export type TautanAktif = { id: string; nopenAkar: string | null; dasar: DasarTautan };

/** Kandidat episode IGD asal menurut SIMGOS (hanya untuk episode RI tanpa leg IGD). */
export type KandidatAkar = { spri: string | null; waktu: string | null };

export type KeputusanRantai =
  /** Bukan episode lanjutan (tanpa asal IGD) — isian di episode ini sendiri. */
  | { jenis: "sendiri" }
  /** Petugas pernah memilih isian terpisah (`TANPA`). */
  | { jenis: "terpisah"; tautanId: string }
  /** Tertaut ke episode akar. */
  | { jenis: "tertaut"; akar: string; tautanId: string }
  /** SPRI menunjuk episode IGD asal → tautan dibuat otomatis. */
  | { jenis: "tautkan-spri"; akar: string }
  /** Perlu konfirmasi petugas sebelum ditautkan (≤ 24 jam, atau SPRI yang pernah dilepas). */
  | { jenis: "konfirmasi"; akar: string; dasar: "SPRI" | "WAKTU" };

/**
 * Keputusan rantai satu episode (K3): tautan aktif menang; tanpa tautan, SPRI
 * ditautkan otomatis KECUALI tautan episode ini pernah dilepas pengelola RM
 * (tak boleh tertaut ulang diam-diam); kandidat ≤ 24 jam selalu dikonfirmasi.
 */
export function putuskanRantai(a: {
  aktif: TautanAktif | null;
  pernahDilepas: boolean;
  kandidat: KandidatAkar | null;
}): KeputusanRantai {
  if (a.aktif) {
    return a.aktif.dasar === "TANPA" || !a.aktif.nopenAkar
      ? { jenis: "terpisah", tautanId: a.aktif.id }
      : { jenis: "tertaut", akar: a.aktif.nopenAkar, tautanId: a.aktif.id };
  }
  const k = a.kandidat;
  if (k?.spri) return a.pernahDilepas ? { jenis: "konfirmasi", akar: k.spri, dasar: "SPRI" } : { jenis: "tautkan-spri", akar: k.spri };
  if (k?.waktu) return { jenis: "konfirmasi", akar: k.waktu, dasar: "WAKTU" };
  return { jenis: "sendiri" };
}

/** Rantai satu episode untuk daftar & profil (tanpa menulis). */
export type RantaiRingkas =
  /** tertaut = tautan tersimpan; otomatis = SPRI, ditautkan saat form dibuka. */
  | { status: "tertaut" | "otomatis"; akar: string; dasar: DasarTautan }
  | { status: "konfirmasi"; akar: string; dasar: "SPRI" | "WAKTU" }
  | { status: "terpisah" };

export function ringkasKeputusan(k: KeputusanRantai, dasarTersimpan: DasarTautan | null): RantaiRingkas | null {
  switch (k.jenis) {
    case "tertaut":
      return { status: "tertaut", akar: k.akar, dasar: dasarTersimpan ?? "SPRI" };
    case "tautkan-spri":
      return { status: "otomatis", akar: k.akar, dasar: "SPRI" };
    case "konfirmasi":
      return { status: "konfirmasi", akar: k.akar, dasar: k.dasar };
    case "terpisah":
      return { status: "terpisah" };
    case "sendiri":
      return null;
  }
}

/** Episode untuk ditampilkan (ruang & waktu masuk). */
export type EpisodeRingkas = { nopen: string; ruang: string; masuk: string | null };

/** Jawaban buka isian yang butuh keputusan petugas RI (dialog "Lanjutkan isian dari IGD?"). */
export type KonfirmasiRantai = {
  nopenLanjutan: string;
  dasar: "SPRI" | "WAKTU";
  akar: EpisodeRingkas;
  /** Isian form berlanjut yang sudah ada di episode akar (hanya kategori yang boleh dilihat). */
  isianAkar: { kode: KodeForm; judul: string; status: StatusIsian }[];
};

export type HasilKonfirmasi =
  | { boleh: true; dasar: DasarTautan; akar: string | null }
  | { boleh: false; alasan: string };

/**
 * Konfirmasi petugas (§6 butir 1): akar kiriman klien HARUS sama dengan
 * kandidat yang dihitung server saat ini (NORM, jenis leg, jendela waktu sudah
 * dijamin query kandidat). `null` = pilih isian terpisah — hanya bila memang
 * ada kandidat (tanpa kandidat tak ada yang perlu diputuskan).
 */
export function cekKonfirmasi(a: { aktif: TautanAktif | null; kandidat: KandidatAkar | null }, akar: string | null): HasilKonfirmasi {
  if (a.aktif) return { boleh: false, alasan: "Episode ini sudah diputuskan tautannya. Muat ulang halaman." };
  const k = a.kandidat;
  if (!k || (!k.spri && !k.waktu)) {
    return { boleh: false, alasan: "Episode ini tidak punya episode IGD asal untuk ditautkan" };
  }
  if (akar === null) return { boleh: true, dasar: "TANPA", akar: null };
  if (akar === k.spri) return { boleh: true, dasar: "SPRI", akar };
  if (akar === k.waktu) return { boleh: true, dasar: "WAKTU", akar };
  return { boleh: false, alasan: "Episode IGD yang dipilih bukan asal episode rawat inap ini" };
}
