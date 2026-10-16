import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { hitungUmur } from "@/lib/format";
import { queryFormRmHeader } from "./form-rm.dal";
import { kebutuhanEdukasi, ringkasKeluarSimrs, ringkasTriase } from "./isian.petakan";
import { bacaEdukasiRujukan, bacaTriaseRujukan } from "./isian.sumber";
import { queryPulang } from "./isian.sumber.dal";
import type { BacaKeluarSimrs, FormRmHeader, KebutuhanEdukasiSimrs, TriaseSimrs } from "./form-rm.types";

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

/**
 * Triase terakhir episode di SIMRS (rujukan baca-saja RM.04). Episode rawat
 * inap tanpa triase → triase episode IGD asalnya. Null bila tak ada / gagal.
 */
export async function bacaTriaseSimrs(nopen: string): Promise<TriaseSimrs | null> {
  if (!isSimgosConfigured()) return null;
  const r = await bacaTriaseRujukan(nopen).catch(() => null);
  return r ? { ...ringkasTriase(r.nilai), episodeIgd: r.nopenIgd } : null;
}

/** Kebutuhan edukasi menurut asesmen SIMRS (rujukan baca-saja RM.21). Null bila tak ada / gagal. */
export async function bacaKebutuhanEdukasi(nopen: string): Promise<KebutuhanEdukasiSimrs | null> {
  if (!isSimgosConfigured()) return null;
  const r = await bacaEdukasiRujukan(nopen).catch(() => null);
  return r ? { perKategori: kebutuhanEdukasi(r.nilai), episodeIgd: r.nopenIgd } : null;
}

/**
 * Keluar pasien menurut SIMRS (`layanan.pasien_pulang` episode ini; rujukan
 * baca-saja RM.01 — dasar kolom Keadaan Keluar yang tertaut). "kosong" = belum
 * dipulangkan di SIMRS; "gagal" = SIMRS tak terbaca (tanpa NOPEN di log).
 */
export async function bacaKeluarSimrs(nopen: string): Promise<BacaKeluarSimrs> {
  if (!isSimgosConfigured()) return { status: "gagal", keluar: null };
  try {
    const row = await queryPulang(nopen);
    return row ? { status: "ada", keluar: ringkasKeluarSimrs(row) } : { status: "kosong", keluar: null };
  } catch (e) {
    console.warn(`[form-rm] baca keluar SIMRS gagal (${(e as { code?: string })?.code ?? (e as Error)?.name ?? "galat"})`);
    return { status: "gagal", keluar: null };
  }
}
