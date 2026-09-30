import "server-only";
import type { Prisma } from "@/generated/app/client";
import type { SessionUser } from "@/server/auth/session";
import { getAppDb } from "@/server/db/app.client";
import { writeAudit } from "@/server/lib/audit";
import { BusinessRuleError, ConflictError, ForbiddenError, ValidationError } from "@/server/lib/errors";
import { simpanNotifikasi } from "@/server/modules/notifikasi/notifikasi.repo";
import type { NotifikasiBaru } from "@/server/modules/notifikasi/notifikasi.types";
import { can } from "@/server/rbac/permissions";
import {
  BATAS,
  cariTransisi,
  KATEGORI_LABEL,
  STATUS_META,
  type AksiTahap1,
  type SasaranTindakLanjut,
} from "./verifikasi.constants";
import { cekManualUntuk, itemTindakLanjut, labelAturan } from "./verifikasi.rules";
import type { KeputusanInput, MassalInput } from "./verifikasi.schema";
import { tentukanSasaran, type ItemBersasaran } from "./verifikasi.sasaran";
import {
  bangunDetail,
  cekSegarBatch,
  izinKlaim,
  itemAntrean,
  muatBerkas,
  saringDasar,
  type BerkasSegar,
} from "./verifikasi.service";
import type { HasilMassal, RuangKerjaKlaim, SnapshotKlaim } from "./verifikasi.types";

/**
 * Keputusan Tahap 1 — Verifikasi Berkas RM (PRD §4, Stage V1). Semua dicek di
 * SERVER terhadap data SIMGOS SEGAR: transisi sah, izin modul, versi (optimistic
 * locking), alasan wajib bila meloloskan berkas yang belum lengkap. Perubahan
 * status + riwayat + tindak lanjut + notifikasi ditulis dalam SATU transaksi.
 * SIMGOS tetap read-only.
 */

const AUDIT_AKSI: Record<AksiTahap1, string> = {
  LOLOSKAN_RM: "klaim.verifikasi.loloskan-rm",
  TANDAI_TIDAK_LENGKAP: "klaim.verifikasi.tidak-lengkap",
};

export const SASARAN_NOTIF: Record<SasaranTindakLanjut, NotifikasiBaru["sasaranJenis"]> = {
  DPJP: "NIP",
  RUANGAN: "RUANGAN",
  PERAN: "PERAN",
};

const isUnik = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

/** Identitas ringkas episode untuk baris `klaim_verifikasi` (diperbarui tiap keputusan). */
function identitas(s: SnapshotKlaim) {
  return {
    norm: s.norm.slice(0, 20),
    namaPasien: s.nama.slice(0, 191),
    kategori: s.kategori,
    ruang: s.ruang?.slice(0, 191) ?? null,
    // Konvensi aplikasi: jam dinding SIMGOS disimpan apa adanya (dibaca sebagai UTC).
    tglPulang: s.pulang ? new Date(`${s.pulang}Z`) : null,
    noSep: s.fakta.sep?.nomor.slice(0, 40) ?? null,
  };
}

/** Berkas final & bukan episode yang digabung — syarat semua keputusan. */
export function pastikanBisaDiputuskan(b: BerkasSegar): void {
  if (!b.final) throw new BusinessRuleError("Episode belum final (masih ada kunjungan yang belum keluar)");
  if (b.digabungKe) {
    throw new BusinessRuleError(`Episode ini digabung ke klaim Rawat Inap ${b.digabungKe}; putuskan di berkas tersebut`);
  }
}

/**
 * Tulis status baru dengan optimistic locking. `versi` null = baris belum ada
 * (dibuat; bentrok unik → konflik). Mengembalikan versi baru.
 */
export async function tulisStatus(
  tx: Prisma.TransactionClient,
  b: BerkasSegar,
  versi: number | null,
  data: Omit<Prisma.KlaimVerifikasiUncheckedCreateInput, "nopen" | "kategori" | "versi">,
): Promise<number> {
  const nopen = b.snapshot.nopen;
  const isi = { ...identitas(b.snapshot), ...data, cek: b.cek as unknown as Prisma.InputJsonValue, cekAt: new Date() };
  if (versi === null) {
    try {
      await tx.klaimVerifikasi.create({ data: { nopen, ...isi, versi: 1 } });
    } catch (e) {
      if (isUnik(e)) throw new ConflictError();
      throw e;
    }
    return 1;
  }
  const r = await tx.klaimVerifikasi.updateMany({ where: { nopen, versi }, data: { ...isi, versi: { increment: 1 } } });
  if (r.count === 0) throw new ConflictError();
  return versi + 1;
}

/** Satu notifikasi per sasaran berisi daftar item yang harus dilengkapi. */
function notifikasiTindakLanjut(s: SnapshotKlaim, items: readonly ItemBersasaran[], olehId: string): NotifikasiBaru[] {
  const grup = new Map<string, ItemBersasaran[]>();
  for (const it of items) {
    const k = `${it.sasaran.jenis}|${it.sasaran.ref}`;
    grup.set(k, [...(grup.get(k) ?? []), it]);
  }
  return [...grup.values()].map((g) => ({
    jenis: "klaim.tindak-lanjut",
    judul: "Berkas klaim perlu dilengkapi",
    pesan: `${s.nama} (RM ${s.norm}) · ${KATEGORI_LABEL[s.kategori]}: ${g.map((i) => labelAturan(i.aturan)).join(", ")}`,
    tautan: "/berkas-klaim/tindak-lanjut",
    sasaranJenis: SASARAN_NOTIF[g[0].sasaran.jenis],
    sasaranRef: g[0].sasaran.ref,
    refTipe: "klaim",
    refId: s.nopen,
    dibuatOlehId: olehId,
  }));
}

export async function putuskanTahap1(
  nopen: string,
  input: KeputusanInput,
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
  const manualBerlaku = cekManualUntuk(s.kategori).map((c) => c.key);
  const manualOk = new Set(input.manual.filter((k) => manualBerlaku.includes(k)));
  const tlOpen = await getAppDb().klaimTindakLanjut.findMany({
    where: { nopen, status: "OPEN" },
    select: { aturan: true },
  });
  const catatan = input.catatan?.trim() || null;
  const data: Record<string, unknown> = { manual: [...manualOk] };

  let baru: ItemBersasaran[] = [];
  if (input.aksi === "LOLOSKAN_RM") {
    const gagal = b.cek.hasil.filter((h) => h.status === "gagal").map((h) => h.key);
    const manualBelum = manualBerlaku.filter((k) => !manualOk.has(k));
    const override = gagal.length > 0 || manualBelum.length > 0 || tlOpen.length > 0;
    if (override && (catatan?.length ?? 0) < BATAS.ALASAN_MIN) {
      throw new ValidationError({
        formErrors: [],
        fieldErrors: {
          catatan: [`Berkas belum lengkap — tulis alasan meloloskan (min. ${BATAS.ALASAN_MIN} karakter)`],
        },
      });
    }
    Object.assign(data, { override, gagal, manualBelum, tlDibatalkan: tlOpen.length });
  } else {
    const items = input.item.map((k) => ({ k, items: itemTindakLanjut(k, s, b.cek, manualOk) }));
    const salah = items.filter((x) => !x.items).map((x) => labelAturan(x.k));
    if (salah.length) {
      throw new ValidationError({
        formErrors: [],
        fieldErrors: { item: [`Item sudah terpenuhi / tidak berlaku: ${salah.join(", ")}. Cek ulang lalu pilih lagi.`] },
      });
    }
    const sudahTerbuka = new Set(tlOpen.map((x) => x.aturan));
    const semua = items.flatMap((x) => x.items!);
    baru = await tentukanSasaran(s, semua.filter((i) => !sudahTerbuka.has(i.aturan)));
    Object.assign(data, { item: semua.map((i) => i.aturan), baru: baru.map((i) => i.aturan) });
  }

  const now = new Date();
  const versiBaru = await getAppDb().$transaction(async (tx) => {
    const v = await tulisStatus(
      tx,
      b,
      versi,
      t.ke === "LOLOS_RM" ? { status: t.ke, lolosRmOlehId: user.id, lolosRmAt: now } : { status: t.ke },
    );
    await tx.klaimVerifikasiRiwayat.create({
      data: {
        nopen, aksi: input.aksi, dariStatus: status, keStatus: t.ke, versi: v, catatan,
        data: data as Prisma.InputJsonValue, olehId: user.id, olehNama: user.name,
      },
    });
    if (input.aksi === "LOLOSKAN_RM" && tlOpen.length) {
      await tx.klaimTindakLanjut.updateMany({
        where: { nopen, status: "OPEN" },
        data: { status: "BATAL", selesaiAt: now, selesaiCara: "BATAL", selesaiOlehId: user.id, selesaiOlehNama: user.name },
      });
    }
    if (baru.length) {
      await tx.klaimTindakLanjut.createMany({
        data: baru.map((i) => ({
          nopen, aturan: i.aturan, tahap: 1, pesan: i.pesan.slice(0, 500),
          sasaranJenis: i.sasaran.jenis, sasaranRef: i.sasaran.ref, sasaranNama: i.sasaran.nama.slice(0, 191),
          catatan, dibuatOlehId: user.id, dibuatOlehNama: user.name,
        })),
      });
      await simpanNotifikasi(tx, notifikasiTindakLanjut(s, baru, user.id));
    }
    return v;
  });

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    action: AUDIT_AKSI[input.aksi],
    targetId: nopen,
    // Tanpa PHI selain NOPEN (PRD §7.6).
    metadata: { dari: status, ke: t.ke, versi: versiBaru, ...data },
    ip,
  });

  const detail = await bangunDetail(b);
  return { ...detail, izin: await izinKlaim(user, detail) };
}

/**
 * Loloskan massal (PRD §6.2): semua berkas BELUM_DIPERIKSA yang lengkap otomatis
 * pada filter ini — dicek ULANG segar dalam satu batch, lalu diputuskan per
 * berkas (masing-masing tercatat di riwayat). Berkas yang berubah / sudah
 * diputuskan orang lain dilewati beserta alasannya.
 */
export async function loloskanMassal(input: MassalInput, user: SessionUser, ip: string | null): Promise<HasilMassal> {
  const { semua } = await itemAntrean(input);
  const kandidat = saringDasar(semua, input)
    .filter((it) => it.status === "BELUM_DIPERIKSA" && it.cek.lengkap)
    .slice(0, BATAS.MASSAL_MAKS)
    .map((it) => it.nopen);
  const hasil: HasilMassal = { disetujui: [], dilewati: [] };
  if (kandidat.length === 0) return hasil;

  const segar = await cekSegarBatch(kandidat);
  const now = new Date();
  for (const nopen of kandidat) {
    const b = segar.get(nopen);
    if (!b) {
      hasil.dilewati.push({ nopen, alasan: "Episode tidak ditemukan / dibatalkan" });
      continue;
    }
    if (!b.final || b.digabungKe || !b.cek.lengkap) {
      hasil.dilewati.push({ nopen, alasan: "Data SIMRS berubah — berkas tidak lagi lengkap otomatis" });
      continue;
    }
    const manual = cekManualUntuk(b.snapshot.kategori).map((c) => c.key);
    try {
      await getAppDb().$transaction(async (tx) => {
        const v = await tulisStatus(tx, b, null, { status: "LOLOS_RM", lolosRmOlehId: user.id, lolosRmAt: now });
        await tx.klaimVerifikasiRiwayat.create({
          data: {
            nopen, aksi: "LOLOSKAN_RM", dariStatus: "BELUM_DIPERIKSA", keStatus: "LOLOS_RM", versi: v,
            data: { massal: true, manual, override: false }, olehId: user.id, olehNama: user.name,
          },
        });
      });
      hasil.disetujui.push(nopen);
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
      hasil.dilewati.push({ nopen, alasan: "Sudah diputuskan pengguna lain" });
    }
  }

  if (hasil.disetujui.length) {
    await writeAudit({
      actorId: user.id,
      actorName: user.name,
      action: "klaim.verifikasi.loloskan-massal",
      targetId: `${input.from}..${input.to}`,
      metadata: { jumlah: hasil.disetujui.length, nopen: hasil.disetujui, dilewati: hasil.dilewati.length },
      ip,
    });
  }
  return hasil;
}
