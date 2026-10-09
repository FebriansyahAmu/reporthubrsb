import {
  adaIsi,
  aturanTtd,
  bila,
  JENIS_INFORMASI,
  kosong,
  kurangInformasi,
  kurangPihak,
  kurangSaksi,
  kurangTerhadap,
  kurangTtdInformasi,
  kurangYangMenyatakan,
  pemberianInformasiKosong,
  saksiKosong,
  statusDari,
  yangMenyatakanKosong,
  type DataPemberianInformasi,
  type DataSaksi,
  type DataYangMenyatakan,
  type StatusLangkah,
} from "./persetujuan/informasi";

/**
 * Acuan formulir **RM.22 — Informasi dan Persetujuan / Penolakan Tindakan
 * Kedokteran** (kertas F4 potret, 2 lembar: persetujuan & penolakan). Teks,
 * nomor, dan urutan baris 1:1 dengan formulir resmi RS; bagian yang sama
 * dengan RM.33 ada di `persetujuan/informasi.ts`. Murni & aman untuk klien.
 *
 * Satu isian = satu tindakan (form berulang). Bagian PEMBERIAN INFORMASI sama
 * di kedua lembar; `lembar` menentukan pernyataan yang ditandatangani.
 */

export const RM22_KOTA = "Modayag";

export const LEMBAR_RM22 = ["persetujuan", "penolakan"] as const;
export type LembarRm22 = (typeof LEMBAR_RM22)[number];

export const META_LEMBAR: Record<
  LembarRm22,
  { label: string; judul: string; bagian: string; kata: string; ringkas: string }
> = {
  persetujuan: {
    label: "Lembar Persetujuan",
    judul: "INFORMASI DAN PERSETUJUAN TINDAKAN KEDOKTERAN",
    bagian: "PERSETUJUAN TINDAKAN KEDOKTERAN",
    kata: "persetujuan",
    ringkas: "Pasien / wali menyetujui tindakan",
  },
  penolakan: {
    label: "Lembar Penolakan",
    judul: "INFORMASI DAN PENOLAKAN TINDAKAN KEDOKTERAN",
    bagian: "PENOLAKAN TINDAKAN KEDOKTERAN",
    kata: "penolakan",
    ringkas: "Pasien / wali menolak tindakan",
  },
};

export const TEKS_RM22 = {
  memahami:
    "Saya memahami perlunya dan manfaat tindakan tersebut sebagaimana telah dijelaskan seperti di atas kepada saya, termasuk risiko dan komplikasi yang mungkin timbul.",
} as const;

/** Data isian RM.22 (sama dengan keluaran `rm22FormSchema`). */
export type Rm22Data = DataPemberianInformasi &
  DataYangMenyatakan &
  DataSaksi & {
    lembar: "" | LembarRm22;
    tindakan: string;
    tanggal: string;
    pernyataTtd: string;
  };

export function emptyRm22Form(): Rm22Data {
  return {
    lembar: "",
    ...pemberianInformasiKosong(),
    ...yangMenyatakanKosong(),
    tindakan: "",
    tanggal: "",
    pernyataTtd: "",
    ...saksiKosong(),
  };
}

/* ------------------------------------------------------------ alur pengisian */

/**
 * Alur pengisian (urutan = urutan di layar). Kekurangan tiap langkah juga
 * menjadi syarat FINAL — satu sumber untuk penanda progres dan validasi server.
 */
export const LANGKAH_RM22 = [
  { id: "pihak", judul: "Pemberian informasi" },
  { id: "informasi", judul: "Isi informasi" },
  { id: "ttdInformasi", judul: "Tanda tangan informasi" },
  { id: "lembar", judul: "Keputusan pasien" },
  { id: "pernyataan", judul: "Pernyataan" },
  { id: "ttdPernyataan", judul: "Tanda tangan & saksi" },
] as const;
export type IdLangkah = (typeof LANGKAH_RM22)[number]["id"];

/** Kekurangan per langkah (kosong = langkah lengkap). Defensif terhadap data lama/parsial. */
export function kekuranganRm22(d: Rm22Data): Record<IdLangkah, string[]> {
  const kataTindakan = d.lembar === "penolakan" ? "ditolak" : d.lembar === "persetujuan" ? "disetujui" : "dinyatakan";
  return {
    pihak: kurangPihak(d),
    informasi: kurangInformasi(d),
    ttdInformasi: kurangTtdInformasi(d),
    lembar: bila(d.lembar !== "persetujuan" && d.lembar !== "penolakan", "Keputusan: lembar persetujuan atau penolakan"),
    pernyataan: [
      ...kurangYangMenyatakan(d),
      ...bila(kosong(d.tindakan), `Tindakan yang ${kataTindakan}`),
      ...kurangTerhadap(d, "Tindakan"),
      ...bila(kosong(d.tanggal), "Tanggal pernyataan"),
    ],
    ttdPernyataan: [...bila(d.pernyataTtd === "", "Tanda tangan yang menyatakan"), ...kurangSaksi(d)],
  };
}

/** Slot TTD yang mengikat pernyataan persetujuan/penolakan (bukan TTD pemberian informasi). */
export const TTD_PERNYATAAN = ["pernyataTtd", "saksi1Ttd", "saksi2Ttd"] as const;

export const PESAN_GANTI_LEMBAR =
  "Lembar diganti: tanda tangan yang menyatakan dan saksi harus dibuat ulang untuk lembar yang baru.";

/**
 * TTD pernyataan & saksi terikat pada lembar dan slot (lihat `aturanTtd`); yang
 * menyatakan boleh memakai ulang TTD penerima informasi yang tersimpan. Dijaga
 * di server saat simpan; UI mengosongkan TTD pernyataan dengan konfirmasi saat
 * ganti lembar.
 */
export const cekTtdPernyataan = aturanTtd({
  kunci: "lembar",
  informasi: ["pemberiTtd", "penerimaTtd"],
  pernyataan: TTD_PERNYATAAN,
  pakaiUlang: { pernyataTtd: "penerimaTtd" },
  pesanGanti: PESAN_GANTI_LEMBAR,
});

export function statusLangkah(d: Rm22Data, id: IdLangkah, kurang: readonly string[]): StatusLangkah {
  const tersentuh: Record<IdLangkah, boolean> = {
    pihak: adaIsi(d.dokterPelaksana, d.pemberiInformasi, d.penerimaInformasi),
    informasi: JENIS_INFORMASI.some((j) => !kosong(d.informasi?.[j.id]?.isi)),
    ttdInformasi: adaIsi(d.pemberiTtd, d.penerimaTtd),
    lembar: d.lembar !== "",
    pernyataan: adaIsi(d.pernyataNama, d.pernyataUmur, d.pernyataAlamat, d.tindakan, d.hubungan) || d.terhadap !== "",
    ttdPernyataan: adaIsi(d.pernyataTtd, d.saksi1Nama, d.saksi1Ttd, d.saksi2Nama, d.saksi2Ttd),
  };
  return statusDari(kurang, tersentuh[id]);
}

/** Ringkasan satu isian untuk daftar isian per pasien (form berulang). */
export function ringkasRm22(d: Partial<Rm22Data> | null | undefined): {
  judul: string;
  lencana: { label: string; nada: "success" | "danger" | "warning" };
} {
  const tindakan = (d?.tindakan ?? "").trim() || (d?.informasi?.tindakan?.isi ?? "").trim();
  const lembar = d?.lembar === "persetujuan" || d?.lembar === "penolakan" ? d.lembar : null;
  return {
    judul: tindakan || "Tindakan belum diisi",
    lencana: lembar
      ? { label: lembar === "persetujuan" ? "Persetujuan" : "Penolakan", nada: lembar === "persetujuan" ? "success" : "danger" }
      : { label: "Keputusan belum dipilih", nada: "warning" },
  };
}
