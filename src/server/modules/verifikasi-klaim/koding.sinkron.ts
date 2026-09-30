import "server-only";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import { writeAudit } from "@/server/lib/audit";
import { ConflictError } from "@/server/lib/errors";
import { simpanNotifikasi } from "@/server/modules/notifikasi/notifikasi.repo";
import { BATAS, KATEGORI_LABEL, type Kategori } from "./verifikasi.constants";
import { queryJejakKoding, queryNamaPengguna } from "./koding.dal";
import { hitungPerubahan, setKlaim } from "./koding.rules";
import { findKoreksiAktif, type KoreksiAktif } from "./verifikasi.repo";
import { PREFIKS_KODING } from "./verifikasi.rules";
import type { BuktiKoding, JejakBukti, SnapshotKlaim } from "./verifikasi.types";

/**
 * DETEKSI OTOMATIS "sudah diterapkan di SIMRS" (PRD §2 langkah 4). Aplikasi
 * TIDAK menulis ke SIMGOS: usulan coder diterapkan petugas di SIMRS, lalu
 * koding SIMRS terbaru (read-only) dibandingkan dengan usulan. Bila sama:
 * usulan → SESUAI (+ bukti siapa & kapan dari SIMGOS), berkas KOREKSI_KODING →
 * LOLOS_KLAIM, item tindak lanjut koreksi ditutup, coder diberi notifikasi.
 *
 * Idempoten & aman bersamaan: usulan ditutup dengan `updateMany … status
 * MENUNGGU_SIMRS` dan status berkas dengan versi (optimistic locking) di satu
 * transaksi — hanya satu proses yang menang. Dipanggil dari: detail berkas,
 * komputasi antrean segar, halaman Tindak Lanjut.
 */

/** Kolom log yang ditampilkan sebagai bukti (nama kolom saja, tanpa isi). */
const KOLOM_BUKTI = new Set(["KODE", "UTAMA", "STATUS", "INACBG", "INA_GROUPER", "DIAGNOSA", "TINDAKAN"]);

export async function sinkronKoding(berkas: readonly { snapshot: SnapshotKlaim }[]): Promise<number> {
  if (berkas.length === 0) return 0;
  const map = new Map(berkas.map((b) => [b.snapshot.nopen, b.snapshot]));
  const aktif = await findKoreksiAktif([...map.keys()]);
  let n = 0;
  for (const [nopen, k] of aktif) {
    const s = map.get(nopen);
    if (!s || hitungPerubahan(setKlaim(s.fakta.koding), k.usulan).length > 0) continue;
    if (await tandaiSesuai(s, k)) n++;
  }
  return n;
}

/**
 * Jejak perubahan koding episode sejak usulan dibuat: baris baru (TANGGAL/OLEH
 * baris) + log ubah SIMGOS. `sejak` = jam dinding SIMGOS saat usulan dibuat.
 */
export async function kumpulkanBukti(nopen: string, sejak: string): Promise<BuktiKoding> {
  const { baris, log } = await queryJejakKoding(nopen, sejak);
  const batas = sejak.replace(" ", "T");
  const kodeBaris = new Map(baris.map((b) => [`${b.tabel}:${b.id}`, b.kode]));
  const mentah: (Omit<JejakBukti, "oleh"> & { olehId: number | null })[] = [
    ...baris
      .filter((b) => b.tanggal && b.tanggal >= batas)
      .map((b) => ({ aksi: "tambah" as const, tabel: b.tabel, kode: b.kode, kolom: [], olehId: b.oleh, pada: b.tanggal! })),
    ...log.map((l) => ({
      aksi: "ubah" as const,
      tabel: l.tabel,
      kode: kodeBaris.get(`${l.tabel}:${l.ref}`) ?? null,
      kolom: l.kolom.filter((c) => KOLOM_BUKTI.has(c)),
      olehId: l.oleh,
      pada: l.pada,
    })),
  ]
    .sort((a, b) => a.pada.localeCompare(b.pada))
    .slice(-BATAS.BUKTI_MAKS);

  const nama = await queryNamaPengguna([...new Set(mentah.map((m) => m.olehId).filter((x): x is number => x != null))]);
  const jejak: JejakBukti[] = mentah.map(({ olehId, ...m }) => ({ ...m, oleh: olehId == null ? null : (nama.get(olehId) ?? null) }));
  const akhir = jejak.at(-1) ?? null;
  return { oleh: akhir?.oleh ?? null, pada: akhir?.pada ?? null, jejak };
}

async function tandaiSesuai(s: SnapshotKlaim, k: KoreksiAktif): Promise<boolean> {
  const nopen = s.nopen;
  const bukti = await kumpulkanBukti(nopen, k.simrsAwal.waktu);
  const now = new Date();

  let hasil: { versi: number; tlDitutup: number } | null;
  try {
    hasil = await getAppDb().$transaction(async (tx) => {
      const kv = await tx.klaimVerifikasi.findUnique({
        where: { nopen },
        select: { status: true, versi: true, namaPasien: true, norm: true, kategori: true },
      });
      if (!kv || kv.status !== "KOREKSI_KODING") return null;
      const r = await tx.klaimKoreksiKoding.updateMany({
        where: { id: k.id, status: "MENUNGGU_SIMRS" },
        data: { status: "SESUAI", sesuaiAt: now, bukti: bukti as unknown as Prisma.InputJsonValue },
      });
      if (r.count === 0) return null;
      const u = await tx.klaimVerifikasi.updateMany({
        where: { nopen, versi: kv.versi, status: "KOREKSI_KODING" },
        data: { status: "LOLOS_KLAIM", versi: { increment: 1 }, lolosKlaimOlehId: k.dibuatOlehId, lolosKlaimAt: now },
      });
      if (u.count === 0) throw new ConflictError(); // berkas berubah bersamaan → batalkan seluruh transaksi
      const tl = await tx.klaimTindakLanjut.updateMany({
        where: { nopen, status: "OPEN", aturan: { startsWith: PREFIKS_KODING } },
        data: { status: "SELESAI", selesaiAt: now, selesaiCara: "OTOMATIS", selesaiOlehNama: "Sistem" },
      });
      const versi = kv.versi + 1;
      await tx.klaimVerifikasiRiwayat.create({
        data: {
          nopen,
          aksi: "KOREKSI_SESUAI",
          dariStatus: "KOREKSI_KODING",
          keStatus: "LOLOS_KLAIM",
          versi,
          data: {
            koreksiId: k.id,
            perubahan: k.usulan.perubahan.map((p) => p.teks),
            tlDitutup: tl.count,
            bukti: { oleh: bukti.oleh, pada: bukti.pada },
          },
          olehNama: "Sistem",
        },
      });
      if (k.dibuatOlehId) {
        const kategori = KATEGORI_LABEL[kv.kategori as Kategori] ?? kv.kategori;
        await simpanNotifikasi(tx, [
          {
            jenis: "klaim.koreksi-sesuai",
            judul: "Koreksi koding sudah diterapkan di SIMRS",
            pesan: `${kv.namaPasien ?? "Pasien"} (RM ${kv.norm ?? "-"}) · ${kategori}: koding SIMRS sudah sesuai usulan${
              bukti.oleh ? ` — diterapkan oleh ${bukti.oleh}` : ""
            }. Berkas lolos klaim.`,
            tautan: `/berkas-klaim/verifikasi?nopen=${nopen}`,
            sasaranJenis: "USER",
            sasaranRef: k.dibuatOlehId,
            refTipe: "klaim",
            refId: nopen,
          },
        ]);
      }
      return { versi, tlDitutup: tl.count };
    });
  } catch (e) {
    if (e instanceof ConflictError) return false;
    throw e;
  }
  if (!hasil) return false;

  await writeAudit({
    actorId: null,
    actorName: "Sistem",
    action: "klaim.koding.sesuai-otomatis",
    targetId: nopen,
    // Tanpa PHI selain NOPEN (PRD §7.6): hanya jumlah.
    metadata: { dari: "KOREKSI_KODING", ke: "LOLOS_KLAIM", versi: hasil.versi, langkah: k.usulan.perubahan.length, tlDitutup: hasil.tlDitutup, jejak: bukti.jejak.length },
  });
  return true;
}
