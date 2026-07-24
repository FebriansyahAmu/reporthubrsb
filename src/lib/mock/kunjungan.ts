/**
 * MOCK daftar kunjungan untuk katalog cetak Resume Medis.
 *
 * Bentuk data ini meniru hasil query nyata nanti:
 *   pendaftaran.kunjungan  ⨝  master.ruangan  (klasifikasi RI/RJ Klinik/IGD)
 * dengan kolom `KELUAR` menandai apakah kunjungan sudah difinalkan.
 *
 * Aturan tampilan (sesuai kebutuhan):
 *   - `tglKeluar` (kolom KELUAR) NULL  → pasien BELUM keluar/final → kartu MERAH,
 *     belum bisa dicetak resumenya.
 *   - `tglKeluar` terisi               → sudah final → SIAP CETAK.
 */

export type KategoriKunjungan = "Rawat Inap" | "Rawat Jalan Klinik" | "IGD";

export type KunjunganResumeItem = {
  /** id = NOPEN (dipakai untuk /print/resume-medis/[id]). */
  id: string;
  norm: string;
  nama: string;
  jenisKelamin: string;
  umur: string;
  kategori: KategoriKunjungan;
  ruang: string;
  dpjp: string;
  diagnosa: string | null;
  /** ISO lokal (tanpa Z). */
  tglMasuk: string;
  /** ISO lokal, atau null bila kolom KELUAR masih kosong (belum final). */
  tglKeluar: string | null;
};

const DATA: KunjunganResumeItem[] = [
  // ── Minggu ini (20–26 Jul 2026) ─────────────────────────────────────────
  {
    id: "1",
    norm: "00-12-45-67",
    nama: "AHMAD FADIL PRATAMA",
    jenisKelamin: "Laki-Laki",
    umur: "25 th",
    kategori: "Rawat Jalan Klinik",
    ruang: "Poliklinik Kulit & Kelamin",
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
    umur: "31 th",
    kategori: "Rawat Inap",
    ruang: "Ruang Melati (Kelas 3)",
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
    umur: "29 th",
    kategori: "IGD",
    ruang: "Instalasi Gawat Darurat",
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
    umur: "45 th",
    kategori: "Rawat Inap",
    ruang: "Ruang Mawar (Kelas 2)",
    dpjp: "dr. AGUS SALIM, Sp.PD",
    diagnosa: null,
    tglMasuk: "2026-07-24T06:20:00",
    tglKeluar: null, // belum keluar → MERAH
  },
  {
    id: "1005",
    norm: "00-22-14-30",
    nama: "RANGGA SAPUTRA",
    jenisKelamin: "Laki-Laki",
    umur: "52 th",
    kategori: "Rawat Jalan Klinik",
    ruang: "Poliklinik Penyakit Dalam",
    dpjp: "dr. AGUS SALIM, Sp.PD",
    diagnosa: null,
    tglMasuk: "2026-07-24T08:40:00",
    tglKeluar: null, // belum keluar → MERAH
  },
  {
    id: "1006",
    norm: "00-22-51-19",
    nama: "LINA MARLINA",
    jenisKelamin: "Perempuan",
    umur: "38 th",
    kategori: "IGD",
    ruang: "Instalasi Gawat Darurat",
    dpjp: "dr. REZA FAHLEVI, Sp.B",
    diagnosa: null,
    tglMasuk: "2026-07-24T11:05:00",
    tglKeluar: null, // belum keluar → MERAH
  },
  // ── Minggu lalu (13–19 Jul 2026) ────────────────────────────────────────
  {
    id: "1007",
    norm: "00-11-90-64",
    nama: "TAUFIK HIDAYAT",
    jenisKelamin: "Laki-Laki",
    umur: "60 th",
    kategori: "Rawat Jalan Klinik",
    ruang: "Poliklinik Mata",
    dpjp: "dr. NILAM SARI, Sp.M",
    diagnosa: "Senile cataract (H25.9)",
    tglMasuk: "2026-07-15T10:00:00",
    tglKeluar: "2026-07-15T10:45:00",
  },
  {
    id: "1008",
    norm: "00-09-42-77",
    nama: "HENDRA GUNAWAN",
    jenisKelamin: "Laki-Laki",
    umur: "48 th",
    kategori: "Rawat Inap",
    ruang: "Ruang Anggrek (Kelas 1)",
    dpjp: "dr. PUTU WIRAWAN, Sp.JP",
    diagnosa: "Congestive heart failure (I50.0)",
    tglMasuk: "2026-07-14T13:00:00",
    tglKeluar: "2026-07-18T09:00:00",
  },
  {
    id: "1009",
    norm: "00-20-63-45",
    nama: "YULIANA",
    jenisKelamin: "Perempuan",
    umur: "27 th",
    kategori: "IGD",
    ruang: "Instalasi Gawat Darurat",
    dpjp: "dr. REZA FAHLEVI, Sp.B",
    diagnosa: "Colic, unspecified (R10.4)",
    tglMasuk: "2026-07-16T20:00:00",
    tglKeluar: "2026-07-16T21:30:00",
  },
];

function delay<T>(v: T, ms = 300): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms));
}

/** Semua kunjungan (data simulasi). Filter minggu/kategori dilakukan di UI. */
export async function getKunjunganResumeList(): Promise<KunjunganResumeItem[]> {
  return delay(DATA);
}
