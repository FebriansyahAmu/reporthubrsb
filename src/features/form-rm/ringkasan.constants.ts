import type { RingkasanForm } from "@/server/modules/form-rm/form-rm.types";

/** Jenis form RM (discriminator baris `form_rm`). */
export const RINGKASAN_JENIS = "ringkasan";

// --- Opsi checkbox (mengikuti formulir RM.01 asli) -------------------------
export const PENDIDIKAN_OPTS = ["Akademik", "SD", "SLTP", "SLTA", "Univ"];
export const BANGSA_OPTS = ["Indonesia", "Asing"];
export const AGAMA_OPTS = ["Islam", "Protestan", "Katolik", "Hindu", "Budha"];
export const PERKAWINAN_OPTS = ["Kawin", "Tidak Kawin", "Duda", "Janda"];
export const PEKERJAAN_OPTS = ["PNS", "TNI / POLRI", "Swasta", "Petani", "Buruh", "Karyawan"];
export const CARA_MASUK_OPTS = ["RS / RB", "Puskesmas", "Dokter", "Paramedis", "Sendiri", "Polisi"];
export const JENIS_PELAYANAN_OPTS = ["Non Bedah", "Bedah", "Kes. Anak", "Kebidanan", "ICU", "Bayi"];
export const PESERTA_OPTS = ["BPJS", "Asuransi", "Umum"];
export const IZIN_KELUAR_OPTS = [
  "Atas Persetujuan",
  "Atas Permintaan Sendiri",
  "Pindah Rumah Sakit Lain",
  "Melarikan Diri",
];
export const IMUNISASI_OPTS = [
  "BCG",
  "D.P.T",
  "Poliomielitis",
  "Tetanus Toxoid",
  "Campak",
  "Hepatitis B",
];
export const KEADAAN_KELUAR_OPTS = [
  "Sembuh",
  "Membaik",
  "Belum Sembuh",
  "Mati ≤ 48 Jam",
  "Mati ≥ 48 Jam",
];
export const RUDA_PAKSA_OPTS = ["Bunuh diri", "Pembunuhan", "Kecelakaan"];

/** Formulir RM.01 kosong (semua field terisi default aman). */
export function emptyRingkasanForm(): RingkasanForm {
  return {
    alamat: "",
    telp: "",
    dirawatKe: "",
    golDarah: "",
    pendidikan: "",
    pendidikanLain: "",
    bangsa: "",
    agama: "",
    statusPerkawinan: "",
    pekerjaan: "",
    caraMasuk: "",
    jenisPelayanan: "",
    namaOrangTua: "",
    pekerjaanOrangTua: "",
    keluargaNama: "",
    keluargaAlamat: "",
    keluargaTelp: "",
    tglMasuk: "",
    tglKeluar: "",
    lamaRawat: "",
    diagnosaSementara: "",
    dpjp: "",
    peserta: "",
    izinKeluar: "",
    diagnosaUtama: "",
    diagnosaUtamaKode: "",
    diagnosaSekunder: "",
    diagnosaSekunderKode: "",
    komplikasi: "",
    komplikasiKode: "",
    penyebabLuar: "",
    penyebabLuarKode: "",
    operasi: "",
    operasiKode: "",
    catatan: "",
    infeksiNosokomial: "",
    penyebabInfeksiNosokomial: "",
    imunisasi: [],
    dokterMerawatNama: "",
    dokterMerawatTtd: "",
    keadaanKeluar: "",
    sebabKematianAktif: false,
    skA: "",
    skALama: "",
    skB: "",
    skBLama: "",
    skC: "",
    skCLama: "",
    skLain: [
      { teks: "", lama: "" },
      { teks: "", lama: "" },
      { teks: "", lama: "" },
    ],
    rudaPaksaMacam: "",
    rudaPaksaCara: "",
    rudaPaksaSifat: "",
    lahirMatiJanin: "",
    lahirMatiSebab: "",
    persalinan: "",
    kehamilan: "",
    operasiKhususAda: "",
    operasiKhususJenis: "",
    sebabKematianTanggal: "",
    dokterKematianNama: "",
    dokterKematianTtd: "",
  };
}
