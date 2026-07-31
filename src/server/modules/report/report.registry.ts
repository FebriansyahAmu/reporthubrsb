/**
 * Registry report SIMGOS (JasperReports) yang boleh dicetak lewat proxy.
 * Setiap entri membangun payload `RequestReport` — TANPA blok DOCUMENT_STORAGE
 * agar murni READ-ONLY (tidak menulis salinan ke document-storage SIMGOS).
 *
 * `NAME` bersifat spesifik faskes (mengandung kode `7111011`); tambah entri baru
 * dengan menyalin NAME persis dari SIMGOS (DevTools → Network saat mencetak).
 *
 * `param` menentukan KUNCI yang dibutuhkan payload:
 *   - "nopen": kunci = NOPEN langsung (mis. Resume Medis → PNOPEN).
 *   - "sep"  : kunci = NOMOR SEP; route wajib me-resolve NOPEN → nomor SEP dulu
 *              (lihat `querySepByNopen`) sebelum memanggil `build`.
 */
export type ReportPayload = Record<string, unknown>;

export type ReportDef = {
  /** Sumber kunci payload: NOPEN apa adanya, atau nomor SEP hasil resolve. */
  param: "nopen" | "sep";
  /** Bangun payload RequestReport dari kunci yang sudah ter-resolve. */
  build: (key: string) => ReportPayload;
};

export const REPORTS: Record<string, ReportDef> = {
  "resume-medis": {
    param: "nopen",
    build: (nopen) => ({
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
    param: "sep",
    build: (sep) => ({
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
    }),
  },
};

export function isKnownReport(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(REPORTS, slug);
}
