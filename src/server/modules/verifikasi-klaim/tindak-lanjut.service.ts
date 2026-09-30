import "server-only";
import type { Prisma } from "@/generated/app/client";
import type { SessionUser } from "@/server/auth/session";
import { getAppDb } from "@/server/db/app.client";
import { writeAudit } from "@/server/lib/audit";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/server/lib/errors";
import { createLimiter } from "@/server/lib/limiter";
import { createTtlCache } from "@/server/lib/ttl-cache";
import { getPenerima, type Penerima } from "@/server/modules/notifikasi/penerima";
import { can } from "@/server/rbac/permissions";
import { BATAS, MODUL_VERIFIKASI, STATUS_AWAL, STATUS_VERIFIKASI, type StatusVerifikasi } from "./verifikasi.constants";
import { bacaUsulan, keTindakLanjutItem } from "./verifikasi.repo";
import { PREFIKS_KODING, PREFIKS_MANUAL } from "./verifikasi.rules";
import type { TindakLanjutQuery } from "./verifikasi.schema";
import { cekSegarBatch } from "./verifikasi.service";
import { sinkronKoding } from "./koding.sinkron";
import { catatSelesai, sinkronTindakLanjut } from "./tindak-lanjut.sinkron";
import type { PerubahanKoding, TindakLanjutDaftar } from "./verifikasi.types";

/**
 * Halaman Tindak Lanjut Berkas (PRD §6.4): item yang harus dilengkapi DPJP
 * (NIP) / ruangan (akses ruangan SIMGOS) / peran penerima. Item OTOMATIS
 * ditutup sendiri begitu data SIMRS lengkap (rekonsiliasi saat halaman dimuat);
 * item koreksi koding ditutup begitu koding SIMRS = usulan coder; item cek
 * manual ditandai selesai oleh penerima atau verifikator.
 */

const cacheSinkron = createTtlCache<number>("tindak-lanjut-sinkron", { ttlMs: BATAS.SINKRON_TTL_MS, max: 50 });
const batasSinkron = createLimiter("tindak-lanjut-sinkron", BATAS.KOMPUTASI_PARALEL);

/** Item yang ditujukan ke penerima: DPJP (NIP), ruangan aksesnya, atau perannya. */
function untukPenerima(p: Penerima): Prisma.KlaimTindakLanjutWhereInput {
  const or: Prisma.KlaimTindakLanjutWhereInput[] = [{ sasaranJenis: "PERAN", sasaranRef: p.role }];
  if (p.nip) or.push({ sasaranJenis: "DPJP", sasaranRef: p.nip });
  if (p.ruangan.length) or.push({ sasaranJenis: "RUANGAN", sasaranRef: { in: p.ruangan } });
  return { OR: or };
}

function ditujukanKe(p: Penerima, r: { sasaranJenis: string; sasaranRef: string }): boolean {
  if (r.sasaranJenis === "PERAN") return r.sasaranRef === p.role;
  if (r.sasaranJenis === "DPJP") return !!p.nip && r.sasaranRef === p.nip;
  return r.sasaranJenis === "RUANGAN" && p.ruangan.includes(r.sasaranRef);
}

/**
 * Tutup otomatis item OTOMATIS terbuka dalam lingkup — cek SEGAR satu batch
 * (maks `SINKRON_MAKS` berkas), di-cache singkat per himpunan NOPEN agar muat
 * ulang halaman tak membebani SIMGOS.
 */
async function rekonsiliasi(lingkup: Prisma.KlaimTindakLanjutWhereInput, segar: boolean): Promise<number> {
  const rows = await getAppDb().klaimTindakLanjut.findMany({
    where: { ...lingkup, status: "OPEN", NOT: { aturan: { startsWith: PREFIKS_MANUAL } } },
    select: { nopen: true },
    distinct: ["nopen"],
    orderBy: { nopen: "asc" },
    take: BATAS.SINKRON_MAKS,
  });
  if (rows.length === 0) return 0;
  const nopens = rows.map((r) => r.nopen);
  const { value, hit } = await cacheSinkron.get(
    nopens.join(","),
    () =>
      batasSinkron(async () => {
        const berkas = [...(await cekSegarBatch(nopens)).values()];
        return (await sinkronTindakLanjut(berkas)) + (await sinkronKoding(berkas));
      }),
    { fresh: segar },
  );
  return hit ? 0 : value;
}

const STATUS_SET = new Set<string>(STATUS_VERIFIKASI);

/**
 * Langkah koreksi untuk item koding: dari usulan yang dibuat dalam transaksi
 * yang sama dengan item (waktu pembuatan terdekat), sesuai jenis item.
 */
async function perubahanKoding(rows: readonly { nopen: string; aturan: string; createdAt: Date }[]) {
  const nopens = [...new Set(rows.filter((r) => r.aturan.startsWith(PREFIKS_KODING)).map((r) => r.nopen))];
  if (nopens.length === 0) return () => null;
  const koreksi = await getAppDb().klaimKoreksiKoding.findMany({
    where: { nopen: { in: nopens } },
    select: { nopen: true, usulan: true, createdAt: true },
  });
  return (r: { nopen: string; aturan: string; createdAt: Date }): PerubahanKoding[] | null => {
    if (!r.aturan.startsWith(PREFIKS_KODING)) return null;
    const jarak = (d: Date) => Math.abs(d.getTime() - r.createdAt.getTime());
    const k = koreksi.filter((x) => x.nopen === r.nopen).sort((a, b) => jarak(a.createdAt) - jarak(b.createdAt))[0];
    const jenis = r.aturan === "koding-px" ? "px" : "dx";
    return k ? bacaUsulan(k.usulan).perubahan.filter((x) => x.jenis === jenis) : null;
  };
}

export async function getTindakLanjut(user: SessionUser, q: TindakLanjutQuery): Promise<TindakLanjutDaftar> {
  const p = await getPenerima(user);
  // Verifikator RM & coder memantau seluruh item yang dikirim tahapnya.
  const bolehSemua =
    (await can(user.role, MODUL_VERIFIKASI.RM, "view")) || (await can(user.role, MODUL_VERIFIKASI.KLAIM, "view"));
  const lingkup = q.lingkup === "semua" && bolehSemua ? "semua" : "saya";
  const cakupan = lingkup === "semua" ? {} : untukPenerima(p);

  const ditutupOtomatis = await rekonsiliasi(cakupan, q.segar === "1");

  const db = getAppDb();
  const where: Prisma.KlaimTindakLanjutWhereInput = {
    ...cakupan,
    status: q.status === "OPEN" ? "OPEN" : { in: ["SELESAI", "BATAL"] },
  };
  const total = await db.klaimTindakLanjut.count({ where });
  const rows = await db.klaimTindakLanjut.findMany({
    where,
    orderBy: q.status === "OPEN" ? { createdAt: "asc" } : { selesaiAt: "desc" },
    skip: (q.page - 1) * q.pageSize,
    take: q.pageSize,
    include: {
      verifikasi: { select: { namaPasien: true, norm: true, kategori: true, ruang: true, tglPulang: true, status: true } },
    },
  });
  const open = await db.klaimTindakLanjut.count({ where: { ...cakupan, status: "OPEN" } });
  const selesai = await db.klaimTindakLanjut.count({ where: { ...cakupan, status: { in: ["SELESAI", "BATAL"] } } });

  const bolehTl = await can(user.role, MODUL_VERIFIKASI.TINDAK_LANJUT, "update");
  const bolehRm = await can(user.role, MODUL_VERIFIKASI.RM, "update");
  const langkahKoding = await perubahanKoding(rows);

  return {
    items: rows.map((r) => {
      const it = keTindakLanjutItem(r);
      const v = r.verifikasi;
      return {
        ...it,
        pasien: {
          nama: v.namaPasien,
          norm: v.norm,
          kategori: v.kategori,
          ruang: v.ruang,
          tglPulang: v.tglPulang ? v.tglPulang.toISOString().slice(0, 19) : null,
        },
        statusKlaim: STATUS_SET.has(v.status) ? (v.status as StatusVerifikasi) : STATUS_AWAL,
        bolehSelesai: it.manual && it.status === "OPEN" && ((bolehTl && ditujukanKe(p, r)) || bolehRm),
        perubahan: langkahKoding(r),
      };
    }),
    page: q.page,
    pageSize: q.pageSize,
    total,
    ringkasan: { open, selesai },
    lingkup,
    bolehSemua,
    tanpaSasaranPribadi: !p.nip && p.ruangan.length === 0,
    meta: { ditutupOtomatis, dihitungPada: new Date().toISOString() },
  };
}

/**
 * Tandai selesai item CEK MANUAL (mis. tanda tangan DPJP) — oleh penerimanya
 * (izin tindak lanjut) atau verifikator RM. Item otomatis tidak bisa ditutup
 * manual: tertutup sendiri saat data SIMRS lengkap.
 */
export async function selesaikanManual(
  id: string,
  catatan: string | undefined,
  user: SessionUser,
  ip: string | null,
): Promise<void> {
  const db = getAppDb();
  const row = await db.klaimTindakLanjut.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Item tindak lanjut tidak ditemukan");
  if (!row.aturan.startsWith(PREFIKS_MANUAL)) {
    throw new BusinessRuleError("Item ini tertutup otomatis begitu datanya lengkap di SIMRS — gunakan Cek ulang");
  }
  if (row.status !== "OPEN") throw new BusinessRuleError("Item sudah tidak terbuka");

  const p = await getPenerima(user);
  const boleh =
    ((await can(user.role, MODUL_VERIFIKASI.TINDAK_LANJUT, "update")) && ditujukanKe(p, row)) ||
    (await can(user.role, MODUL_VERIFIKASI.RM, "update"));
  if (!boleh) throw new ForbiddenError();

  const teks = catatan?.trim() || null;
  await db.$transaction(async (tx) => {
    const r = await tx.klaimTindakLanjut.updateMany({
      where: { id, status: "OPEN" },
      data: { status: "SELESAI", selesaiAt: new Date(), selesaiCara: "MANUAL", selesaiOlehId: user.id, selesaiOlehNama: user.name },
    });
    if (r.count === 0) throw new ConflictError("Item sudah diubah pengguna lain. Muat ulang.");
    await catatSelesai(tx, row.nopen, "TL_SELESAI_MANUAL", { aturan: [row.aturan], id }, user.id, user.name, teks);
  });

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: "klaim.tindak-lanjut.selesai",
    targetId: row.nopen,
    metadata: { id, aturan: row.aturan },
    ip,
  });
}
