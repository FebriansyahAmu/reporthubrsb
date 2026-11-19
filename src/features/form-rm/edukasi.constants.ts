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

/** Opsi hambatan yang meniadakan opsi lain (memilihnya mengosongkan hambatan lain). */
export const HAMBATAN_TIDAK_ADA = "Tidak Ada";

/** Kolom per kategori yang wajib terisi sebelum FINAL. */
export type KolomSyaratEdukasi = "edukatorNama" | "tanggalJam" | "sasaranTtd";

/**
 * Satu syarat FINAL RM.21. `indeks` = posisi baris di `entries` (null untuk
 * syarat "minimal satu kategori"). Sumber tunggal registri (`syaratFinal`,
 * diperiksa server saat FINALKAN) dan panel "Syarat finalisasi" di layar.
 */
export type SyaratEdukasi = {
  kunci: string;
  label: string;
  ok: boolean;
  indeks: number | null;
  kolom: KolomSyaratEdukasi | null;
};

type EntriSyarat = Pick<EdukasiEntry, "kategori" | "aktif" | "edukatorNama" | "tanggalJam" | "sasaranTtd">;

/** Syarat untuk satu kategori aktif (urutan = urutan pesan galat FINALKAN). */
export function syaratKategori(e: EntriSyarat, indeks: number): SyaratEdukasi[] {
  return [
    { kolom: "edukatorNama", label: `${e.kategori}: nama edukator`, ok: e.edukatorNama.trim() !== "" },
    { kolom: "tanggalJam", label: `${e.kategori}: tanggal & jam edukasi`, ok: e.tanggalJam.trim() !== "" },
    { kolom: "sasaranTtd", label: `${e.kategori}: tanda tangan sasaran edukasi`, ok: e.sasaranTtd !== "" },
  ].map((s) => ({ ...s, kolom: s.kolom as KolomSyaratEdukasi, kunci: `${indeks}.${s.kolom}`, indeks }));
}

/** Semua syarat FINAL (terpenuhi & belum). Tanpa kategori aktif → satu syarat "minimal satu". */
export function syaratEdukasi(d: { entries: readonly EntriSyarat[] }): SyaratEdukasi[] {
  const aktif = d.entries.flatMap((e, i) => (e.aktif ? [{ e, i }] : []));
  if (aktif.length === 0) {
    return [{ kunci: "aktif", label: "Minimal satu kebutuhan edukasi diisi", ok: false, indeks: null, kolom: null }];
  }
  return aktif.flatMap(({ e, i }) => syaratKategori(e, i));
}

/** Syarat FINAL yang belum terpenuhi (pesannya dipakai registri). */
export const kekuranganEdukasi = (d: { entries: readonly EntriSyarat[] }): SyaratEdukasi[] =>
  syaratEdukasi(d).filter((s) => !s.ok);

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
