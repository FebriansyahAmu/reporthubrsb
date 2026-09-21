/** DTO Dashboard Analitik Inventaris (dipakai server & client). */

export type InvDashboardTotals = {
  totalUnit: number;
  totalNilai: number;
  jenisBarang: number;
  ruanganTerisi: number;
  perluPerhatian: number;
};

/** Segmen komposisi berlabel — `tone` → warna status di klien (identitas via label). */
export type InvKompo = { label: string; value: number; tone: string };

/** Baris sebaran: jumlah unit + total nilai (klien pilih metrik bar & sub). */
export type InvBarItem = { label: string; jumlah: number; nilai: number };

/** Titik tren perolehan per tahun. */
export type InvYearItem = { tahun: number; jumlah: number; nilai: number };

export type InvDashboardData = {
  totals: InvDashboardTotals;
  kondisi: InvKompo[];
  statusAset: InvKompo[];
  perRuangan: InvBarItem[];
  perKategori: InvBarItem[];
  perSumber: InvBarItem[];
  trenTahun: InvYearItem[];
  updatedAt: string;
};
