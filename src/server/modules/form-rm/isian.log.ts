import "server-only";
import type { FormRmIsianLog, Prisma } from "@/generated/app/client";
import { tumpang, type Perubahan } from "@/features/form-rm/gabung";
import type { Aktor, EntriLogIsian, LogIsian } from "./isian.types";
import type { KonteksLog } from "./isian.konteks";
import {
  bacaPerubahan,
  bolehGabungLog,
  gabungPerubahan,
  periksaRantaiLog,
  segelLog,
  type AksiLog,
  type IsiSegelLog,
} from "./isian.log.inti";

/**
 * LOG PERUBAHAN ISIAN — tulis & baca `form_rm_isian_log` (PRD Berlanjut IGD →
 * RI §8.4). Penulis WAJIB sudah mengunci baris isian dalam transaksi yang sama
 * (FOR UPDATE / UPDATE) sehingga penulisan log per isian berurutan. Nilai
 * kolom hanya ada di tabel ini — audit_log umum tetap tanpa isi form.
 */

type Tx = Prisma.TransactionClient;

const isiDari = (r: FormRmIsianLog): IsiSegelLog => ({
  isianId: r.isianId,
  urut: r.urut,
  revAwal: r.revAwal,
  revAkhir: r.revAkhir,
  aksi: r.aksi,
  olehId: r.olehId,
  olehNama: r.olehNama,
  konteksNopen: r.konteksNopen,
  konteksUnit: r.konteksUnit,
  konteksRuang: r.konteksRuang,
  perubahan: r.perubahan,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  hashSebelum: r.hashSebelum,
});

/**
 * Catat perubahan satu simpan (`rev` = rev BARU isian). Tanpa perubahan → tidak
 * menulis. SIMPAN beruntun orang & konteks yang sama ≤ 5 menit digabung ke entri
 * terakhir (K7) dan disegel ulang (hash_sebelum tetap).
 */
export async function tulisLog(
  tx: Tx,
  kunci: Uint8Array,
  e: { isianId: string; rev: number; aksi: AksiLog; aktor: Aktor; konteks: KonteksLog; perubahan: readonly Perubahan[] },
): Promise<void> {
  if (e.perubahan.length === 0) return;
  const sekarang = new Date();
  const terakhir = await tx.formRmIsianLog.findFirst({ where: { isianId: e.isianId }, orderBy: { urut: "desc" } });

  if (
    terakhir &&
    bolehGabungLog(terakhir, { aksi: e.aksi, olehId: e.aktor.id, konteksNopen: e.konteks.nopen, revAwal: e.rev }, sekarang)
  ) {
    const gabung = gabungPerubahan(bacaPerubahan(terakhir.perubahan), e.perubahan);
    if (gabung) {
      const isi: IsiSegelLog = { ...isiDari(terakhir), revAkhir: e.rev, perubahan: gabung, updatedAt: sekarang.toISOString() };
      await tx.formRmIsianLog.update({
        where: { id: terakhir.id },
        data: { revAkhir: e.rev, perubahan: gabung as Prisma.InputJsonValue, updatedAt: sekarang, hash: segelLog(kunci, isi) },
      });
      return;
    }
  }

  const isi: IsiSegelLog = {
    isianId: e.isianId,
    urut: (terakhir?.urut ?? 0) + 1,
    revAwal: e.rev,
    revAkhir: e.rev,
    aksi: e.aksi,
    olehId: e.aktor.id,
    olehNama: e.aktor.nama,
    konteksNopen: e.konteks.nopen,
    konteksUnit: e.konteks.unit,
    konteksRuang: e.konteks.ruang,
    perubahan: [...e.perubahan],
    createdAt: sekarang.toISOString(),
    updatedAt: sekarang.toISOString(),
    hashSebelum: terakhir?.hash ?? null,
  };
  await tx.formRmIsianLog.create({
    data: {
      isianId: isi.isianId,
      urut: isi.urut,
      revAwal: isi.revAwal,
      revAkhir: isi.revAkhir,
      aksi: isi.aksi,
      olehId: isi.olehId,
      olehNama: isi.olehNama,
      konteksNopen: isi.konteksNopen,
      konteksUnit: isi.konteksUnit,
      konteksRuang: isi.konteksRuang,
      perubahan: isi.perubahan as Prisma.InputJsonValue,
      hash: segelLog(kunci, isi),
      hashSebelum: isi.hashSebelum,
      createdAt: sekarang,
      updatedAt: sekarang,
    },
  });
}

/** Siapa terakhir mengubah tiap path (konflik §8.3): entri log terbaru yang menyentuh path itu. */
export async function olehTerakhir(
  tx: Tx,
  isianId: string,
  paths: readonly string[],
): Promise<Map<string, { oleh: string | null; unit: string; ruang: string | null; waktu: string }>> {
  const hasil = new Map<string, { oleh: string | null; unit: string; ruang: string | null; waktu: string }>();
  if (paths.length === 0) return hasil;
  const rows = await tx.formRmIsianLog.findMany({
    where: { isianId },
    orderBy: { urut: "desc" },
    take: 50,
    select: { olehNama: true, konteksUnit: true, konteksRuang: true, updatedAt: true, perubahan: true },
  });
  for (const p of paths) {
    const r = rows.find((x) => bacaPerubahan(x.perubahan).some((c) => tumpang(c.p, p)));
    if (r) hasil.set(p, { oleh: r.olehNama, unit: r.konteksUnit, ruang: r.konteksRuang, waktu: r.updatedAt.toISOString() });
  }
  return hasil;
}

/** Seluruh log isian + pemeriksaan segel berantai (hak dicek pemanggil). */
export async function bacaLog(db: Tx, isianId: string, kunci: Uint8Array): Promise<LogIsian> {
  const rows = await db.formRmIsianLog.findMany({ where: { isianId }, orderBy: { urut: "asc" } });
  const masalah = periksaRantaiLog(
    kunci,
    rows.map((r) => ({ hash: r.hash, isi: isiDari(r) })),
  );
  return {
    entri: rows.map(
      (r): EntriLogIsian => ({
        urut: r.urut,
        revAwal: r.revAwal,
        revAkhir: r.revAkhir,
        aksi: r.aksi,
        olehNama: r.olehNama,
        unit: r.konteksUnit,
        ruang: r.konteksRuang,
        konteksNopen: r.konteksNopen,
        perubahan: bacaPerubahan(r.perubahan),
        dibuatAt: r.createdAt.toISOString(),
        diperbaruiAt: r.updatedAt.toISOString(),
      }),
    ),
    integritas: { utuh: masalah.length === 0, masalah },
  };
}
