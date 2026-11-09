import "server-only";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import { fullName } from "@/features/master/master.constants";
import { tafsirCari } from "@/features/form-rm/cari";
import type { HakForm } from "@/features/form-rm/hak";
import { adalahStatusIsian, STATUS_ISIAN } from "@/features/form-rm/isian.status";
import { definisiForm, type KodeForm } from "@/features/form-rm/registry";
import {
  batasRentang,
  PER_HALAMAN_RIWAYAT,
  type DasarTanggal,
  type ItemRiwayat,
  type PetugasRiwayat,
  type RiwayatResult,
  type StatusRiwayat,
} from "@/features/form-rm/riwayat";
import { formBoleh } from "./form-rm.akses";
import type { RiwayatQuery } from "./form-rm.schema";

/**
 * RIWAYAT PENGISIAN — daftar isian Form RM per rentang tanggal (baca murni,
 * tanpa audit seperti daftar & pemilih pasien; membuka isian tetap diaudit).
 * Hanya form yang kategorinya boleh dilihat; `form` di luar hak → daftar
 * kosong (bukan galat) agar keberadaan isian kategori lain tak terbaca.
 */

const KOLOM_DASAR = { diperbarui: "updatedAt", dibuat: "createdAt", difinalkan: "difinalkanAt" } as const satisfies Record<
  DasarTanggal,
  keyof Prisma.FormRmIsianWhereInput
>;

const kosong = (halaman = 1): RiwayatResult => ({
  data: [],
  jumlah: { semua: 0, DRAF: 0, FINAL: 0, BATAL: 0 },
  total: 0,
  halaman,
  jumlahHalaman: 1,
  perHalaman: PER_HALAMAN_RIWAYAT,
});

/** Kata kunci → syarat pasien: angka = No.RM / NOPEN persis (terindeks), huruf = penggalan nama. */
function syaratCari(q: string | undefined): Prisma.FormRmIsianWhereInput {
  const k = q ? tafsirCari(q) : null;
  if (!k) return {};
  return "angka" in k ? { OR: [{ norm: k.angka }, { nopen: k.angka }] } : { namaPasien: { contains: k.nama } };
}

export async function riwayatIsian(input: RiwayatQuery, aktor: { id: string; hak: HakForm }): Promise<RiwayatResult> {
  const boleh = formBoleh(aktor.hak).map((d) => d.kode);
  const kodes = input.form ? boleh.filter((k) => k === input.form) : boleh;
  if (kodes.length === 0) return kosong();

  const kolom = KOLOM_DASAR[input.dasar];
  const where: Prisma.FormRmIsianWhereInput = {
    formKode: { in: kodes },
    [kolom]: batasRentang(input.dari, input.sampai),
    ...(input.saya ? { dibuatOlehId: aktor.id } : {}),
    ...syaratCari(input.q),
  };
  const db = getAppDb();

  const perStatus = await db.formRmIsian.groupBy({ by: ["status"], where, _count: { _all: true } });
  const jumlah: Record<StatusRiwayat, number> = { semua: 0, DRAF: 0, FINAL: 0, BATAL: 0 };
  for (const r of perStatus) {
    if (!adalahStatusIsian(r.status)) continue;
    jumlah[r.status] = r._count._all;
    jumlah.semua += r._count._all;
  }
  const total = jumlah[input.status];
  const jumlahHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN_RIWAYAT));
  const halaman = Math.min(input.halaman, jumlahHalaman);
  if (total === 0) return { ...kosong(halaman), jumlah };

  const rows = await db.formRmIsian.findMany({
    where: input.status === "semua" ? { ...where, status: { in: [...STATUS_ISIAN] } } : { ...where, status: input.status },
    select: {
      id: true,
      formKode: true,
      urutan: true,
      status: true,
      nopen: true,
      norm: true,
      namaPasien: true,
      ruang: true,
      createdAt: true,
      updatedAt: true,
      difinalkanAt: true,
      dibuatOlehId: true,
      difinalkanOlehId: true,
    },
    orderBy: [{ [kolom]: "desc" }, { id: "desc" }],
    skip: (halaman - 1) * PER_HALAMAN_RIWAYAT,
    take: PER_HALAMAN_RIWAYAT,
  });

  // Isi form hanya dibaca untuk baris form berulang (pembeda isian, mis. tindakan RM.22).
  const perluRingkas = rows.filter((r) => definisiForm(r.formKode)?.ringkasIsian).map((r) => r.id);
  const idPetugas = [...new Set(rows.flatMap((r) => [r.dibuatOlehId, r.difinalkanOlehId]).filter((x): x is string => !!x))];
  const [isiBerulang, pengguna] = await Promise.all([
    perluRingkas.length
      ? db.formRmIsian.findMany({ where: { id: { in: perluRingkas } }, select: { id: true, data: true } })
      : [],
    idPetugas.length
      ? db.user.findMany({
          where: { id: { in: idPetugas } },
          select: { id: true, name: true, gelarDepan: true, gelarBelakang: true },
        })
      : [],
  ]);
  const dataIsian = new Map(isiBerulang.map((r) => [r.id, r.data]));
  const namaPetugas = new Map(pengguna.map((u) => [u.id, fullName(u)]));
  const petugas = (id: string | null): PetugasRiwayat | null =>
    id ? { nama: namaPetugas.get(id) ?? "Pengguna terhapus" } : null;

  const data: ItemRiwayat[] = rows.flatMap((r) => {
    const def = definisiForm(r.formKode);
    if (!def || !adalahStatusIsian(r.status)) return [];
    const waktu = (input.dasar === "dibuat" ? r.createdAt : input.dasar === "difinalkan" ? r.difinalkanAt : r.updatedAt) ?? r.updatedAt;
    return [
      {
        id: r.id,
        kode: def.kode as KodeForm,
        ringkas: def.ringkasIsian && dataIsian.has(r.id) ? def.ringkasIsian(dataIsian.get(r.id)).judul : null,
        urutan: r.urutan,
        status: r.status,
        tertaut: r.nopen !== "",
        nopen: r.nopen,
        norm: r.norm,
        namaPasien: r.namaPasien,
        ruang: r.ruang,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        difinalkanAt: r.difinalkanAt?.toISOString() ?? null,
        waktu: waktu.toISOString(),
        dibuatOleh: petugas(r.dibuatOlehId),
        difinalkanOleh: r.status === "FINAL" ? petugas(r.difinalkanOlehId) : null,
        milikSaya: r.dibuatOlehId === aktor.id,
        bolehCetak: aktor.hak.boleh(def.kategori, "print"),
      },
    ];
  });

  return { data, jumlah, total, halaman, jumlahHalaman, perHalaman: PER_HALAMAN_RIWAYAT };
}
