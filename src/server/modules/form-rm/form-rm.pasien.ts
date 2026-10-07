import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import type { HakForm } from "@/features/form-rm/hak";
import { kelengkapanDari, statusPasien } from "@/features/form-rm/kelengkapan";
import type { DefinisiForm, JenisKunjungan } from "@/features/form-rm/registry";
import { formBoleh } from "./form-rm.akses";
import { queryJenisEpisode, queryLegAktif, queryLegPasien, queryLegRentang, queryNormCari } from "./form-rm.dal";
import { tafsirCari } from "@/features/form-rm/cari";
import { halamanDari, kelompokkanEpisode, petaJenisEpisode } from "./form-rm.episode";
import type {
  DaftarPasienForm,
  FormRmListResult,
  FormRmPatient,
  PasienSasaran,
  StatusFormPasien,
} from "./form-rm.types";
import { isianAktifPerNopen } from "./isian.cari";

/**
 * DAFTAR PASIEN FORM RM (PRD §6.1–6.2) — pemilih pasien per form dan daftar per
 * pasien. SIMGOS hanya dibaca (query berparameter, terindeks, dibatasi waktu);
 * status isian dari reporthub dengan satu query batch per daftar.
 */

const UKURAN_PEMILIH = 20;
const UKURAN_DAFTAR = 12;

export type PasienFormArgs = {
  q?: string;
  ruanganId?: string;
  status?: StatusFormPasien;
  halaman: number;
};

/**
 * Pemilih pasien satu form. Tanpa kata kunci: pasien aktif sesuai sasaran form
 * (leg sasaran masih dilayani / masuk dalam jendela jam). Dengan kata kunci
 * (≥ 3 karakter): episode sasaran milik pasien yang cocok No.RM / NIK / NOPEN /
 * nama, terbaru dulu. Tiap baris membawa isian aktif form itu.
 */
export async function daftarPasienForm(def: DefinisiForm, a: PasienFormArgs): Promise<DaftarPasienForm> {
  const kunci = a.q ? tafsirCari(a.q) : null;
  const mode = a.q ? "cari" : "aktif";
  const ringkas: Record<StatusFormPasien, number> = { KOSONG: 0, DRAF: 0, FINAL: 0 };
  if (!isSimgosConfigured() || (a.q && !kunci)) {
    return { ...halamanDari([], 1, UKURAN_PEMILIH), mode, ringkas, updatedAt: new Date().toISOString() };
  }

  const acuan = new Date();
  const legs = kunci
    ? await queryLegPasien({ jenis: def.sasaran.jenis, norm: await queryNormCari(kunci) })
    : await queryLegAktif({ jenis: def.sasaran.jenis, jendelaJam: def.sasaran.jendelaJam, ruanganId: a.ruanganId });
  const episode = kelompokkanEpisode(legs, acuan);

  const isian = await isianAktifPerNopen(episode.map((e) => e.nopen), [def.kode]);
  const semua: PasienSasaran[] = episode.map((e) => ({ ...e, isian: isian.get(e.nopen)?.[def.kode] ?? null }));
  for (const p of semua) ringkas[statusPasien(p.isian)]++;
  const tersaring = a.status ? semua.filter((p) => statusPasien(p.isian) === a.status) : semua;

  return { ...halamanDari(tersaring, a.halaman, UKURAN_PEMILIH), mode, ringkas, updatedAt: acuan.toISOString() };
}

/** Gabungan jenis kunjungan sasaran form yang boleh dilihat (urut 1, 2, 3). */
export const jenisSasaran = (forms: readonly DefinisiForm[]): JenisKunjungan[] =>
  [...new Set(forms.flatMap((d) => d.sasaran.jenis))].sort((x, y) => x - y);

export type FormRmListArgs = {
  from: string;
  toExclusive: string;
  ruanganId?: string;
  jenis?: JenisKunjungan;
  search?: string;
  page: number;
};

/**
 * Daftar per pasien: episode dengan leg sasaran (form yang boleh dilihat) yang
 * masuk dalam rentang, beserta kelengkapan form wajibnya. Jenis kunjungan
 * episode diambil dari SEMUA lognya (bukan hanya yang di rentang) agar form
 * wajib tepat.
 */
export async function getFormRmList(a: FormRmListArgs, hak: HakForm): Promise<FormRmListResult> {
  const forms = formBoleh(hak);
  const semuaJenis = jenisSasaran(forms);
  const jenis = a.jenis ? semuaJenis.filter((j) => j === a.jenis) : semuaJenis;
  const kosong: FormRmListResult = {
    ...halamanDari([], 1, UKURAN_DAFTAR),
    lengkapCount: 0,
    belumLengkapCount: 0,
    total: 0,
    updatedAt: new Date().toISOString(),
  };
  if (!isSimgosConfigured() || jenis.length === 0) return kosong;

  const episode = kelompokkanEpisode(
    await queryLegRentang({ jenis, from: a.from, toExclusive: a.toExclusive, ruanganId: a.ruanganId }),
    new Date(),
  );
  const q = a.search?.trim().toLowerCase();
  const cocok = q ? episode.filter((e) => `${e.nama} ${e.norm} ${e.nopen} ${e.ruang}`.toLowerCase().includes(q)) : episode;

  const nopens = cocok.map((e) => e.nopen);
  const [jenisRows, isianMap] = await Promise.all([
    queryJenisEpisode(nopens),
    isianAktifPerNopen(nopens, forms.map((d) => d.kode)),
  ]);
  const jenisEpisode = petaJenisEpisode(jenisRows);
  const data: FormRmPatient[] = cocok.map((e) => ({
    ...e,
    kelengkapan: kelengkapanDari(isianMap.get(e.nopen) ?? {}, forms, jenisEpisode.get(e.nopen) ?? new Set([e.jenis])),
  }));

  const lengkapCount = data.filter((p) => p.kelengkapan.lengkap).length;
  const belumLengkapCount = data.filter((p) => p.kelengkapan.total > 0 && !p.kelengkapan.lengkap).length;
  return {
    ...halamanDari(data, a.page, UKURAN_DAFTAR),
    total: data.length,
    lengkapCount,
    belumLengkapCount,
    updatedAt: new Date().toISOString(),
  };
}

/** Jenis kunjungan seluruh leg aktif satu episode (profil pasien). */
export async function jenisEpisode(nopen: string): Promise<Set<JenisKunjungan>> {
  if (!isSimgosConfigured()) return new Set();
  return petaJenisEpisode(await queryJenisEpisode([nopen])).get(nopen) ?? new Set();
}
