/**
 * Registry report SIMGOS (JasperReports) yang boleh dicetak lewat proxy.
 * Setiap entri membangun payload `RequestReport` — TANPA blok DOCUMENT_STORAGE
 * agar murni READ-ONLY (tidak menulis salinan ke document-storage SIMGOS).
 *
 * `NAME` bersifat spesifik faskes (mengandung kode `7111011`); tambah entri baru
 * dengan menyalin NAME persis dari SIMGOS (DevTools → Network saat mencetak).
 */
export type ReportPayload = Record<string, unknown>;

type ReportBuilder = (nopen: string) => ReportPayload;

export const REPORTS: Record<string, ReportBuilder> = {
  "resume-medis": (nopen) => ({
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
};

export function isKnownReport(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(REPORTS, slug);
}
