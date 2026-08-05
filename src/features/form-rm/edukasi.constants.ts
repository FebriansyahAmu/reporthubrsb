import type { EdukasiEntry, EdukasiForm } from "@/server/modules/form-rm/form-rm.types";

/** Jenis form RM (discriminator baris `form_rm`). */
export const EDUKASI_JENIS = "edukasi";

/** Kategori edukator + topik acuan RM.21 (urutan & isi sesuai formulir cetak). */
export const EDUKASI_KATEGORI: { key: string; topik: string[] }[] = [
  {
    key: "Keperawatan",
    topik: [
      "Hak dan Kewajiban Pasien dan Keluarga",
      "Penjelasan tentang proses pemberian informed consent",
      "Manajemen Nyeri",
      "Cuci tangan yang aman",
    ],
  },
  { key: "Tenaga Gizi", topik: ["Diet Gizi", "Nutrisi"] },
  { key: "Farmasi", topik: ["Obat-obatan"] },
  {
    key: "Tenaga Kesehatan Lainnya",
    topik: ["Teknik Rehabilitasi", "Penggunaan Peralatan Medis"],
  },
  {
    key: "Dokter",
    topik: ["Diagnosis", "Tindakan Kedokteran", "Indikasi Tindakan", "Tujuan", "Resiko", "Komplikasi"],
  },
];

export const BAHASA_OPTS = ["Indonesia", "Daerah", "Inggris"];
export const PENDIDIKAN_OPTS = ["SD", "SLTP", "SLTA", "S1", "S2"];
export const BACA_TULIS_OPTS = ["Baik", "Kurang"];
export const TIPE_BELAJAR_OPTS = ["Verbal", "Tulisan"];
export const HAMBATAN_OPTS = [
  "Tidak Ada",
  "Emosional",
  "Fisik Lemah",
  "Gangguan Mata",
  "Gangguan Telinga",
  "Gangguan Bicara",
  "Bahasa / Kognitif Terbatas",
  "Budaya / Agama / Spiritual",
];
export const KESEDIAAN_OPTS = ["Bersedia", "Tidak Bersedia"];
export const METODE_OPTS = ["Wawancara", "Diskusi Kelompok", "Ceramah", "Demonstrasi"];
export const SARANA_OPTS = ["Leaflet", "Audiovisual", "Lisan"];
export const PEMAHAMAN_OPTS = ["Sudah Mengerti", "Sudah Paham"];
export const EVALUASI_OPTS = ["Re-Edukasi", "Sudah Mengerti", "Sudah Paham"];
export const SASARAN_OPTS = ["Pasien", "Keluarga", "Lain-lain"];
export const HUBUNGAN_OPTS = ["Istri", "Suami", "Anak", "Kakek", "Nenek", "Saudara", "Keluarga"];

/** Satu baris edukasi kosong untuk kategori tertentu. */
export function emptyEntry(kategori: string): EdukasiEntry {
  return {
    kategori,
    aktif: false,
    edukatorNama: "",
    tanggalJam: "",
    durasiMenit: "",
    sasaran: "",
    sasaranNama: "",
    sasaranHubungan: "",
    sasaranTtd: "",
    metode: [],
    sarana: [],
    saranaLain: "",
    pemahaman: [],
    evaluasi: [],
    tanggalReEdukasi: "",
  };
}

/** Form Edukasi kosong (satu entry per kategori RM.21). */
export function emptyEdukasiForm(): EdukasiForm {
  return {
    persiapan: {
      bahasa: [],
      bahasaLain: "",
      penerjemah: "",
      pendidikan: "",
      pendidikanLain: "",
      bacaTulis: "",
      tipePembelajaran: [],
      hambatan: [],
      hambatanLain: "",
      kesediaan: "",
    },
    entries: EDUKASI_KATEGORI.map((k) => emptyEntry(k.key)),
    catatan: "",
  };
}
