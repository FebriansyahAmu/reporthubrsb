import type { PageMeta } from "@/lib/types";

export type JenisPelayanan = 1 | 2;

/** Satu rujukan keluar (bpjs.rujukan) + nama pasien & tujuan hasil join. */
export type RujukanKeluarItem = {
  noRujukan: string;
  noSep: string;
  /** "YYYY-MM-DD" (diformat di SQL, bebas geser TZ). */
  tglRujukan: string;
  tglRencanaKunjungan: string;
  jnsPelayanan: JenisPelayanan;
  jenisLabel: string; // "Rawat Inap" | "Rawat Jalan"
  diagRujukan: string; // kode ICD-10
  catatan: string;
  status: number;
  pasienNama: string;
  pasienNik: string;
  tujuanKode: string;
  tujuanNama: string; // nama faskes tujuan (ppk) atau kode bila tak dikenal
  poliKode: string;
  poliNama: string; // nama poli tujuan atau "" (rujukan RI biasanya tanpa poli)
};

export type RujukanCounts = { semua: number; rawatInap: number; rawatJalan: number };

export type RujukanKeluarResult = {
  data: RujukanKeluarItem[];
  meta: PageMeta;
  counts: RujukanCounts;
  updatedAt: string; // ISO
};

/** Filter yang sudah tervalidasi (dipakai DAL). */
export type RujukanKeluarFilter = {
  from?: string;
  to?: string;
  jnsPelayanan?: JenisPelayanan;
  search?: string;
};
