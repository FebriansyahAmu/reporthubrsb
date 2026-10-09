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
  tanggalPanjang,
  yangMenyatakanKosong,
  type DataPemberianInformasi,
  type DataSaksi,
  type DataYangMenyatakan,
  type StatusLangkah,
} from "./persetujuan/informasi";

/**
 * Acuan formulir **RM.33 — Informasi dan Persetujuan / Penundaan & Penolakan
 * Rujukan** (kertas F4 potret, 2 lembar). Lembar 1 "INFORMASI DAN PERSETUJUAN
 * RUJUKAN" (berkop), lembar 2 "INFORMASI PENUNDAAN DAN PENOLAKAN RUJUKAN"
 * (tanpa kop, pilihan MENUNDA/MENOLAK dicoret salah satu). Teks 1:1 dengan
 * formulir resmi RS; bagian yang sama dengan RM.22 ada di
 * `persetujuan/informasi.ts`. Murni & aman untuk klien.
 *
 * Satu isian = satu rujukan (form berulang). `keputusan` menentukan lembar dan
 * pernyataan yang ditandatangani — TTD pernyataan terikat padanya.
 */

export const RM33_KOTA = "Sumber Rejo";

export const KEPUTUSAN_RM33 = ["setuju", "menunda", "menolak"] as const;
export type KeputusanRm33 = (typeof KEPUTUSAN_RM33)[number];

export type LembarRm33 = "persetujuan" | "penundaan";

export const META_LEMBAR_RM33: Record<LembarRm33, { label: string; judul: string; bagian: string }> = {
  persetujuan: {
    label: "Lembar Persetujuan Rujukan",
    judul: "INFORMASI DAN PERSETUJUAN RUJUKAN",
    bagian: "PERSETUJUAN RUJUKAN",
  },
  penundaan: {
    label: "Lembar Penundaan & Penolakan Rujukan",
    judul: "INFORMASI PENUNDAAN DAN PENOLAKAN RUJUKAN",
    bagian: "PENUNDAAN DAN PENOLAKAN RUJUKAN",
  },
};

export const META_KEPUTUSAN: Record<
  KeputusanRm33,
  { label: string; ringkas: string; lencana: string; nada: "success" | "warning" | "danger"; kata: string; lembar: LembarRm33 }
> = {
  setuju: {
    label: "Setuju dirujuk",
    ringkas: "Pasien / wali menyetujui rujukan",
    lencana: "Setuju",
    nada: "success",
    kata: "SETUJU",
    lembar: "persetujuan",
  },
  menunda: {
    label: "Menunda rujukan",
    ringkas: "Pasien / wali menunda rujukan",
    lencana: "Menunda",
    nada: "warning",
    kata: "MENUNDA",
    lembar: "penundaan",
  },
  menolak: {
    label: "Menolak rujukan",
    ringkas: "Pasien / wali menolak rujukan",
    lencana: "Menolak",
    nada: "danger",
    kata: "MENOLAK",
    lembar: "penundaan",
  },
};

export const lembarRm33 = (k: "" | KeputusanRm33): LembarRm33 | null => (k ? META_KEPUTUSAN[k].lembar : null);

export const TEKS_RM33 = {
  menyatakan: "untuk rujuk tanggal",
  memahami: "Saya memahami perlunya dan manfaat dilakukan rujuk",
  memahamiLanjut:
    "sebagaimana telah dijelaskan seperti di atas kepada saya, termasuk risiko dan komplikasi yang mungkin timbul. Saya juga menyadari bahwa oleh karena ilmu kedokteran bukanlah ilmu pasti, maka keberhasilan tindakan kedokteran bukanlah keniscayaan, melainkan sangat bergantung kepada izin Tuhan Yang Maha Esa.",
  /** Catatan kaki baris tanda tangan: siapa yang lazim menandatangani. */
  catatanTtd: "Dokter yang menindak, istri / suami / ayah / ibu / mertua / perawat",
} as const;

/** Data isian RM.33 (sama dengan keluaran `rm33FormSchema`). */
export type Rm33Data = DataPemberianInformasi &
  DataYangMenyatakan &
  DataSaksi & {
    keputusan: "" | KeputusanRm33;
    /** Rumah sakit / fasilitas tujuan (+ poli), mis. "RSUP Prof. DR. R. D. Kandou (Penyakit Dalam)". */
    tujuanRujukan: string;
    tanggalRujuk: string;
    tanggal: string;
    pernyataTtd: string;
    /** Kolom "Dokter" di baris tanda tangan pernyataan (dokter yang menindak). */
    dokterNama: string;
    dokterTtd: string;
  };

export function emptyRm33Form(): Rm33Data {
  return {
    keputusan: "",
    tujuanRujukan: "",
    tanggalRujuk: "",
    ...pemberianInformasiKosong(),
    ...yangMenyatakanKosong(),
    tanggal: "",
    pernyataTtd: "",
    dokterNama: "",
    dokterTtd: "",
    ...saksiKosong(),
  };
}

/** "RSUP X" → "ke RSUP X" untuk rumpang "rujuk ___" (tanpa "ke" ganda bila sudah diketik). */
export const keTujuan = (tujuan: string): string => {
  const t = tujuan.trim().replace(/\s+/g, " ");
  return !t ? "" : /^ke\s/i.test(t) ? t : `ke ${t}`;
};

/** Isi saran informasi no. 3 "Tindakan Kedokteran" untuk rujukan. */
export const tindakanRujukan = (tujuan: string): string => {
  const ke = keTujuan(tujuan);
  return ke ? `Rujukan ${ke}` : "";
};

/* ------------------------------------------------------------ alur pengisian */

/**
 * Alur pengisian (urutan = urutan di layar). Kekurangan tiap langkah juga
 * menjadi syarat FINAL — satu sumber untuk penanda progres dan validasi server.
 * Judul ringkas (TTD = tanda tangan) agar tujuh langkah muat satu baris navigasi.
 */
export const LANGKAH_RM33 = [
  { id: "rujukan", judul: "Rujukan" },
  { id: "pihak", judul: "Pemberian informasi" },
  { id: "informasi", judul: "Isi informasi" },
  { id: "ttdInformasi", judul: "TTD informasi" },
  { id: "keputusan", judul: "Keputusan" },
  { id: "pernyataan", judul: "Pernyataan" },
  { id: "ttdPernyataan", judul: "TTD & saksi" },
] as const;
export type IdLangkahRm33 = (typeof LANGKAH_RM33)[number]["id"];

export function kekuranganRm33(d: Rm33Data): Record<IdLangkahRm33, string[]> {
  return {
    rujukan: [
      ...bila(kosong(d.tujuanRujukan), "Tujuan rujukan (rumah sakit / fasilitas)"),
      ...bila(!tanggalPanjang(d.tanggalRujuk ?? ""), "Tanggal rujuk"),
    ],
    pihak: kurangPihak(d),
    informasi: kurangInformasi(d),
    ttdInformasi: kurangTtdInformasi(d),
    keputusan: bila(!(KEPUTUSAN_RM33 as readonly string[]).includes(d.keputusan), "Keputusan: setuju, menunda, atau menolak rujukan"),
    pernyataan: [...kurangYangMenyatakan(d), ...kurangTerhadap(d, "Rujukan"), ...bila(kosong(d.tanggal), "Tanggal pernyataan")],
    ttdPernyataan: [
      ...bila(d.pernyataTtd === "", "Tanda tangan yang menyatakan"),
      ...bila(kosong(d.dokterNama), "Nama dokter"),
      ...bila(d.dokterTtd === "", "Tanda tangan dokter"),
      ...kurangSaksi(d),
    ],
  };
}

export function statusLangkahRm33(d: Rm33Data, id: IdLangkahRm33, kurang: readonly string[]): StatusLangkah {
  const tersentuh: Record<IdLangkahRm33, boolean> = {
    rujukan: adaIsi(d.tujuanRujukan, d.tanggalRujuk),
    pihak: adaIsi(d.dokterPelaksana, d.pemberiInformasi, d.penerimaInformasi),
    informasi: JENIS_INFORMASI.some((j) => !kosong(d.informasi?.[j.id]?.isi)),
    ttdInformasi: adaIsi(d.pemberiTtd, d.penerimaTtd),
    keputusan: d.keputusan !== "",
    pernyataan: adaIsi(d.pernyataNama, d.pernyataUmur, d.pernyataAlamat, d.hubungan) || d.terhadap !== "",
    ttdPernyataan: adaIsi(d.pernyataTtd, d.dokterTtd, d.saksi1Nama, d.saksi1Ttd, d.saksi2Nama, d.saksi2Ttd),
  };
  return statusDari(kurang, tersentuh[id]);
}

/* ------------------------------------------------------------ aturan TTD */

/** Slot TTD yang mengikat pernyataan keputusan (bukan TTD pemberian informasi). */
export const TTD_PERNYATAAN_RM33 = ["pernyataTtd", "dokterTtd", "saksi1Ttd", "saksi2Ttd"] as const;

export const PESAN_GANTI_KEPUTUSAN =
  "Keputusan diganti: tanda tangan yang menyatakan, dokter, dan saksi harus dibuat ulang untuk keputusan yang baru.";

/**
 * TTD pernyataan, dokter, & saksi terikat pada keputusan (setuju / menunda /
 * menolak — kalimat yang ditandatangani berbeda) dan slotnya. Yang menyatakan
 * boleh memakai ulang TTD penerima informasi tersimpan; dokter boleh memakai
 * ulang TTD pemberi informasi tersimpan (lihat `aturanTtd`).
 */
export const cekTtdRm33 = aturanTtd({
  kunci: "keputusan",
  informasi: ["pemberiTtd", "penerimaTtd"],
  pernyataan: TTD_PERNYATAAN_RM33,
  pakaiUlang: { pernyataTtd: "penerimaTtd", dokterTtd: "pemberiTtd" },
  pesanGanti: PESAN_GANTI_KEPUTUSAN,
});

/* -------------------------------------------------------------- ringkasan */

/** Ringkasan satu isian untuk daftar isian per pasien (form berulang). */
export function ringkasRm33(d: Partial<Rm33Data> | null | undefined): {
  judul: string;
  lencana: { label: string; nada: "success" | "warning" | "danger" | "neutral" };
} {
  const tujuan = typeof d?.tujuanRujukan === "string" ? d.tujuanRujukan.trim() : "";
  const k = d?.keputusan && (KEPUTUSAN_RM33 as readonly string[]).includes(d.keputusan) ? META_KEPUTUSAN[d.keputusan] : null;
  return {
    judul: tujuan ? `Rujuk ${keTujuan(tujuan)}` : "Tujuan rujukan belum diisi",
    lencana: k ? { label: k.lencana, nada: k.nada } : { label: "Keputusan belum dipilih", nada: "neutral" },
  };
}
