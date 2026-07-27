import type {
  KunjunganResumeItem,
  RuanganOption,
} from "@/server/modules/kunjungan/kunjungan.types";

/**
 * MOCK daftar kunjungan + ruangan untuk katalog cetak Resume Medis.
 * Dipakai HANYA sebagai fallback saat SIMGOS belum dikonfigurasi
 * (`isSimgosConfigured()` false). Bentuk data meniru hasil query nyata:
 *   pendaftaran.kunjungan ⨝ master.ruangan ⨝ pendaftaran.pendaftaran ⨝ master.pasien
 */

export const MOCK_RUANGAN: RuanganOption[] = [
  { id: "104020102", nama: "KLINIK INTERNA", kategori: "Rawat Jalan Klinik" },
  { id: "104020101", nama: "KLINIK MATA", kategori: "Rawat Jalan Klinik" },
  { id: "104010101", nama: "NON BEDAH", kategori: "IGD" },
  { id: "104010102", nama: "BEDAH", kategori: "IGD" },
  { id: "104030103", nama: "INTERNA KELAS 3", kategori: "Rawat Inap" },
  { id: "104040101", nama: "RUANG ICU", kategori: "Rawat Inap" },
];

const DATA: KunjunganResumeItem[] = [
  {
    id: "1",
    norm: "00-12-45-67",
    nama: "AHMAD FADIL PRATAMA",
    jenisKelamin: "Laki-Laki",
    umur: "25 th 1 bl",
    kategori: "Rawat Jalan Klinik",
    ruang: "KLINIK KULIT & KELAMIN",
    dpjp: "dr. RINA MELATI, Sp.KK",
    diagnosa: "Dermatitis, unspecified (L30.9)",
    tglMasuk: "2026-07-20T09:15:00",
    tglKeluar: "2026-07-20T10:05:00",
  },
  {
    id: "2",
    norm: "00-15-98-02",
    nama: "SITI NURHALIZA",
    jenisKelamin: "Perempuan",
    umur: "31 th 4 bl",
    kategori: "Rawat Inap",
    ruang: "INTERNA KELAS 3",
    dpjp: "dr. AGUS SALIM, Sp.PD",
    diagnosa: "Dengue haemorrhagic fever (A91)",
    tglMasuk: "2026-07-21T14:00:00",
    tglKeluar: "2026-07-24T08:30:00",
  },
  {
    id: "3",
    norm: "00-18-33-51",
    nama: "BUDI HARTONO",
    jenisKelamin: "Laki-Laki",
    umur: "29 th 2 bl",
    kategori: "IGD",
    ruang: "BEDAH",
    dpjp: "dr. REZA FAHLEVI, Sp.B",
    diagnosa: "Acute appendicitis (K35.80)",
    tglMasuk: "2026-07-23T22:10:00",
    tglKeluar: "2026-07-23T23:40:00",
  },
  {
    id: "1004",
    norm: "00-21-07-88",
    nama: "DEWI ANGGRAINI",
    jenisKelamin: "Perempuan",
    umur: "45 th 6 bl",
    kategori: "Rawat Inap",
    ruang: "RUANG ICU",
    dpjp: null,
    diagnosa: null,
    tglMasuk: "2026-07-24T06:20:00",
    tglKeluar: null, // belum keluar → MERAH
  },
  {
    id: "1005",
    norm: "00-22-14-30",
    nama: "RANGGA SAPUTRA",
    jenisKelamin: "Laki-Laki",
    umur: "52 th 0 bl",
    kategori: "Rawat Jalan Klinik",
    ruang: "KLINIK INTERNA",
    dpjp: null,
    diagnosa: null,
    tglMasuk: "2026-07-24T08:40:00",
    tglKeluar: null, // belum keluar → MERAH
  },
  {
    id: "1006",
    norm: "00-22-51-19",
    nama: "LINA MARLINA",
    jenisKelamin: "Perempuan",
    umur: "38 th 9 bl",
    kategori: "IGD",
    ruang: "NON BEDAH",
    dpjp: null,
    diagnosa: null,
    tglMasuk: "2026-07-24T11:05:00",
    tglKeluar: null, // belum keluar → MERAH
  },
  {
    id: "1007",
    norm: "00-11-90-64",
    nama: "TAUFIK HIDAYAT",
    jenisKelamin: "Laki-Laki",
    umur: "60 th 3 bl",
    kategori: "Rawat Jalan Klinik",
    ruang: "KLINIK MATA",
    dpjp: null,
    diagnosa: null,
    tglMasuk: "2026-07-15T10:00:00",
    tglKeluar: "2026-07-15T10:45:00",
  },
];

/** Fallback: filter data mock sesuai rentang tanggal + ruangan (meniru DAL). */
export async function filterMockKunjungan(params: {
  from: string;
  to: string;
  ruanganId?: string;
}): Promise<KunjunganResumeItem[]> {
  const fromT = new Date(`${params.from}T00:00:00`).getTime();
  const toT = new Date(`${params.to}T00:00:00`).getTime();
  const ruangNama = params.ruanganId
    ? MOCK_RUANGAN.find((r) => r.id === params.ruanganId)?.nama
    : undefined;

  const hasil = DATA.filter((it) => {
    const t = new Date(it.tglMasuk).getTime();
    if (t < fromT || t >= toT) return false;
    if (ruangNama && it.ruang !== ruangNama) return false;
    return true;
  }).sort((a, b) => +new Date(b.tglMasuk) - +new Date(a.tglMasuk));

  return new Promise((r) => setTimeout(() => r(hasil), 200));
}
