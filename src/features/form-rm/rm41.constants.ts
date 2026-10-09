import { adaIsi, aturanTtd, bila, kosong, statusDari, tanggalPanjang, type JkPilihan, type StatusLangkah } from "./persetujuan/informasi";

/**
 * Acuan formulir **RM.41 — Surat Pernyataan Pulang Atas Permintaan Sendiri**
 * (kertas F4 potret, satu lembar). Teks 1:1 dengan formulir resmi RS. Murni &
 * aman untuk klien: dipakai skema, registri (syarat FINAL & aturan TTD),
 * tampilan form, cetak, dan pemetaan SIMRS.
 *
 * Satu isian per episode (pasien pulang sekali). Pilihan "Selaku diri sendiri /
 * suami / … / saudara" dicoret yang tidak berlaku saat dicetak; TTD yang
 * menyatakan terikat padanya.
 */

export const RM41_KOTA = "Modayag";

/** "Selaku diri sendiri / suami / istri / ayah / ibu / anak / saudara dari pasien" (urutan kertas). */
export const SELAKU_RM41 = ["diri", "suami", "istri", "ayah", "ibu", "anak", "saudara"] as const;
export type SelakuRm41 = (typeof SELAKU_RM41)[number];

/** Teks pilihan persis seperti tercetak. */
export const TEKS_SELAKU: Record<SelakuRm41, string> = {
  diri: "diri sendiri",
  suami: "suami",
  istri: "istri",
  ayah: "ayah",
  ibu: "ibu",
  anak: "anak",
  saudara: "saudara",
};

/** Label layar (huruf besar di awal). */
export const LABEL_SELAKU: Record<SelakuRm41, string> = {
  diri: "Diri sendiri",
  suami: "Suami",
  istri: "Istri",
  ayah: "Ayah",
  ibu: "Ibu",
  anak: "Anak",
  saudara: "Saudara",
};

export const TEKS_RM41 = {
  judul: "SURAT PERNYATAAN PULANG ATAS PERMINTAAN SENDIRI",
  pembuka: "Yang bertanda tangan di bawah ini :",
  menyatakan: "Dengan ini menyatakan dengan sesungguhnya bahwa :",
  butir1Awal: "Dengan sadar tanpa paksaan dari pihak manapun kepada pihak RSUD Bolaang Mongondow Timur untuk",
  aps: "PULANG ATAS PERMINTAAN SENDIRI",
  butir1Akhir: "yang merupakan hak saya / pasien dengan alasan",
  butir2:
    "Saya telah memahami sepenuhnya penjelasan yang diberikan dari pihak rumah sakit mengenai penyakit dan kemungkinan / konsekuensi terbaik sampai dengan terburuk atas keputusan yang saya ambil. Serta tanggung jawab saya dalam mengambil keputusan ini.",
  butir3:
    "Apabila terjadi sesuatu hal yang berkait dengan putusan yang telah diambil, maka hal tersebut adalah menjadi tanggung jawab pasien / keluarga sepenuhnya dan tidak akan menyangkut pautkan / menuntut rumah sakit ini.",
  butir4: "Atas putusan saya ini, rumah sakit telah memberikan penjelasan mengenai alternatif pengobatan selanjutnya.",
  penutup: "Demikianlah pernyataan ini saya buat dengan sebenar-benarnya.",
  namaTtd: "Nama jelas & Tanda tangan",
} as const;

/** Data isian RM.41 (sama dengan keluaran `rm41FormSchema`). */
export type Rm41Data = {
  /** Yang bertanda tangan di bawah ini. */
  pernyataNama: string;
  pernyataUmur: string;
  pernyataAlamat: string;
  selaku: "" | SelakuRm41;
  /** Pasien (terisi dari SIMRS). */
  pasienNama: string;
  pasienJk: "" | JkPilihan;
  pasienTglLahir: string;
  pasienNorm: string;
  alasan: string;
  /** "Modayag, [tanggal], Jam : [jam] WITA" — "YYYY-MM-DDTHH:mm". */
  waktu: string;
  petugasNama: string;
  petugasTtd: string;
  saksiNama: string;
  saksiTtd: string;
  pernyataTtd: string;
};

export function emptyRm41Form(): Rm41Data {
  return {
    pernyataNama: "",
    pernyataUmur: "",
    pernyataAlamat: "",
    selaku: "",
    pasienNama: "",
    pasienJk: "",
    pasienTglLahir: "",
    pasienNorm: "",
    alasan: "",
    waktu: "",
    petugasNama: "",
    petugasTtd: "",
    saksiNama: "",
    saksiTtd: "",
    pernyataTtd: "",
  };
}

const WAKTU_RE = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;

/** "2026-10-09T14:05" → { tanggal: "9 Oktober 2026", jam: "14.05" }; kosong bila tak valid. */
export function pisahWaktu(waktu: string): { tanggal: string; jam: string } {
  const m = WAKTU_RE.exec((waktu ?? "").trim());
  const tanggal = m ? tanggalPanjang(m[1]) : "";
  return tanggal ? { tanggal, jam: `${m![2]}.${m![3]}` } : { tanggal: "", jam: "" };
}

/* ------------------------------------------------------------ alur pengisian */

/**
 * Alur pengisian (urutan = urutan di layar). Kekurangan tiap langkah juga
 * menjadi syarat FINAL — satu sumber untuk penanda progres dan validasi server.
 */
export const LANGKAH_RM41 = [
  { id: "pernyata", judul: "Yang menyatakan" },
  { id: "pasien", judul: "Data pasien" },
  { id: "alasan", judul: "Alasan & pernyataan" },
  { id: "ttd", judul: "Waktu & tanda tangan" },
] as const;
export type IdLangkahRm41 = (typeof LANGKAH_RM41)[number]["id"];

export function kekuranganRm41(d: Rm41Data): Record<IdLangkahRm41, string[]> {
  return {
    pernyata: [
      ...bila(!(SELAKU_RM41 as readonly string[]).includes(d.selaku), "Selaku: diri sendiri atau hubungan dengan pasien"),
      ...bila(kosong(d.pernyataNama), "Nama yang menyatakan"),
      ...bila(kosong(d.pernyataUmur), "Umur yang menyatakan"),
      ...bila(kosong(d.pernyataAlamat), "Alamat yang menyatakan"),
    ],
    pasien: [
      ...bila(kosong(d.pasienNama), "Nama pasien"),
      ...bila(d.pasienJk === "", "Jenis kelamin pasien (L / P)"),
      ...bila(!tanggalPanjang(d.pasienTglLahir ?? ""), "Tanggal lahir pasien"),
      ...bila(kosong(d.pasienNorm), "Nomor RM pasien"),
    ],
    alasan: bila(kosong(d.alasan), "Alasan pulang atas permintaan sendiri"),
    ttd: [
      ...bila(!pisahWaktu(d.waktu).tanggal, "Tanggal & jam pernyataan"),
      ...bila(kosong(d.petugasNama), "Nama petugas RS"),
      ...bila(d.petugasTtd === "", "Tanda tangan petugas RS"),
      ...bila(kosong(d.saksiNama), "Nama saksi"),
      ...bila(d.saksiTtd === "", "Tanda tangan saksi"),
      ...bila(d.pernyataTtd === "", "Tanda tangan yang menyatakan"),
    ],
  };
}

export function statusLangkahRm41(d: Rm41Data, id: IdLangkahRm41, kurang: readonly string[]): StatusLangkah {
  const tersentuh: Record<IdLangkahRm41, boolean> = {
    pernyata: d.selaku !== "" || adaIsi(d.pernyataNama, d.pernyataUmur, d.pernyataAlamat),
    pasien: d.pasienJk !== "" || adaIsi(d.pasienNama, d.pasienTglLahir, d.pasienNorm),
    alasan: adaIsi(d.alasan),
    ttd: adaIsi(d.waktu, d.petugasNama, d.petugasTtd, d.saksiNama, d.saksiTtd, d.pernyataTtd),
  };
  return statusDari(kurang, tersentuh[id]);
}

/* ------------------------------------------------------------ aturan TTD */

export const PESAN_GANTI_SELAKU =
  "Status yang menyatakan (diri sendiri / hubungan dengan pasien) diganti: tanda tangan yang menyatakan harus dibuat ulang.";

/**
 * TTD petugas & saksi terikat pada slotnya (tak bisa dipindah antar-slot); TTD
 * yang menyatakan juga terikat pada `selaku` — kalimat "Selaku …" yang
 * ditandatangani berbeda. Lihat `aturanTtd` (slot "informasi" = terikat slot saja).
 */
export const cekTtdRm41 = aturanTtd({
  kunci: "selaku",
  informasi: ["petugasTtd", "saksiTtd"],
  pernyataan: ["pernyataTtd"],
  pakaiUlang: {},
  pesanGanti: PESAN_GANTI_SELAKU,
});
