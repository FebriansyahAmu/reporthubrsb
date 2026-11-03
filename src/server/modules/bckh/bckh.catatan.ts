import "server-only";
import { tanggalHariIniWita } from "@/lib/format";
import { getAppDb } from "@/server/db/app.client";
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from "@/server/lib/errors";
import { adaPerubahan, hariTerlambat, ringkasPerubahan, tanggalPalingAwal, tanggalPanjang } from "./bckh.aturan";
import {
  JENIS_LOG,
  LOG_PER_HALAMAN,
  NAMA_BULAN,
  STATUS_BEKERJA,
  type AksiLog,
  type JenisLog,
  type Kategori,
  type StatusHari,
  type Target,
} from "./bckh.constants";
import { bacaHari, dariDate, keDate, keHariDto } from "./bckh.dal";
import type { SimpanHariInput } from "./bckh.schema";
import type { HariDto, LogResult, RincianLog } from "./bckh.types";

export type Aktor = { id: string; nama: string; ip: string | null };

const isUnik = (e: unknown) => (e as { code?: string } | null)?.code === "P2002";
const galat = (pesan: string, field = "tanggal") => new ValidationError({ formErrors: [], fieldErrors: { [field]: [pesan] } });

/** Tanggal catatan: ≤ hari ini (WITA) dan ≥ 1 Januari tahun lalu (PRD §6.3). */
function cekTanggal(tanggal: string): void {
  const hariIni = tanggalHariIniWita();
  if (tanggal > hariIni) throw galat("Catatan untuk tanggal yang akan datang belum bisa dibuat");
  if (tanggal < tanggalPalingAwal(hariIni)) throw galat(`Catatan paling awal untuk ${tanggalPanjang(tanggalPalingAwal(hariIni))}`);
}

export type Tx = Parameters<Parameters<ReturnType<typeof getAppDb>["$transaction"]>[0]>[0];

export function tulisLog(tx: Tx, userId: string, aktor: Aktor, aksi: AksiLog, tanggal: string, rincian: RincianLog) {
  return tx.bckhLog.create({
    data: { userId, aktorId: aktor.id, aktorNama: aktor.nama.slice(0, 191), aksi, tanggal: keDate(tanggal), rincian, ip: aktor.ip?.slice(0, 64) ?? null },
  });
}

/**
 * Catatan bulan yang laporannya sedang diajukan / sudah disetujui TERKUNCI (PRD
 * §15.2): snapshot yang ditandatangani tak boleh berbeda dari catatan.
 */
async function cekTidakTerkunci(tx: Tx, userId: string, tanggal: string): Promise<void> {
  const bulan = tanggal.slice(0, 7);
  const p = await tx.bckhPengajuan.findFirst({ where: { userId, bulan, aktif: "1" }, select: { status: true } });
  if (!p) return;
  const nama = `${NAMA_BULAN[Number(bulan.slice(5, 7)) - 1]} ${bulan.slice(0, 4)}`;
  throw new BusinessRuleError(
    p.status === "DISETUJUI"
      ? `Laporan ${nama} sudah disetujui — catatan bulan ini terkunci. Minta atasan membatalkan persetujuan bila perlu diubah.`
      : `Laporan ${nama} sedang diajukan untuk ditandatangani — catatan bulan ini terkunci. Tarik pengajuan dulu untuk mengubahnya.`,
  );
}

/**
 * Buat / ubah catatan SENDIRI untuk satu tanggal. Konkurensi optimistis: `versi`
 * wajib sama dengan `updated_at` tersimpan (update bersyarat atomik); ID kegiatan
 * wajib milik catatan itu. Simpan tanpa perubahan tidak menulis apa pun. Catatan,
 * kegiatan & satu entri log ditulis dalam SATU transaksi.
 */
export async function simpanHari(aktor: Aktor, tanggal: string, input: SimpanHariInput): Promise<HariDto> {
  cekTanggal(tanggal);
  const db = getAppDb();
  const kegiatan = STATUS_BEKERJA.has(input.status) ? input.kegiatan : [];

  try {
    await db.$transaction(async (tx) => {
      await cekTidakTerkunci(tx, aktor.id, tanggal);
      const lama = await tx.bckhHari.findUnique({
        where: { userId_tanggal: { userId: aktor.id, tanggal: keDate(tanggal) } },
        select: { id: true, status: true, keterangan: true, updatedAt: true, kegiatan: { select: { id: true, uraian: true, kategori: true, target: true }, orderBy: [{ urutan: "asc" }, { createdAt: "asc" }] } },
      });
      if (!lama && input.versi) throw new ConflictError("Catatan ini sudah dihapus di tempat lain. Muat ulang lalu coba lagi.");
      if (lama && input.versi !== lama.updatedAt.toISOString()) {
        throw new ConflictError("Catatan ini sudah diubah di tempat lain. Muat ulang lalu coba lagi.");
      }
      const idLama = new Set(lama?.kegiatan.map((k) => k.id) ?? []);
      if (kegiatan.some((k) => k.id && !idLama.has(k.id))) {
        throw new ConflictError("Daftar kegiatan sudah berubah. Muat ulang lalu coba lagi.");
      }

      const rincian = ringkasPerubahan(
        lama && {
          status: lama.status as StatusHari,
          keterangan: lama.keterangan,
          kegiatan: lama.kegiatan.map((k) => ({ ...k, kategori: k.kategori as Kategori, target: k.target as Target })),
        },
        { status: input.status, keterangan: input.keterangan, kegiatan },
      );
      if (lama && !adaPerubahan(rincian)) return;

      let hariId: string;
      if (lama) {
        const n = await tx.bckhHari.updateMany({
          where: { id: lama.id, updatedAt: lama.updatedAt },
          data: { status: input.status, keterangan: input.keterangan, updatedAt: new Date() },
        });
        if (n.count !== 1) throw new ConflictError("Catatan ini sudah diubah di tempat lain. Muat ulang lalu coba lagi.");
        hariId = lama.id;
        const dipakai = new Set(kegiatan.map((k) => k.id).filter(Boolean));
        const dibuang = lama.kegiatan.filter((k) => !dipakai.has(k.id)).map((k) => k.id);
        if (dibuang.length) await tx.bckhKegiatan.deleteMany({ where: { hariId, id: { in: dibuang } } });
      } else {
        hariId = (
          await tx.bckhHari.create({
            data: { userId: aktor.id, tanggal: keDate(tanggal), status: input.status, keterangan: input.keterangan },
            select: { id: true },
          })
        ).id;
      }

      for (const [urutan, k] of kegiatan.entries()) {
        const data = { uraian: k.uraian, kategori: k.kategori, target: k.target, urutan };
        if (k.id) await tx.bckhKegiatan.update({ where: { id: k.id, hariId }, data });
        else await tx.bckhKegiatan.create({ data: { ...data, hariId } });
      }
      await tulisLog(tx, aktor.id, aktor, lama ? "UBAH" : "BUAT", tanggal, rincian);
    });
  } catch (e) {
    if (isUnik(e)) throw new ConflictError("Catatan untuk tanggal ini baru saja dibuat di tempat lain. Muat ulang lalu coba lagi.");
    throw e;
  }

  const baru = await bacaHari(aktor.id, tanggal);
  if (!baru) throw new NotFoundError("Catatan tidak ditemukan");
  return keHariDto(baru);
}

/** Hapus catatan SENDIRI (kegiatan ikut terhapus, CASCADE) + log. */
export async function hapusHari(aktor: Aktor, tanggal: string, versi: string): Promise<void> {
  await getAppDb().$transaction(async (tx) => {
    await cekTidakTerkunci(tx, aktor.id, tanggal);
    const lama = await tx.bckhHari.findUnique({
      where: { userId_tanggal: { userId: aktor.id, tanggal: keDate(tanggal) } },
      select: { id: true, status: true, updatedAt: true, _count: { select: { kegiatan: true } } },
    });
    if (!lama) throw new NotFoundError("Catatan tidak ditemukan");
    const n = await tx.bckhHari.deleteMany({ where: { id: lama.id, updatedAt: new Date(versi) } });
    if (n.count !== 1) throw new ConflictError("Catatan ini sudah diubah di tempat lain. Muat ulang lalu coba lagi.");
    await tulisLog(tx, aktor.id, aktor, "HAPUS", tanggal, {
      status: { dari: lama.status as StatusHari, ke: null },
      ...(lama._count.kegiatan ? { hapus: lama._count.kegiatan } : {}),
      kegiatan: 0,
    });
  });
}

/** Catat unduhan laporan (pelaku bisa atasan / pemegang `bckh.tim`). */
export async function catatEkspor(pemilikId: string, aktor: Aktor, bulan: string): Promise<void> {
  await getAppDb().$transaction((tx) => tulisLog(tx, pemilikId, aktor, "EKSPOR", `${bulan}-01`, { bulan }));
}

/**
 * Log pengisian terbaru → lama, berhalaman (`LOG_PER_HALAMAN`, nomor halaman) dengan
 * filter jenis aksi. Indeks `(user_id, id)`; halaman di luar jangkauan → halaman terakhir.
 */
export async function daftarLog(userId: string, halamanMinta = 1, jenis: JenisLog = "semua"): Promise<LogResult> {
  const db = getAppDb();
  const aksi = JENIS_LOG[jenis];
  const where = { userId, ...(aksi ? { aksi: { in: [...aksi] } } : {}) };
  const total = await db.bckhLog.count({ where });
  const jumlahHalaman = Math.max(1, Math.ceil(total / LOG_PER_HALAMAN));
  const halaman = Math.min(halamanMinta, jumlahHalaman);
  const rows = await db.bckhLog.findMany({
    where,
    orderBy: { id: "desc" },
    skip: (halaman - 1) * LOG_PER_HALAMAN,
    take: LOG_PER_HALAMAN,
    select: { id: true, aksi: true, tanggal: true, rincian: true, aktorId: true, aktorNama: true, createdAt: true },
  });
  return {
    total,
    halaman,
    jumlahHalaman,
    perHalaman: LOG_PER_HALAMAN,
    log: rows.map((r) => {
      const tanggal = dariDate(r.tanggal);
      const dibuat = r.createdAt.toISOString();
      return {
        id: r.id,
        aksi: r.aksi as AksiLog,
        tanggal,
        rincian: (r.rincian ?? {}) as RincianLog,
        aktorNama: r.aktorNama,
        olehPemilik: r.aktorId === userId,
        dibuat,
        terlambat: r.aksi === "BUAT" ? hariTerlambat(tanggal, dibuat) : 0,
      };
    }),
  };
}
