import "server-only";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import { simpanNotifikasi } from "@/server/modules/notifikasi/notifikasi.repo";
import { KATEGORI_LABEL, type Kategori } from "./verifikasi.constants";
import { findTindakLanjutOtomatisOpen } from "./verifikasi.repo";
import { tindakLanjutTerpenuhi } from "./verifikasi.rules";
import type { HasilCek, SnapshotKlaim } from "./verifikasi.types";

/**
 * REKONSILIASI tindak lanjut (PRD §4, §6.4): item OTOMATIS yang kekurangannya
 * sudah terpenuhi menurut data SIMGOS terbaru ditutup (SELESAI, cara OTOMATIS),
 * dicatat di riwayat, dan — bila berkas TIDAK_LENGKAP tak punya item terbuka
 * lagi — verifikator pembuatnya diberi notifikasi "siap diperiksa ulang".
 *
 * Idempoten & aman bersamaan: tiap item ditutup dengan `updateMany ... status
 * OPEN` sehingga hanya satu proses yang "memenangkan" penutupan item tersebut.
 * Dipanggil dari: detail berkas, komputasi antrean segar, halaman Tindak Lanjut.
 */

export type BerkasTercek = { snapshot: SnapshotKlaim; cek: HasilCek };

type Tx = Prisma.TransactionClient;

export async function sinkronTindakLanjut(berkas: readonly BerkasTercek[]): Promise<number> {
  const map = new Map(berkas.map((b) => [b.snapshot.nopen, b]));
  const open = await findTindakLanjutOtomatisOpen([...map.keys()]);
  const kandidat = open.filter((t) => {
    const b = map.get(t.nopen);
    return !!b && tindakLanjutTerpenuhi(t.aturan, b.snapshot, b.cek);
  });
  if (kandidat.length === 0) return 0;

  return getAppDb().$transaction(async (tx) => {
    const now = new Date();
    const ditutup = new Map<string, string[]>();
    for (const t of kandidat) {
      const r = await tx.klaimTindakLanjut.updateMany({
        where: { id: t.id, status: "OPEN" },
        data: { status: "SELESAI", selesaiAt: now, selesaiCara: "OTOMATIS", selesaiOlehNama: "Sistem" },
      });
      if (r.count) ditutup.set(t.nopen, [...(ditutup.get(t.nopen) ?? []), t.aturan]);
    }
    for (const [nopen, aturan] of ditutup) {
      await catatSelesai(tx, nopen, "TL_SELESAI_OTOMATIS", { aturan }, null, "Sistem");
    }
    return [...ditutup.values()].reduce((a, x) => a + x.length, 0);
  });
}

/**
 * Riwayat penutupan item + notifikasi "siap diperiksa ulang" bila tak ada item
 * terbuka lagi pada berkas TIDAK_LENGKAP. Dipakai penutupan otomatis & manual.
 */
export async function catatSelesai(
  tx: Tx,
  nopen: string,
  aksi: "TL_SELESAI_OTOMATIS" | "TL_SELESAI_MANUAL",
  data: Record<string, unknown>,
  olehId: string | null,
  olehNama: string,
  catatan?: string | null,
): Promise<void> {
  const klaim = await tx.klaimVerifikasi.findUnique({
    where: { nopen },
    select: { status: true, versi: true, namaPasien: true, norm: true, kategori: true },
  });
  if (!klaim) return;
  await tx.klaimVerifikasiRiwayat.create({
    data: { nopen, aksi, versi: klaim.versi, data: data as Prisma.InputJsonValue, catatan: catatan ?? null, olehId, olehNama },
  });
  if (klaim.status !== "TIDAK_LENGKAP") return;
  const sisa = await tx.klaimTindakLanjut.count({ where: { nopen, status: "OPEN" } });
  if (sisa > 0) return;

  const pembuat = await tx.klaimTindakLanjut.findMany({
    where: { nopen, dibuatOlehId: { not: null } },
    select: { dibuatOlehId: true },
    distinct: ["dibuatOlehId"],
  });
  const kategori = KATEGORI_LABEL[klaim.kategori as Kategori] ?? klaim.kategori;
  await simpanNotifikasi(
    tx,
    pembuat.map((p) => ({
      jenis: "klaim.siap-periksa-ulang",
      judul: "Berkas klaim siap diperiksa ulang",
      pesan: `${klaim.namaPasien ?? "Pasien"} (RM ${klaim.norm ?? "-"}) · ${kategori}: semua tindak lanjut sudah selesai.`,
      tautan: `/berkas-klaim/verifikasi?nopen=${nopen}`,
      sasaranJenis: "USER",
      sasaranRef: p.dibuatOlehId!,
      refTipe: "klaim",
      refId: nopen,
    })),
  );
}
