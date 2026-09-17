import "server-only";
import {
  queryCpptIgdSourceByNopen,
  queryCpptKunjunganByNopen,
  querySepByNopen,
  querySpriKunjunganByNopen,
} from "@/server/modules/berkas-klaim/berkas-klaim.dal";

/**
 * Registry report SIMGOS (JasperReports) yang boleh dicetak lewat proxy.
 * Setiap entri membangun payload `RequestReport` — TANPA blok DOCUMENT_STORAGE
 * agar murni READ-ONLY (tidak menulis salinan ke document-storage SIMGOS).
 *
 * `NAME` bersifat spesifik faskes (mengandung kode `7111011`); tambah entri baru
 * dengan menyalin NAME persis dari SIMGOS (DevTools → Network saat mencetak).
 *
 * `build(nopen)` boleh me-resolve parameter tambahan via query READ-ONLY (mis.
 * SEP butuh nomor SEP, CPPT butuh KUNJUNGAN). Mengembalikan `null` bila dokumen
 * tak bisa dibuat untuk NOPEN tsb (mis. pasien umum tanpa SEP, atau tanpa CPPT).
 */
export type ReportPayload = Record<string, unknown>;

export type ReportDef = {
  build: (nopen: string) => Promise<ReportPayload | null>;
};

/** Payload cetak "Catatan Medik" (CPPT) untuk satu leg (NOPEN + KUNJUNGAN). */
function cpptPayload(nopen: string, kunjungan: string): ReportPayload {
  return {
    NAME: "mr.7111011-CetakCatatanMedik",
    PARAMETER: { PNOPEN: nopen, PKUNJUNGAN: kunjungan, PID: 0 },
    PRINT_NAME: "CetakMR",
    TYPE: "Pdf",
    EXT: "pdf",
    REQUEST_FOR_PRINT: false,
    ALLOW_DOWNLOAD: false,
    CONNECTION_NUMBER: 0,
    COPIES: 1,
  };
}

export const REPORTS: Record<string, ReportDef> = {
  "resume-medis": {
    build: async (nopen) => ({
      TITLE: `RESUME MEDIS - ${nopen}`,
      NAME: "mr.7111011-CetakMR2ResumeMedis",
      FINAL: 1,
      ENABLE_BUTTON_SIGN: false,
      PARAMETER: { PNOPEN: nopen },
      PRINT_NAME: "CetakMR",
      TYPE: "Pdf",
      EXT: "pdf",
      REQUEST_FOR_PRINT: false,
      ALLOW_DOWNLOAD: false,
      CONNECTION_NUMBER: 0,
      COPIES: 1,
    }),
  },
  sep: {
    build: async (nopen) => {
      const sep = await querySepByNopen(nopen);
      if (!sep) return null;
      return {
        NAME: "bpjs.7111011-CetakSEP",
        TYPE: "Pdf",
        EXT: "pdf",
        PARAMETER: { PSEP: sep, CETAK_HEADER: 1 },
        REQUEST_FOR_PRINT: false,
        MULTI_PRINT: false,
        PRINT_NAME: "CetakSEP",
        ALLOW_DOWNLOAD: false,
        CONNECTION_NUMBER: 0,
        COPIES: 1,
      };
    },
  },
  cppt: {
    build: async (nopen) => {
      const kunjungan = await queryCpptKunjunganByNopen(nopen);
      return kunjungan ? cpptPayload(nopen, kunjungan) : null;
    },
  },
  spri: {
    build: async (nopen) => {
      // PKUNJUNGAN = leg IGD/asal tempat SPRI dibuat (bukan leg Rawat Inap).
      const kunjungan = await querySpriKunjunganByNopen(nopen);
      if (!kunjungan) return null;
      return {
        NAME: "bpjs.7111011-RencanaKontrol",
        TYPE: "Pdf",
        EXT: "pdf",
        PARAMETER: { PKUNJUNGAN: kunjungan, CETAK_HEADER: 1 },
        REQUEST_FOR_PRINT: false,
        MULTI_PRINT: false,
        PRINT_NAME: "CetakSPRI",
        TITLE: "Cetak Surat Rencana Rawat Inap",
        ALLOW_DOWNLOAD: false,
        CONNECTION_NUMBER: 0,
        COPIES: 1,
      };
    },
  },
};

export function isKnownReport(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(REPORTS, slug);
}

export type BuildPayloadsOpts = {
  /** CPPT: sertakan pula CPPT leg IGD asal (digabung jadi satu PDF). */
  includeIgd?: boolean;
};

/**
 * Bangun DAFTAR payload report untuk satu NOPEN (urutan = urutan cetak/gabung).
 * Umumnya 1 payload. Khusus **CPPT + includeIgd**: bila episode RI punya leg IGD
 * asal (via SPRI) ber-CPPT, IGD ditaruh DULU (kronologis) lalu leg utama (RI) —
 * keduanya digabung menjadi satu file oleh report engine. Mengembalikan `null`
 * bila dokumen tak tersedia untuk NOPEN ini.
 */
export async function buildReportPayloads(
  report: string,
  nopen: string,
  opts: BuildPayloadsOpts = {},
): Promise<ReportPayload[] | null> {
  const def = REPORTS[report];
  if (!def) return null;

  if (report === "cppt" && opts.includeIgd) {
    const [igd, main] = await Promise.all([
      queryCpptIgdSourceByNopen(nopen),
      queryCpptKunjunganByNopen(nopen),
    ]);
    const list: ReportPayload[] = [];
    if (igd) list.push(cpptPayload(igd.nopen, igd.kunjungan)); // IGD dulu (kronologis)
    if (main) list.push(cpptPayload(nopen, main)); // lalu leg utama (RI)
    return list.length ? list : null;
  }

  const payload = await def.build(nopen);
  return payload ? [payload] : null;
}
