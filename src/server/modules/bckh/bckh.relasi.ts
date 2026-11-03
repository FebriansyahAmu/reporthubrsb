import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { namaBergelar } from "./bckh.aturan";
import { versiAvatar } from "./bckh.avatar";
import { SETELAN } from "./bckh.constants";
import type { AkunPenyetuju } from "./bckh.types";

/**
 * Relasi atasan ↔ pegawai (PRD §15.3) — modul kecil tanpa impor modul BCKH lain
 * agar bisa dipakai `bckh.akses` (penjaga baca) tanpa impor melingkar.
 */

export async function bacaSetelan(kunci: string): Promise<string | null> {
  const row = await getAppDb().bckhSetelan.findUnique({ where: { kunci }, select: { nilai: true } });
  return row?.nilai || null;
}

/** Akun direktur penanda tangan "Mengetahui" (null = belum diatur). */
export const bacaMengetahuiId = () => bacaSetelan(SETELAN.mengetahuiId);

/**
 * Akun yang boleh dipilih sebagai atasan / direktur "Mengetahui": pengguna AKTIF
 * yang perannya memegang `bckh.persetujuan:update`, atau superadmin. Nama TTD,
 * NIP & jabatan dari profil BCKH-nya (bila ada) agar blok TTD terisi otomatis.
 */
export async function daftarPenyetuju(ids?: readonly string[]): Promise<AkunPenyetuju[]> {
  const db = getAppDb();
  const [grant, superRole] = await Promise.all([
    db.rolePermission.findMany({ where: { moduleKey: "bckh.persetujuan", action: "update" }, select: { roleId: true } }),
    db.role.findMany({ where: { isSuperadmin: true }, select: { id: true } }),
  ]);
  const roleIds = [...new Set([...grant.map((g) => g.roleId), ...superRole.map((r) => r.id)])];
  if (roleIds.length === 0) return [];
  const users = await db.user.findMany({
    where: { roleId: { in: roleIds }, isActive: true, ...(ids ? { id: { in: [...ids] } } : {}) },
    select: { id: true, username: true, name: true, gelarDepan: true, gelarBelakang: true, nip: true },
    orderBy: { name: "asc" },
  });
  if (users.length === 0) return [];
  const [profil, avatar] = await Promise.all([
    db.bckhProfil.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { userId: true, namaLengkap: true, namaTtd: true, nip: true, jabatan: true } }),
    Promise.all(users.map((u) => versiAvatar(u.id))),
  ]);
  const by = new Map(profil.map((p) => [p.userId, p]));
  return users.map((u, i) => {
    const p = by.get(u.id);
    const nama = namaBergelar(u);
    return {
      id: u.id,
      username: u.username,
      nama: p?.namaLengkap || nama,
      namaTtd: p?.namaTtd || nama.toUpperCase(),
      nip: p?.nip || u.nip || "",
      jabatan: p?.jabatan ?? "",
      avatar: avatar[i],
    };
  });
}

/** Akun penyetuju yang sah (aktif & berwenang) atau null. */
export async function penyetujuSah(id: string): Promise<AkunPenyetuju | null> {
  return (await daftarPenyetuju([id]))[0] ?? null;
}

/** Akun atasan langsung yang dipilih pegawai (null = belum memilih). */
export async function bacaAtasanId(userId: string): Promise<string | null> {
  const row = await getAppDb().bckhAtasan.findUnique({ where: { userId }, select: { atasanId: true } });
  return row?.atasanId ?? null;
}

/**
 * `targetId` bawahan `penampilId`? Ya bila target memilih penampil sebagai atasan,
 * penampil = direktur "Mengetahui" (atas semua pegawai), atau target pernah
 * mengajukan laporan kepadanya (riwayat tetap bisa ditinjau).
 */
export async function adalahBawahan(penampilId: string, targetId: string): Promise<boolean> {
  if (penampilId === targetId) return false;
  const db = getAppDb();
  const [atasanId, mengetahuiId, pernah] = await Promise.all([
    bacaAtasanId(targetId),
    bacaMengetahuiId(),
    db.bckhPengajuan.findFirst({
      where: { userId: targetId, OR: [{ atasanId: penampilId }, { mengetahuiId: penampilId }] },
      select: { id: true },
    }),
  ]);
  return atasanId === penampilId || mengetahuiId === penampilId || !!pernah;
}

/**
 * Bawahan penampil: `semua` = penampil direktur "Mengetahui"; `langsung` = memilih
 * penampil sebagai atasan; `lain` = punya pengajuan AKTIF kepadanya (mis. atasan
 * sudah diganti setelah mengajukan).
 */
export async function bawahanDari(penampilId: string): Promise<{ semua: boolean; langsung: string[]; lain: string[] }> {
  const db = getAppDb();
  const [langsung, mengetahuiId, aktif] = await Promise.all([
    db.bckhAtasan.findMany({ where: { atasanId: penampilId }, select: { userId: true } }),
    bacaMengetahuiId(),
    db.bckhPengajuan.findMany({
      where: { aktif: "1", OR: [{ atasanId: penampilId }, { mengetahuiId: penampilId }] },
      select: { userId: true },
    }),
  ]);
  const idLangsung = langsung.map((r) => r.userId).filter((id) => id !== penampilId);
  const set = new Set(idLangsung);
  return {
    semua: mengetahuiId === penampilId,
    langsung: idLangsung,
    lain: [...new Set(aktif.map((r) => r.userId))].filter((id) => id !== penampilId && !set.has(id)),
  };
}
