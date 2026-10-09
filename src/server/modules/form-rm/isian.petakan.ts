import { terisi, type SumberId } from "@/features/form-rm/asal";
import type { KodeForm } from "@/features/form-rm/registry";
import { jkRm22, umurTahun } from "@/features/form-rm/rm22.constants";
import type { DiagnosaRow, TriaseSimgosRow } from "./form-rm.dal";
import type { FormRmHeader, TriaseForm, TriaseSimrs } from "./form-rm.types";
import type { EdukasiRow, EpisodeRow, KeluargaRow, MorseRow, PulangRow, SosialRow } from "./isian.sumber.dal";

/**
 * PEMETAAN ISI OTOMATIS (PRD §8.3) — fungsi MURNI: baris sumber SIMGOS → nilai
 * kolom isian per path. Tanpa I/O (diuji unit); pengambilan sumber ada di
 * `isian.sumber.ts`. Kode referensi SIMGOS (agama, pendidikan, pekerjaan, …)
 * dipetakan per ID, bukan pencocokan teks, agar pasti dan dapat diuji silang.
 */

export type TipeSumber = {
  identitas: FormRmHeader;
  sosial: SosialRow;
  keluarga: KeluargaRow[];
  episode: EpisodeRow;
  diagnosa: DiagnosaRow[];
  pulang: PulangRow;
  triase: TriaseSimgosRow;
  edukasi: EdukasiRow;
  morse: MorseRow;
};

/** Hasil sumber yang ADA datanya (sumber kosong / gagal tidak dicantumkan). */
export type HasilSumber = { [S in SumberId]?: TipeSumber[S] };

export type KolomTerisi = { nilai: unknown; sumber: SumberId };
/** path kolom → nilai SIMRS + sumbernya. Hanya kolom yang benar-benar terisi. */
export type NilaiSimrs = Record<string, KolomTerisi>;

export type PetaForm = {
  /** Sumber yang dipakai form; masing-masing diambil sekali per pengisian. */
  readonly sumber: readonly SumberId[];
  petakan(h: HasilSumber): NilaiSimrs;
  /** Nilai bawaan BUKAN dari SIMRS (mis. tanggal hari ini) — hanya untuk isian baru. */
  bawaan?(data: Record<string, unknown>, hariIni: string): void;
};

/* ------------------------------------------------------------------ bantu */

type Id = number | string | null | undefined;

const bersih = (s: string | null | undefined) => (s ?? "").trim();
const bukanStrip = (s: string) => (s && s !== "—" ? s : "");

/** Kode berangka SIMGOS → number; null bila kosong / bukan angka. */
function kode(v: Id): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Tambahkan kolom yang terisi; kolom berikutnya dengan path sama menimpa (prioritas sumber). */
function isi(out: NilaiSimrs, sumber: SumberId, kolom: Record<string, unknown>): void {
  for (const [path, nilai] of Object.entries(kolom)) if (terisi(nilai)) out[path] = { nilai, sumber };
}

const WAKTU_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
/** "YYYY-MM-DDTHH:mm" jam dinding; selain itu "". */
const waktu = (s: string | null | undefined) => (WAKTU_RE.test(bersih(s)) ? bersih(s) : "");
/** "2026-09-29T08:04:00.000Z" (jam dinding di field UTC) → "2026-09-29T08:04". */
const jamDinding = (iso: string) => iso.slice(0, 16);

/** Selisih hari kalender masuk → keluar ("" bila tak lengkap / terbalik). */
export function hitungLamaRawat(masuk: string, keluar: string): string {
  const a = WAKTU_RE.exec(masuk);
  const b = WAKTU_RE.exec(keluar);
  if (!a || !b) return "";
  const hari = (Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3])) / 86_400_000;
  return hari >= 0 ? String(hari) : "";
}

/** Nomor telepon yang masuk akal (≥ 6 digit); isian sampah ("-", "000") dibuang. */
function telp(s: string | null | undefined): string {
  const t = bersih(s);
  return /^\+?[\d\s-]+$/.test(t) && t.replace(/\D/g, "").length >= 6 && !/^0+$/.test(t.replace(/\D/g, "")) ? t : "";
}

/* ------------------------------------------------------------ data sosial */

/** Pendidikan (referensi JENIS 3) → opsi RM.01 [Akademik, SD, SLTP, SLTA, Univ]. */
export const PENDIDIKAN_RM01: Readonly<Record<number, string>> = {
  3: "SD", // Tamat SD/Sederajat
  4: "SLTP",
  5: "SLTA",
  6: "Akademik", // Diploma I/II
  7: "Akademik", // Akademi/Diploma III/Sarjana Muda
  8: "Univ", // Diploma IV/Strata I
  9: "Univ", // Strata II
  10: "Univ", // Strata III
};
/** Pendidikan → opsi RM.21 [SD, SLTP, SLTA, S1, S2]. */
export const PENDIDIKAN_RM21: Readonly<Record<number, string>> = { 3: "SD", 4: "SLTP", 5: "SLTA", 8: "S1", 9: "S2" };

/** Pendidikan tanpa padanan opsi (mis. "Tidak/Belum Sekolah") ditulis di kolom lain-lain. */
export function petaPendidikan(peta: Readonly<Record<number, string>>, id: Id, desk: string | null): { opt: string; lain: string } {
  const n = kode(id);
  if (n === null) return { opt: "", lain: "" };
  const opt = peta[n];
  return opt ? { opt, lain: "" } : { opt: "", lain: bersih(desk) };
}

/** Pekerjaan (referensi JENIS 4, kode Dukcapil) → opsi RM.01. Tanpa padanan (mis. IRT, pelajar) → "". */
export const PEKERJAAN_RM01: Readonly<Record<number, string>> = {
  5: "PNS",
  6: "TNI / POLRI",
  7: "TNI / POLRI",
  8: "Swasta", // Perdagangan
  84: "Swasta", // Pedagang
  88: "Swasta", // Wiraswasta
  9: "Petani", // Petani/Pekebun
  10: "Petani", // Peternak
  11: "Petani", // Nelayan/Perikanan
  15: "Karyawan", // Karyawan Swasta
  16: "Karyawan", // BUMN
  17: "Karyawan", // BUMD
  18: "Karyawan", // Honorer
  19: "Buruh", // Buruh Harian Lepas
  20: "Buruh",
  21: "Buruh",
  22: "Buruh",
};

/** Agama (referensi JENIS 1) → opsi RM.01; Konghucu/penghayat/lainnya tak punya opsi. */
export const AGAMA_RM01: Readonly<Record<number, string>> = { 1: "Islam", 2: "Protestan", 3: "Katolik", 4: "Hindu", 5: "Budha" };

/** Status kawin (referensi JENIS 5): cerai hidup/mati → Duda / Janda menurut jenis kelamin. */
export function petaPerkawinan(id: Id, jenisKelamin: Id): string {
  const n = kode(id);
  if (n === 1) return "Tidak Kawin";
  if (n === 2) return "Kawin";
  if (n === 3 || n === 4) {
    const jk = kode(jenisKelamin);
    return jk === 1 ? "Duda" : jk === 2 ? "Janda" : "";
  }
  return "";
}

/** Bahasa (referensi JENIS 177, ISO 639) → opsi RM.21 [Indonesia, Daerah, Inggris] + lain-lain. */
const BAHASA_RM21: Readonly<Record<number, string>> = { 71: "Indonesia", 79: "Daerah", 151: "Daerah", 42: "Inggris" };
const URUT_BAHASA = ["Indonesia", "Daerah", "Inggris"];
/** ID 1 = "Tidak Ada" (bawaan pendaftaran) — bukan informasi bahasa. */
const BAHASA_KOSONG = 1;

/** `raw` = "id=deskripsi|…" dari query sosial. */
export function petaBahasa(raw: string | null): { bahasa: string[]; lain: string } {
  const bahasa = new Set<string>();
  const lain: string[] = [];
  for (const bagian of bersih(raw).split("|")) {
    const m = /^(\d+)=(.*)$/.exec(bagian);
    if (!m || Number(m[1]) === BAHASA_KOSONG) continue;
    const opt = BAHASA_RM21[Number(m[1])];
    if (opt) bahasa.add(opt);
    else if (m[2].trim()) lain.push(m[2].trim());
  }
  return { bahasa: URUT_BAHASA.filter((b) => bahasa.has(b)), lain: lain.join(", ") };
}

function komposeAlamat(r: SosialRow): string {
  const nyata = (s: string | null) => !!s && s.trim() !== "" && !/^0+$/.test(s.trim());
  return [bersih(r.ALAMAT), nyata(r.RT) ? `RT ${bersih(r.RT)}` : "", nyata(r.RW) ? `RW ${bersih(r.RW)}` : ""]
    .filter(Boolean)
    .join(" ");
}

function petaSosialRm01(r: SosialRow): Record<string, unknown> {
  const pend = petaPendidikan(PENDIDIKAN_RM01, r.PENDIDIKAN, r.PENDIDIKAN_DESK);
  const goldar = bersih(r.GOL_DARAH);
  const negara = bersih(r.NEGARA);
  return {
    alamat: komposeAlamat(r),
    telp: telp(r.TELP),
    golDarah: /^tidak\s*tahu$/i.test(goldar) ? "" : goldar,
    pendidikan: pend.opt,
    pendidikanLain: pend.lain,
    bangsa: negara ? (/indonesia/i.test(negara) ? "Indonesia" : "Asing") : "",
    agama: AGAMA_RM01[kode(r.AGAMA) ?? -1] ?? "",
    statusPerkawinan: petaPerkawinan(r.PERKAWINAN, r.JENIS_KELAMIN),
    pekerjaan: PEKERJAAN_RM01[kode(r.PEKERJAAN) ?? -1] ?? "",
  };
}

/* --------------------------------------------------------------- keluarga */

/** SHDK (referensi JENIS 7). Orang tua (7) masuk kolom "nama orang tua", bukan "keluarga terdekat". */
const SHDK_ORANG_TUA = 7;
/** Suami, Isteri, Kepala Keluarga, Anak, Menantu, Cucu, Mertua, Family lain, Pembantu, Lainnya. */
const PRIORITAS_KELUARGA = [2, 3, 1, 4, 5, 6, 8, 9, 10, 11];

export function petaKeluarga(rows: readonly KeluargaRow[]): Record<string, unknown> {
  const ada = rows.filter((r) => bersih(r.NAMA));
  // Ayah (JK 1) lebih dulu, lalu ibu.
  const ortu = ada
    .filter((r) => kode(r.SHDK) === SHDK_ORANG_TUA)
    .sort((a, b) => (kode(a.JENIS_KELAMIN) ?? 9) - (kode(b.JENIS_KELAMIN) ?? 9));
  const dekat = PRIORITAS_KELUARGA.map((s) => ada.find((r) => kode(r.SHDK) === s)).find((r) => r !== undefined);
  return {
    namaOrangTua: ortu.map((r) => bersih(r.NAMA)).join(" / "),
    pekerjaanOrangTua: ortu.map((r) => bersih(r.PEKERJAAN)).filter(Boolean).join(" / "),
    keluargaNama: dekat ? bersih(dekat.NAMA) : "",
    keluargaAlamat: dekat ? bersih(dekat.ALAMAT) : "",
    keluargaTelp: dekat ? telp(dekat.TELP) : "",
  };
}

/* ---------------------------------------------------------------- episode */

/** Jenis pelayanan RM.01 dari nama ruang (leg rawat inap diutamakan, lalu IGD). */
export function petaJenisPelayanan(ruang: string | null): string {
  const r = bersih(ruang).toUpperCase();
  if (!r) return "";
  if (/NICU|NEONAT|PERINA|BAYI/.test(r)) return "Bayi";
  if (/\bICU\b|ICCU|HCU/.test(r)) return "ICU";
  if (/OBGYN|IRDO|KEBIDANAN|BERSALIN/.test(r)) return "Kebidanan";
  if (/ANAK|IRDA/.test(r)) return "Kes. Anak";
  if (/NON BEDAH|INTERNA|PENYAKIT DALAM|UMUM|ISOLASI/.test(r)) return "Non Bedah";
  if (/BEDAH/.test(r)) return "Bedah";
  return "";
}

/** Jenis PPK perujuk (`master.ppk.JENIS`) → cara masuk RM.01. */
const CARA_MASUK_PPK: Readonly<Record<number, string>> = { 1: "RS / RB", 2: "Puskesmas", 4: "Dokter" };

/**
 * Cara masuk dari surat rujukan pendaftaran. Episode rawat inap saja (pindahan
 * IGD ber-NOPEN baru) tidak diisi: rujukannya milik pendaftaran RI, bukan cara
 * pasien datang ke rumah sakit.
 */
export function petaCaraMasuk(e: Pick<EpisodeRow, "ADA_IGD_RJ" | "PPK_SENDIRI" | "PPK_JENIS">): string {
  if (kode(e.ADA_IGD_RJ) !== 1) return "";
  if (kode(e.PPK_SENDIRI) === 1) return "Sendiri";
  return CARA_MASUK_PPK[kode(e.PPK_JENIS) ?? -1] ?? "";
}

const PESERTA: Readonly<Record<number, string>> = { 1: "Umum", 2: "BPJS", 3: "Asuransi" };
/** Kelas kamar (referensi JENIS 19) → opsi RM.03. */
export const KELAS_KAMAR: Readonly<Record<number, string>> = { 1: "Kelas III", 2: "Kelas II", 3: "Kelas I", 4: "VIP" };

function petaEpisodeRm01(e: EpisodeRow): Record<string, unknown> {
  const masuk = waktu(e.MASUK);
  const keluar = waktu(e.KELUAR);
  const ke = kode(e.DIRAWAT_KE);
  return {
    dirawatKe: ke && ke > 0 ? String(ke) : "",
    caraMasuk: petaCaraMasuk(e),
    jenisPelayanan: petaJenisPelayanan(e.RUANG),
    tglMasuk: masuk,
    tglKeluar: keluar,
    lamaRawat: hitungLamaRawat(masuk, keluar),
    diagnosaSementara: bersih(e.DIAGNOSA_MASUK),
    dpjp: bersih(e.DPJP),
    peserta: PESERTA[kode(e.PENJAMIN_JENIS) ?? -1] ?? "",
    dokterMerawatNama: bersih(e.DPJP),
  };
}

/* ----------------------------------------------------------------- pulang */

/** Cara keluar (referensi JENIS 45) → izin keluar RM.01. Meninggal / DOA / lanjut rawat inap tak punya opsi. */
export const IZIN_KELUAR: Readonly<Record<number, string>> = {
  1: "Atas Persetujuan", // Diijinkan pulang
  2: "Atas Permintaan Sendiri", // Pulang paksa
  3: "Pindah Rumah Sakit Lain", // Dirujuk ke RS lain
  4: "Melarikan Diri", // Lari
  5: "Pindah Rumah Sakit Lain",
};
/** Keadaan keluar (referensi JENIS 46) → RM.01. DOA / lanjut rawat inap tak punya opsi. */
export const KEADAAN_KELUAR: Readonly<Record<number, string>> = {
  1: "Sembuh",
  2: "Membaik",
  3: "Belum Sembuh",
  4: "Mati ≤ 48 Jam",
  5: "Mati ≥ 48 Jam",
};

/* --------------------------------------------------------------- diagnosa */

/** Diagnosa akhir: utama (UTAMA=1 pertama) + sekunder digabung. */
export function ringkasDiagnosa(rows: readonly DiagnosaRow[]) {
  const utama = rows.find((r) => Number(r.UTAMA) === 1);
  const sekunder = rows.filter((r) => Number(r.UTAMA) !== 1);
  return {
    diagnosaUtama: utama ? bersih(utama.DIAGNOSA) : "",
    diagnosaUtamaKode: utama ? bersih(utama.KODE) : "",
    diagnosaSekunder: sekunder.map((r) => bersih(r.DIAGNOSA)).filter(Boolean).join("; "),
    diagnosaSekunderKode: sekunder.map((r) => bersih(r.KODE)).filter(Boolean).join(", "),
  };
}

/** Diagnosis RM.22: "Nama (KODE)" utama lebih dulu, lalu sekunder, dipisah "; ". */
export function teksDiagnosis(rows: readonly DiagnosaRow[]): string {
  const urut = [...rows.filter((r) => Number(r.UTAMA) === 1), ...rows.filter((r) => Number(r.UTAMA) !== 1)];
  const teks = urut.map((r) => {
    const nama = bersih(r.DIAGNOSA);
    const k = bersih(r.KODE);
    return nama && k ? `${nama} (${k})` : nama || k;
  });
  return [...new Set(teks.filter(Boolean))].join("; ");
}

/* ---------------------------------------------------------------- edukasi */

const ya = (v: Id) => kode(v) === 1;

/** Bendera hambatan SIMGOS → opsi RM.21 (urutan mengikuti formulir). */
const HAMBATAN: readonly [keyof EdukasiRow, string][] = [
  ["HAMBATAN_EMOSI", "Emosional"],
  ["HAMBATAN_FISIK", "Fisik Lemah"],
  ["HAMBATAN_PENGLIHATAN", "Gangguan Mata"],
  ["HAMBATAN_PENDENGARAN", "Gangguan Telinga"],
  ["HAMBATAN_KOGNITIF", "Bahasa / Kognitif Terbatas"],
  ["HAMBATAN_BAHASA", "Bahasa / Kognitif Terbatas"],
  ["HAMBATAN_BUDAYA", "Budaya / Agama / Spiritual"],
];

export function petaHambatan(r: EdukasiRow): { hambatan: string[]; lain: string } {
  const daftar = [...new Set(HAMBATAN.filter(([k]) => ya(r[k] as Id)).map(([, opsi]) => opsi))];
  const lain = bersih(r.HAMBATAN_LAINNYA);
  if (daftar.length === 0 && !lain) return { hambatan: kode(r.HAMBATAN) === 0 ? ["Tidak Ada"] : [], lain: "" };
  return { hambatan: daftar, lain };
}

function petaEdukasiRm21(r: EdukasiRow): Record<string, unknown> {
  const h = petaHambatan(r);
  const penerjemah = kode(r.PENERJEMAH);
  return {
    "persiapan.penerjemah": penerjemah === 1 ? "Ya" : penerjemah === 0 ? "Tidak" : "",
    "persiapan.hambatan": h.hambatan,
    "persiapan.hambatanLain": h.lain,
    // KESEDIAAN 0 bukan bukti penolakan: 525 dari 535 baris bernilai 0 tetap
    // berisi kebutuhan edukasi (kemungkinan nilai bawaan) → hanya "Bersedia" yang diisi.
    "persiapan.kesediaan": ya(r.KESEDIAAN) ? "Bersedia" : "",
  };
}

/** Kebutuhan edukasi menurut asesmen SIMRS → kategori edukator RM.21 (rujukan baca-saja). */
const KEBUTUHAN_EDUKASI: readonly { kolom: keyof EdukasiRow; kategori: string; topik: string }[] = [
  { kolom: "EDUKASI_HKP", kategori: "Keperawatan", topik: "Hak & kewajiban pasien" },
  { kolom: "EDUKASI_PEMBERIAN_INFORMED_CONSENT", kategori: "Keperawatan", topik: "Informed consent" },
  { kolom: "EDUKASI_NYERI", kategori: "Keperawatan", topik: "Manajemen nyeri" },
  { kolom: "EDUKASI_CUCI_TANGAN", kategori: "Keperawatan", topik: "Cuci tangan" },
  { kolom: "EDUKASI_NUTRISI", kategori: "Tenaga Gizi", topik: "Nutrisi" },
  { kolom: "EDUKASI_OBAT", kategori: "Farmasi", topik: "Obat-obatan" },
  { kolom: "EDUKASI_REHAB_MEDIK", kategori: "Tenaga Kesehatan Lainnya", topik: "Rehabilitasi medik" },
  { kolom: "EDUKASI_PENGGUNAAN_ALAT", kategori: "Tenaga Kesehatan Lainnya", topik: "Penggunaan alat medis" },
  { kolom: "EDUKASI_DIAGNOSA", kategori: "Dokter", topik: "Diagnosis" },
  { kolom: "EDUKASI_PENYAKIT", kategori: "Dokter", topik: "Penyakit" },
  { kolom: "EDUKASI_PROSEDURE_PENUNJANG", kategori: "Dokter", topik: "Prosedur penunjang" },
];
export const KATEGORI_KEBUTUHAN_EDUKASI = [...new Set(KEBUTUHAN_EDUKASI.map((k) => k.kategori))];

/** kategori edukator → topik yang dibutuhkan menurut SIMRS. */
export function kebutuhanEdukasi(r: EdukasiRow): Record<string, string[]> {
  const hasil: Record<string, string[]> = {};
  for (const k of KEBUTUHAN_EDUKASI) if (ya(r[k.kolom] as Id)) (hasil[k.kategori] ??= []).push(k.topik);
  return hasil;
}

/* ----------------------------------------------------------------- triase */

/** "2026-09-29 08:04:21" / "2026-09-29T08:04" → "2026-09-29T08:04" (jam dinding). "" bila tak valid. */
function keWaktuLokal(s: string | null): string {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(bersih(s));
  return m ? `${m[1]}T${m[2]}:${m[3]}` : "";
}

/** Angka TTV SIMGOS → teks rapi ("97.00" → "97"); 0 = tidak diukur → "". Non-angka dibiarkan. */
function angkaRapi(s: string | null): string {
  const t = bersih(s);
  if (!t) return "";
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n)) return t;
  return n > 0 ? String(n) : "";
}

/** Cara datang SIMGOS (jenis + alat transportasi + pengantar) → pilihan formulir. */
function petaCaraDatang(r: TriaseSimgosRow): Pick<TriaseForm, "caraDatang" | "caraDatangLain"> {
  const alat = bersih(r.DATANG_ALAT).toLowerCase();
  const pengantar = bersih(r.DATANG_PENGANTAR).toLowerCase();
  const jenis = Number(bersih(r.DATANG_JENIS));
  if (/ambulan/.test(alat)) return { caraDatang: "Ambulans", caraDatangLain: "" };
  if (jenis === 2) return { caraDatang: "Lain-lain", caraDatangLain: "Rujukan" };
  if (jenis === 3) return { caraDatang: "Lain-lain", caraDatangLain: "Dikirim polisi" };
  if (jenis !== 1 && !pengantar) return { caraDatang: "", caraDatangLain: "" };
  if (!pengantar || /^((datang|os) )?sendiri$|^pribadi$/.test(pengantar)) {
    return { caraDatang: "Sendiri", caraDatangLain: "" };
  }
  return { caraDatang: "Diantar", caraDatangLain: "" };
}

const petugasTriase = (r: TriaseSimgosRow) => bersih(r.DOKTER) || bersih(r.PERAWAT) || bersih(r.PENGGUNA);

/** Baris triase SIMGOS → kolom RM.04. */
export function petaTriase(r: TriaseSimgosRow): Record<string, unknown> {
  const waktuTriase = keWaktuLokal(r.WAKTU);
  const datang = keWaktuLokal(r.DATANG_TGL) || waktuTriase;
  const jenisKasus = bersih(r.KASUS_JENIS);
  const kasus = jenisKasus === "1" ? "Trauma" : jenisKasus === "0" ? "Non Trauma" : "";
  const kecelakaan = [
    bersih(r.KASUS_LL) === "1" ? "Kecelakaan Lalu Lintas" : "",
    bersih(r.KASUS_KK) === "1" ? "Kecelakaan Kerja" : "",
  ].filter(Boolean);
  const doa = bersih(r.KDOA) === "1";
  return {
    kedatanganWaktu: datang,
    ...petaCaraDatang(r),
    kasus,
    kecelakaan: kasus === "Trauma" ? kecelakaan : [],
    doa,
    doaWaktu: doa ? datang : "",
    tdSistolik: angkaRapi(r.SISTOLE),
    tdDiastolik: angkaRapi(r.DIASTOLE),
    nadi: angkaRapi(r.NADI),
    suhu: angkaRapi(r.SUHU),
    saturasi: angkaRapi(r.SATURASI),
    pernapasan: angkaRapi(r.NAFAS),
    waktuTriase,
    petugasNama: petugasTriase(r),
  };
}

/** Ringkasan triase SIMRS untuk rujukan baca-saja di form RM.04. */
export function ringkasTriase(r: TriaseSimgosRow): TriaseSimrs {
  const kat = [r.K1, r.K2, r.K3, r.K4, r.K5].findIndex((v) => bersih(v) === "1");
  const terpimpin = bersih(r.TERPIMPIN);
  return {
    waktu: keWaktuLokal(r.WAKTU),
    kategori: kat < 0 ? null : kat + 1,
    doa: bersih(r.KDOA) === "1",
    zona: bersih(r.ZONA),
    keluhan: [bersih(r.KELUHAN), terpimpin ? `(${terpimpin})` : ""].filter(Boolean).join(" "),
    petugas: petugasTriase(r),
  };
}

/* ------------------------------------------------------------------ morse */

/** Kode referensi SIMGOS (JENIS 186–191) → nilai opsi form Morse. 0 = tak diisi. */
const MORSE_KODE = {
  riwayatJatuh: { 1: "tidak", 2: "ya" },
  diagnosisSekunder: { 1: "tidak", 2: "ya" },
  alatBantu: { 1: "tidakAda", 2: "tongkat", 3: "furnitur" },
  terapiIntravena: { 1: "tidak", 2: "ya" },
  gayaBerjalan: { 1: "lemah", 2: "terganggu" },
  statusMental: { 1: "baik", 2: "lupa" },
} as const satisfies Record<string, Record<number, string>>;

/**
 * Pengkajian Morse pertama SIMRS → baris pengkajian awal (baris 1). Referensi
 * SIMGOS tak punya kode "normal" untuk gaya berjalan; isian SIMRS yang terisi
 * lengkap kecuali gaya berjalan (429 baris) = normal (skor 0, sama seperti
 * prosedur SIMGOS `grafikSkalaMorse` yang menghitung kode kosong sebagai 0).
 */
export function petaMorse(r: MorseRow): Record<string, unknown> {
  const ambil = <K extends keyof typeof MORSE_KODE>(k: K, v: Id): string =>
    (MORSE_KODE[k] as Record<number, string>)[kode(v) ?? -1] ?? "";
  const nilai = {
    riwayatJatuh: ambil("riwayatJatuh", r.RIWAYAT_JATUH),
    diagnosisSekunder: ambil("diagnosisSekunder", r.DIAGNOSIS),
    alatBantu: ambil("alatBantu", r.ALAT_BANTU),
    terapiIntravena: ambil("terapiIntravena", r.HEPARIN),
    gayaBerjalan: ambil("gayaBerjalan", r.GAYA_BERJALAN),
    statusMental: ambil("statusMental", r.KESADARAN),
  };
  const lainTerisi = [nilai.riwayatJatuh, nilai.diagnosisSekunder, nilai.alatBantu, nilai.terapiIntravena, nilai.statusMental].every(Boolean);
  if (!nilai.gayaBerjalan && kode(r.GAYA_BERJALAN) === 0 && lainTerisi) nilai.gayaBerjalan = "normal";
  return {
    "pengkajian.0.waktu": waktu(r.WAKTU),
    ...Object.fromEntries(Object.entries(nilai).map(([k, v]) => [`pengkajian.0.${k}`, v])),
    "pengkajian.0.petugasNama": bersih(r.PETUGAS),
  };
}

/* ----------------------------------------------------------- peta per form */

/** Form tanpa entri = tanpa isi otomatis (form deklaratif boleh tak memakai SIMRS). */
export const PETA_FORM: Readonly<Partial<Record<KodeForm, PetaForm>>> = {
  "RM.04": {
    sumber: ["identitas", "triase"],
    petakan(h) {
      const out: NilaiSimrs = {};
      // Tanpa triase SIMRS: waktu masuk kunjungan sebagai waktu kedatangan (ditimpa triase bila ada).
      if (h.identitas) isi(out, "identitas", { kedatanganWaktu: jamDinding(h.identitas.masuk) });
      if (h.triase) isi(out, "triase", petaTriase(h.triase));
      return out;
    },
    bawaan(d) {
      if (!d.waktuTriase) d.waktuTriase = d.kedatanganWaktu;
    },
  },
  "RM.21": {
    sumber: ["sosial", "edukasi"],
    petakan(h) {
      const out: NilaiSimrs = {};
      if (h.sosial) {
        const b = petaBahasa(h.sosial.BAHASA);
        const p = petaPendidikan(PENDIDIKAN_RM21, h.sosial.PENDIDIKAN, h.sosial.PENDIDIKAN_DESK);
        isi(out, "sosial", {
          "persiapan.bahasa": b.bahasa,
          "persiapan.bahasaLain": b.lain,
          "persiapan.pendidikan": p.opt,
          "persiapan.pendidikanLain": p.lain,
        });
      }
      if (h.edukasi) isi(out, "edukasi", petaEdukasiRm21(h.edukasi));
      return out;
    },
  },
  "RM.01": {
    sumber: ["sosial", "keluarga", "episode", "diagnosa", "pulang"],
    petakan(h) {
      const out: NilaiSimrs = {};
      if (h.sosial) isi(out, "sosial", petaSosialRm01(h.sosial));
      if (h.keluarga) isi(out, "keluarga", petaKeluarga(h.keluarga));
      if (h.episode) isi(out, "episode", petaEpisodeRm01(h.episode));
      if (h.diagnosa) isi(out, "diagnosa", ringkasDiagnosa(h.diagnosa));
      if (h.pulang) {
        isi(out, "pulang", {
          izinKeluar: IZIN_KELUAR[kode(h.pulang.CARA) ?? -1] ?? "",
          keadaanKeluar: KEADAAN_KELUAR[kode(h.pulang.KEADAAN) ?? -1] ?? "",
        });
      }
      return out;
    },
    bawaan(d, hariIni) {
      d.sebabKematianTanggal = hariIni;
    },
  },
  "RM.03": {
    sumber: ["identitas", "episode"],
    petakan(h) {
      const out: NilaiSimrs = {};
      if (h.identitas) {
        isi(out, "identitas", {
          nik: h.identitas.nik,
          waktuPendaftaran: jamDinding(h.identitas.masuk),
          ruanganRawat: bukanStrip(h.identitas.ruang),
          pasienNama: bukanStrip(h.identitas.nama),
        });
      }
      if (h.episode) isi(out, "episode", { kelas: KELAS_KAMAR[kode(h.episode.KELAS) ?? -1] ?? "" });
      return out;
    },
    bawaan(d, hariIni) {
      d.tanggalTtd = hariIni;
    },
  },
  "RM.22": {
    sumber: ["identitas", "sosial", "episode", "diagnosa"],
    petakan(h) {
      const out: NilaiSimrs = {};
      if (h.identitas) {
        isi(out, "identitas", {
          pasienNama: bukanStrip(h.identitas.nama),
          pasienUmur: umurTahun(h.identitas.umur),
          pasienJk: jkRm22(h.identitas.jenisKelamin),
        });
      }
      if (h.sosial) isi(out, "sosial", { pasienAlamat: komposeAlamat(h.sosial) });
      if (h.episode) {
        // Diagnosa masuk = cadangan; diagnosa episode (bila sudah dikoding) menimpanya.
        isi(out, "episode", { pemberiInformasi: bersih(h.episode.DPJP), "informasi.diagnosis.isi": bersih(h.episode.DIAGNOSA_MASUK) });
      }
      if (h.diagnosa) isi(out, "diagnosa", { "informasi.diagnosis.isi": teksDiagnosis(h.diagnosa) });
      return out;
    },
    bawaan(d, hariIni) {
      d.tanggal = hariIni;
    },
  },
  "RM.MORSE": {
    sumber: ["morse"],
    petakan(h) {
      const out: NilaiSimrs = {};
      if (h.morse) isi(out, "morse", petaMorse(h.morse));
      return out;
    },
  },
};
