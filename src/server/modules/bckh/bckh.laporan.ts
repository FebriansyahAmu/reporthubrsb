import "server-only";
import { tanggalHariIniWita } from "@/lib/format";
import { getAppDb } from "@/server/db/app.client";
import { writeAudit } from "@/server/lib/audit";
import type { PenggunaBckh } from "./bckh.akses";
import { barisLaporan, hariKerjaDalam, hitungDasbor, rentangBulanIni } from "./bckh.aturan";
import { AKSI_AUDIT_PENGATURAN, NAMA_BULAN, PENGATURAN_BAWAAN, type PengaturanLaporan } from "./bckh.constants";
import { hariRingkas } from "./bckh.dal";
import { bacaProfil } from "./bckh.profil";
import type { SimpanPengaturanInput } from "./bckh.schema";
import type { DasborResult, LaporanResult } from "./bckh.types";

/* ------------------------------------------------------------- pengaturan */

const PILIH_PENGATURAN = {
  kop1: true,
  kop2: true,
  instansi1: true,
  instansi2: true,
  mengetahuiJabatan: true,
  mengetahuiNama: true,
  mengetahuiNip: true,
} as const;

export type PengaturanDto = PengaturanLaporan & { tersimpan: boolean; diubahOleh: string | null; diubahAt: string | null };

export async function bacaPengaturan(): Promise<PengaturanDto> {
  const row = await getAppDb().bckhPengaturan.findUnique({
    where: { id: 1 },
    select: { ...PILIH_PENGATURAN, diubahOlehNama: true, updatedAt: true },
  });
  if (!row) return { ...PENGATURAN_BAWAAN, tersimpan: false, diubahOleh: null, diubahAt: null };
  const { diubahOlehNama, updatedAt, ...isi } = row;
  return { ...isi, tersimpan: true, diubahOleh: diubahOlehNama, diubahAt: updatedAt.toISOString() };
}

/** Simpan pengaturan laporan global + jejak `audit_log` (dari → ke per field yang berubah). */
export async function simpanPengaturan(
  input: SimpanPengaturanInput,
  aktor: { id: string; nama: string; ip: string | null },
): Promise<PengaturanDto> {
  const lama = await bacaPengaturan();
  const berubah = (Object.keys(input) as (keyof SimpanPengaturanInput)[]).filter((k) => lama[k] !== input[k]);
  if (berubah.length === 0 && lama.tersimpan) return lama;
  const oleh = { diubahOlehId: aktor.id, diubahOlehNama: aktor.nama.slice(0, 191) };
  await getAppDb().bckhPengaturan.upsert({ where: { id: 1 }, create: { id: 1, ...input, ...oleh }, update: { ...input, ...oleh } });
  await writeAudit({
    actorId: aktor.id,
    actorName: aktor.nama,
    action: AKSI_AUDIT_PENGATURAN,
    targetId: "bckh_pengaturan",
    metadata: { perubahan: Object.fromEntries(berubah.map((k) => [k, { dari: lama[k], ke: input[k] }])) },
    ip: aktor.ip,
  });
  return bacaPengaturan();
}

/* ---------------------------------------------------------------- laporan */

/** Data Laporan Kinerja Harian satu bulan (pratinjau & PDF). */
export async function laporanBulan(target: PenggunaBckh, bulan: string, milikSendiri: boolean): Promise<LaporanResult> {
  const { dari, sampai } = rentangBulanIni(bulan);
  const [profil, pengaturan, hari] = await Promise.all([bacaProfil(target), bacaPengaturan(), hariRingkas(target.id, dari, sampai)]);
  const tercatat = new Set(hari.map((h) => h.tanggal));

  const kurang: string[] = [];
  if (!profil.jabatan) kurang.push("Jabatan belum diisi di profil");
  if (!profil.atasanNama) kurang.push("Nama atasan langsung belum diisi di profil");
  if (!pengaturan.mengetahuiNama) kurang.push("Penandatangan \"Mengetahui\" belum diatur");
  if (hari.length === 0) kurang.push("Belum ada catatan pada bulan ini");

  return {
    bulan,
    tahun: Number(bulan.slice(0, 4)),
    namaBulan: NAMA_BULAN[Number(bulan.slice(5, 7)) - 1],
    profil,
    pengaturan: Object.fromEntries(
      (Object.keys(PENGATURAN_BAWAAN) as (keyof PengaturanLaporan)[]).map((k) => [k, pengaturan[k]]),
    ) as PengaturanLaporan,
    baris: barisLaporan(hari),
    hariKerjaKosong: hariKerjaDalam(dari, sampai, tanggalHariIniWita()).filter((t) => !tercatat.has(t)),
    kurang,
    milikSendiri,
  };
}

/** Dasbor persentase dalam rentang. */
export async function dasbor(target: PenggunaBckh, dari: string, sampai: string): Promise<DasborResult> {
  return hitungDasbor(await hariRingkas(target.id, dari, sampai), dari, sampai, tanggalHariIniWita());
}

/** Nama berkas PDF: `BCKH_<Nama>_<YYYY-MM>.pdf` (ASCII aman). */
export const namaBerkasLaporan = (nama: string, bulan: string) =>
  `BCKH_${nama.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "Pegawai"}_${bulan}.pdf`;
