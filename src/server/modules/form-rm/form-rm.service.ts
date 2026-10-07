import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { hitungUmur } from "@/lib/format";
import {
  queryFormRmHeader,
  queryRingkasanHeader,
  queryDiagnosaByNopen,
  queryTriaseSimgos,
  type DiagnosaRow,
  type TriaseSimgosRow,
} from "./form-rm.dal";
import {
  matchAgama,
  matchPekerjaan,
  matchPendidikan,
  matchPerkawinan,
} from "@/features/form-rm/ringkasan.constants";
import type { FormRmHeader, RingkasanPrefill, TriasePrefill, TriaseSimrs } from "./form-rm.types";

function toIso(v: Date | string | null): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** DATETIME adapter (jam dinding di field UTC) → tanggal lokal; null bila tak valid. */
function tanggalDinding(v: Date | string | null): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Header identitas pasien untuk kepala formulir. Umur dihitung pada tanggal
 * masuk episode (umur saat dilayani, bukan saat dicetak). Null bila NOPEN tak
 * ditemukan.
 */
export async function getFormRmHeader(nopen: string): Promise<FormRmHeader | null> {
  if (!isSimgosConfigured()) return null;
  const h = await queryFormRmHeader(nopen);
  if (!h) return null;

  const lahir = h.TANGGAL_LAHIR
    ? h.TANGGAL_LAHIR instanceof Date
      ? h.TANGGAL_LAHIR
      : new Date(h.TANGGAL_LAHIR)
    : null;
  const jk = Number(h.JENIS_KELAMIN);

  return {
    nopen,
    norm: String(h.NORM ?? ""),
    nama: h.NAMA?.trim() || "—",
    jenisKelamin: jk === 1 ? "Laki-Laki" : jk === 2 ? "Perempuan" : "—",
    tanggalLahir: toIso(h.TANGGAL_LAHIR),
    umur: hitungUmur(lahir && !Number.isNaN(lahir.getTime()) ? lahir : null, tanggalDinding(h.MASUK) ?? new Date()),
    ruang: h.RUANG?.trim() || "—",
    masuk: toIso(h.MASUK) ?? new Date().toISOString(),
    nik: h.NIK?.trim() || "",
  };
}

// --- RM.01 Ringkasan Masuk & Keluar --------------------------------------

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Date SIMGOS (jam-dinding di field UTC) → "YYYY-MM-DDTHH:mm" lokal. Baca getUTC*. */
function toWallClockLocal(v: Date | string | null): string {
  if (v == null) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return (
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  );
}

/** Selisih hari (kalender) masuk→keluar sebagai "lama rawat". "" bila tak lengkap. */
function hitungLamaRawat(masuk: Date | string | null, keluar: Date | string | null): string {
  if (masuk == null || keluar == null) return "";
  const dm = masuk instanceof Date ? masuk : new Date(masuk);
  const dk = keluar instanceof Date ? keluar : new Date(keluar);
  if (Number.isNaN(dm.getTime()) || Number.isNaN(dk.getTime())) return "";
  const a = Date.UTC(dm.getUTCFullYear(), dm.getUTCMonth(), dm.getUTCDate());
  const b = Date.UTC(dk.getUTCFullYear(), dk.getUTCMonth(), dk.getUTCDate());
  const days = Math.round((b - a) / 86_400_000);
  return days >= 0 ? String(days) : "";
}

function komposeAlamat(alamat: string | null, rt: string | null, rw: string | null): string {
  const isReal = (s: string | null) => !!s && s.trim() !== "" && !/^0+$/.test(s.trim());
  const parts = [
    alamat?.trim() || "",
    isReal(rt) ? `RT ${rt!.trim()}` : "",
    isReal(rw) ? `RW ${rw!.trim()}` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

/** Susun diagnosa akhir: utama (baris UTAMA=1 pertama) + sekunder (UTAMA=2, gabung). */
function ringkasDiagnosa(rows: DiagnosaRow[]) {
  const clean = (s: string | null) => (s ?? "").trim();
  const utamaRows = rows.filter((r) => Number(r.UTAMA) === 1);
  const sekRows = rows.filter((r) => Number(r.UTAMA) !== 1);
  const u = utamaRows[0];
  return {
    diagnosaUtama: u ? clean(u.DIAGNOSA) : "",
    diagnosaUtamaKode: u ? clean(u.KODE) : "",
    diagnosaSekunder: sekRows.map((r) => clean(r.DIAGNOSA)).filter(Boolean).join("; "),
    diagnosaSekunderKode: sekRows.map((r) => clean(r.KODE)).filter(Boolean).join(", "),
  };
}

const EMPTY_PREFILL: RingkasanPrefill = {
  alamat: "",
  golDarah: "",
  dirawatKe: "",
  pendidikan: "",
  pendidikanLain: "",
  bangsa: "",
  agama: "",
  statusPerkawinan: "",
  pekerjaan: "",
  tglMasuk: "",
  tglKeluar: "",
  lamaRawat: "",
  dpjp: "",
  peserta: "",
  diagnosaUtama: "",
  diagnosaUtamaKode: "",
  diagnosaSekunder: "",
  diagnosaSekunderKode: "",
};

/**
 * Prefill RM.01 dari SIMGOS (read-only), sudah dipetakan ke opsi formulir.
 * Sumber yang gagal/kosong → nilai kosong (form tetap bisa diisi manual).
 */
export async function prefillRingkasan(nopen: string, header: FormRmHeader): Promise<RingkasanPrefill> {
  if (!isSimgosConfigured()) return EMPTY_PREFILL;
  const [row, dx] = await Promise.all([
    queryRingkasanHeader(nopen).catch(() => null),
    queryDiagnosaByNopen(nopen).catch(() => [] as DiagnosaRow[]),
  ]);
  if (!row) return EMPTY_PREFILL;
  const pend = matchPendidikan(row.PENDIDIKAN?.trim() || "");
  const goldar = row.GOL_DARAH?.trim() || "";
  const negara = row.NEGARA?.trim() || "";
  const penjamin = Number(row.PENJAMIN_JENIS);
  return {
    alamat: komposeAlamat(row.ALAMAT, row.RT, row.RW),
    golDarah: /^tidak\s*tahu$/i.test(goldar) ? "" : goldar,
    dirawatKe: row.DIRAWAT_KE != null ? String(Number(row.DIRAWAT_KE) || "") : "",
    pendidikan: pend.opt,
    pendidikanLain: pend.lain,
    bangsa: negara ? (/indonesia/i.test(negara) ? "Indonesia" : "Asing") : "",
    agama: matchAgama(row.AGAMA?.trim() || ""),
    statusPerkawinan: matchPerkawinan(row.PERKAWINAN?.trim() || "", header.jenisKelamin),
    pekerjaan: matchPekerjaan(row.PEKERJAAN?.trim() || ""),
    tglMasuk: toWallClockLocal(row.MASUK),
    tglKeluar: toWallClockLocal(row.KELUAR),
    lamaRawat: hitungLamaRawat(row.MASUK, row.KELUAR),
    dpjp: row.DPJP?.trim() || "",
    peserta: penjamin === 2 ? "BPJS" : penjamin === 3 ? "Asuransi" : penjamin === 1 ? "Umum" : "",
    ...ringkasDiagnosa(dx),
  };
}

// --- RM.04 Triase IGD ------------------------------------------------------

const bersih = (s: string | null | undefined) => (s ?? "").trim();

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
function petaCaraDatang(r: TriaseSimgosRow): Pick<TriasePrefill, "caraDatang" | "caraDatangLain"> {
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

/** Baris triase SIMGOS → prefill form RM.04 + ringkasan rujukan SIMRS. */
function petaTriaseSimgos(r: TriaseSimgosRow): { prefill: TriasePrefill; simrs: TriaseSimrs } {
  const waktu = keWaktuLokal(r.WAKTU);
  const datang = keWaktuLokal(r.DATANG_TGL) || waktu;
  const kasusJenis = bersih(r.KASUS_JENIS);
  const kasus: TriasePrefill["kasus"] =
    kasusJenis === "1" ? "Trauma" : kasusJenis === "0" ? "Non Trauma" : "";
  const kecelakaan = [
    bersih(r.KASUS_LL) === "1" ? "Kecelakaan Lalu Lintas" : "",
    bersih(r.KASUS_KK) === "1" ? "Kecelakaan Kerja" : "",
  ].filter(Boolean);
  const doa = bersih(r.KDOA) === "1";
  const kat = [r.K1, r.K2, r.K3, r.K4, r.K5].findIndex((v) => bersih(v) === "1");
  const petugas = bersih(r.DOKTER) || bersih(r.PERAWAT) || bersih(r.PENGGUNA);
  const terpimpin = bersih(r.TERPIMPIN);

  return {
    prefill: {
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
      waktuTriase: waktu,
      petugasNama: petugas,
    },
    simrs: {
      waktu,
      kategori: kat < 0 ? null : kat + 1,
      doa,
      zona: bersih(r.ZONA),
      keluhan: [bersih(r.KELUHAN), terpimpin ? `(${terpimpin})` : ""].filter(Boolean).join(" "),
      petugas,
    },
  };
}

/** Triase terakhir episode dari SIMRS → prefill RM.04 + ringkasan rujukan; null bila tak ada. */
export async function bacaTriaseSimrs(
  nopen: string,
): Promise<{ prefill: TriasePrefill; simrs: TriaseSimrs } | null> {
  if (!isSimgosConfigured()) return null;
  const row = await queryTriaseSimgos(nopen).catch(() => null);
  return row ? petaTriaseSimgos(row) : null;
}
