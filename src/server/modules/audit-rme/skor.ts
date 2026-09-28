/**
 * Skor kepatuhan pengimputan per petugas (Fase 2 · K3) — FUNGSI MURNI (tanpa
 * I/O), dipakai server (menghitung) dan UI (menampilkan rumus apa adanya).
 *
 * Skor adalah ALAT BANTU penilaian reward & punishment, bukan keputusan
 * otomatis (PRD §4.4). Prinsip:
 * - Dibandingkan dengan rekan SEPROFESI (perawat vs perawat, dokter vs dokter).
 * - Komponen yang tidak berlaku (mis. dokter tanpa TTV) tidak menghukum —
 *   bobotnya dibagi ulang ke komponen yang berlaku.
 * - Petugas dengan data terlalu sedikit tidak diberi peringkat.
 * - Item tarif pada Tindakan tidak dihitung (lihat `TINDAKAN_TARIF`).
 */

import {
  PROFESI_BIDAN,
  PROFESI_DOKTER,
  PROFESI_PERAWAT,
  TTV_TERLAMBAT_MENIT,
  type KategoriKey,
} from "./kunjungan.constants";

/* ---------------------------------------------------------------- aturan */

export const KOMPONEN_KEYS = ["aktivitas", "kontribusiRi", "ketepatanTtv", "integritas"] as const;
export type KomponenKey = (typeof KOMPONEN_KEYS)[number];

/**
 * Syarat minimal: skor & peringkat (hari aktif, input klinis), komponen TTV
 * (jumlah TTV) & kontribusi RI (hari-pasien RI yang disentuh — keterlibatan
 * insidental di RI, mis. dokter IGD 2–3 hari-pasien, tidak dinilai).
 */
export const SKOR_SYARAT = { hariAktifMin: 3, inputMin: 10, ttvMin: 3, riHariPasienMin: 5 } as const;

/**
 * Proporsi input batal yang membuat integritas = 0 (penalti ringan, PRD §4.4).
 * Median batal 1,3%, p90 6–9% (30 hari, 28 Sep 2026).
 */
export const INTEGRITAS_BATAS = 0.15;

export const KOMPONEN: Record<KomponenKey, { label: string; bobot: number; rumus: string }> = {
  aktivitas: {
    label: "Aktivitas dokumentasi",
    bobot: 35,
    rumus: "Input klinis aktif per hari dinas aktif, dibandingkan dengan rekan seprofesi (persentil 0–100).",
  },
  kontribusiRi: {
    label: "Kontribusi target Rawat Inap",
    bobot: 30,
    rumus:
      "Perawat/Bidan: shift-pasien RI yang diisi CPPT olehnya; Dokter: hari-pasien RI yang divisite (CPPT dokter). " +
      `Per hari dinas aktif, persentil seprofesi. Berlaku bila menangani ≥ ${SKOR_SYARAT.riHariPasienMin} hari-pasien Rawat Inap.`,
  },
  ketepatanTtv: {
    label: "Ketepatan waktu TTV",
    bobot: 20,
    rumus: `Persentase TTV yang disimpan ≤ ${TTV_TERLAMBAT_MENIT} menit setelah waktu pemeriksaan. Berlaku bila ≥ ${SKOR_SYARAT.ttvMin} TTV.`,
  },
  integritas: {
    label: "Integritas input",
    bobot: 15,
    rumus: `100 bila tidak ada input yang dibatalkan; turun linear hingga 0 pada ≥ ${INTEGRITAS_BATAS * 100}% input dibatalkan.`,
  },
};

export type BandKey = "TELADAN" | "BAIK" | "CUKUP" | "PEMBINAAN";
/**
 * Pita skor (urut dari tertinggi). Dua komponen berbobot terbesar bersifat
 * relatif (persentil, median 50) → batas pita disesuaikan dengan skala itu.
 */
export const BAND: readonly { key: BandKey; label: string; min: number }[] = [
  { key: "TELADAN", label: "Teladan", min: 75 },
  { key: "BAIK", label: "Baik", min: 60 },
  { key: "CUKUP", label: "Cukup", min: 40 },
  { key: "PEMBINAAN", label: "Perlu pembinaan", min: 0 },
];
export const bandOf = (skor: number): BandKey => BAND.find((b) => skor >= b.min)!.key;
export const bandLabel = (key: BandKey) => BAND.find((b) => b.key === key)!.label;

/* ----------------------------------------------------------------- tipe */

/** Metrik mentah satu petugas dalam rentang (semua dari data aktual). */
export type MetrikPetugas = {
  id: string;
  profesi: number | null;
  /** Input AKTIF klinis per kategori (Tindakan = prosedur, tanpa item tarif). */
  perKategori: Record<KategoriKey, number>;
  /** Σ perKategori. */
  klinis: number;
  cpptKeperawatan: number;
  cpptDokter: number;
  /** Item tarif aktif (tidak dihitung ke skor). */
  tarif: number;
  /** Input klinis berstatus batal (STATUS 0). */
  batal: number;
  ttv: number;
  ttvTerlambat: number;
  /** TTV aktif bernilai di luar rentang fisiologis ekstrem — informasi, tidak dinilai. */
  ttvTakWajar: number;
  /** Hari dinas (07.00–07.00) dengan ≥ 1 input apa pun. */
  hariAktif: number;
  pasien: number;
  /** Hari-pasien RI yang disentuh (input apa pun). */
  riHariPasien: number;
  /** Shift-pasien RI dengan CPPT keperawatan oleh petugas ini. */
  riShift: number;
  /** Hari-pasien RI dengan CPPT dokter oleh petugas ini. */
  riVisite: number;
};

/** `skor` 0–100 (null = tidak berlaku); `nilai` = besaran mentah yang dinilai. */
export type Komponen = { skor: number | null; nilai: number | null };

export type SkorPetugas = MetrikPetugas & {
  dinilai: boolean;
  /** Alasan tidak dinilai (data belum cukup). */
  alasan: string | null;
  komponen: Record<KomponenKey, Komponen>;
  skor: number | null;
  band: BandKey | null;
  /** Peringkat di antara petugas seprofesi yang dinilai (1 = terbaik). */
  peringkat: number | null;
  /** Jumlah petugas seprofesi yang dinilai (pembanding persentil). */
  pembanding: number;
};

/* ---------------------------------------------------------------- hitung */

const KOSONG: Komponen = { skor: null, nilai: null };

/** Persentil peringkat tengah: (lebih kecil + ½·sama) / n × 100. `values` memuat `v`. */
function persentil(values: number[], v: number): number {
  let lt = 0;
  let eq = 0;
  for (const x of values) {
    if (x < v) lt++;
    else if (x === v) eq++;
  }
  return Math.round(((lt + 0.5 * eq) / values.length) * 100);
}

/** Besaran kontribusi RI sesuai profesi — null bila tidak berlaku. */
function kontribusiRi(m: MetrikPetugas): number | null {
  if (m.riHariPasien < SKOR_SYARAT.riHariPasienMin) return null;
  if (m.profesi === PROFESI_PERAWAT || m.profesi === PROFESI_BIDAN) return m.riShift;
  if (m.profesi === PROFESI_DOKTER) return m.riVisite;
  return null;
}

function alasanTidakDinilai(m: MetrikPetugas): string | null {
  if (m.hariAktif < SKOR_SYARAT.hariAktifMin) return `Aktif < ${SKOR_SYARAT.hariAktifMin} hari dinas`;
  if (m.klinis < SKOR_SYARAT.inputMin) return `Input klinis < ${SKOR_SYARAT.inputMin}`;
  return null;
}

const bulat1 = (n: number) => Math.round(n * 10) / 10;

function perProfesiOf<T extends { profesi: number | null }>(items: T[]): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const it of items) {
    const key = it.profesi ?? -1;
    const list = out.get(key);
    if (list) list.push(it);
    else out.set(key, [it]);
  }
  return out;
}

/**
 * Skor semua petugas. Persentil dihitung per profesi di antara petugas yang
 * DINILAI saja. Urutan hasil = urutan masukan.
 */
export function hitungSkor(metrik: MetrikPetugas[]): SkorPetugas[] {
  const grup = perProfesiOf(metrik.filter((m) => !alasanTidakDinilai(m)));

  const aktivitasOf = (m: MetrikPetugas) => m.klinis / m.hariAktif;
  const kontribusiOf = (m: MetrikPetugas) => {
    const k = kontribusiRi(m);
    return k == null ? null : k / m.hariAktif;
  };

  const hasil = metrik.map((m): SkorPetugas => {
    const alasan = alasanTidakDinilai(m);
    const peers = grup.get(m.profesi ?? -1) ?? [];
    if (alasan) {
      return { ...m, dinilai: false, alasan, komponen: { aktivitas: KOSONG, kontribusiRi: KOSONG, ketepatanTtv: KOSONG, integritas: KOSONG }, skor: null, band: null, peringkat: null, pembanding: peers.length };
    }

    const akt = aktivitasOf(m);
    const kon = kontribusiOf(m);
    const konPeers = peers.map(kontribusiOf).filter((x): x is number => x != null);
    // TTV tak wajar TIDAK dinilai: pola sistemik (47% TTV 30 hari bersuhu tanpa koma, mis. 362)
    // → ditampilkan sebagai temuan, bukan hukuman individu.
    const bermasalah = m.batal / Math.max(1, m.klinis + m.batal);

    const komponen: Record<KomponenKey, Komponen> = {
      aktivitas: { skor: persentil(peers.map(aktivitasOf), akt), nilai: bulat1(akt) },
      kontribusiRi: kon == null ? KOSONG : { skor: persentil(konPeers, kon), nilai: bulat1(kon) },
      ketepatanTtv:
        m.ttv >= SKOR_SYARAT.ttvMin
          ? { skor: Math.round(((m.ttv - m.ttvTerlambat) / m.ttv) * 100), nilai: m.ttv - m.ttvTerlambat }
          : KOSONG,
      integritas: {
        skor: Math.round(Math.max(0, 1 - bermasalah / INTEGRITAS_BATAS) * 100),
        nilai: Math.round(bermasalah * 1000) / 10,
      },
    };

    let bobot = 0;
    let total = 0;
    for (const k of KOMPONEN_KEYS) {
      const s = komponen[k].skor;
      if (s == null) continue;
      bobot += KOMPONEN[k].bobot;
      total += KOMPONEN[k].bobot * s;
    }
    const skor = Math.round(total / bobot);
    return { ...m, dinilai: true, alasan: null, komponen, skor, band: bandOf(skor), peringkat: null, pembanding: peers.length };
  });

  // Peringkat per profesi: skor ↓, lalu volume klinis ↓ (penentu seri).
  for (const list of perProfesiOf(hasil.filter((h) => h.dinilai)).values()) {
    list.sort((a, b) => b.skor! - a.skor! || b.klinis - a.klinis);
    list.forEach((h, i) => (h.peringkat = i + 1));
  }
  return hasil;
}
