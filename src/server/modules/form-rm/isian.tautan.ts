import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import { isSimgosConfigured } from "@/server/lib/env";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/server/lib/errors";
import { tafsirCari } from "@/features/form-rm/cari";
import { cocokSasaran, definisiForm, pesanBukanSasaran, saringLeg, type DefinisiForm } from "@/features/form-rm/registry";
import type { IdentitasSementaraNilai } from "@/features/form-rm/sementara";
import { queryLegPasien, queryLegRentang, queryNormCari } from "./form-rm.dal";
import { kelompokkanEpisode } from "./form-rm.episode";
import { legEpisode } from "./form-rm.pasien";
import { getFormRmHeader } from "./form-rm.service";
import { auditIsian } from "./isian.audit";
import { isianAktifPerNopen } from "./isian.cari";
import type { BuatSementaraInput, LepasTautanInput, TautkanInput } from "./isian.schema";
import {
  cariIsian,
  cariIsianBoleh,
  definisiDari,
  isUnik,
  jagaDraf,
  keDto,
  SERTA_SEMENTARA,
  tertaut,
  type BarisIsian,
} from "./isian.service";
import { jendelaKandidat, kandidatDari, waktuAcuan } from "./isian.tautan.waktu";
import type { AktorForm, DaftarKandidatTautan, IsianForm } from "./isian.types";

/**
 * ISIAN SEBELUM PASIEN TERDAFTAR (mis. triase pasien yang baru tiba di IGD).
 *
 * - Dibuat dengan identitas sementara: subjek "~<token>", nopen & norm kosong,
 *   nama = sebutan. Isi form diisi manual (tanpa data SIMRS).
 * - Ditautkan ke pendaftaran (NOPEN) setelah pasien terdaftar: subjek, nopen,
 *   norm, nama & ruang diganti snapshot SIMGOS. Kunci unik (form, subjek,
 *   urutan) menjamin form tidak berulang tetap satu isian aktif per NOPEN.
 * - FINAL menunggu tautan (dicek di `aksiIsian`), sehingga isian sementara tak
 *   pernah punya revisi bersegel saat subjeknya berubah — rantai segel tetap utuh.
 * - Lepas tautan (salah pasien) hanya untuk draf yang belum pernah difinalkan dan
 *   belum memakai data SIMRS pasien itu.
 *
 * SIMGOS hanya dibaca. Audit tanpa identitas sementara (hanya id, kode, NOPEN).
 */

/** "~" + 16 karakter acak: unik per isian dan tak pernah sama dengan NOPEN (angka). */
const subjekSementara = () => `~${randomBytes(12).toString("base64url")}`;

type DefSementara = DefinisiForm & { tanpaPendaftaran: NonNullable<DefinisiForm["tanpaPendaftaran"]> };

function defSementara(def: DefinisiForm): DefSementara {
  if (!def.tanpaPendaftaran) throw new BusinessRuleError("Formulir ini hanya bisa diisi untuk pasien yang sudah terdaftar");
  return def as DefSementara;
}

/** Isian sementara yang masih DRAF & belum tertaut, dengan izin ubah kategori form-nya. */
async function cariBelumTertaut(id: string, aktor: AktorForm): Promise<BarisIsian & { def: DefSementara }> {
  const row = await cariIsianBoleh(id, aktor.hak, "update");
  if (tertaut(row)) throw new BusinessRuleError("Isian ini sudah tertaut ke pasien terdaftar");
  jagaDraf(row);
  if (!row.identitasSementara) throw new BusinessRuleError("Isian ini tidak dapat ditautkan");
  return { ...row, def: defSementara(definisiDari(row)) };
}

/* ------------------------------------------------------------------ buat */

export async function buatIsianSementara(input: BuatSementaraInput, aktor: AktorForm): Promise<IsianForm> {
  const def = definisiForm(input.kode);
  if (!def) throw new NotFoundError("Form tidak dikenal");
  if (!aktor.hak.boleh(def.kategori, "create")) throw new ForbiddenError();
  defSementara(def);
  const s = input.sementara;

  const row = await getAppDb().formRmIsian.create({
    data: {
      formKode: def.kode,
      formVersi: def.versi,
      subjek: subjekSementara(),
      nopen: "",
      urutan: 1,
      norm: "",
      namaPasien: s.sebutan,
      ruang: null,
      data: def.kosong() as Prisma.InputJsonValue,
      asal: {},
      dibuatOlehId: aktor.id,
      diubahOlehId: aktor.id,
      identitasSementara: {
        create: { sebutan: s.sebutan, jenisKelamin: s.jenisKelamin, perkiraanUmur: s.perkiraanUmur, ciri: s.ciri },
      },
    },
    include: SERTA_SEMENTARA,
  });
  await auditIsian(aktor, "buat-sementara", row);
  return keDto(row);
}

/** Perbaiki identitas sementara (hanya sebelum ditautkan). Tidak menaikkan rev isi form. */
export async function ubahIdentitasSementara(
  id: string,
  input: IdentitasSementaraNilai,
  aktor: AktorForm,
): Promise<IsianForm> {
  await cariBelumTertaut(id, aktor);
  const hasil = await getAppDb().$transaction(async (tx) => {
    const n = await tx.formRmIsian.updateMany({
      where: { id, status: "DRAF", nopen: "" },
      data: { namaPasien: input.sebutan, diubahOlehId: aktor.id },
    });
    if (n.count === 0) throw new ConflictError();
    await tx.formRmIdentitasSementara.update({ where: { isianId: id }, data: input });
    return cariIsian(id, tx);
  });
  await auditIsian(aktor, "ubah-identitas-sementara", hasil);
  return keDto(hasil);
}

/* -------------------------------------------------------------- kandidat */

/**
 * Pendaftaran yang bisa ditautkan. Tanpa kata kunci: pendaftaran sasaran form
 * yang masuk antara 2 jam sebelum s.d. 48 jam sesudah waktu acuan (kedatangan /
 * triase di form, atau waktu isian dibuat), yang belum punya isian form ini
 * dulu, lalu yang waktunya terdekat. Dengan kata kunci: pencarian No. RM / NIK /
 * NOPEN / nama seperti pemilih pasien. READ-ONLY ke SIMGOS.
 */
export async function kandidatTautan(id: string, q: string | undefined, aktor: AktorForm): Promise<DaftarKandidatTautan> {
  const row = await cariBelumTertaut(id, aktor);
  const sah = row.def.skema.safeParse(row.data);
  const acuan = waktuAcuan(sah.success ? row.def.tanpaPendaftaran.waktuAcuan(sah.data) : "", row.createdAt);
  const mode = q ? "cari" : "saran";
  const kunci = q ? tafsirCari(q) : null;
  if (!isSimgosConfigured() || (q && !kunci)) return { mode, acuan, data: [] };

  const sasaran = [saringLeg(row.def.sasaran)];
  const legs = kunci
    ? await queryLegPasien({ sasaran, norm: await queryNormCari(kunci) })
    : await queryLegRentang({ sasaran, ...jendelaKandidat(acuan) });
  const episode = kelompokkanEpisode(legs, new Date());
  const aktif = await isianAktifPerNopen(
    episode.map((e) => e.nopen),
    [row.def.kode],
  );
  const lain = new Map<string, string>();
  for (const [nopen, per] of aktif) {
    const isian = per[row.def.kode];
    if (isian) lain.set(nopen, isian.id);
  }
  return { mode, acuan, data: kandidatDari(episode, acuan, lain, mode === "saran") };
}

/* ---------------------------------------------------------------- tautkan */

/**
 * Tautkan isian sementara ke pendaftaran. Pendaftaran harus aktif di SIMGOS &
 * punya kunjungan sasaran form; form tidak berulang ditolak bila pendaftaran itu
 * sudah punya isian aktif (salah satunya perlu dibatalkan dulu).
 */
export async function tautkanIsian(id: string, input: TautkanInput, aktor: AktorForm): Promise<IsianForm> {
  const row = await cariBelumTertaut(id, aktor);
  if (row.rev !== input.rev) throw new ConflictError();
  const { def } = row;
  const db = getAppDb();

  const [header, legs, revisi, lain, lama] = await Promise.all([
    getFormRmHeader(input.nopen),
    legEpisode(input.nopen),
    db.formRmRevisi.count({ where: { isianId: id } }),
    db.formRmIsian.findFirst({
      where: { formKode: def.kode, subjek: input.nopen },
      orderBy: { urutan: "desc" },
      select: { id: true, urutan: true, status: true },
    }),
    def.jenisLama
      ? db.formRm.findUnique({ where: { nopen_jenis: { nopen: input.nopen, jenis: def.jenisLama } }, select: { id: true } })
      : null,
  ]);
  if (!header) throw new NotFoundError("Pendaftaran tidak ditemukan atau tidak aktif di SIMRS");
  if (!cocokSasaran(def.sasaran, legs)) throw new BusinessRuleError(pesanBukanSasaran(def.sasaran));
  // Segel revisi memuat subjek: isian bersegel tak boleh berpindah subjek.
  if (revisi > 0) throw new BusinessRuleError("Isian yang sudah punya riwayat revisi tidak dapat ditautkan");
  // Isian tabel lama yang belum dipindahkan tak boleh terlewati (dipindahkan saat formulir pasien itu dibuka).
  if (!lain && lama) {
    throw new BusinessRuleError(
      `Pasien ini masih punya isian ${def.kode} versi lama. Buka formulir ${def.kode} pasien itu sekali (data lama dipindahkan otomatis), lalu periksa sebelum menautkan.`,
    );
  }
  if (lain && lain.status !== "BATAL" && !def.berulang) {
    throw new BusinessRuleError(
      `Pasien ini sudah punya isian ${def.kode} (${lain.status}). Periksa isian itu; batalkan salah satunya bila ganda.`,
      { isianLain: lain.id },
    );
  }

  const hasil = await db
    .$transaction(async (tx) => {
      const n = await tx.formRmIsian.updateMany({
        where: { id, rev: input.rev, status: "DRAF", nopen: "" },
        data: {
          subjek: input.nopen,
          nopen: input.nopen,
          urutan: (lain?.urutan ?? 0) + 1,
          norm: header.norm,
          namaPasien: header.nama,
          ruang: header.ruang === "—" ? null : header.ruang,
          rev: input.rev + 1,
          diubahOlehId: aktor.id,
        },
      });
      if (n.count === 0) throw new ConflictError();
      await tx.formRmIdentitasSementara.update({
        where: { isianId: id },
        data: { ditautkanAt: new Date(), ditautkanOlehId: aktor.id, ditautkanOlehNama: aktor.nama },
      });
      return cariIsian(id, tx);
    })
    .catch((e: unknown) => {
      // Kunci unik (form, subjek, urutan): pendaftaran ini baru saja mendapat isian lain.
      throw isUnik(e) ? new ConflictError("Pasien ini baru saja mendapat isian lain untuk formulir ini. Muat ulang lalu periksa.") : e;
    });

  await auditIsian(aktor, "tautkan", hasil);
  return keDto(hasil);
}

/* ------------------------------------------------------------ lepas tautan */

/**
 * Lepas tautan isian sementara yang salah pasien → kembali "Belum tertaut".
 * Hanya draf tanpa revisi (belum pernah difinalkan) dan tanpa data SIMRS yang
 * diterapkan (data pasien itu tak boleh terbawa ke pasien lain). Selain itu:
 * batalkan isian lalu buat yang baru.
 */
export async function lepasTautan(id: string, input: LepasTautanInput, aktor: AktorForm): Promise<IsianForm> {
  const row = await cariIsianBoleh(id, aktor.hak, "update");
  if (!tertaut(row) || !row.identitasSementara) throw new BusinessRuleError("Isian ini tidak dibuat sebagai isian sementara");
  jagaDraf(row);
  if (row.rev !== input.rev) throw new ConflictError();
  const db = getAppDb();
  const tolak = "Batalkan isian ini lalu buat isian baru untuk pasien yang benar.";
  if ((await db.formRmRevisi.count({ where: { isianId: id } })) > 0) {
    throw new BusinessRuleError(`Isian yang pernah difinalkan tidak dapat dilepas tautannya. ${tolak}`);
  }
  if (row.asal && Object.keys(row.asal as object).length > 0) {
    throw new BusinessRuleError(`Isian ini sudah memakai data SIMRS pasien tertaut, sehingga tautannya tidak dapat dilepas. ${tolak}`);
  }

  const nopenSebelum = row.nopen;
  const hasil = await db.$transaction(async (tx) => {
    const n = await tx.formRmIsian.updateMany({
      where: { id, rev: input.rev, status: "DRAF", nopen: nopenSebelum },
      data: {
        subjek: subjekSementara(),
        nopen: "",
        urutan: 1,
        norm: "",
        namaPasien: row.identitasSementara!.sebutan,
        ruang: null,
        rev: input.rev + 1,
        diubahOlehId: aktor.id,
      },
    });
    if (n.count === 0) throw new ConflictError();
    await tx.formRmIdentitasSementara.update({
      where: { isianId: id },
      data: { ditautkanAt: null, ditautkanOlehId: null, ditautkanOlehNama: null },
    });
    return cariIsian(id, tx);
  });

  await auditIsian(aktor, "lepas-tautan", hasil, { nopenSebelum });
  return keDto(hasil);
}
