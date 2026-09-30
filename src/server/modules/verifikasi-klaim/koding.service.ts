import "server-only";
import type { Prisma } from "@/generated/app/client";
import type { SessionUser } from "@/server/auth/session";
import { getAppDb } from "@/server/db/app.client";
import { writeAudit } from "@/server/lib/audit";
import { BusinessRuleError, ConflictError, ForbiddenError, ValidationError } from "@/server/lib/errors";
import { simpanNotifikasi } from "@/server/modules/notifikasi/notifikasi.repo";
import type { NotifikasiBaru } from "@/server/modules/notifikasi/notifikasi.types";
import { can } from "@/server/rbac/permissions";
import { BATAS, cariTransisi, KATEGORI_LABEL, STATUS_META, type AksiTahap2 } from "./verifikasi.constants";
import { queryWaktuSimgos } from "./koding.dal";
import { petaIcd } from "./icd.cache";
import {
  hitungPerubahan,
  kodeUntukIcd,
  konteksKoding,
  masalahUsulan,
  normalKode,
  setDariUsulan,
  setKlaim,
  usulanSama,
} from "./koding.rules";
import { pastikanBisaDiputuskan, SASARAN_NOTIF, tulisStatus } from "./keputusan.service";
import { findKoreksiAktif, type KoreksiAktif } from "./verifikasi.repo";
import { PREFIKS_KODING } from "./verifikasi.rules";
import type { KodingKeputusanInput } from "./verifikasi.schema";
import { tentukanSasaran, type ItemBersasaran } from "./verifikasi.sasaran";
import { bangunDetail, izinKlaim, muatBerkas } from "./verifikasi.service";
import type { ItemTindakLanjut, PerubahanKoding, RuangKerjaKlaim, SetKoding, SnapshotKlaim, UsulanKoding } from "./verifikasi.types";

/**
 * Keputusan Tahap 2 — Verifikator Klaim / Coder (PRD §2, §4, Stage V2).
 *  - AJUKAN_KOREKSI: usulan disimpan di reporthub (BUKAN ditulis ke SIMGOS) +
 *    tindak lanjut ke penerap (diagnosa → DPJP, prosedur → ruang) + notifikasi.
 *    Dari KOREKSI_KODING = revisi (usulan lama & tindak lanjutnya dibatalkan).
 *  - LOLOSKAN_KLAIM: menerima koding SIMRS apa adanya; alasan wajib bila aturan
 *    Tahap 2 gagal atau masih ada usulan yang belum diterapkan (dibatalkan).
 *  - KEMBALIKAN_KE_RM: ke TIDAK_LENGKAP dengan alasan; verifikator RM diberi tahu.
 * Semua dicek di server terhadap data SIMGOS segar; tulisan dalam satu transaksi.
 */

const AUDIT_AKSI: Record<AksiTahap2, string> = {
  AJUKAN_KOREKSI: "klaim.koding.ajukan-koreksi",
  LOLOSKAN_KLAIM: "klaim.koding.loloskan-klaim",
  KEMBALIKAN_KE_RM: "klaim.koding.kembalikan",
};

const galat = (field: string, pesan: string) => new ValidationError({ formErrors: [], fieldErrors: { [field]: [pesan] } });

type RencanaKoreksi = {
  usulan: UsulanKoding;
  perubahan: PerubahanKoding[];
  /** Jam dinding SIMGOS saat usulan dibuat (batas bawah bukti). */
  waktu: string;
  items: ItemBersasaran[];
};

/** Validasi usulan terhadap master ICD & aturan, hitung langkah, tentukan penerap. */
async function rencanakanKoreksi(
  s: SnapshotKlaim,
  simrs: SetKoding,
  masukan: UsulanKoding,
  aktif: KoreksiAktif | null,
): Promise<RencanaKoreksi> {
  const usulan: UsulanKoding = {
    diagnosa: masukan.diagnosa.map((d) => ({ kode: normalKode(d.kode), utama: d.utama })),
    prosedur: masukan.prosedur.map((p) => ({ kode: normalKode(p.kode) })),
  };
  const icd = await petaIcd(kodeUntukIcd([simrs, setDariUsulan(usulan)]));
  const masalah = masalahUsulan(konteksKoding(s, icd, setDariUsulan(usulan)));
  if (masalah.length) throw galat("usulan", `Usulan belum sesuai aturan INA-CBG: ${masalah.map((m) => m.pesan).join(" · ")}`);

  const perubahan = hitungPerubahan(simrs, usulan).map((p) => ({
    ...p,
    nama: p.kode ? (icd[p.jenis === "dx" ? "10" : "9"][p.kode]?.nama ?? null) : null,
  }));
  if (perubahan.length === 0) throw galat("usulan", "Usulan sama dengan koding SIMRS sekarang — gunakan Loloskan klaim");
  if (aktif && usulanSama(aktif.usulan, usulan)) throw galat("usulan", "Usulan sama dengan usulan yang sedang menunggu SIMRS");

  // Penerap di SIMRS (log 30 hari): diagnosa diubah dokter, prosedur diinput petugas ruangan.
  const dx = perubahan.filter((p) => p.jenis === "dx");
  const px = perubahan.filter((p) => p.jenis === "px");
  const items: ItemTindakLanjut[] = [
    ...(dx.length ? [{ aturan: "koding-dx", pesan: dx.map((p) => p.teks).join("; "), pj: "DPJP" as const }] : []),
    ...(px.length ? [{ aturan: "koding-px", pesan: px.map((p) => p.teks).join("; "), pj: "PERAWAT" as const }] : []),
  ];
  return { usulan, perubahan, waktu: await queryWaktuSimgos(), items: await tentukanSasaran(s, items) };
}

/** Satu notifikasi per penerap berisi langkah koreksi yang harus diterapkan. */
function notifikasiKoreksi(s: SnapshotKlaim, items: readonly ItemBersasaran[], olehId: string): NotifikasiBaru[] {
  const grup = new Map<string, ItemBersasaran[]>();
  for (const it of items) {
    const k = `${it.sasaran.jenis}|${it.sasaran.ref}`;
    grup.set(k, [...(grup.get(k) ?? []), it]);
  }
  return [...grup.values()].map((g) => ({
    jenis: "klaim.koreksi-koding",
    judul: "Koreksi koding perlu diterapkan di SIMRS",
    pesan: `${s.nama} (RM ${s.norm}) · ${KATEGORI_LABEL[s.kategori]}: ${g.map((i) => i.pesan).join("; ")}`.slice(0, 500),
    tautan: "/berkas-klaim/tindak-lanjut",
    sasaranJenis: SASARAN_NOTIF[g[0].sasaran.jenis],
    sasaranRef: g[0].sasaran.ref,
    refTipe: "klaim",
    refId: s.nopen,
    dibuatOlehId: olehId,
  }));
}

export async function putuskanTahap2(
  nopen: string,
  input: KodingKeputusanInput,
  user: SessionUser,
  ip: string | null,
): Promise<RuangKerjaKlaim> {
  const b = await muatBerkas(nopen);
  pastikanBisaDiputuskan(b);

  const status = b.simpan?.status ?? "BELUM_DIPERIKSA";
  const versi = b.simpan?.versi ?? null;
  if (input.versi !== versi) throw new ConflictError();
  const t = cariTransisi(status, input.aksi);
  if (!t) throw new BusinessRuleError(`Aksi tidak sah untuk berkas berstatus ${STATUS_META[status].label}`);
  if (!t.izin || !(await can(user.role, t.izin.modul, t.izin.aksi))) throw new ForbiddenError();

  const s = b.snapshot;
  const simrs = setKlaim(s.fakta.koding);
  const aktif = (await findKoreksiAktif([nopen])).get(nopen) ?? null;
  const catatan = input.catatan?.trim() || null;
  const alasanCukup = (catatan?.length ?? 0) >= BATAS.ALASAN_MIN;
  const data: Record<string, unknown> = {};
  let rencana: RencanaKoreksi | null = null;

  if (input.aksi === "AJUKAN_KOREKSI") {
    rencana = await rencanakanKoreksi(s, simrs, input.usulan!, aktif);
    Object.assign(data, { perubahan: rencana.perubahan.map((p) => p.teks), revisi: !!aktif });
  } else if (input.aksi === "LOLOSKAN_KLAIM") {
    const gagal = b.cekKoding.hasil.filter((h) => h.status === "gagal").map((h) => h.key);
    const override = gagal.length > 0 || !!aktif;
    if (override && !alasanCukup) {
      throw galat(
        "catatan",
        aktif
          ? `Usulan koreksi belum diterapkan di SIMRS — tulis alasan meloloskan (min. ${BATAS.ALASAN_MIN} karakter)`
          : `Koding SIMRS masih melanggar aturan — tulis alasan meloloskan (min. ${BATAS.ALASAN_MIN} karakter)`,
      );
    }
    Object.assign(data, { override, gagal });
  } else if (!alasanCukup) {
    throw galat("catatan", `Tulis alasan mengembalikan ke Tahap 1 (min. ${BATAS.ALASAN_MIN} karakter)`);
  }

  const now = new Date();
  const hasil = await getAppDb().$transaction(async (tx) => {
    const v = await tulisStatus(
      tx,
      b,
      versi,
      t.ke === "LOLOS_KLAIM" ? { status: t.ke, lolosKlaimOlehId: user.id, lolosKlaimAt: now } : { status: t.ke },
    );
    let tlDibatalkan = 0;
    if (aktif) {
      await tx.klaimKoreksiKoding.updateMany({ where: { id: aktif.id, status: "MENUNGGU_SIMRS" }, data: { status: "BATAL" } });
      const r = await tx.klaimTindakLanjut.updateMany({
        where: { nopen, status: "OPEN", aturan: { startsWith: PREFIKS_KODING } },
        data: { status: "BATAL", selesaiAt: now, selesaiCara: "BATAL", selesaiOlehId: user.id, selesaiOlehNama: user.name },
      });
      tlDibatalkan = r.count;
    }
    let koreksiId: string | null = null;
    if (rencana) {
      const k = await tx.klaimKoreksiKoding.create({
        data: {
          nopen,
          usulan: { ...rencana.usulan, perubahan: rencana.perubahan } as unknown as Prisma.InputJsonValue,
          simrsAwal: { waktu: rencana.waktu, set: simrs } as unknown as Prisma.InputJsonValue,
          catatan,
          dibuatOlehId: user.id,
          dibuatOlehNama: user.name,
        },
      });
      koreksiId = k.id;
      await tx.klaimTindakLanjut.createMany({
        data: rencana.items.map((i) => ({
          nopen, aturan: i.aturan, tahap: 2, pesan: i.pesan.slice(0, 500),
          sasaranJenis: i.sasaran.jenis, sasaranRef: i.sasaran.ref, sasaranNama: i.sasaran.nama.slice(0, 191),
          catatan, dibuatOlehId: user.id, dibuatOlehNama: user.name,
        })),
      });
      await simpanNotifikasi(tx, notifikasiKoreksi(s, rencana.items, user.id));
    }
    await tx.klaimVerifikasiRiwayat.create({
      data: {
        nopen, aksi: input.aksi, dariStatus: status, keStatus: t.ke, versi: v, catatan,
        data: { ...data, koreksiId, koreksiDibatalkan: aktif?.id ?? null, tlDibatalkan } as Prisma.InputJsonValue,
        olehId: user.id, olehNama: user.name,
      },
    });
    if (input.aksi === "KEMBALIKAN_KE_RM") {
      const kv = await tx.klaimVerifikasi.findUnique({ where: { nopen }, select: { lolosRmOlehId: true } });
      if (kv?.lolosRmOlehId && kv.lolosRmOlehId !== user.id) {
        await simpanNotifikasi(tx, [
          {
            jenis: "klaim.dikembalikan",
            judul: "Berkas klaim dikembalikan ke Tahap 1",
            pesan: `${s.nama} (RM ${s.norm}) · ${KATEGORI_LABEL[s.kategori]}: ${catatan}`.slice(0, 500),
            tautan: `/berkas-klaim/verifikasi?nopen=${nopen}`,
            sasaranJenis: "USER",
            sasaranRef: kv.lolosRmOlehId,
            refTipe: "klaim",
            refId: nopen,
            dibuatOlehId: user.id,
          },
        ]);
      }
    }
    return { v, koreksiId, tlDibatalkan };
  });

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: AUDIT_AKSI[input.aksi],
    targetId: nopen,
    // Tanpa PHI selain NOPEN (PRD §7.6): kode ICD & teks tidak dicatat, hanya jumlah / kunci aturan.
    metadata: {
      dari: status,
      ke: t.ke,
      versi: hasil.v,
      koreksiId: hasil.koreksiId,
      langkah: rencana
        ? { dx: rencana.perubahan.filter((p) => p.jenis === "dx").length, px: rencana.perubahan.filter((p) => p.jenis === "px").length }
        : null,
      override: data.override ?? null,
      gagal: data.gagal ?? null,
      revisi: data.revisi ?? null,
      tlDibatalkan: hasil.tlDibatalkan,
    },
    ip,
  });

  const detail = await bangunDetail(b);
  return { ...detail, izin: await izinKlaim(user, detail) };
}
