import "server-only";
import {
  queryCpptKunjunganByNopen,
  querySepByNopen,
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
      if (!kunjungan) return null;
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
    },
  },
};

export function isKnownReport(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(REPORTS, slug);
}
