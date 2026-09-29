import type { TriaseForm } from "@/server/modules/form-rm/form-rm.types";

/** Jenis form RM (discriminator baris `form_rm`) untuk Triase IGD. */
export const TRIASE_JENIS = "triase";

/** Kop cetak RM.04 (sesuai formulir asli). */
export const TRIASE_RS = {
  nama: "RSUD BOLAANG MONGONDOW TIMUR",
  alamat: [
    "Jl. Amurang-Kotamobagu Desa Sumber Rejo",
    "E-mail : boltimrsd@gmail.com Modayag- Bolaang mongondow timur",
  ],
};

export const CARA_DATANG_OPTS = ["Sendiri", "Ambulans", "Diantar", "Lain-lain"] as const;
export const KASUS_OPTS = ["Non Trauma", "Trauma"] as const;
export const KECELAKAAN_OPTS = [
  "Kecelakaan Rumah Tangga",
  "Kecelakaan Lalu Lintas",
  "Kecelakaan Kerja",
  "Kecelakaan Air",
  "Kecelakaan Pejalan Kaki",
] as const;
export const EMERGENCY_OPTS = ["True Emergency", "False Emergency"] as const;

export type TriaseKat = 1 | 2 | 3 | 4 | 5;

/** Lima kolom kategori formulir — waktu respon & ruang observasi = baris tetap di kertas. */
export const TRIASE_KATEGORI: readonly {
  no: TriaseKat;
  romawi: string;
  label: string;
  /** Warna kolom di formulir kertas. */
  warna: "merah" | "kuning" | "hijau";
  /** Teks baris "Kesadaran" (tanpa kotak centang di kertas — dilingkari). */
  gcs: string;
  respon: string;
  observasi: string;
  /** Nama kategori padanan di triase SIMRS. */
  simrs: string;
}[] = [
  { no: 1, romawi: "I", label: "Kategori I", warna: "merah", gcs: "GCS ≤ 9", respon: "Segera < 5 menit", observasi: "Ruang Resusitasi", simrs: "Resusitasi" },
  { no: 2, romawi: "II", label: "Kategori II", warna: "merah", gcs: "GCS 9 – 12", respon: "< 10 menit", observasi: "Ruang Resusitasi", simrs: "Emergency" },
  { no: 3, romawi: "III", label: "Kategori III", warna: "kuning", gcs: "GCS ≥ 12", respon: "30 menit", observasi: "Ruang Observasi / Ruang tindakan", simrs: "Urgent" },
  { no: 4, romawi: "IV", label: "Kategori IV", warna: "kuning", gcs: "GCS 15", respon: "60 menit", observasi: "Ruang Observasi / Ruang tindakan", simrs: "Less Urgent" },
  { no: 5, romawi: "V", label: "Kategori V", warna: "hijau", gcs: "GCS 15", respon: "120 menit", observasi: "Ruang Observasi / Ruang tindakan", simrs: "Non Urgent" },
];

export type TriaseAspekKey = "a" | "b" | "c" | "d";

/** Baris pemeriksaan (Kesadaran disisipkan di antara Sirkulasi & Tanda Lain). */
export const TRIASE_ASPEK: readonly { key: TriaseAspekKey; label: string; en: string }[] = [
  { key: "a", label: "Jalan Napas", en: "Airway" },
  { key: "b", label: "Pernapasan", en: "Breathing" },
  { key: "c", label: "Sirkulasi", en: "Circulation" },
  { key: "d", label: "Tanda Lain", en: "Disability" },
];

export type TriaseKriteria = { id: string; kat: TriaseKat; aspek: TriaseAspekKey; label: string };

const k = (id: string, label: string): TriaseKriteria => ({
  id,
  kat: Number(id[0]) as TriaseKat,
  aspek: id[1] as TriaseAspekKey,
  label,
});

/**
 * Seluruh kriteria formulir RM.04, transkrip 1:1. ID = `<kategori><aspek><urut>` dan
 * TIDAK boleh diubah (tersimpan di data isian); menambah kriteria = ID baru.
 */
export const TRIASE_KRITERIA: readonly TriaseKriteria[] = [
  // Jalan Napas (Airway)
  k("1a1", "Sumbatan Total"),
  k("2a1", "Bebas"),
  k("2a2", "Sumbatan Napas Sebagian"),
  k("2a3", "Stridor/Gurgling/Snoring"),
  k("3a1", "Bebas"),
  k("4a1", "Bebas"),
  k("5a1", "Bebas"),
  // Pernapasan (Breathing)
  k("1b1", "Napas Spontan (-)"),
  k("1b2", "Frekuensi Napas < 10 x/m"),
  k("1b3", "Sianosis"),
  k("1b4", "Distres Pernapasan Berat"),
  k("2b1", "Frekuensi Napas > 30 x/m"),
  k("2b2", "Distres Pernapasan Berat (Otot diafragma, Refraksi sedang, Kulit pucat)"),
  k("2b3", "Mengi"),
  k("3b1", "Napas Spontan (+)"),
  k("3b2", "Frekuensi Napas 24 – 30 x/m"),
  k("3b3", "Distres Pernapasan Ringan"),
  k("3b4", "Mengi"),
  k("4b1", "Napas Spontan (+)"),
  k("4b2", "Frekuensi Napas 20 – 24 x/m"),
  k("5b1", "Napas Spontan (+)"),
  k("5b2", "Frekuensi Napas 16 – 20 x/m"),
  // Sirkulasi (Circulation)
  k("1c1", "Nadi Tidak Teraba"),
  k("1c2", "Pucat"),
  k("1c3", "Akral Dingin"),
  k("1c4", "Pengisian Kapiler > 4 detik"),
  k("1c5", "Tekanan Darah Sistolik < 80 mmHg atau tanda Syok"),
  k("2c1", "Nadi Teraba Lemah"),
  k("2c2", "Frekuensi Nadi < 50 x/m atau > 150 x/m"),
  k("2c3", "Pucat"),
  k("2c4", "Akral Dingin"),
  k("2c5", "Pengisian Kapiler 2 - 4 detik"),
  k("2c6", "Perdarahan Hebat"),
  k("2c7", "Nyeri Dada Kardiak"),
  k("3c1", "Frekuensi Nadi 120 – 150 x/m"),
  k("3c2", "Tekanan Darah Sistolik > 160 mmHg"),
  k("3c3", "Tekanan Darah Diastolik > 100 mmHg"),
  k("3c4", "Perdarahan Sedang – Berat"),
  k("3c5", "Dehidrasi"),
  k("4c1", "Frekuensi Nadi 100 – 120 x/m"),
  k("4c2", "Tekanan Darah Sistolik 120 – 160 mmHg"),
  k("4c3", "Tekanan Darah Diastolik 80 – 100 mmHg"),
  k("5c1", "Frekuensi Nadi 80 – 100 x/m"),
  k("5c2", "Tekanan Darah Sistolik 120 mmHg"),
  k("5c3", "Tekanan Darah Diastolik 80 mmHg"),
  // Tanda Lain (Disability)
  k("1d1", "Kejang Sedang Berlangsung"),
  k("2d1", "Gelisah"),
  k("2d2", "Somnolen"),
  k("2d3", "Demam dengan Tanda-tanda Letargia"),
  k("2d4", "Nyeri hebat karena sebab apapun"),
  k("2d5", "Kaku kuduk pada bayi usia < 28 hari"),
  k("2d6", "Hemiparese / Disfagia pada semua umur"),
  k("2d7", "Trauma kepala berat"),
  k("2d8", "Multiple trauma atau patah tulang mayor"),
  k("2d9", "Trauma kimia pada mata"),
  k("3d1", "Apatis"),
  k("3d2", "Nyeri sedang – berat apapun penyebabnya"),
  k("3d3", "Muntah terus menerus"),
  k("3d4", "Riwayat kejang (saat ini sadar)"),
  k("3d5", "Trauma kepala dengan kehilangan kesadaran singkat (saat ini sadar)"),
  k("3d6", "Nyeri perut sedang - berat"),
  k("4d1", "Trauma kepala tanpa penurunan kesadaran"),
  k("4d2", "Nyeri perut ringan"),
  k("4d3", "Nyeri ringan – sedang apapun penyebabnya"),
  k("4d4", "Trauma ringan pada ekstremitas"),
  k("4d5", "Inflamasi pada mata atau adanya benda asing"),
  k("4d6", "Muntah / diare tanpa tanda dehidrasi"),
  k("5d1", "Gejala klinis (-)"),
  k("5d2", "Luka ringan"),
  k("5d3", "Rencana Imunisasi"),
  k("5d4", "Nyeri ringan"),
  k("5d5", "Sakit dengan gejala ringan"),
  k("5d6", "Kontrol luka"),
  k("5d7", "Lebam pasca trauma ringan"),
];

export const TRIASE_KRITERIA_ID = new Set(TRIASE_KRITERIA.map((x) => x.id));
const KRITERIA_BY_ID = new Map(TRIASE_KRITERIA.map((x) => [x.id, x]));
export const kriteriaById = (id: string) => KRITERIA_BY_ID.get(id);

/** Kriteria satu sel matriks (aspek × kategori), urut sesuai formulir. */
export function kriteriaSel(aspek: TriaseAspekKey, kat: TriaseKat): readonly TriaseKriteria[] {
  return TRIASE_KRITERIA.filter((x) => x.aspek === aspek && x.kat === kat);
}

export function emptyTriaseForm(): TriaseForm {
  return {
    kedatanganWaktu: "",
    caraDatang: "",
    caraDatangLain: "",
    kasus: "",
    kecelakaan: [],
    doa: false,
    doaWaktu: "",
    tdSistolik: "",
    tdDiastolik: "",
    nadi: "",
    suhu: "",
    saturasi: "",
    pernapasan: "",
    kriteria: [],
    kesadaran: "",
    catatan: ["", "", "", "", ""],
    emergency: "",
    waktuTriase: "",
    petugasNama: "",
    petugasTtd: "",
  };
}

/** Jumlah kriteria tercentang per kategori (indeks 0 = Kategori I). Kesadaran ikut dihitung. */
export function hitungPerKategori(f: Pick<TriaseForm, "kriteria" | "kesadaran">): number[] {
  const n = [0, 0, 0, 0, 0];
  for (const id of f.kriteria) {
    const kr = KRITERIA_BY_ID.get(id);
    if (kr) n[kr.kat - 1] += 1;
  }
  const ks = Number(f.kesadaran);
  if (ks >= 1 && ks <= 5) n[ks - 1] += 1;
  return n;
}

/** Kategori hasil triase = kolom paling gawat yang punya temuan; null bila belum ada. */
export function hitungKategori(f: Pick<TriaseForm, "kriteria" | "kesadaran">): TriaseKat | null {
  const i = hitungPerKategori(f).findIndex((n) => n > 0);
  return i < 0 ? null : ((i + 1) as TriaseKat);
}

/** Angka dari isian TTV ("37,5" → 37.5). NaN bila kosong/bukan angka. */
export function angkaTtv(s: string): number {
  const t = s.trim().replace(",", ".");
  return t === "" ? Number.NaN : Number(t);
}

export type SaranTtv = { id: string; alasan: string };

/**
 * Saran kriteria dari angka tanda vital (ambang = teks kriteria di formulir).
 * HANYA saran — petugas yang memutuskan mencentang. Ambang yang tumpang tindih di
 * kertas (mis. 20 & 24 x/m) dibaca setengah-terbuka ke kategori yang lebih gawat.
 */
export function saranTtv(f: Pick<TriaseForm, "tdSistolik" | "tdDiastolik" | "nadi" | "pernapasan">): SaranTtv[] {
  const out: SaranTtv[] = [];
  const rr = angkaTtv(f.pernapasan);
  if (rr > 0) {
    const a = `Pernapasan ${f.pernapasan.trim()} x/menit`;
    if (rr < 10) out.push({ id: "1b2", alasan: a });
    else if (rr > 30) out.push({ id: "2b1", alasan: a });
    else if (rr >= 24) out.push({ id: "3b2", alasan: a });
    else if (rr >= 20) out.push({ id: "4b2", alasan: a });
    else if (rr >= 16) out.push({ id: "5b2", alasan: a });
  }
  const hr = angkaTtv(f.nadi);
  if (hr > 0) {
    const a = `Nadi ${f.nadi.trim()} x/menit`;
    if (hr < 50 || hr > 150) out.push({ id: "2c2", alasan: a });
    else if (hr >= 120) out.push({ id: "3c1", alasan: a });
    else if (hr >= 100) out.push({ id: "4c1", alasan: a });
    else if (hr >= 80) out.push({ id: "5c1", alasan: a });
  }
  const sis = angkaTtv(f.tdSistolik);
  if (sis > 0) {
    const a = `Sistolik ${f.tdSistolik.trim()} mmHg`;
    if (sis < 80) out.push({ id: "1c5", alasan: a });
    else if (sis > 160) out.push({ id: "3c2", alasan: a });
    else if (sis > 120) out.push({ id: "4c2", alasan: a });
    // 80–99 mmHg: tak ada kriteria padanan di kertas → tak disarankan.
    else if (sis >= 100) out.push({ id: "5c2", alasan: a });
  }
  const dia = angkaTtv(f.tdDiastolik);
  if (dia > 0) {
    const a = `Diastolik ${f.tdDiastolik.trim()} mmHg`;
    if (dia > 100) out.push({ id: "3c3", alasan: a });
    else if (dia > 80) out.push({ id: "4c3", alasan: a });
    else if (dia >= 60) out.push({ id: "5c3", alasan: a });
  }
  return out;
}
