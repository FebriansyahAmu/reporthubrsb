import { EDUKASI_KATEGORI } from "./edukasi.constants";
import { definisiForm } from "./registry";
import { adalahDataUrlTtd, idDariRefTtd } from "./skema";

/**
 * LABEL KOLOM ISIAN — nama manusiawi per path untuk log perubahan, panel
 * konflik, dan pemberitahuan form berlanjut (PRD Berlanjut IGD → RI §5.6, §8.1).
 * Murni & aman untuk klien. Path yang tak terdaftar → nama dari path itu sendiri.
 */

type PetaLabel = Readonly<Record<string, string>>;

const RM21: PetaLabel = {
  "persiapan.bahasa": "Bahasa",
  "persiapan.bahasaLain": "Bahasa lain",
  "persiapan.penerjemah": "Kebutuhan penerjemah",
  "persiapan.pendidikan": "Pendidikan pasien",
  "persiapan.pendidikanLain": "Pendidikan lain",
  "persiapan.bacaTulis": "Baca & tulis",
  "persiapan.tipePembelajaran": "Tipe pembelajaran",
  "persiapan.hambatan": "Hambatan edukasi",
  "persiapan.hambatanLain": "Hambatan lain",
  "persiapan.kesediaan": "Kesediaan menerima edukasi",
  entries: "Kebutuhan edukasi",
  catatan: "Catatan tambahan",
};

/** Kolom per kategori kebutuhan edukasi (`entries.<i>.<kolom>`). */
const RM21_ENTRI: PetaLabel = {
  kategori: "kategori",
  aktif: "diberikan",
  edukatorNama: "nama edukator",
  tanggalJam: "tanggal & jam",
  durasiMenit: "durasi (menit)",
  sasaran: "sasaran",
  sasaranNama: "nama sasaran",
  sasaranHubungan: "hubungan sasaran dengan pasien",
  sasaranTtd: "tanda tangan sasaran",
  metode: "metode edukasi",
  sarana: "sarana edukasi",
  saranaLain: "sarana lain",
  pemahaman: "tingkat pemahaman",
  evaluasi: "evaluasi",
  tanggalReEdukasi: "tanggal re-edukasi",
};

const RM03: PetaLabel = {
  waktuPendaftaran: "Tanggal & jam pendaftaran",
  ruanganRawat: "Ruangan rawat",
  kelas: "Kelas",
  nik: "NIK",
  pjNama: "Penanggung jawab: nama",
  pjJenisKelamin: "Penanggung jawab: jenis kelamin",
  pjUmur: "Penanggung jawab: umur",
  pjHubungan: "Penanggung jawab: hubungan dengan pasien",
  pjAlamat: "Penanggung jawab: alamat",
  pjTelepon: "Penanggung jawab: telepon",
  pelepasanInfo: "Pelepasan informasi (III)",
  izinPrivasi: "Akses pengunjung (IV)",
  permintaanKhusus: "Permintaan privasi khusus (IV)",
  pasienNama: "Nama pasien / penanggung jawab",
  pasienTtd: "Tanda tangan pasien / penanggung jawab",
  petugasNama: "Nama petugas",
  petugasTtd: "Tanda tangan petugas",
  tanggalTtd: "Tanggal tanda tangan",
};

const RM01: PetaLabel = {
  alamat: "Alamat",
  telp: "Telp / HP",
  dirawatKe: "Dirawat ke-",
  golDarah: "Gol. darah",
  pendidikan: "Pendidikan terakhir",
  pendidikanLain: "Pendidikan lain",
  bangsa: "Bangsa",
  agama: "Agama",
  statusPerkawinan: "Status perkawinan",
  pekerjaan: "Pekerjaan",
  caraMasuk: "Cara masuk rumah sakit",
  jenisPelayanan: "Jenis pelayanan",
  namaOrangTua: "Nama orang tua",
  pekerjaanOrangTua: "Pekerjaan orang tua",
  keluargaNama: "Keluarga terdekat: nama",
  keluargaAlamat: "Keluarga terdekat: alamat",
  keluargaTelp: "Keluarga terdekat: telp / HP",
  tglMasuk: "Tanggal & jam masuk",
  tglKeluar: "Tanggal & jam keluar",
  lamaRawat: "Lama rawat",
  diagnosaSementara: "Diagnosa sementara",
  dpjp: "Dokter jaga / DPJP",
  peserta: "Peserta",
  izinKeluar: "Izin keluar",
  diagnosaUtama: "Diagnosa utama",
  diagnosaUtamaKode: "Kode ICD diagnosa utama",
  diagnosaSekunder: "Diagnosa sekunder",
  diagnosaSekunderKode: "Kode ICD diagnosa sekunder",
  komplikasi: "Komplikasi",
  komplikasiKode: "Kode ICD komplikasi",
  penyebabLuar: "Penyebab luar cedera & keracunan",
  penyebabLuarKode: "Kode ICD penyebab luar",
  operasi: "Operasi",
  operasiKode: "Kode ICD operasi",
  catatan: "Catatan",
  infeksiNosokomial: "Infeksi nosokomial",
  penyebabInfeksiNosokomial: "Penyebab infeksi nosokomial",
  imunisasi: "Sejarah imunisasi",
  dokterMerawatNama: "Nama dokter yang merawat",
  dokterMerawatTtd: "Tanda tangan dokter yang merawat",
  keadaanKeluar: "Keadaan keluar",
  sebabKematianAktif: "Sebab kematian (halaman 2)",
  skA: "Sebab kematian I.a",
  skALama: "Sebab kematian I.a: lama sakit",
  skB: "Sebab kematian I.b",
  skBLama: "Sebab kematian I.b: lama sakit",
  skC: "Sebab kematian I.c",
  skCLama: "Sebab kematian I.c: lama sakit",
  skLain: "Penyakit lain (sebab kematian II)",
  rudaPaksaMacam: "Macam ruda paksa",
  rudaPaksaCara: "Cara kejadian ruda paksa",
  rudaPaksaSifat: "Sifat jejas",
  lahirMatiJanin: "Janin lahir mati",
  lahirMatiSebab: "Sebab kelahiran mati",
  persalinan: "Peristiwa persalinan",
  kehamilan: "Peristiwa kehamilan",
  operasiKhususAda: "Dilakukan operasi",
  operasiKhususJenis: "Jenis operasi",
  sebabKematianTanggal: "Tanggal keterangan sebab kematian",
  dokterKematianNama: "Dokter pemberi keterangan sebab kematian",
  dokterKematianTtd: "Tanda tangan dokter pemberi keterangan sebab kematian",
};

const PETA: Readonly<Record<string, PetaLabel>> = { "RM.21": RM21, "RM.03": RM03, "RM.01": RM01 };

/** "pjNama" → "Pj nama" (cadangan untuk path tak terdaftar). */
function dariPath(p: string): string {
  const akhir = p.split(".").filter((s) => !/^\d+$/.test(s)).pop() ?? p;
  const kata = akhir.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return kata.charAt(0).toUpperCase() + kata.slice(1);
}

/** Label terdaftar untuk path; null bila tidak terdaftar. */
export function labelTerdaftar(kode: string, p: string, data?: unknown): string | null {
  const peta = PETA[kode];
  if (!peta) return null;
  if (Object.hasOwn(peta, p)) return peta[p];
  const s = p.split(".");
  if (kode === "RM.21" && s[0] === "entries" && s.length >= 2 && /^\d+$/.test(s[1])) {
    const i = Number(s[1]);
    const dariData = (data as { entries?: { kategori?: unknown }[] } | null | undefined)?.entries?.[i]?.kategori;
    const kategori = typeof dariData === "string" && dariData ? dariData : (EDUKASI_KATEGORI[i]?.key ?? `#${i + 1}`);
    if (s.length === 2) return `Edukasi ${kategori}`;
    if (s.length === 3 && Object.hasOwn(RM21_ENTRI, s[2])) return `Edukasi ${kategori}: ${RM21_ENTRI[s[2]]}`;
    return null;
  }
  if (kode === "RM.01" && s[0] === "skLain" && s.length >= 2 && /^\d+$/.test(s[1])) {
    const baris = `Penyakit lain II.${Number(s[1]) + 1}`;
    if (s.length === 2) return baris;
    if (s.length === 3 && s[2] === "teks") return baris;
    if (s.length === 3 && s[2] === "lama") return `${baris}: lama sakit`;
  }
  return null;
}

/** Label manusiawi path kolom (`data` membantu menamai baris berkategori, mis. edukasi). */
export const labelKolom = (kode: string, p: string, data?: unknown): string => labelTerdaftar(kode, p, data) ?? dariPath(p);

/** Daftar label tanpa duplikat, urut kemunculan (pemberitahuan "mengubah: …"). */
export function daftarLabel(kode: string, paths: readonly string[], data?: unknown): string[] {
  return [...new Set(paths.map((p) => labelKolom(kode, p, data)))];
}

/** Path slot tanda tangan isian (TTD ditampilkan sebagai "tanda tangan diganti", bukan gambar). */
export function slotTtd(kode: string, data: unknown): Set<string> {
  const def = definisiForm(kode);
  const slot = new Set<string>();
  if (!def || !data || typeof data !== "object") return slot;
  try {
    def.petaTtd(data as object, (v, s) => {
      slot.add(s);
      return v;
    });
  } catch {
    // data tak berbentuk form ini → tanpa slot
  }
  return slot;
}

/** Perubahan TTD dalam kata-kata (tanpa gambar). */
export function ringkasTtd(sebelum: unknown, sesudah: unknown): string {
  const ada = (v: unknown) => typeof v === "string" && (idDariRefTtd(v) !== null || adalahDataUrlTtd(v));
  if (!ada(sebelum) && ada(sesudah)) return "ditandatangani";
  if (ada(sebelum) && !ada(sesudah)) return "tanda tangan dihapus";
  return "tanda tangan diganti";
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const TANGGAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

/** Nilai kolom → teks singkat untuk log & konflik (tanggal isian "2026-11-12T10:42" → "12 Nov 2026 10.42"). */
export function ringkasNilai(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(kosong)";
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  if (typeof v === "string") {
    const m = TANGGAL_RE.exec(v);
    return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}${m[4] ? ` ${m[4]}.${m[5]}` : ""}` : v;
  }
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    const isi = v.map(ringkasNilai).filter((x) => x !== "(kosong)");
    return isi.length > 0 ? isi.join(", ") : "(kosong)";
  }
  if (typeof v === "object") {
    const isi = Object.values(v as Record<string, unknown>)
      .map(ringkasNilai)
      .filter((x) => x !== "(kosong)");
    return isi.length > 0 ? isi.join(" · ") : "(kosong)";
  }
  return String(v);
}
