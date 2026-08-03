import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { queryTurunanByNopens } from "@/server/modules/pelayanan/pelayanan.dal";
import { queryBuktiReportHeader, querySepByNopen } from "./berkas-klaim.dal";
import { getBuktiContext } from "./berkas-klaim.bukti.service";
import type { BuktiTindakanRow } from "./berkas-klaim.types";

const RUMAH_SAKIT = "RSUD BOLAANG MONGONDOW TIMUR";

/** Baca DATETIME SIMGOS sebagai jam-dinding (getUTC*, bebas timezone mesin). */
function wallParts(v: Date | string | null): { y: number; m: number; d: number } | null {
  if (v == null) return null;
  const dt = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(dt.getTime())) return null;
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** DATETIME/ISO → "DD-MM-YYYY" (jam-dinding). Kosong bila null/invalid. */
function fmtDate(v: Date | string | null): string {
  const p = wallParts(v);
  return p ? `${pad(p.d)}-${pad(p.m)}-${p.y}` : "";
}

/** "YYYY-MM-DD…" (dari form tersimpan/prefill) → "DD-MM-YYYY". */
function fmtIsoDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s.trim();
}

/** Selisih hari MRS→KRS (inklusif minimal 1 bila keduanya ada). */
function hariRawat(masuk: Date | string | null, keluar: Date | string | null): string {
  const a = wallParts(masuk);
  const b = wallParts(keluar);
  if (!a || !b) return "";
  const da = Date.UTC(a.y, a.m - 1, a.d);
  const db = Date.UTC(b.y, b.m - 1, b.d);
  const diff = Math.round((db - da) / 86_400_000);
  return String(Math.max(1, diff));
}

/** Satu baris Tabel B (catatan pelayanan). */
export type BuktiReportRow = {
  ruang: string;
  tanggal: string;
  tindakan: string;
  pelaksana: string;
  keterangan: string;
};

/** Data lengkap formulir Bukti Pelayanan / Perawatan Peserta JKN-KIS. */
export type BuktiPelayananReport = {
  nopen: string;
  rumahSakit: string;
  namaPenderita: string;
  /** No. Surat Jaminan Perawatan / SEP. */
  noSuratJaminan: string;
  noKartuJkn: string;
  namaPeserta: string;
  noMedicalRecord: string;
  diagnosa: string;
  /** Ringkasan rawat (Tabel A). */
  ruangKelas: string;
  mrsTanggal: string;
  krsTanggal: string;
  jumlahHari: string;
  dpjp: string;
  penjamin: string;
  /** Tabel B — semua tindakan 1:1. */
  rows: BuktiReportRow[];
  /** true bila dari Bukti tersimpan (bukan prefill SIMGOS mentah). */
  tersimpan: boolean;
  dicetakPada: string;
};

/**
 * Rakit data formulir Bukti Pelayanan untuk satu NOPEN (READ-ONLY dari SIMGOS +
 * Bukti tersimpan di reporthub). Tabel B = SEMUA tindakan 1:1: dari Bukti
 * tersimpan bila ada (hasil isian/sunting petugas), atau prefill `layanan.tindakan_medis`.
 */
export async function getBuktiPelayananReport(
  nopen: string,
): Promise<BuktiPelayananReport | null> {
  if (!isSimgosConfigured()) return null;

  const h = await queryBuktiReportHeader(nopen);
  if (!h) return null;

  const [legs, ctx, sep] = await Promise.all([
    queryTurunanByNopens([nopen]),
    getBuktiContext(nopen),
    querySepByNopen(nopen).catch(() => null),
  ]);

  // Leg klinis utama (RI > IGD > RJ) untuk ringkasan rawat.
  const mainLeg =
    [3, 2, 1].map((j) => legs.find((l) => Number(l.JENIS_KUNJUNGAN) === j)).find(Boolean) ??
    legs[0] ??
    null;
  const ruang = mainLeg?.RUANG?.trim() || "—";

  const saved = ctx.saved;
  const tindakan: BuktiTindakanRow[] =
    saved && saved.data.tindakan.length > 0 ? saved.data.tindakan : ctx.tindakanSimgos;

  const rows: BuktiReportRow[] = tindakan.map((t) => ({
    ruang,
    tanggal: fmtIsoDate(t.tanggal),
    tindakan: t.nama?.trim() || "",
    pelaksana: t.pelaksana?.trim() || "",
    keterangan: t.keterangan?.trim() || "",
  }));

  return {
    nopen,
    rumahSakit: RUMAH_SAKIT,
    namaPenderita: h.NAMA?.trim() || "—",
    noSuratJaminan: sep ?? saved?.data.noSep?.trim() ?? "",
    noKartuJkn: h.NO_KARTU?.trim() ?? "",
    namaPeserta: h.NAMA_PESERTA?.trim() || h.NAMA?.trim() || "",
    noMedicalRecord: String(h.NORM ?? ""),
    diagnosa: h.DIAGNOSA?.trim() ?? "",
    ruangKelas: ruang,
    mrsTanggal: fmtDate(mainLeg?.MASUK ?? null),
    krsTanggal: fmtDate(mainLeg?.KELUAR ?? null),
    jumlahHari: hariRawat(mainLeg?.MASUK ?? null, mainLeg?.KELUAR ?? null),
    dpjp: saved?.data.dpjp?.trim() || ctx.dpjpSimgos || "",
    penjamin: saved?.data.penjamin?.trim() || "BPJS Kesehatan",
    rows,
    tersimpan: !!saved,
    dicetakPada: new Date().toISOString(),
  };
}
