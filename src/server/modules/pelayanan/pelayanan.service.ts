import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import {
  queryBelumFinal,
  queryDiagnosaKelengkapan,
  queryKunjunganRange,
  queryResumeKelengkapan,
  queryTurunanByNopens,
} from "./pelayanan.dal";
import {
  mapDiagnosa,
  mapKunjunganPelayanan,
  mapResume,
  mapTurunan,
} from "./pelayanan.mapper";
import {
  agingBucket,
  DIAGNOSA_STATUS_ORDER,
  RESUME_STATUS_ORDER,
  type AgingBucket,
  type BelumFinalCounts,
  type BelumFinalItem,
  type BelumFinalResult,
  type TurunanLayananItem,
  type DiagnosaCounts,
  type DiagnosaItem,
  type DiagnosaResult,
  type DiagnosaStatus,
  type KunjunganPelayananCounts,
  type KunjunganPelayananItem,
  type KunjunganPelayananResult,
  type KunjunganPelayananSummary,
  type ResumeCounts,
  type ResumeItem,
  type ResumeResult,
  type ResumeStatus,
} from "./pelayanan.types";
import type {
  BelumFinalQuery,
  DiagnosaQuery,
  KunjunganPelayananQuery,
  ResumeQuery,
} from "./pelayanan.schema";

export type { KunjunganPelayananResult, BelumFinalResult, DiagnosaResult, ResumeResult };

function summarize(data: KunjunganPelayananItem[]): KunjunganPelayananSummary {
  const finalItems = data.filter((d) => d.final);
  const rata =
    finalItems.length > 0
      ? Math.round(finalItems.reduce((s, d) => s + d.lamaMenit, 0) / finalItems.length)
      : null;
  return {
    total: data.length,
    belumFinal: data.length - finalItems.length,
    final: finalItems.length,
    rataLamaMenit: rata,
  };
}

function matchSearch(it: { nama: string; norm: string; ruang: string }, q: string): boolean {
  return `${it.nama} ${it.norm} ${it.ruang}`.toLowerCase().includes(q);
}

function emptyResult(): KunjunganPelayananResult {
  return {
    data: [],
    meta: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
    summary: summarize([]),
    counts: { Semua: 0, "Rawat Inap": 0, "Rawat Jalan Klinik": 0, IGD: 0 },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Monitoring Kunjungan: kunjungan pada rentang tanggal (+ ruangan opsional) dengan
 * lama rawat & status finalisasi. Ringkasan dihitung atas seluruh scope; daftar
 * disaring (kategori/cari) lalu **dipaginasi di server** agar tak mengirim penuh.
 * SIMGOS belum dikonfigurasi → hasil kosong (fitur ini tak punya data simulasi).
 */
export async function getKunjunganPelayanan(
  params: KunjunganPelayananQuery,
): Promise<KunjunganPelayananResult> {
  if (!isSimgosConfigured()) return emptyResult();

  const rows = await queryKunjunganRange({
    from: params.from,
    to: params.to,
    ruanganId: params.ruangan,
  });
  const scope = rows.map(mapKunjunganPelayanan);

  // Ringkasan atas seluruh scope (range + ruangan), independen kategori/cari.
  const summary = summarize(scope);

  // Pencarian dulu → dasar untuk hitungan tab kategori.
  const q = params.search?.toLowerCase();
  const searched = q ? scope.filter((it) => matchSearch(it, q)) : scope;

  const counts: KunjunganPelayananCounts = {
    Semua: searched.length,
    "Rawat Inap": searched.filter((it) => it.kategori === "Rawat Inap").length,
    "Rawat Jalan Klinik": searched.filter((it) => it.kategori === "Rawat Jalan Klinik").length,
    IGD: searched.filter((it) => it.kategori === "IGD").length,
  };

  // Filter kategori → paginasi.
  const filtered = params.kategori
    ? searched.filter((it) => it.kategori === params.kategori)
    : searched;

  const pageSize = params.pageSize;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(params.page, totalPages);
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return {
    data,
    meta: { page, pageSize, total, totalPages },
    summary,
    counts,
    updatedAt: new Date().toISOString(),
  };
}

function emptyBelumFinal(): BelumFinalResult {
  return {
    data: [],
    meta: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
    counts: { Semua: 0, b1: 0, b2: 0, b3: 0, b4: 0 },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Monitoring "Belum Difinalkan": kunjungan KELUAR NULL (90 hari terakhir),
 * dikelompokkan umur tunggakan (bucket) & diurut terlama dulu. Hitungan bucket
 * memperhitungkan filter kategori/cari; daftar dipaginasi di server.
 */
export async function getBelumFinal(params: BelumFinalQuery): Promise<BelumFinalResult> {
  if (!isSimgosConfigured()) return emptyBelumFinal();

  const rows = await queryBelumFinal(params.ruangan);
  const scope: BelumFinalItem[] = rows.map((r) => {
    const it = mapKunjunganPelayanan(r);
    return { ...it, bucket: agingBucket(it.lamaMenit), turunan: [] };
  });

  // Filter kategori + cari → dasar hitungan bucket.
  const q = params.search?.toLowerCase();
  let base = q ? scope.filter((it) => matchSearch(it, q)) : scope;
  if (params.kategori) base = base.filter((it) => it.kategori === params.kategori);

  const countBucket = (b: AgingBucket) => base.filter((it) => it.bucket === b).length;
  const counts: BelumFinalCounts = {
    Semua: base.length,
    b1: countBucket("b1"),
    b2: countBucket("b2"),
    b3: countBucket("b3"),
    b4: countBucket("b4"),
  };

  // Filter bucket → paginasi (sudah urut terlama dulu dari DAL).
  const filtered = params.bucket ? base.filter((it) => it.bucket === params.bucket) : base;
  const pageSize = params.pageSize;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(params.page, totalPages);
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  // Lampirkan turunan layanan HANYA untuk halaman ini (≤ pageSize NOPEN) agar
  // payload ringan. Leg kartu itu sendiri (own NOMOR) dikecualikan.
  await attachTurunan(data);

  return {
    data,
    meta: { page, pageSize, total, totalPages },
    counts,
    updatedAt: new Date().toISOString(),
  };
}

/** Ambil semua leg per NOPEN untuk item halaman & sematkan (kecuali leg sendiri). */
async function attachTurunan(data: BelumFinalItem[]): Promise<void> {
  if (data.length === 0) return;
  const nopens = [...new Set(data.map((d) => d.nopen))];
  const rows = await queryTurunanByNopens(nopens);

  const byNopen = new Map<string, TurunanLayananItem[]>();
  for (const row of rows) {
    const key = String(row.NOPEN);
    const list = byNopen.get(key) ?? [];
    list.push(mapTurunan(row));
    byNopen.set(key, list);
  }

  for (const d of data) {
    d.turunan = (byNopen.get(d.nopen) ?? []).filter((t) => t.nomor !== d.nomor);
  }
}

function emptyDiagnosa(): DiagnosaResult {
  return {
    data: [],
    meta: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
    counts: { Semua: 0, TANPA_DX: 0, TANPA_ICD: 0, TANPA_UTAMA: 0, LENGKAP: 0 },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Monitoring "Kelengkapan Diagnosa": kunjungan FINAL pada rentang tanggal dinilai
 * kelengkapan diagnosanya (tanpa diagnosa / tanpa ICD / tanpa utama / lengkap).
 * Hitungan status memperhitungkan filter kategori/cari; daftar dipaginasi server.
 */
export async function getDiagnosaKelengkapan(params: DiagnosaQuery): Promise<DiagnosaResult> {
  if (!isSimgosConfigured()) return emptyDiagnosa();

  const rows = await queryDiagnosaKelengkapan({
    from: params.from,
    to: params.to,
    ruanganId: params.ruangan,
  });
  const scope: DiagnosaItem[] = rows.map(mapDiagnosa);

  const q = params.search?.toLowerCase();
  let base = q ? scope.filter((it) => matchSearch(it, q)) : scope;
  if (params.kategori) base = base.filter((it) => it.kategori === params.kategori);

  const countStatus = (s: DiagnosaStatus) => base.filter((it) => it.status === s).length;
  const counts: DiagnosaCounts = {
    Semua: base.length,
    TANPA_DX: countStatus("TANPA_DX"),
    TANPA_ICD: countStatus("TANPA_ICD"),
    TANPA_UTAMA: countStatus("TANPA_UTAMA"),
    LENGKAP: countStatus("LENGKAP"),
  };

  // Filter status → urut paling parah dulu → paginasi.
  const filtered = params.status ? base.filter((it) => it.status === params.status) : base;
  filtered.sort(
    (a, b) => DIAGNOSA_STATUS_ORDER.indexOf(a.status) - DIAGNOSA_STATUS_ORDER.indexOf(b.status),
  );

  const pageSize = params.pageSize;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(params.page, totalPages);
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return {
    data,
    meta: { page, pageSize, total, totalPages },
    counts,
    updatedAt: new Date().toISOString(),
  };
}

function emptyResume(): ResumeResult {
  return {
    data: [],
    meta: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
    counts: { Semua: 0, TANPA_RESUME: 0, RESUME_MINIM: 0, LENGKAP: 0 },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Monitoring "Kelengkapan Resume Medis": kunjungan FINAL pada rentang tanggal
 * dinilai kelengkapan resume medisnya (tanpa resume / resume belum lengkap /
 * lengkap). Hitungan status memperhitungkan filter kategori/cari; daftar
 * dipaginasi server & diurut paling parah dulu.
 */
export async function getResumeKelengkapan(params: ResumeQuery): Promise<ResumeResult> {
  if (!isSimgosConfigured()) return emptyResume();

  const rows = await queryResumeKelengkapan({
    from: params.from,
    to: params.to,
    ruanganId: params.ruangan,
  });
  const scope: ResumeItem[] = rows.map(mapResume);

  const q = params.search?.toLowerCase();
  let base = q ? scope.filter((it) => matchSearch(it, q)) : scope;
  if (params.kategori) base = base.filter((it) => it.kategori === params.kategori);

  const countStatus = (s: ResumeStatus) => base.filter((it) => it.status === s).length;
  const counts: ResumeCounts = {
    Semua: base.length,
    TANPA_RESUME: countStatus("TANPA_RESUME"),
    RESUME_MINIM: countStatus("RESUME_MINIM"),
    LENGKAP: countStatus("LENGKAP"),
  };

  // Filter status → urut paling parah dulu → paginasi.
  const filtered = params.status ? base.filter((it) => it.status === params.status) : base;
  filtered.sort(
    (a, b) => RESUME_STATUS_ORDER.indexOf(a.status) - RESUME_STATUS_ORDER.indexOf(b.status),
  );

  const pageSize = params.pageSize;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(params.page, totalPages);
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return {
    data,
    meta: { page, pageSize, total, totalPages },
    counts,
    updatedAt: new Date().toISOString(),
  };
}
