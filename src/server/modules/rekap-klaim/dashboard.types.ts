/** Tipe data Dashboard Analitik Rekap Klaim BPJS (F-04.6). Tanpa server-only agar
 *  bisa diimpor sebagai type oleh komponen klien. */

export type ToneStr = "brand" | "success" | "warning" | "danger" | "accent" | "neutral";

export type KomposisiSlice = { label: string; value: number; tone: ToneStr };
export type TrenBulan = { bulan: number; dana: number; diterima: number; entri: number };
export type TrenTahun = { tahun: number; dana: number; entri: number };

export type KlaimDashboardData = {
  tahunBerjalan: number;
  adaData: boolean;
  /** Ringkasan tahun berjalan (year-to-date). */
  totals: { totalYtd: number; diterimaYtd: number; entriYtd: number; kasusYtd: number };
  /** Klaim belum cair (seluruh periode): SUBMITTED/APPROVED/PARTIAL. */
  belumCair: { count: number; nilai: number };
  /** Potongan bertahap yang masih berjalan (cicilanKe < totalCicilan). */
  potonganBerjalan: { count: number; nilai: number };
  /** Jumlah entri yang perlu perhatian: EXPIRED/REJECTED/selisih (seluruh periode). */
  perluPerhatian: number;
  /** Komposisi jumlah entri per jenis klaim (seluruh periode). */
  komposisiJenis: KomposisiSlice[];
  /** Sebaran jumlah entri per status (seluruh periode). */
  statusKlaim: KomposisiSlice[];
  /** Tren dana per bulan pada tahun berjalan (12 bulan penuh). */
  trenBulanan: TrenBulan[];
  /** Tren dana per tahun pelayanan (seluruh periode). */
  trenTahun: TrenTahun[];
};
