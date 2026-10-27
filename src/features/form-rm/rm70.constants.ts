import { adaIsi, bila, kosong, PESAN_TTD_LAMA, statusDari, tanggalPanjang, type StatusLangkah } from "./persetujuan/informasi";

/**
 * Acuan formulir **RM.70 — Proses Pemantauan Persalinan (Partograf)** beserta
 * **Catatan Persalinan** di baliknya (kertas F4 potret, dua halaman bolak-balik).
 * Halaman 1: kop, G/P/A, tanggal & jam, ketuban & mules, lalu grafik partograf
 * 15 jam (30 kolom setengah jam): kondisi janin, kemajuan persalinan, kondisi
 * ibu, nama & paraf. Halaman 2: catatan Kala I–IV, bayi baru lahir, dan KIE.
 * Teks cetak 1:1 dengan formulir resmi RS (termasuk ejaan kertas); label layar
 * memakai ejaan baku. Murni & aman untuk klien.
 *
 * Satu isian = satu persalinan per episode (form tak berulang).
 */

/* =================================================================== grafik */

/** Lebar grafik kertas: 15 jam = 30 kolom setengah jam; titik berada di garis k = 0..30. */
export const JAM_GRAFIK = 15;
export const KOLOM_GRAFIK = JAM_GRAFIK * 2;
export const GARIS_AKHIR = KOLOM_GRAFIK;

/** Titik pada garis waktu `k` (0..30, tiap setengah jam). */
export type TitikNilai = { k: number; v: number };
/** Tekanan darah pada garis `k`: panah dari diastolik ke sistolik; salah satu boleh belum diisi. */
export type TitikTd = { k: number; s: number | null; d: number | null };
/** Isian satu kotak kolom `c` (0..29). */
export type SelTeks = { c: number; v: string };
export type DurasiKontraksi = "<20" | "20-40" | ">40";
export type SelKontraksi = { c: number; n: number; d: DurasiKontraksi };
export type ParafGrafik = { id: string; c: number; nama: string; paraf: string };

/** Rentang sumbu kertas & rentang nilai sah (nilai di luar sumbu digambar di tepi + angkanya). */
export const SUMBU = {
  djj: { min: 80, max: 200, langkah: 10, sahMin: 40, sahMax: 240 },
  pembukaan: { min: 0, max: 10, langkah: 1, sahMin: 0, sahMax: 10 },
  penurunan: { min: 0, max: 5, langkah: 1, sahMin: 0, sahMax: 5 },
  nadi: { min: 60, max: 180, langkah: 10, sahMin: 30, sahMax: 220 },
  td: { min: 60, max: 180, langkah: 10, sahMin: 40, sahMax: 260 },
} as const;

export const KETUBAN = [
  { id: "U", label: "Utuh", ket: "Selaput ketuban masih utuh" },
  { id: "J", label: "Jernih", ket: "Pecah, air ketuban jernih" },
  { id: "M", label: "Mekonium", ket: "Pecah, bercampur mekonium" },
  { id: "D", label: "Darah", ket: "Pecah, bercampur darah" },
  { id: "K", label: "Kering", ket: "Pecah, tidak ada air ketuban" },
] as const;
export type KodeKetuban = (typeof KETUBAN)[number]["id"];

export const PENYUSUPAN = [
  { id: "0", ket: "Tulang kepala terpisah, sutura mudah diraba" },
  { id: "1", ket: "Tulang kepala saling bersentuhan" },
  { id: "2", ket: "Tumpang tindih, masih dapat dipisahkan" },
  { id: "3", ket: "Tumpang tindih, tidak dapat dipisahkan" },
] as const;
export type KodePenyusupan = (typeof PENYUSUPAN)[number]["id"];

/** Legenda kontraksi kertas: titik-titik < 20, arsir 20–40, hitam > 40 detik. */
export const DURASI_KONTRAKSI = [
  { id: "<20", label: "< 20 detik" },
  { id: "20-40", label: "20–40 detik" },
  { id: ">40", label: "> 40 detik" },
] as const satisfies readonly { id: DurasiKontraksi; label: string }[];

export const SKALA_URINE = ["-", "+", "++", "+++"] as const;

/** Lajur sel bertulisan (kotak per setengah jam). `maks` = panjang tulisan. */
export const LAJUR_SEL = {
  oksitosin: { label: "Oksitosin U/L", maks: 6 },
  tetes: { label: "Tetes / menit", maks: 6 },
  obat: { label: "Obat & cairan IV", maks: 60 },
  suhu: { label: "Suhu °C", maks: 5 },
  protein: { label: "Urine: protein", maks: 4 },
  aseton: { label: "Urine: aseton", maks: 4 },
  volume: { label: "Urine: volume (ml)", maks: 5 },
  makan: { label: "Input: makan", maks: 12 },
  minum: { label: "Input: minum", maks: 12 },
} as const;
export type LajurSel = keyof typeof LAJUR_SEL;
export const DAFTAR_LAJUR_SEL = Object.keys(LAJUR_SEL) as LajurSel[];

export type GrafikRm70 = {
  /** Tanggal & jam garis 0 (lajur "Waktu (Jam)") — "YYYY-MM-DDTHH:mm". */
  mulai: string;
  djj: TitikNilai[];
  ketuban: { c: number; v: KodeKetuban }[];
  penyusupan: { c: number; v: KodePenyusupan }[];
  /** Pembukaan serviks (cm), tanda X. */
  pembukaan: TitikNilai[];
  /** Turunnya kepala (per lima), tanda O. */
  penurunan: TitikNilai[];
  kontraksi: SelKontraksi[];
  nadi: TitikNilai[];
  td: TitikTd[];
  paraf: ParafGrafik[];
  /** Tulisan bebas di ruang kosong grafik kemajuan (mis. jam lahir, BB, APGAR). */
  catatan: string;
} & Record<LajurSel, SelTeks[]>;

/* ======================================================== catatan persalinan */

export const TEMPAT_PERSALINAN = [
  { id: "rumah", label: "Rumah ibu", cetak: "Rumah Ibu" },
  { id: "puskesmas", label: "Puskesmas", cetak: "Puskesmas" },
  { id: "klinik", label: "Klinik swasta", cetak: "Klinik swasta" },
  { id: "lainnya", label: "Lainnya", cetak: "Lainnya" },
] as const;
export type TempatPersalinan = (typeof TEMPAT_PERSALINAN)[number]["id"];
/** Isian bawaan tempat persalinan "Lainnya" — persalinan di rumah sakit ini. */
export const TEMPAT_RS = "RSUD Boltim";

export const PENDAMPING = [
  { id: "suami", label: "Suami", cetak: "Suami" },
  { id: "keluarga", label: "Keluarga", cetak: "Keluarga" },
  { id: "teman", label: "Teman", cetak: "Teman" },
  { id: "dukun", label: "Dukun", cetak: "Dukun" },
  { id: "tidakAda", label: "Tidak ada", cetak: "Tidak ada" },
] as const;
export const GAWAT_JANIN = [
  { id: "miringKiri", label: "Miringkan ibu ke sisi kiri", cetak: "Miringkan ibu ke sisi kiri" },
  { id: "tarikNapas", label: "Minta ibu menarik napas", cetak: "Minta ibu menarik nafs" },
  { id: "episiotomi", label: "Episiotomi", cetak: "Eoisiotomi" },
] as const;
export const DISTOSIA_BAHU = [
  { id: "mcRobert", label: "Manuver McRoberts", cetak: "Manuver Mc Robert" },
  { id: "merangkak", label: "Ibu merangkak", cetak: "Ibu merangkang" },
  { id: "lainnya", label: "Lainnya", cetak: "lainnya" },
] as const;
export const TINDAKAN_LASERASI = [
  { id: "manual", label: "Mengeluarkan secara manual", cetak: "mengeluarkan secara manual" },
  { id: "rujuk", label: "Merujuk", cetak: "merujuk" },
  { id: "lain", label: "Tindakan lain", cetak: "tindakan lain" },
] as const;
export const ATONIA_UTERI = [
  { id: "kbi", label: "Kompresi bimanual interna", cetak: "Kompresi bimanual interna" },
  { id: "metil", label: "Metil ergometrin 0,2 mg IM", cetak: "Metil Ergometrin 0,2 mg IM" },
  { id: "drip", label: "Oksitosin drip", cetak: "Oksitoksin drip" },
] as const;
export const DERAJAT_LASERASI = ["I", "II", "III", "IV"] as const;

export const KONDISI_BAYI = [
  { id: "pucat", label: "Pucat" },
  { id: "biru", label: "Biru" },
  { id: "lemas", label: "Lemas" },
] as const;
export const TINDAKAN_BAYI = [
  { id: "keringkan", label: "Mengeringkan", cetak: "mengeringkan" },
  { id: "hangatkan", label: "Menghangatkan", cetak: "menghangatkan" },
  { id: "jalanNapas", label: "Bebaskan jalan napas", cetak: "Bebaskan jalan nafas" },
  { id: "stimulasi", label: "Stimulasi rangsang aktif", cetak: "stimulasi rangsang aktif" },
  { id: "lain", label: "Lain-lain", cetak: "lain-lain, sebutkan :" },
] as const;

type IdDari<T extends readonly { id: string }[]> = T[number]["id"];
export type IdPendamping = IdDari<typeof PENDAMPING>;
export type IdGawatJanin = IdDari<typeof GAWAT_JANIN>;
export type IdDistosia = IdDari<typeof DISTOSIA_BAHU>;
export type IdTindakanLaserasi = IdDari<typeof TINDAKAN_LASERASI>;
export type IdAtonia = IdDari<typeof ATONIA_UTERI>;
export type IdKondisiBayi = IdDari<typeof KONDISI_BAYI>;
export type IdTindakanBayi = IdDari<typeof TINDAKAN_BAYI>;

export type YaTidak = "" | "ya" | "tidak";
/** "( ) ya ( ) tidak, alasan : …" */
export type YaTidakAlasan = { jawab: YaTidak; alasan: string };

/** Butir Kala III a–c (urutan & teks kertas). */
export const BUTIR_KALA3 = [
  { id: "oksitosin", huruf: "a.", label: "Oksitosin 10 U IM < 2 menit", cetak: "Pemberian Oksilosin 10 U IM < 2 Menit ?" },
  { id: "oksitosinUlang", huruf: "", label: "Oksitosin ulang (2×)", cetak: "Pemberian  Oksitosin ulang (2x)?" },
  { id: "ptt", huruf: "b.", label: "Penegangan tali pusat terkendali", cetak: "Penegangan Tali Pusat terkendali?" },
  { id: "masase", huruf: "c.", label: "Masase fundus uteri", cetak: "Masage fundus uteri" },
] as const;
export type IdButirKala3 = (typeof BUTIR_KALA3)[number]["id"];

export type PersalinanRm70 = {
  /** "YYYY-MM-DD". */
  tanggal: string;
  penolong: string;
  tempat: "" | TempatPersalinan;
  tempatLain: string;
  alamat: string;
  kala1: { waspada: "" | "Y" | "T"; lain: boolean; lainKet: string; tatalaksana: string; hasil: string };
  kala2: {
    /** Menit. */
    lama: string;
    episiotomi: YaTidak;
    indikasi: string;
    pendamping: IdPendamping[];
    gawatJanin: IdGawatJanin[];
    distosia: IdDistosia[];
    tatalaksana: string;
    hasil: string;
  };
  kala3: {
    lama: string;
    /** ml. */
    perdarahan: string;
    laserasi: "" | (typeof DERAJAT_LASERASI)[number];
    tindakan: IdTindakanLaserasi[];
    tindakanLain: string;
    atonia: IdAtonia[];
    lain: string;
    tatalaksana: string;
    hasil: string;
  } & Record<IdButirKala3, YaTidakAlasan>;
};

export type BayiRm70 = {
  /** Gram. */
  berat: string;
  /** cm. */
  panjang: string;
  jk: "" | "L" | "P";
  apgar1: string;
  apgar5: string;
  asi: YaTidak;
  asiAlasan: string;
  kondisi: IdKondisiBayi[];
  tindakan: IdTindakanBayi[];
  tindakanLain: string;
  cacat: boolean;
  cacatKet: string;
  lain: boolean;
  lainKet: string;
  tatalaksana: string;
  hasil: string;
};

/** Pemantauan Kala IV: jam ke-1 empat baris (tiap 15 menit), jam ke-2 dua baris (tiap 30 menit). */
export const BARIS_KALA4 = [
  { jamKe: 1, menit: 15 },
  { jamKe: 1, menit: 30 },
  { jamKe: 1, menit: 45 },
  { jamKe: 1, menit: 60 },
  { jamKe: 2, menit: 90 },
  { jamKe: 2, menit: 120 },
] as const;
/** Suhu diukur sekali tiap jam: kotak suhu baris lain diarsir hitam di kertas. */
export const SUHU_KALA4 = new Set([0, 4]);

export type BarisKala4 = {
  /** "HH:mm". */
  pukul: string;
  td: string;
  nadi: string;
  suhu: string;
  tfu: string;
  kontraksi: string;
  kandungKemih: string;
  /** ml. */
  perdarahan: string;
};

/** Materi KIE (urutan & teks kertas). */
export const MATERI_KIE = [
  { id: "senamNifas", label: "Senam nifas", cetak: "Semua nifas" },
  { id: "breastCare", label: "Breast care", cetak: "Breast care" },
  { id: "asi", label: "ASI", cetak: "ASI" },
  { id: "taliPusat", label: "Perawatan tali pusat", cetak: "Perawatan Tali Pusat" },
  { id: "kb", label: "KB", cetak: "KL" },
  { id: "gizi", label: "Gizi", cetak: "Gizi" },
  { id: "imunisasi", label: "Imunisasi", cetak: "Imunisasi" },
] as const;
export type BarisKie = { tanggal: string; pelaksana: string; ket: string };

/** Data isian RM.70 (sama dengan keluaran `rm70FormSchema`). */
export type Rm70Data = {
  gravida: string;
  para: string;
  abortus: string;
  /** "Tanggal : … Jam : …" — "YYYY-MM-DDTHH:mm". */
  masukWaktu: string;
  /** "Ketuban Pecah Sejak Jam" — "HH:mm". */
  ketubanJam: string;
  /** "Mules sejak jam" — "HH:mm". */
  mulesJam: string;
  grafik: GrafikRm70;
  persalinan: PersalinanRm70;
  bayi: BayiRm70;
  kala4: { baris: BarisKala4[]; masalah: string; tatalaksana: string; hasil: string };
  kie: BarisKie[];
};

const yta = (): YaTidakAlasan => ({ jawab: "", alasan: "" });
export const barisKala4Kosong = (): BarisKala4 => ({ pukul: "", td: "", nadi: "", suhu: "", tfu: "", kontraksi: "", kandungKemih: "", perdarahan: "" });

export function grafikKosong(): GrafikRm70 {
  return {
    mulai: "",
    djj: [],
    ketuban: [],
    penyusupan: [],
    pembukaan: [],
    penurunan: [],
    kontraksi: [],
    oksitosin: [],
    tetes: [],
    obat: [],
    nadi: [],
    td: [],
    suhu: [],
    protein: [],
    aseton: [],
    volume: [],
    makan: [],
    minum: [],
    paraf: [],
    catatan: "",
  };
}

export function emptyRm70Form(): Rm70Data {
  return {
    gravida: "",
    para: "",
    abortus: "",
    masukWaktu: "",
    ketubanJam: "",
    mulesJam: "",
    grafik: grafikKosong(),
    persalinan: {
      tanggal: "",
      penolong: "",
      tempat: "",
      tempatLain: "",
      alamat: "",
      kala1: { waspada: "", lain: false, lainKet: "", tatalaksana: "", hasil: "" },
      kala2: { lama: "", episiotomi: "", indikasi: "", pendamping: [], gawatJanin: [], distosia: [], tatalaksana: "", hasil: "" },
      kala3: {
        lama: "",
        perdarahan: "",
        oksitosin: yta(),
        oksitosinUlang: yta(),
        ptt: yta(),
        masase: yta(),
        laserasi: "",
        tindakan: [],
        tindakanLain: "",
        atonia: [],
        lain: "",
        tatalaksana: "",
        hasil: "",
      },
    },
    bayi: {
      berat: "",
      panjang: "",
      jk: "",
      apgar1: "",
      apgar5: "",
      asi: "",
      asiAlasan: "",
      kondisi: [],
      tindakan: [],
      tindakanLain: "",
      cacat: false,
      cacatKet: "",
      lain: false,
      lainKet: "",
      tatalaksana: "",
      hasil: "",
    },
    kala4: { baris: BARIS_KALA4.map(barisKala4Kosong), masalah: "", tatalaksana: "", hasil: "" },
    kie: MATERI_KIE.map(() => ({ tanggal: "", pelaksana: "", ket: "" })),
  };
}

/** Data tersimpan (apa adanya) → bentuk lengkap; kolom yang hilang = kosong. */
export function lengkapiRm70(data: unknown): Rm70Data {
  const k = emptyRm70Form();
  const x = (data && typeof data === "object" ? data : {}) as Partial<Rm70Data>;
  return {
    ...k,
    ...x,
    grafik: { ...k.grafik, ...x.grafik },
    persalinan: {
      ...k.persalinan,
      ...x.persalinan,
      kala1: { ...k.persalinan.kala1, ...x.persalinan?.kala1 },
      kala2: { ...k.persalinan.kala2, ...x.persalinan?.kala2 },
      kala3: { ...k.persalinan.kala3, ...x.persalinan?.kala3 },
    },
    bayi: { ...k.bayi, ...x.bayi },
    kala4: { ...k.kala4, ...x.kala4, baris: k.kala4.baris.map((b, i) => ({ ...b, ...x.kala4?.baris?.[i] })) },
    kie: k.kie.map((b, i) => ({ ...b, ...x.kie?.[i] })),
  };
}

/* ==================================================================== waktu */

const WAKTU_RE = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;
export const JAM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const p2 = (n: number) => String(n).padStart(2, "0");

/** "2026-10-07T07:00" → menit sejak epoch jam dinding (UTC semu); null bila tak valid. */
export function menitDari(waktu: string): number | null {
  const m = WAKTU_RE.exec((waktu ?? "").trim());
  if (!m || !tanggalPanjang(`${m[1]}-${m[2]}-${m[3]}`)) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60_000;
}

/** Menit (jam dinding) → "YYYY-MM-DDTHH:mm". */
export function waktuDari(menit: number): string {
  const d = new Date(menit * 60_000);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
}

/** "HH:mm" → "HH.mm" (ejaan jam kertas); "" bila tak valid. */
export const jamTitik = (jam: string) => (JAM_RE.test((jam ?? "").trim()) ? jam.trim().replace(":", ".") : "");

/** "2026-10-07T07:00" → { tanggal: "07.10.2026", jam: "07.00" } (gaya tulisan formulir). */
export function pisahWaktuRm70(waktu: string): { tanggal: string; jam: string } {
  const m = WAKTU_RE.exec((waktu ?? "").trim());
  return m && tanggalPanjang(`${m[1]}-${m[2]}-${m[3]}`) ? { tanggal: `${m[3]}.${m[2]}.${m[1]}`, jam: `${m[4]}.${m[5]}` } : { tanggal: "", jam: "" };
}

/** "2026-10-06" → "06-10-2026" (tanggal catatan persalinan). */
export const tanggalStrip = (ymd: string) => (tanggalPanjang(ymd ?? "") ? ymd.split("-").reverse().join("-") : "");

/** Jam dinding garis `k` dari mulai grafik → "HH.mm"; "" bila mulai kosong. */
export function jamGaris(mulai: string, k: number): string {
  const m = menitDari(mulai);
  if (m === null) return "";
  return waktuDari(m + Math.round(k * 30)).slice(11).replace(":", ".");
}

/** Waktu lengkap garis `k` → "YYYY-MM-DDTHH:mm"; "" bila mulai kosong. */
export function waktuGaris(mulai: string, k: number): string {
  const m = menitDari(mulai);
  return m === null ? "" : waktuDari(m + Math.round(k * 30));
}

/** Label 15 kotak lajur "Waktu (Jam)" — jam dinding tiap awal jam. */
export const labelJamGrafik = (mulai: string): string[] => Array.from({ length: JAM_GRAFIK }, (_, j) => jamGaris(mulai, j * 2));

/** Posisi waktu (pecahan garis) dari mulai grafik; null bila mulai kosong. */
export function garisDariWaktu(mulai: string, waktu: string): number | null {
  const a = menitDari(mulai);
  const b = menitDari(waktu);
  return a === null || b === null ? null : (b - a) / 30;
}

/** Bulatkan ke bawah ke setengah jam: "2026-10-07T07:20" → "2026-10-07T07:00". */
export function bulatSetengahJam(waktu: string): string {
  const m = menitDari(waktu);
  return m === null ? "" : waktuDari(Math.floor(m / 30) * 30);
}

/* =========================================================== daftar lajur */

const urutK = <T extends { k: number }>(a: T[]) => [...a].sort((x, y) => x.k - y.k);
const urutC = <T extends { c: number }>(a: T[]) => [...a].sort((x, y) => x.c - y.c);

/** Pasang / ganti titik garis `k` (urut k, satu titik per garis); `null` = hapus. */
export function pasangTitik<T extends { k: number }>(daftar: readonly T[], k: number, titik: T | null): T[] {
  const lain = daftar.filter((t) => t.k !== k);
  return urutK(titik ? [...lain, titik] : lain);
}

/** Pasang / ganti isi kotak kolom `c` (urut c, satu isi per kotak); `null` = hapus. */
export function pasangSel<T extends { c: number }>(daftar: readonly T[], c: number, sel: T | null): T[] {
  const lain = daftar.filter((t) => t.c !== c);
  return urutC(sel ? [...lain, sel] : lain);
}

export const titikDi = <T extends { k: number }>(daftar: readonly T[], k: number) => daftar.find((t) => t.k === k);
export const selDi = <T extends { c: number }>(daftar: readonly T[], c: number) => daftar.find((t) => t.c === c);

/* ====================================================== garis waspada/bertindak */

/** Garis waspada: 4 cm pada garis 0 → 10 cm pada jam ke-6 (1 cm/jam). Garis bertindak 4 jam di kanannya. */
export const WASPADA = { k0: 0, v0: 4, k1: 12, v1: 10 } as const;
export const JARAK_BERTINDAK = 8;

/** Garis waspada pada pembukaan `v` (≥ 4 cm) → posisi garis k. */
export const kWaspada = (v: number) => WASPADA.k0 + ((v - WASPADA.v0) * (WASPADA.k1 - WASPADA.k0)) / (WASPADA.v1 - WASPADA.v0);

export type PosisiKemajuan = "fase-laten" | "aman" | "waspada" | "bertindak";

/** Letak satu pemeriksaan pembukaan terhadap garis waspada & bertindak (fase aktif ≥ 4 cm). */
export function posisiKemajuan(t: TitikNilai): PosisiKemajuan {
  if (t.v < WASPADA.v0) return "fase-laten";
  const w = kWaspada(t.v);
  if (t.k >= w + JARAK_BERTINDAK) return "bertindak";
  if (t.k > w) return "waspada";
  return "aman";
}

/** Posisi terburuk seluruh pemeriksaan pembukaan (null bila belum ada). */
export function kemajuanTerburuk(pembukaan: readonly TitikNilai[]): { posisi: PosisiKemajuan; titik: TitikNilai } | null {
  const urut: PosisiKemajuan[] = ["fase-laten", "aman", "waspada", "bertindak"];
  let terburuk: { posisi: PosisiKemajuan; titik: TitikNilai } | null = null;
  for (const t of pembukaan) {
    const p = posisiKemajuan(t);
    if (!terburuk || urut.indexOf(p) > urut.indexOf(terburuk.posisi)) terburuk = { posisi: p, titik: t };
  }
  return terburuk;
}

/** "Partograf melewati garis waspada : Y/T" menurut grafik; "" bila belum ada pemeriksaan fase aktif. */
export function waspadaMenurutGrafik(pembukaan: readonly TitikNilai[]): "" | "Y" | "T" {
  const aktif = pembukaan.filter((t) => t.v >= WASPADA.v0);
  if (aktif.length === 0) return "";
  return aktif.some((t) => posisiKemajuan(t) === "waspada" || posisiKemajuan(t) === "bertindak") ? "Y" : "T";
}

/* ============================================================== tanda bahaya */

export type TandaBahaya = { lajur: string; k: number; pesan: string; nada: "danger" | "warning" };

const angka = (s: string) => {
  const n = Number((s ?? "").trim().replace(",", "."));
  return (s ?? "").trim() !== "" && Number.isFinite(n) ? n : null;
};

/** Temuan di luar batas normal (APN) — penanda layar, tak mengubah isian. */
export function tandaBahaya(g: GrafikRm70): TandaBahaya[] {
  const hasil: TandaBahaya[] = [];
  for (const t of g.djj) {
    if (t.v < 120) hasil.push({ lajur: "djj", k: t.k, pesan: `DJJ ${t.v} < 120`, nada: "danger" });
    else if (t.v > 160) hasil.push({ lajur: "djj", k: t.k, pesan: `DJJ ${t.v} > 160`, nada: "danger" });
  }
  for (const s of g.ketuban) {
    if (s.v === "M") hasil.push({ lajur: "ketuban", k: s.c, pesan: "Air ketuban bercampur mekonium", nada: "warning" });
    if (s.v === "D") hasil.push({ lajur: "ketuban", k: s.c, pesan: "Air ketuban bercampur darah", nada: "warning" });
  }
  for (const s of g.penyusupan) if (s.v === "3") hasil.push({ lajur: "penyusupan", k: s.c, pesan: "Penyusupan 3 — tak dapat dipisahkan", nada: "danger" });
  for (const t of g.pembukaan) {
    const p = posisiKemajuan(t);
    if (p === "bertindak") hasil.push({ lajur: "pembukaan", k: t.k, pesan: `Pembukaan ${t.v} cm melewati garis bertindak`, nada: "danger" });
    else if (p === "waspada") hasil.push({ lajur: "pembukaan", k: t.k, pesan: `Pembukaan ${t.v} cm melewati garis waspada`, nada: "warning" });
  }
  for (const t of g.nadi) {
    if (t.v > 100) hasil.push({ lajur: "nadi", k: t.k, pesan: `Nadi ibu ${t.v} > 100`, nada: "warning" });
    else if (t.v < 60) hasil.push({ lajur: "nadi", k: t.k, pesan: `Nadi ibu ${t.v} < 60`, nada: "warning" });
  }
  for (const t of g.td) {
    if ((t.s ?? 0) >= 140 || (t.d ?? 0) >= 90) hasil.push({ lajur: "td", k: t.k, pesan: `TD ${t.s ?? "?"}/${t.d ?? "?"} — hipertensi`, nada: "warning" });
    else if (t.s !== null && t.s < 90) hasil.push({ lajur: "td", k: t.k, pesan: `TD sistolik ${t.s} < 90`, nada: "warning" });
  }
  for (const s of g.suhu) {
    const n = angka(s.v);
    if (n !== null && n >= 38) hasil.push({ lajur: "suhu", k: s.c, pesan: `Suhu ${s.v} °C ≥ 38`, nada: "warning" });
  }
  for (const s of g.protein) if (s.v === "++" || s.v === "+++") hasil.push({ lajur: "protein", k: s.c, pesan: `Protein urine ${s.v}`, nada: "warning" });
  for (const s of g.aseton) if (s.v.includes("+")) hasil.push({ lajur: "aseton", k: s.c, pesan: `Aseton urine ${s.v}`, nada: "warning" });
  return hasil.sort((a, b) => a.k - b.k);
}

/* ======================================================== jadwal pemeriksaan */

/** Interval pemantauan kala I fase aktif (dalam setengah jam): DJJ, nadi & kontraksi tiap 30 menit; suhu & urine tiap 2 jam; VT & TD tiap 4 jam. */
export const JADWAL_PANTAU = [
  { id: "djj", label: "DJJ", tiap: 1 },
  { id: "kontraksi", label: "Kontraksi", tiap: 1 },
  { id: "nadi", label: "Nadi", tiap: 1 },
  { id: "suhu", label: "Suhu", tiap: 4 },
  { id: "volume", label: "Urine", tiap: 4 },
  { id: "pembukaan", label: "Periksa dalam", tiap: 8 },
  { id: "td", label: "Tekanan darah", tiap: 8 },
] as const;

export type JadwalBerikut = { id: string; label: string; k: number; terlambat: boolean };

/** Posisi pencatatan terakhir tiap butir jadwal (garis untuk titik, awal kotak untuk sel). */
function terakhir(g: GrafikRm70, id: (typeof JADWAL_PANTAU)[number]["id"]): number | null {
  const daftar: readonly ({ k: number } | { c: number })[] = g[id];
  return daftar.length ? Math.max(...daftar.map((x) => ("k" in x ? x.k : x.c))) : null;
}

/**
 * Pemeriksaan berikutnya menurut jadwal dari pencatatan terakhir. `sekarang` =
 * posisi garis saat ini (pecahan) atau null bila tak diketahui. Butir yang belum
 * pernah dicatat tak dijadwalkan.
 */
export function jadwalBerikut(g: GrafikRm70, sekarang: number | null): JadwalBerikut[] {
  return JADWAL_PANTAU.flatMap((j) => {
    const t = terakhir(g, j.id);
    if (t === null) return [];
    const k = t + j.tiap;
    if (k > GARIS_AKHIR) return [];
    return [{ id: j.id, label: j.label, k, terlambat: sekarang !== null && sekarang > k + 0.5 }];
  }).sort((a, b) => a.k - b.k);
}

/* ================================================================ kala IV */

/** Jumlah perdarahan Kala IV (ml); null bila belum ada angka. */
export function totalPerdarahanKala4(baris: readonly BarisKala4[]): number | null {
  const n = baris.map((b) => angka(b.perdarahan)).filter((x): x is number => x !== null);
  return n.length ? n.reduce((a, b) => a + b, 0) : null;
}

/** Jadwal pukul Kala IV dari pukul baris pertama: +15, +30, +45 menit, lalu +75, +105 menit. */
export function jadwalKala4(pukulPertama: string): string[] {
  const m = JAM_RE.exec((pukulPertama ?? "").trim());
  if (!m) return [];
  const awal = Number(m[1]) * 60 + Number(m[2]);
  return BARIS_KALA4.map((b) => {
    const t = (awal + b.menit - BARIS_KALA4[0].menit) % 1440;
    return `${p2(Math.floor(t / 60))}:${p2(t % 60)}`;
  });
}

/* ================================================================== bayi */

export type NilaiApgar = { nilai: number; kelas: "normal" | "sedang" | "berat" } | null;

export function kelasApgar(s: string): NilaiApgar {
  const n = angka(s);
  if (n === null || n < 0 || n > 10) return null;
  return { nilai: n, kelas: n >= 7 ? "normal" : n >= 4 ? "sedang" : "berat" };
}

/** "5/6" — nilai APGAR menit ke-1 / ke-5 seperti tulisan di kertas. */
export const teksApgar = (b: Pick<BayiRm70, "apgar1" | "apgar5">) => [b.apgar1.trim(), b.apgar5.trim()].filter(Boolean).join("/");

/* ============================================================ alur pengisian */

export const LANGKAH_RM70 = [
  { id: "data", judul: "Data ibu" },
  { id: "partograf", judul: "Partograf" },
  { id: "persalinan", judul: "Kala I & II" },
  { id: "kala3", judul: "Kala III" },
  { id: "bayi", judul: "Bayi baru lahir" },
  { id: "kala4", judul: "Kala IV" },
  { id: "kie", judul: "KIE" },
] as const;
export type IdLangkahRm70 = (typeof LANGKAH_RM70)[number]["id"];

const DIGIT = /^\d{1,2}$/;
const adaBaris = (b: BarisKala4) => Object.values(b).some((v) => !kosong(v));

/** "pukul 09.30" bila mulai grafik diketahui, selain itu "jam ke-1,5" (posisi pada grafik). */
export function labelPosisi(mulai: string, k: number): string {
  const jam = jamGaris(mulai, k);
  return jam ? `pukul ${jam}` : `jam ke-${String(k / 2).replace(".", ",")}`;
}

export function kekuranganRm70(d: Rm70Data): Record<IdLangkahRm70, string[]> {
  const g = d.grafik;
  const p = d.persalinan;
  const b = d.bayi;
  const bayiDisentuh = adaIsi(b.berat, b.panjang, b.jk, b.apgar1, b.apgar5);
  return {
    data: [
      ...bila(!DIGIT.test(d.gravida), "G (gravida)"),
      ...bila(!DIGIT.test(d.para), "P (para)"),
      ...bila(!DIGIT.test(d.abortus), "A (abortus)"),
      ...bila(DIGIT.test(d.gravida) && Number(d.gravida) < 1, "G minimal 1"),
      ...bila(!pisahWaktuRm70(d.masukWaktu).tanggal, "Tanggal & jam"),
    ],
    partograf: [
      ...bila(!pisahWaktuRm70(g.mulai).tanggal, "Jam mulai grafik (lajur Waktu)"),
      ...bila(g.pembukaan.length === 0, "Minimal satu pemeriksaan pembukaan serviks (X)"),
      ...bila(g.djj.length === 0, "Minimal satu denyut jantung janin"),
      ...bila(!g.paraf.some((x) => !kosong(x.nama) && x.paraf !== ""), "Nama & paraf petugas"),
      ...g.paraf.flatMap((x) =>
        bila(kosong(x.nama) !== (x.paraf === ""), `Paraf ${labelPosisi(g.mulai, x.c)}: ${kosong(x.nama) ? "nama" : "paraf"} belum diisi`),
      ),
      ...g.td.flatMap((t) => bila(t.s === null || t.d === null, `TD ${labelPosisi(g.mulai, t.k)}: ${t.s === null ? "sistolik" : "diastolik"} belum diisi`)),
    ],
    persalinan: [
      ...bila(!tanggalPanjang(p.tanggal), "Tanggal persalinan"),
      ...bila(kosong(p.penolong), "Penolong persalinan"),
      ...bila(p.tempat === "", "Tempat persalinan"),
      ...bila(p.tempat === "lainnya" && kosong(p.tempatLain), "Tempat persalinan lainnya"),
      ...bila(p.kala1.waspada === "", "Kala I: partograf melewati garis waspada Y/T"),
      ...bila(p.kala1.lain && kosong(p.kala1.lainKet), "Kala I: sebutkan lain-lain"),
      ...bila(p.kala2.episiotomi === "ya" && kosong(p.kala2.indikasi), "Kala II: indikasi episiotomi"),
    ],
    kala3: [
      ...BUTIR_KALA3.flatMap((x) => bila(p.kala3[x.id].jawab === "tidak" && kosong(p.kala3[x.id].alasan), `${x.label}: alasan tidak`)),
      ...bila(p.kala3.tindakan.includes("lain") && kosong(p.kala3.tindakanLain), "Sebutkan tindakan lain"),
    ],
    bayi: bayiDisentuh
      ? [
          ...bila(!/^\d{3,4}$/.test(b.berat), "Berat badan (gram)"),
          ...bila(!/^\d{2}([.,]\d)?$/.test(b.panjang), "Panjang badan (cm)"),
          ...bila(b.jk === "", "Jenis kelamin L/P"),
          ...bila(kelasApgar(b.apgar1) === null || kelasApgar(b.apgar5) === null, "Nilai APGAR menit 1 & 5"),
          ...bila(b.asi === "tidak" && kosong(b.asiAlasan), "Alasan ASI tidak < 1 jam"),
          ...bila(b.tindakan.includes("lain") && kosong(b.tindakanLain), "Sebutkan tindakan lain-lain"),
          ...bila(b.cacat && kosong(b.cacatKet), "Sebutkan cacat bawaan"),
          ...bila(b.lain && kosong(b.lainKet), "Sebutkan lain-lain"),
        ]
      : [],
    kala4: d.kala4.baris.flatMap((x, i) => bila(adaBaris(x) && !JAM_RE.test(x.pukul), `Baris ${i + 1}: pukul`)),
    kie: d.kie.flatMap((x, i) =>
      adaIsi(x.tanggal, x.pelaksana, x.ket)
        ? [...bila(!tanggalPanjang(x.tanggal), `${MATERI_KIE[i].label}: tanggal`), ...bila(kosong(x.pelaksana), `${MATERI_KIE[i].label}: pelaksana`)]
        : [],
    ),
  };
}

/** Langkah bersyarat wajib FINAL; langkah lain hanya diperiksa bila diisi. */
const LANGKAH_WAJIB: ReadonlySet<IdLangkahRm70> = new Set(["data", "partograf", "persalinan"]);

export function statusLangkahRm70(d: Rm70Data, id: IdLangkahRm70, kurang: readonly string[]): StatusLangkah {
  const g = d.grafik;
  const p = d.persalinan;
  const tersentuh: Record<IdLangkahRm70, boolean> = {
    data: adaIsi(d.gravida, d.para, d.abortus, d.masukWaktu, d.ketubanJam, d.mulesJam),
    partograf: g.djj.length + g.pembukaan.length + g.penurunan.length + g.kontraksi.length + g.nadi.length + g.paraf.length > 0,
    persalinan: adaIsi(p.tanggal, p.penolong, p.kala1.waspada, p.kala2.lama, p.kala2.episiotomi) || p.kala2.pendamping.length > 0,
    kala3:
      adaIsi(p.kala3.lama, p.kala3.perdarahan, p.kala3.laserasi, p.kala3.lain, p.kala3.tatalaksana) ||
      BUTIR_KALA3.some((x) => p.kala3[x.id].jawab !== "") ||
      p.kala3.atonia.length + p.kala3.tindakan.length > 0,
    bayi: adaIsi(d.bayi.berat, d.bayi.panjang, d.bayi.jk, d.bayi.apgar1, d.bayi.apgar5, d.bayi.asi),
    kala4: d.kala4.baris.some(adaBaris) || adaIsi(d.kala4.masalah),
    kie: d.kie.some((x) => adaIsi(x.tanggal, x.pelaksana, x.ket)),
  };
  // Langkah tak wajib yang belum disentuh = "belum diisi", bukan "lengkap".
  if (!LANGKAH_WAJIB.has(id) && !tersentuh[id]) return "kosong";
  return statusDari(kurang, tersentuh[id]);
}

/* ============================================================ aturan paraf */

const namaSama = (a: unknown, b: string) => typeof a === "string" && !kosong(a) && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Paraf lajur "Nama & Paraf" terikat pada nama petugas kotaknya — aturan yang
 * sama dengan RM.50. Referensi paraf tersimpan (`ttd:<id>`) hanya sah bila ada
 * kotak TERSIMPAN berparaf sama dengan nama petugas yang sama (pakai ulang paraf
 * oleh petugas yang sama boleh). "" & paraf baru selalu sah.
 */
export function cekParafRm70(lama: unknown, baru: Pick<Rm70Data, "grafik">): string | null {
  const l = (lama && typeof lama === "object" ? lama : {}) as { grafik?: { paraf?: unknown } };
  const tersimpan = (Array.isArray(l.grafik?.paraf) ? l.grafik.paraf : []) as Partial<ParafGrafik>[];
  for (const x of baru.grafik.paraf) {
    if (!x.paraf.startsWith("ttd:")) continue;
    if (!tersimpan.some((t) => t && t.paraf === x.paraf && namaSama(t.nama, x.nama))) return PESAN_PARAF_RM70;
  }
  return null;
}

export const PESAN_PARAF_RM70 = `${PESAN_TTD_LAMA} Paraf hanya dapat dipakai ulang dari kotak tersimpan dengan nama petugas yang sama.`;

/* ================================================================ lain-lain */

/** Pengenal paraf acak [a-z0-9] — `getRandomValues` (tersedia juga di HTTP LAN, tak seperti randomUUID). */
export function idAcak(): string {
  const b = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(b, (x) => "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]).join("");
}

/** No. RM bergaya formulir: 34734 → "03.47.34" (6 digit berpasangan); selain angka ≤ 6 digit apa adanya. */
export function normBertitik(norm: string): string {
  const t = (norm ?? "").trim();
  if (!/^\d{1,6}$/.test(t)) return t === "—" ? "" : t;
  return t.padStart(6, "0").replace(/(\d{2})(\d{2})(\d{2})/, "$1.$2.$3");
}

/** Tanggal lahir kepala (ISO) → "16.01.1990"; "" bila tak valid. */
export function tanggalLahirTitik(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso ?? "").trim());
  return m && tanggalPanjang(`${m[1]}-${m[2]}-${m[3]}`) ? `${m[3]}.${m[2]}.${m[1]}` : "";
}
