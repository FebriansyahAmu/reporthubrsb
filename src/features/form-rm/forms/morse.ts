import { definisiDeklaratif, type KategoriSkor, type KolomBaris, type Opsi } from "../deklaratif";

/**
 * PENGKAJIAN RISIKO JATUH DEWASA — SKALA MORSE (pilot form deklaratif, PRD F3).
 *
 * DRAF sampai templat resmi RS diterima: kode RM, ambang kategori, daftar
 * intervensi, dan tata letak cetak disesuaikan 1:1 dengan templat itu. Skor
 * tiap opsi = skala Morse baku = `master.referensi` JENIS 186–191 kolom
 * SCORING di SIMGOS (isi otomatis baris pengkajian awal memakai kode yang sama).
 */

const yaTidak = (skorYa: number): readonly Opsi[] => [
  { nilai: "tidak", label: "Tidak", skor: 0 },
  { nilai: "ya", label: "Ya", skor: skorYa },
];

/** Interpretasi skor (pedoman pencegahan jatuh yang umum dipakai RS di Indonesia). */
export const KATEGORI_MORSE: readonly KategoriSkor[] = [
  { min: 0, label: "Risiko rendah", nada: "rendah" },
  { min: 25, label: "Risiko sedang", nada: "sedang" },
  { min: 45, label: "Risiko tinggi", nada: "tinggi" },
];

const FAKTOR = ["riwayatJatuh", "diagnosisSekunder", "alatBantu", "terapiIntravena", "gayaBerjalan", "statusMental"] as const;

const INTERVENSI: readonly Opsi[] = [
  { nilai: "orientasi", label: "Orientasi lingkungan & kamar" },
  { nilai: "tempatTidurRendah", label: "Tempat tidur posisi rendah, roda terkunci" },
  { nilai: "pagarTempatTidur", label: "Pagar tempat tidur terpasang" },
  { nilai: "belTerjangkau", label: "Bel & barang pribadi mudah dijangkau" },
  { nilai: "lantaiAman", label: "Lantai kering, penerangan cukup" },
  { nilai: "alasKaki", label: "Alas kaki anti-licin" },
  { nilai: "gelangKuning", label: "Gelang kuning risiko jatuh terpasang" },
  { nilai: "tandaRisiko", label: "Tanda risiko jatuh di tempat tidur / pintu" },
  { nilai: "pengawasan", label: "Pengawasan tiap 1–2 jam" },
  { nilai: "pendamping", label: "Keluarga mendampingi & diedukasi" },
  { nilai: "bantuMobilisasi", label: "Bantu mobilisasi & eliminasi" },
];

const PENGKAJIAN: readonly KolomBaris[] = [
  { jenis: "tanggalJam", id: "waktu", label: "Tanggal & jam", wajib: true },
  { jenis: "pilihan", id: "riwayatJatuh", label: "Riwayat jatuh (3 bulan terakhir)", wajib: true, opsi: yaTidak(25) },
  { jenis: "pilihan", id: "diagnosisSekunder", label: "Diagnosis sekunder (> 1 diagnosis)", wajib: true, opsi: yaTidak(15) },
  {
    jenis: "pilihan",
    id: "alatBantu",
    label: "Alat bantu berjalan",
    wajib: true,
    opsi: [
      { nilai: "tidakAda", label: "Tidak ada / bed rest / dibantu perawat", skor: 0 },
      { nilai: "tongkat", label: "Kruk / tongkat / walker", skor: 15 },
      { nilai: "furnitur", label: "Berpegangan pada furnitur", skor: 30 },
    ],
  },
  { jenis: "pilihan", id: "terapiIntravena", label: "Terapi intravena / heparin lock", wajib: true, opsi: yaTidak(20) },
  {
    jenis: "pilihan",
    id: "gayaBerjalan",
    label: "Gaya berjalan",
    wajib: true,
    opsi: [
      { nilai: "normal", label: "Normal / bed rest / kursi roda", skor: 0 },
      { nilai: "lemah", label: "Lemah", skor: 10 },
      { nilai: "terganggu", label: "Terganggu", skor: 20 },
    ],
  },
  {
    jenis: "pilihan",
    id: "statusMental",
    label: "Status mental",
    wajib: true,
    opsi: [
      { nilai: "baik", label: "Orientasi baik / sadar kemampuan diri", skor: 0 },
      { nilai: "lupa", label: "Lupa / tidak sadar keterbatasan diri", skor: 15 },
    ],
  },
  { jenis: "skor", id: "skor", label: "Total skor", dari: FAKTOR, kategori: KATEGORI_MORSE },
  { jenis: "pilihanGanda", id: "intervensi", label: "Intervensi pencegahan jatuh", opsi: INTERVENSI, lebar: 2 },
  { jenis: "teks", id: "petugasNama", label: "Nama perawat", wajib: true, maks: 120 },
  { jenis: "ttd", id: "paraf", label: "Paraf perawat", petugas: { jenis: "PARAF", kolomNama: "petugasNama", isiNamaOtomatis: true } },
];

/** Label kolom SIMRS baris pengkajian awal (penanda asal & muat ulang). */
const kolomAwal = (id: (typeof FAKTOR)[number] | "waktu" | "petugasNama", label: string) =>
  ({ path: `pengkajian.0.${id}`, label: `Pengkajian awal — ${label}`, sumber: "morse" }) as const;

export const morse = definisiDeklaratif({
  kode: "RM.MORSE",
  versi: 1,
  judul: "Pengkajian Risiko Jatuh Dewasa (Skala Morse)",
  kategori: "asesmen-keperawatan",
  cakupan: "EPISODE",
  berulang: false,
  // Dikaji di IGD & dikaji ulang selama rawat inap. Belum dihitung wajib
  // (kelengkapan) sampai kebijakan RS ditetapkan.
  sasaran: { jenis: [2, 3], jendelaJam: 72 },
  wajibUntuk: [],
  kertas: { ukuran: "A4", orientasi: "lanskap" },
  simrs: [
    {
      id: "pengkajianAwal",
      judul: "Pengkajian awal",
      kolom: [
        kolomAwal("waktu", "tanggal & jam"),
        kolomAwal("riwayatJatuh", "riwayat jatuh"),
        kolomAwal("diagnosisSekunder", "diagnosis sekunder"),
        kolomAwal("alatBantu", "alat bantu berjalan"),
        kolomAwal("terapiIntravena", "terapi intravena"),
        kolomAwal("gayaBerjalan", "gaya berjalan"),
        kolomAwal("statusMental", "status mental"),
        kolomAwal("petugasNama", "nama perawat"),
      ],
    },
  ],
  struktur: {
    bagian: [
      {
        id: "pengkajian",
        judul: "Pengkajian Risiko Jatuh",
        keterangan:
          "Kaji saat masuk, setiap pindah ruangan, bila kondisi berubah, setelah pasien jatuh, dan berkala sesuai kebijakan RS.",
        kolom: [
          {
            jenis: "tabel",
            id: "pengkajian",
            label: "Pengkajian",
            namaBaris: "Pengkajian",
            kolom: PENGKAJIAN,
            maksBaris: 20,
            barisAwal: 1,
            minBarisFinal: 1,
            cetak: "lajur",
          },
        ],
      },
      {
        id: "catatan",
        judul: "Interpretasi & Catatan",
        kolom: [
          {
            jenis: "info",
            id: "interpretasi",
            teks: "Skor 0–24: risiko rendah (pencegahan standar). 25–44: risiko sedang. ≥ 45: risiko tinggi (pencegahan risiko tinggi).",
          },
          { jenis: "teks", id: "catatan", label: "Catatan", maks: 1000, baris: 3, lebar: 3 },
        ],
      },
    ],
  },
});
