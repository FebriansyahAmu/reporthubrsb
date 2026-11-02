import "server-only";
import { tanggalHariIniWita } from "@/lib/format";
import { getAppDb } from "@/server/db/app.client";
import { PILIH_PENGGUNA } from "./bckh.akses";
import { versiAvatar } from "./bckh.avatar";
import { daftarTanggal, hariKerjaDalam, rentangBulanIni, tambahHari } from "./bckh.aturan";
import { STATUS_BEKERJA, type StatusHari } from "./bckh.constants";
import { dariDate, keDate } from "./bckh.dal";
import { namaBergelar } from "./bckh.profil";
import type { AnggotaTim, TimResult } from "./bckh.types";

/** Panjang grafik mini per pegawai (5 minggu). */
const HARI_MINI = 35;

/**
 * Ringkasan Tim (pemegang `bckh.tim`): pegawai aktif yang perannya boleh mengisi
 * BCKH + siapa pun yang sudah punya catatan/profil. Superadmin tanpa catatan tidak
 * ikut (peran admin tidak otomatis pengisi BCKH).
 */
export async function daftarTim(bulan: string): Promise<TimResult> {
  const db = getAppDb();
  const hariIni = tanggalHariIniWita();
  const { dari, sampai } = rentangBulanIni(bulan);
  const awalMini = tambahHari(hariIni, -(HARI_MINI - 1));

  const [grant, terakhir, profil] = await Promise.all([
    db.rolePermission.findMany({ where: { moduleKey: "bckh", action: "view" }, select: { roleId: true } }),
    db.bckhHari.groupBy({ by: ["userId"], _max: { updatedAt: true } }),
    db.bckhProfil.findMany({ select: { userId: true, namaLengkap: true, jabatan: true, unit: true } }),
  ]);
  const punyaData = [...new Set([...terakhir.map((t) => t.userId), ...profil.map((p) => p.userId)])];
  const users = await db.user.findMany({
    where: { OR: [{ roleId: { in: grant.map((g) => g.roleId) }, isActive: true }, { id: { in: punyaData } }] },
    select: PILIH_PENGGUNA,
  });
  if (users.length === 0) return { bulan, anggota: [], hariIni };

  const awal = dari < awalMini ? dari : awalMini;
  const akhir = sampai > hariIni ? sampai : hariIni;
  const hari = await db.bckhHari.findMany({
    where: { userId: { in: users.map((u) => u.id) }, tanggal: { gte: keDate(awal), lte: keDate(akhir) } },
    select: { userId: true, tanggal: true, status: true, _count: { select: { kegiatan: true } } },
  });

  const perUser = new Map<string, Map<string, number>>();
  for (const h of hari) {
    const peta = perUser.get(h.userId) ?? new Map<string, number>();
    peta.set(dariDate(h.tanggal), STATUS_BEKERJA.has(h.status as StatusHari) ? h._count.kegiatan : 0);
    perUser.set(h.userId, peta);
  }
  const profilBy = new Map(profil.map((p) => [p.userId, p]));
  const terakhirBy = new Map(terakhir.map((t) => [t.userId, t._max.updatedAt]));
  const kerja = hariKerjaDalam(dari, sampai, hariIni);
  const bulanIni = daftarTanggal(dari, sampai);
  const mini = daftarTanggal(awalMini, hariIni);
  const avatar = await Promise.all(users.map((u) => versiAvatar(u.id)));

  const anggota: AnggotaTim[] = users.map((u, i) => {
    const peta = perUser.get(u.id) ?? new Map<string, number>();
    const p = profilBy.get(u.id);
    const tercatatBulan = bulanIni.filter((t) => peta.has(t));
    return {
      userId: u.id,
      username: u.username,
      nama: p?.namaLengkap || namaBergelar(u),
      jabatan: p?.jabatan ?? "",
      unit: p?.unit ?? "",
      kegiatan: tercatatBulan.reduce((s, t) => s + (peta.get(t) ?? 0), 0),
      hariTercatat: tercatatBulan.length,
      hariKerja: kerja.length,
      hariKerjaTerisi: kerja.filter((t) => peta.has(t)).length,
      terakhirMengisi: terakhirBy.get(u.id)?.toISOString() ?? null,
      avatar: avatar[i],
      mini: mini.map((t) => peta.get(t) ?? 0),
    };
  });
  anggota.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  return { bulan, anggota, hariIni };
}
