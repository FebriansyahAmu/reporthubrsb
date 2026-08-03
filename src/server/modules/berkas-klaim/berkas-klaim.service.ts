import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { hitungUmur } from "@/lib/format";
import { queryKunjunganRange, queryTurunanByNopens } from "@/server/modules/pelayanan/pelayanan.dal";
import { mapKunjunganPelayanan, mapTurunan } from "@/server/modules/pelayanan/pelayanan.mapper";
import { queryBerkasDetail, querySepByNopen } from "./berkas-klaim.dal";
import { buktiExists } from "./berkas-klaim.bukti.service";
import type { BerkasKlaimQuery } from "./berkas-klaim.schema";
import type {
  BerkasDetail,
  BerkasKlaimCounts,
  BerkasKlaimItem,
  BerkasKlaimResult,
  DokumenBerkas,
  KategoriKunjungan,
  TurunanLayananItem,
} from "./berkas-klaim.types";

export type { BerkasKlaimResult, BerkasDetail };

function matchSearch(it: { nama: string; norm: string; ruang: string }, q: string): boolean {
  return `${it.nama} ${it.norm} ${it.ruang}`.toLowerCase().includes(q);
}

function emptyResult(): BerkasKlaimResult {
  return {
    data: [],
    meta: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
    counts: { Semua: 0, "Rawat Inap": 0, "Rawat Jalan Klinik": 0, IGD: 0 },
    updatedAt: new Date().toISOString(),
  };
}

/** Sematkan turunan layanan (semua leg NOPEN, kecuali leg sendiri) untuk 1 halaman. */
async function attachTurunan(data: BerkasKlaimItem[]): Promise<void> {
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

/**
 * Daftar "Berkas Klaim RM": pasien yang sudah FINAL pada rentang tanggal, dengan
 * turunan layanan. Persis pola Monitoring Kunjungan tetapi hanya yang final.
 */
export async function getBerkasKlaimRM(params: BerkasKlaimQuery): Promise<BerkasKlaimResult> {
  if (!isSimgosConfigured()) return emptyResult();

  const rows = await queryKunjunganRange({
    from: params.from,
    to: params.to,
    ruanganId: params.ruangan,
    finalOnly: true,
  });
  const scope: BerkasKlaimItem[] = rows.map((r) => ({ ...mapKunjunganPelayanan(r), turunan: [] }));

  const q = params.search?.toLowerCase();
  const searched = q ? scope.filter((it) => matchSearch(it, q)) : scope;

  const counts: BerkasKlaimCounts = {
    Semua: searched.length,
    "Rawat Inap": searched.filter((it) => it.kategori === "Rawat Inap").length,
    "Rawat Jalan Klinik": searched.filter((it) => it.kategori === "Rawat Jalan Klinik").length,
    IGD: searched.filter((it) => it.kategori === "IGD").length,
  };

  const filtered = params.kategori
    ? searched.filter((it) => it.kategori === params.kategori)
    : searched;

  const pageSize = params.pageSize;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(params.page, totalPages);
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  await attachTurunan(data);

  return {
    data,
    meta: { page, pageSize, total, totalPages },
    counts,
    updatedAt: new Date().toISOString(),
  };
}

const n = (v: number | string | null): number => Number(v) || 0;

/**
 * Detail berkas satu episode (NOPEN): identitas + status tiap dokumen klaim.
 * Deteksi READ-ONLY; SEP & Bukti Pelayanan ditandai PENDING (belum ada pemetaan).
 */
export async function getBerkasDetail(nopen: string): Promise<BerkasDetail | null> {
  if (!isSimgosConfigured()) return null;

  const header = await queryBerkasDetail(nopen);
  if (!header) return null;

  const legRows = await queryTurunanByNopens([nopen]);
  const turunan = legRows.map(mapTurunan);
  const jenisSet = new Set(legRows.map((r) => Number(r.JENIS_KUNJUNGAN)));
  const hasRI = jenisSet.has(3);
  const hasIGD = jenisSet.has(2);

  // Leg klinis utama (prioritas RI > IGD > RJ) untuk header episode.
  const priority = [3, 2, 1];
  const mainRow =
    priority
      .map((j) => legRows.find((r) => Number(r.JENIS_KUNJUNGAN) === j))
      .find(Boolean) ?? legRows[0];

  const kategori: KategoriKunjungan = hasRI
    ? "Rawat Inap"
    : hasIGD
      ? "IGD"
      : "Rawat Jalan Klinik";

  const mainMasuk = mainRow ? mapTurunan(mainRow) : null;
  const lahir = header.TANGGAL_LAHIR
    ? header.TANGGAL_LAHIR instanceof Date
      ? header.TANGGAL_LAHIR
      : new Date(header.TANGGAL_LAHIR)
    : null;
  const jk = Number(header.JENIS_KELAMIN);

  const triageN = n(header.TRIAGE_N);
  const resumeN = n(header.RESUME_N);
  const spriN = n(header.SPRI_N);
  const cpptN = n(header.CPPT_N);
  const diagnosaN = n(header.DIAGNOSA_N);
  const final = mainMasuk?.final ?? false;
  const buktiAda = await buktiExists(nopen).catch(() => false);
  // Nomor SEP dari bpjs.kunjungan (noKartu + tglSEP), READ-ONLY. Null bila umum/belum terbit.
  const sepNo = await querySepByNopen(nopen).catch(() => null);

  const dokumen: DokumenBerkas[] = [
    {
      key: "rekam-medis",
      label: "Rekam Medis",
      icon: "rekam-medis",
      status: final ? "ADA" : "TIDAK",
      keterangan: diagnosaN > 0 ? `${diagnosaN} diagnosa` : final ? "Siap dicetak" : "Belum final",
      // Viewer (iframe) → preview PDF resmi SIMGOS di tab, tak dicegat IDM.
      printHref: `/print/simgos/resume-medis/${nopen}`,
    },
    {
      key: "triase",
      label: "Triase",
      icon: "triase",
      status: hasIGD ? (triageN > 0 ? "ADA" : "TIDAK") : "NA",
      keterangan: hasIGD ? (triageN > 0 ? `${triageN} triase` : "Belum diinput") : "Non-IGD",
    },
    {
      key: "sep",
      label: "SEP",
      icon: "sep",
      status: sepNo ? "ADA" : "TIDAK",
      keterangan: sepNo ? `No. SEP ${sepNo}` : "Tidak ditemukan (umum / SEP belum terbit)",
      // Viewer (iframe) → cetak SEP resmi via report engine (route resolve NOPEN→SEP).
      printHref: sepNo ? `/print/simgos/sep/${nopen}` : undefined,
    },
    {
      key: "spri",
      label: "SPRI",
      icon: "spri",
      status: hasRI ? (spriN > 0 ? "ADA" : "TIDAK") : "NA",
      keterangan: hasRI
        ? spriN > 0
          ? "Ada perintah rawat inap"
          : "Belum diinput"
        : "Hanya Rawat Inap",
    },
    {
      key: "bukti",
      label: "Bukti Pelayanan",
      icon: "bukti",
      status: buktiAda ? "ADA" : "TIDAK",
      keterangan: buktiAda ? "Sudah diisi" : "Belum diisi — klik untuk mengisi",
    },
    {
      key: "cppt",
      label: "CPPT",
      icon: "cppt",
      status: cpptN > 0 ? "ADA" : "TIDAK",
      keterangan: cpptN > 0 ? `${cpptN} catatan` : "Belum ada catatan",
      // Cetak Catatan Medik resmi (route resolve NOPEN→KUNJUNGAN ber-CPPT).
      printHref: cpptN > 0 ? `/print/simgos/cppt/${nopen}` : undefined,
    },
    {
      key: "resume",
      label: "Resume Pulang",
      icon: "resume",
      status: resumeN > 0 ? "ADA" : hasRI ? "TIDAK" : "NA",
      keterangan: resumeN > 0 ? "Sudah diinput" : hasRI ? "Belum diinput" : "Opsional (non-RI)",
      printHref: resumeN > 0 ? `/print/resume-pulang/${nopen}` : undefined,
    },
  ];

  return {
    nopen,
    norm: String(header.NORM),
    nama: header.NAMA?.trim() || "—",
    jenisKelamin: jk === 1 ? "Laki-Laki" : jk === 2 ? "Perempuan" : "—",
    umur: hitungUmur(lahir && !Number.isNaN(lahir.getTime()) ? lahir : null),
    kategori,
    ruangUtama: mainMasuk?.ruang ?? "—",
    masuk: mainMasuk?.masuk ?? new Date().toISOString(),
    keluar: mainMasuk?.keluar ?? null,
    final,
    turunan,
    dokumen,
  };
}
