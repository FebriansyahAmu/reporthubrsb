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

// --- Normalisasi nilai referensi SIMGOS → opsi formulir --------------------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Cocokkan agama SIMGOS ("Katholik", "Kristen Protestan", …) → AGAMA_OPTS. */
export function matchAgama(raw: string): string {
  const n = norm(raw);
  if (!n) return "";
  if (n.includes("islam")) return "Islam";
  if (n.includes("protestan") || n.includes("kristen")) return "Protestan";
  if (n.includes("katol") || n.includes("kathol")) return "Katolik";
  if (n.includes("hindu")) return "Hindu";
  if (n.includes("budha") || n.includes("buddha")) return "Budha";
  return "";
}

/** Cocokkan status perkawinan SIMGOS → PERKAWINAN_OPTS (Duda/Janda per JK). */
export function matchPerkawinan(raw: string, jenisKelamin: string): string {
  const n = norm(raw);
  if (!n) return "";
  if (n.includes("cerai") || n.includes("janda") || n.includes("duda")) {
    return jenisKelamin === "Perempuan" ? "Janda" : "Duda";
  }
  if (n.includes("belum") || n.startsWith("tidak")) return "Tidak Kawin";
  if (n.includes("kawin") || n.includes("nikah")) return "Kawin";
  return "";
}

/** Cocokkan pekerjaan SIMGOS → PEKERJAAN_OPTS ("" bila tak ada padanan). */
export function matchPekerjaan(raw: string): string {
  const n = norm(raw);
  if (!n) return "";
  if (n.includes("pns") || n.includes("pegawainegeri")) return "PNS";
  if (n.includes("tni") || n.includes("polri") || n.includes("polisi")) return "TNI / POLRI";
  if (n.includes("swasta") || n.includes("wiraswasta")) return "Swasta";
  if (n.includes("petani") || n.includes("tani") || n.includes("nelayan")) return "Petani";
  if (n.includes("buruh")) return "Buruh";
  if (n.includes("karyawan")) return "Karyawan";
  return "";
}

/** Cocokkan pendidikan SIMGOS → {opt, lain}. Tak cocok → opt "" + lain=raw. */
export function matchPendidikan(raw: string): { opt: string; lain: string } {
  const n = norm(raw);
  if (!n) return { opt: "", lain: "" };
  if (n === "sd" || n.includes("sekolahdasar")) return { opt: "SD", lain: "" };
  if (n.includes("smp") || n.includes("sltp") || n.includes("mts")) return { opt: "SLTP", lain: "" };
  if (n.includes("sma") || n.includes("slta") || n.includes("smu") || n.includes("smk") || n.includes("ma"))
    return { opt: "SLTA", lain: "" };
  if (n.includes("akadem") || n.includes("diploma") || /d[1-4]/.test(n)) return { opt: "Akademik", lain: "" };
  if (
    n.includes("univ") ||
    n.includes("sarjana") ||
    n.includes("strata") ||
    /s[1-3]/.test(n)
  )
    return { opt: "Univ", lain: "" };
  // Tidak cocok (mis. "Tidak/Belum Sekolah") → tulis di kolom Lain-lain.
  return { opt: "", lain: raw.trim() };
}

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
