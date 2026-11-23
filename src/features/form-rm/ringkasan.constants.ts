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

/** Sebab Kematian II (penyakit lain) selalu tampil 3 baris di form & cetak. */
export const BARIS_SK_LAIN = 3;

/** Bentuk baku isian RM.01: baris Sebab Kematian II dilengkapi sampai 3. Idempoten. */
export function lengkapiRingkasan(f: RingkasanForm): RingkasanForm {
  const skLain = [...(Array.isArray(f.skLain) ? f.skLain : [])];
  while (skLain.length < BARIS_SK_LAIN) skLain.push({ teks: "", lama: "" });
  return { ...f, skLain };
}

const WAKTU_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Lama rawat (hari) = selisih TANGGAL keluar − masuk ("YYYY-MM-DDTHH:mm"); "" bila tak lengkap / terbalik. */
export function hitungLamaRawat(masuk: string, keluar: string): string {
  const a = WAKTU_RE.exec(masuk);
  const b = WAKTU_RE.exec(keluar);
  if (!a || !b) return "";
  const hari = (Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3])) / 86_400_000;
  return hari >= 0 ? String(hari) : "";
}

/* -------------------------------------------------- syarat FINAL & langkah */

export type KolomSyaratRingkasan = "dokterMerawatNama" | "dokterMerawatTtd" | "skA" | "dokterKematianNama" | "dokterKematianTtd";

/**
 * Satu syarat FINAL RM.01 — sumber tunggal registri (`syaratFinal`, diperiksa
 * server saat FINALKAN; pesan = `label`) dan panel "Syarat finalisasi" di layar.
 * Halaman 2 (sebab kematian) hanya bersyarat bila diaktifkan.
 */
export type SyaratRingkasan = { kolom: KolomSyaratRingkasan; label: string; ok: boolean; langkah: "keluar" | "kematian" };

type DataSyarat = Pick<
  RingkasanForm,
  "dokterMerawatNama" | "dokterMerawatTtd" | "sebabKematianAktif" | "skA" | "dokterKematianNama" | "dokterKematianTtd"
>;

const ada = (s: string | null | undefined) => (s ?? "").trim() !== "";

export function syaratRingkasan(d: DataSyarat): SyaratRingkasan[] {
  return [
    { kolom: "dokterMerawatNama", label: "Nama dokter yang merawat", ok: ada(d.dokterMerawatNama), langkah: "keluar" },
    { kolom: "dokterMerawatTtd", label: "Tanda tangan dokter yang merawat", ok: d.dokterMerawatTtd !== "", langkah: "keluar" },
    ...(d.sebabKematianAktif
      ? ([
          { kolom: "skA", label: "Sebab kematian langsung (I.a)", ok: ada(d.skA), langkah: "kematian" },
          { kolom: "dokterKematianNama", label: "Nama dokter pemberi keterangan sebab kematian", ok: ada(d.dokterKematianNama), langkah: "kematian" },
          {
            kolom: "dokterKematianTtd",
            label: "Tanda tangan dokter pemberi keterangan sebab kematian",
            ok: d.dokterKematianTtd !== "",
            langkah: "kematian",
          },
        ] as const)
      : []),
  ];
}

/** Syarat FINAL yang belum terpenuhi (label = pesan galat FINALKAN). */
export const kekuranganRingkasan = (d: DataSyarat): SyaratRingkasan[] => syaratRingkasan(d).filter((s) => !s.ok);

/** Kelompok langkah = halaman kertas. */
export const GRUP_RINGKASAN = { hal1: "Halaman 1: ringkasan", hal2: "Halaman 2: bila meninggal" } as const;

export const LANGKAH_RINGKASAN = [
  { id: "identitas", judul: "Identitas & keluarga terdekat", singkat: "Identitas", grup: GRUP_RINGKASAN.hal1 },
  { id: "sosial", judul: "Data sosial", singkat: "Sosial", grup: GRUP_RINGKASAN.hal1 },
  { id: "perawatan", judul: "Masuk & perawatan", singkat: "Perawatan", grup: GRUP_RINGKASAN.hal1 },
  { id: "diagnosa", judul: "Diagnosa akhir & catatan", singkat: "Diagnosa", grup: GRUP_RINGKASAN.hal1 },
  { id: "keluar", judul: "Keadaan keluar & dokter", singkat: "Keluar", grup: GRUP_RINGKASAN.hal1 },
  { id: "kematian", judul: "Sebab kematian", singkat: "Kematian", grup: GRUP_RINGKASAN.hal2 },
] as const;
export type IdLangkahRingkasan = (typeof LANGKAH_RINGKASAN)[number]["id"];
export type StatusLangkahRingkasan = "lengkap" | "sebagian" | "kosong";

const statusHitung = (n: number, total: number): StatusLangkahRingkasan => (n === 0 ? "kosong" : n >= total ? "lengkap" : "sebagian");
const hitungIsi = (...v: string[]) => v.filter(ada).length;

/**
 * Status & ringkasan tiap langkah layar isian. Halaman 1 sebagian besar kolom
 * opsional → status = banyaknya kolom terisi; langkah bersyarat FINAL (keluar,
 * kematian) → status = syarat terpenuhi. `sisa` = kolom/syarat yang belum (lencana
 * "n belum lengkap"). `meninggalSimrs` = SIMRS mencatat
 * pasien meninggal (halaman 2 perlu diisi walau belum diaktifkan).
 */
export function ringkasLangkahRingkasan(
  d: RingkasanForm,
  meninggalSimrs = false,
): Record<IdLangkahRingkasan, { status: StatusLangkahRingkasan; ket: string; sisa: number; kurang: SyaratRingkasan[] }> {
  const syarat = syaratRingkasan(d);
  const per = (l: "keluar" | "kematian") => syarat.filter((s) => s.langkah === l);
  const nIdentitas = hitungIsi(d.alamat, d.telp, d.dirawatKe, d.golDarah, d.keluargaNama, d.keluargaAlamat, d.keluargaTelp);
  const nSosial =
    hitungIsi(d.bangsa, d.agama, d.statusPerkawinan, d.pekerjaan, d.namaOrangTua, d.pekerjaanOrangTua) + (ada(d.pendidikan) || ada(d.pendidikanLain) ? 1 : 0);
  const nRawat = hitungIsi(d.caraMasuk, d.jenisPelayanan, d.tglMasuk, d.tglKeluar, d.lamaRawat, d.diagnosaSementara, d.dpjp, d.peserta, d.izinKeluar);
  const nDxLain = hitungIsi(d.diagnosaSekunder, d.komplikasi, d.penyebabLuar, d.operasi);
  const keluar = per("keluar");
  const okKeluar = keluar.filter((s) => s.ok).length;
  const mati = per("kematian");
  const okMati = mati.filter((s) => s.ok).length;
  const lain = nDxLain ? ` · ${nDxLain} diagnosa lain` : "";
  return {
    identitas: { status: statusHitung(nIdentitas, 7), ket: `${nIdentitas} dari 7 terisi`, sisa: 7 - nIdentitas, kurang: [] },
    sosial: { status: statusHitung(nSosial, 7), ket: `${nSosial} dari 7 terisi`, sisa: 7 - nSosial, kurang: [] },
    perawatan: { status: statusHitung(nRawat, 9), ket: `${nRawat} dari 9 terisi`, sisa: 9 - nRawat, kurang: [] },
    diagnosa: {
      status: ada(d.diagnosaUtama) && ada(d.diagnosaUtamaKode) ? "lengkap" : ada(d.diagnosaUtama) || ada(d.diagnosaUtamaKode) || nDxLain > 0 ? "sebagian" : "kosong",
      ket: !ada(d.diagnosaUtama)
        ? `Diagnosa utama belum diisi${lain}`
        : ada(d.diagnosaUtamaKode)
          ? `Diagnosa utama & kode terisi${lain}`
          : `Kode ICD diagnosa utama belum diisi${lain}`,
      sisa: 2 - hitungIsi(d.diagnosaUtama, d.diagnosaUtamaKode),
      kurang: [],
    },
    keluar: {
      status: statusHitung(okKeluar, keluar.length),
      ket: `${okKeluar} dari ${keluar.length} syarat terpenuhi`,
      sisa: keluar.length - okKeluar,
      kurang: keluar.filter((s) => !s.ok),
    },
    kematian: d.sebabKematianAktif
      ? {
          status: statusHitung(okMati, mati.length),
          ket: `${okMati} dari ${mati.length} syarat terpenuhi`,
          sisa: mati.length - okMati,
          kurang: mati.filter((s) => !s.ok),
        }
      : { status: "kosong", ket: meninggalSimrs ? "SIMRS: pasien meninggal — perlu diisi" : "Tidak dipakai (pasien tidak meninggal)", sisa: 0, kurang: [] },
  };
}
