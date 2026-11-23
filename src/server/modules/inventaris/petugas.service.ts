import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import type { PetugasPutInput, RuanganPenggunaPutInput } from "./petugas.schema";
import { namaAkun, nipBermakna, normNip, ruanganPerAkun, samarkanNip } from "./petugas.util";
import type {
  AkunRingkas,
  PenggunaHit,
  PetugasRuanganDetail,
  RuanganChip,
  RuanganPenggunaDetail,
  RuanganRingkas,
} from "./petugas.types";

export { namaAkun, normNip };

/** Aksi audit penggantian daftar petugas ruangan. */
export const AKSI_PETUGAS_RUANGAN = "inventaris.ruangan.petugas";
/** Aksi audit penggantian ruangan tugas satu akun (dari Master › Pengguna). */
export const AKSI_RUANGAN_PENGGUNA = "inventaris.pengguna.ruangan";

const PILIH_RUANGAN = { id: true, kodePrefix: true, nama: true, aktif: true } as const;

type AkunRow = {
  id: string;
  username: string;
  name: string;
  gelarDepan: string | null;
  gelarBelakang: string | null;
  isActive: boolean;
};

const PILIH_AKUN = {
  id: true,
  username: true,
  name: true,
  gelarDepan: true,
  gelarBelakang: true,
  isActive: true,
} as const;

function ringkas(u: AkunRow): AkunRingkas {
  return { id: u.id, nama: namaAkun(u), username: u.username, aktif: u.isActive };
}

type Db = ReturnType<typeof getAppDb>;

/** Akun aktif yang NIP-nya (tanpa spasi) sama dengan NIP PJ ruangan. */
async function akunPj(db: Db, pjNip: string | null): Promise<AkunRingkas[]> {
  const n = normNip(pjNip);
  if (!nipBermakna(n)) return [];
  const kandidat = await db.user.findMany({
    where: { isActive: true, nip: { not: null } },
    select: { ...PILIH_AKUN, nip: true },
  });
  return kandidat.filter((u) => normNip(u.nip) === n).map(ringkas);
}

/** Petugas satu ruangan + akun PJ yang otomatis termasuk. */
export async function listPetugasRuangan(ruanganId: string): Promise<PetugasRuanganDetail> {
  const db = getAppDb();
  const r = await db.invRuangan.findUnique({
    where: { id: ruanganId },
    select: { id: true, kodePrefix: true, nama: true, pjNama: true, pjNip: true, aktif: true },
  });
  if (!r) throw new NotFoundError("Ruangan tidak ditemukan.");
  const [rows, pj] = await Promise.all([
    db.invRuanganPetugas.findMany({
      where: { ruanganId },
      orderBy: { createdAt: "asc" },
      select: { dibuatOleh: true, createdAt: true, user: { select: PILIH_AKUN } },
    }),
    akunPj(db, r.pjNip),
  ]);
  return {
    ruangan: { id: r.id, kodePrefix: r.kodePrefix, nama: r.nama, pjNama: r.pjNama, aktif: r.aktif },
    petugas: rows.map((p) => ({ ...ringkas(p.user), dibuatOleh: p.dibuatOleh, createdAt: p.createdAt.toISOString() })),
    akunPj: pj,
  };
}

/**
 * Ganti seluruh daftar petugas ruangan (satu transaksi + jejak audit di
 * transaksi yang sama). Akun BARU harus ada & aktif; akun lama yang kini
 * nonaktif boleh tetap dipertahankan. Tanpa perubahan → tidak menulis apa pun.
 */
export async function setPetugasRuangan(
  ruanganId: string,
  input: PetugasPutInput,
  aktor: { id: string; nama: string; ip: string | null },
): Promise<PetugasRuanganDetail> {
  const db = getAppDb();
  const ids = [...new Set(input.userIds)];

  await db.$transaction(async (tx) => {
    const r = await tx.invRuangan.findUnique({
      where: { id: ruanganId },
      select: { id: true, kodePrefix: true, nama: true },
    });
    if (!r) throw new NotFoundError("Ruangan tidak ditemukan.");

    const lama = await tx.invRuanganPetugas.findMany({
      where: { ruanganId },
      select: { userId: true, user: { select: PILIH_AKUN } },
    });
    const lamaIds = new Set(lama.map((l) => l.userId));
    const tambahIds = ids.filter((id) => !lamaIds.has(id));
    const hapus = lama.filter((l) => !ids.includes(l.userId));

    const akunBaru = tambahIds.length
      ? await tx.user.findMany({ where: { id: { in: tambahIds } }, select: PILIH_AKUN })
      : [];
    const ketemu = new Set(akunBaru.map((a) => a.id));
    const salah = tambahIds.filter((id) => !ketemu.has(id)).length + akunBaru.filter((a) => !a.isActive).length;
    if (salah > 0) {
      throw new ValidationError({
        formErrors: [`${salah} akun tidak ditemukan atau nonaktif. Muat ulang lalu pilih lagi.`],
        fieldErrors: {},
      });
    }
    if (tambahIds.length === 0 && hapus.length === 0) return;

    if (hapus.length) {
      await tx.invRuanganPetugas.deleteMany({ where: { ruanganId, userId: { in: hapus.map((h) => h.userId) } } });
    }
    if (tambahIds.length) {
      await tx.invRuanganPetugas.createMany({
        data: tambahIds.map((userId) => ({ ruanganId, userId, dibuatOleh: aktor.nama.slice(0, 191) })),
        skipDuplicates: true,
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: aktor.id,
        actorName: aktor.nama,
        action: AKSI_PETUGAS_RUANGAN,
        targetId: r.id,
        metadata: {
          ruangan: { kodePrefix: r.kodePrefix, nama: r.nama },
          ditambah: akunBaru.map((a) => ({ id: a.id, nama: namaAkun(a) })),
          dihapus: hapus.map((h) => ({ id: h.userId, nama: namaAkun(h.user) })),
          jumlah: ids.length,
        },
        ip: aktor.ip,
      },
    });
  });

  return listPetugasRuangan(ruanganId);
}

/** Cari akun aktif (nama / username / NIP) untuk dipetakan sebagai petugas. Maks 20. */
export async function cariPengguna(q: string): Promise<PenggunaHit[]> {
  const db = getAppDb();
  const term = q.trim();
  const nipTerm = normNip(term);
  const rows = await db.user.findMany({
    where: {
      isActive: true,
      ...(term
        ? {
            OR: [
              { name: { contains: term } },
              { username: { contains: term } },
              ...(nipTerm.length >= 4 ? [{ nip: { contains: nipTerm } }] : []),
            ],
          }
        : {}),
    },
    select: { ...PILIH_AKUN, nip: true },
    orderBy: [{ name: "asc" }],
    take: 20,
  });
  return rows.map((u) => ({ id: u.id, nama: namaAkun(u), username: u.username, nip: samarkanNip(u.nip) }));
}

/**
 * Ruangan aktif milik akun: dipetakan sebagai petugas, ATAU NIP akun = NIP PJ
 * ruangan (keduanya tanpa spasi). Urutan mengikuti `ruangan` masukan.
 */
export async function ruanganSaya(
  userId: string,
  ruangan: { id: string; pjNip: string | null }[],
): Promise<string[]> {
  const db = getAppDb();
  const [akun, petugas] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { nip: true } }),
    db.invRuanganPetugas.findMany({ where: { userId }, select: { ruanganId: true } }),
  ]);
  const nip = normNip(akun?.nip);
  const cocokPj = nipBermakna(nip);
  const dipetakan = new Set(petugas.map((p) => p.ruanganId));
  return ruangan.filter((r) => dipetakan.has(r.id) || (cocokPj && normNip(r.pjNip) === nip)).map((r) => r.id);
}

/* ------------------------------------------- dari sisi akun (Master › Pengguna) */

/** Ruangan aktif untuk pemilih ruangan tugas di form akun (urut kode). */
export async function listOpsiRuangan(): Promise<RuanganRingkas[]> {
  return getAppDb().invRuangan.findMany({
    where: { aktif: true },
    orderBy: [{ kodePrefix: "asc" }],
    select: PILIH_RUANGAN,
  });
}

/** Ruangan aktif yang NIP PJ-nya sama dengan NIP akun (tanpa spasi). */
async function ruanganPjAkun(db: Db, nip: string | null): Promise<RuanganRingkas[]> {
  const n = normNip(nip);
  if (!nipBermakna(n)) return [];
  const kandidat = await db.invRuangan.findMany({
    where: { aktif: true, pjNip: { not: null } },
    orderBy: [{ kodePrefix: "asc" }],
    select: { ...PILIH_RUANGAN, pjNip: true },
  });
  return kandidat
    .filter((r) => normNip(r.pjNip) === n)
    .map((r) => ({ id: r.id, kodePrefix: r.kodePrefix, nama: r.nama, aktif: r.aktif }));
}

/** Ruangan tugas satu akun: dipetakan manual + otomatis lewat NIP PJ. */
export async function listRuanganPengguna(userId: string): Promise<RuanganPenggunaDetail> {
  const db = getAppDb();
  const akun = await db.user.findUnique({ where: { id: userId }, select: { ...PILIH_AKUN, nip: true } });
  if (!akun) throw new NotFoundError("Pengguna tidak ditemukan.");
  const [rows, pj] = await Promise.all([
    db.invRuanganPetugas.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { ruangan: { select: PILIH_RUANGAN } },
    }),
    ruanganPjAkun(db, akun.nip),
  ]);
  return { akun: ringkas(akun), ruangan: rows.map((r) => r.ruangan), otomatisPj: pj };
}

/**
 * Ganti seluruh ruangan tugas satu akun (satu transaksi + jejak audit di
 * transaksi yang sama). Ruangan BARU harus ada & aktif; ruangan lama yang kini
 * nonaktif boleh dipertahankan. Tanpa perubahan → tidak menulis apa pun.
 * Tabelnya sama dengan Pengaturan › Ruangan › Petugas → kedua layar selalu sinkron.
 */
export async function setRuanganPengguna(
  userId: string,
  input: RuanganPenggunaPutInput,
  aktor: { id: string; nama: string; ip: string | null },
): Promise<RuanganPenggunaDetail> {
  const db = getAppDb();
  const ids = [...new Set(input.ruanganIds)];

  await db.$transaction(async (tx) => {
    const akun = await tx.user.findUnique({ where: { id: userId }, select: PILIH_AKUN });
    if (!akun) throw new NotFoundError("Pengguna tidak ditemukan.");

    const lama = await tx.invRuanganPetugas.findMany({
      where: { userId },
      select: { ruanganId: true, ruangan: { select: PILIH_RUANGAN } },
    });
    const lamaIds = new Set(lama.map((l) => l.ruanganId));
    const tambahIds = ids.filter((id) => !lamaIds.has(id));
    const hapus = lama.filter((l) => !ids.includes(l.ruanganId));

    const ruanganBaru = tambahIds.length
      ? await tx.invRuangan.findMany({ where: { id: { in: tambahIds } }, select: PILIH_RUANGAN })
      : [];
    const ketemu = new Set(ruanganBaru.map((r) => r.id));
    const salah = tambahIds.filter((id) => !ketemu.has(id)).length + ruanganBaru.filter((r) => !r.aktif).length;
    if (salah > 0) {
      throw new ValidationError({
        formErrors: [`${salah} ruangan tidak ditemukan atau nonaktif. Muat ulang lalu pilih lagi.`],
        fieldErrors: {},
      });
    }
    if (tambahIds.length === 0 && hapus.length === 0) return;

    if (hapus.length) {
      await tx.invRuanganPetugas.deleteMany({ where: { userId, ruanganId: { in: hapus.map((h) => h.ruanganId) } } });
    }
    if (tambahIds.length) {
      await tx.invRuanganPetugas.createMany({
        data: tambahIds.map((ruanganId) => ({ ruanganId, userId, dibuatOleh: aktor.nama.slice(0, 191) })),
        skipDuplicates: true,
      });
    }
    const ringkasR = (r: RuanganRingkas) => ({ id: r.id, kodePrefix: r.kodePrefix, nama: r.nama });
    await tx.auditLog.create({
      data: {
        actorId: aktor.id,
        actorName: aktor.nama,
        action: AKSI_RUANGAN_PENGGUNA,
        targetId: akun.id,
        metadata: {
          akun: { username: akun.username, nama: namaAkun(akun) },
          ditambah: ruanganBaru.map(ringkasR),
          dihapus: hapus.map((h) => ringkasR(h.ruangan)),
          jumlah: ids.length,
        },
        ip: aktor.ip,
      },
    });
  });

  return listRuanganPengguna(userId);
}

/**
 * Ruangan aktif per akun untuk kolom tabel Master › Pengguna (2 kueri untuk satu
 * halaman). Gagal (mis. migrasi Inventaris belum dijalankan) → peta kosong, agar
 * daftar pengguna — jalan masuk admin — tetap terbuka.
 */
export async function ruanganUntukDaftarPengguna(
  akun: { id: string; nip: string | null }[],
): Promise<Map<string, RuanganChip[]>> {
  if (akun.length === 0) return new Map();
  const db = getAppDb();
  try {
    const perluPj = akun.some((a) => nipBermakna(normNip(a.nip)));
    const [petugas, ruanganPj] = await Promise.all([
      db.invRuanganPetugas.findMany({
        where: { userId: { in: akun.map((a) => a.id) } },
        orderBy: { createdAt: "asc" },
        select: { userId: true, ruangan: { select: PILIH_RUANGAN } },
      }),
      perluPj
        ? db.invRuangan.findMany({
            where: { aktif: true, pjNip: { not: null } },
            orderBy: [{ kodePrefix: "asc" }],
            select: { id: true, kodePrefix: true, nama: true, pjNip: true },
          })
        : Promise.resolve([]),
    ]);
    return ruanganPerAkun(akun, petugas, ruanganPj);
  } catch (e) {
    console.warn("[inventaris] ruangan tugas pengguna tak terbaca:", e instanceof Error ? e.message : e);
    return new Map();
  }
}
