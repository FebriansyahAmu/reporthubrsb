import "server-only";
import type { FormRmIsian, Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  ServiceUnavailableError,
} from "@/server/lib/errors";
import { definisiForm, type DefinisiForm } from "@/features/form-rm/registry";
import {
  adalahStatusIsian,
  perluIzinKelola,
  statusSetelah,
  type AksiIsian,
  type StatusIsian,
} from "@/features/form-rm/isian.status";
import { getFormRmHeader } from "./form-rm.service";
import type { FormRmHeader } from "./form-rm.types";
import { auditIsian } from "./isian.audit";
import { pindahkanBarisLama } from "./isian.lama";
import { isiOtomatis } from "./isian.prefill";
import { kanonik, periksaRantai, segel, type IsiSegel } from "./isian.segel";
import type { AksiIsianInput, BuatIsianInput, SimpanIsianInput } from "./isian.schema";
import { pisahkanTtd, rujukanTtd, sidikTtd, sisipkanTtd } from "./isian.ttd";
import type { Aktor, IsianForm, RevisiIsian, RiwayatIsian } from "./isian.types";

/**
 * LAYANAN ISIAN FORM RM (PRD §6.3, §8). Semua penulisan memakai update
 * bersyarat pada `rev` (+ status) → tulis bersamaan: satu menang, sisanya 409.
 * Setiap transisi status menulis revisi tersegel HMAC berantai dalam transaksi
 * yang sama. Audit tanpa isi form / nama pasien (hanya id, kode, NOPEN, status).
 */

type Tx = Prisma.TransactionClient;

/** JSON isian setelah TTD dipisah (TTD tidak ikut dihitung). */
const MAKS_DATA_BYTE = 256 * 1024;

const isUnik = (e: unknown) => (e as { code?: string } | null)?.code === "P2002";

/* ------------------------------------------------------- kunci integritas */

let kunciCache: { mentah: string; kunci: Uint8Array } | null = null;

/** Kunci HMAC segel revisi dari env (≥ 32 karakter). Tanpa kunci → 503 (fail-closed). */
function kunciIntegritas(): Uint8Array {
  const mentah = process.env.FORM_RM_KUNCI_INTEGRITAS?.trim() ?? "";
  if (mentah.length < 32) {
    throw new ServiceUnavailableError(
      "Kunci integritas Form RM (FORM_RM_KUNCI_INTEGRITAS) belum dikonfigurasi dengan benar",
    );
  }
  if (kunciCache?.mentah !== mentah) kunciCache = { mentah, kunci: new TextEncoder().encode(mentah) };
  return kunciCache.kunci;
}

/* ---------------------------------------------------------------- bantu */

function definisiDari(row: Pick<FormRmIsian, "formKode" | "formVersi">): DefinisiForm {
  const def = definisiForm(row.formKode);
  // Versi dinaikkan bila struktur form berubah; dukungan multi-versi menyusul saat dibutuhkan.
  if (!def || def.versi !== row.formVersi) {
    throw new BusinessRuleError(`Definisi form ${row.formKode} v${row.formVersi} tidak tersedia`);
  }
  return def;
}

function statusDari(row: Pick<FormRmIsian, "status">): StatusIsian {
  if (!adalahStatusIsian(row.status)) throw new BusinessRuleError(`Status isian tidak dikenal: ${row.status}`);
  return row.status;
}

function keDto(row: FormRmIsian): IsianForm {
  const def = definisiDari(row);
  return {
    id: row.id,
    kode: def.kode,
    versi: row.formVersi,
    judul: def.judul,
    kategori: def.kategori,
    nopen: row.nopen,
    urutan: row.urutan,
    norm: row.norm,
    namaPasien: row.namaPasien,
    ruang: row.ruang,
    status: statusDari(row),
    rev: row.rev,
    data: row.data,
    asal: Array.isArray(row.asal) ? (row.asal as string[]) : [],
    dibuatOlehId: row.dibuatOlehId,
    diubahOlehId: row.diubahOlehId,
    difinalkanOlehId: row.difinalkanOlehId,
    difinalkanAt: row.difinalkanAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function cariIsian(id: string, db: Tx = getAppDb()): Promise<FormRmIsian> {
  const row = await db.formRmIsian.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Isian form tidak ditemukan");
  return row;
}

/* ------------------------------------------------------------------ buat */

/**
 * Buka isian aktif (bukan BATAL) untuk (form, pendaftaran), atau buat baru
 * dengan identitas & isi otomatis dari SIMGOS (read-only). Form berulang selalu
 * membuat isian baru dengan urutan berikutnya. Bila form itu belum pernah punya
 * isian tetapi ada di tabel lama, data lama yang dipindahkan (bukan isi otomatis).
 *
 * Urutan isian baru diambil dari snapshot AWAL (sebelum isi otomatis yang
 * lambat): permintaan bersamaan menghitung urutan yang sama → bentrok di kunci
 * unik → yang kalah membuka isian pemenang. Form tidak berulang tak pernah
 * punya dua isian aktif.
 */
export async function bukaAtauBuatIsian(
  input: BuatIsianInput,
  aktor: Aktor,
): Promise<{ isian: IsianForm; baru: boolean }> {
  const def = definisiForm(input.kode);
  if (!def) throw new NotFoundError("Form tidak dikenal");
  const db = getAppDb();
  const subjek = input.nopen; // semua form saat ini bercakupan EPISODE

  const terakhir = () => db.formRmIsian.findFirst({ where: { formKode: def.kode, subjek }, orderBy: { urutan: "desc" } });
  /** Isian aktif milik permintaan lain yang menang balapan (form tidak berulang). */
  const bukaPemenang = async () => {
    const ada = def.berulang ? null : await terakhir();
    if (!ada || ada.status === "BATAL") throw new ConflictError();
    return { isian: keDto(ada), baru: false };
  };

  const awal = await terakhir();
  if (!def.berulang && awal && awal.status !== "BATAL") return { isian: keDto(awal), baru: false };

  if (!awal) {
    const lama = await db.formRm.findUnique({ where: { nopen_jenis: { nopen: input.nopen, jenis: def.jenisLama } } });
    if (lama) {
      const h = await pindahkanBarisLama(lama, aktor);
      if (h.hasil === "dipindah") return { isian: keDto(await cariIsian(h.isianId)), baru: true };
      if (h.hasil === "gagal") {
        throw new BusinessRuleError(`Isian lama form ini tidak bisa dipindahkan (${h.alasan}). Hubungi pengelola rekam medis.`);
      }
      return bukaPemenang(); // dilewati = baru saja dipindahkan permintaan lain
    }
  }

  const header = await getFormRmHeader(input.nopen);
  if (!header) throw new NotFoundError("Pendaftaran tidak ditemukan atau tidak aktif");
  const { data, asal } = await isiOtomatis(def, input.nopen, header);

  try {
    const row = await db.formRmIsian.create({
      data: {
        formKode: def.kode,
        formVersi: def.versi,
        subjek,
        nopen: input.nopen,
        urutan: (awal?.urutan ?? 0) + 1,
        norm: header.norm,
        namaPasien: header.nama,
        ruang: header.ruang === "—" ? null : header.ruang,
        data: data as Prisma.InputJsonValue,
        asal,
        dibuatOlehId: aktor.id,
        diubahOlehId: aktor.id,
      },
    });
    await auditIsian(aktor, "buat", row);
    return { isian: keDto(row), baru: true };
  } catch (e) {
    // Dua permintaan bersamaan: yang kalah membuka isian milik pemenang.
    if (!isUnik(e)) throw e;
    return bukaPemenang();
  }
}

/* ------------------------------------------------------------------ baca */

export async function bacaIsian(id: string, aktor: Aktor): Promise<IsianForm> {
  const row = await cariIsian(id);
  await auditIsian(aktor, "lihat", row);
  return keDto(row);
}

/**
 * Identitas kepala formulir: No.RM, nama & ruang dari SNAPSHOT isian (diambil
 * server saat dibuat); jenis kelamin, tanggal lahir, dst. dibaca dari SIMGOS.
 */
export async function identitasIsian(isian: IsianForm): Promise<FormRmHeader> {
  const simgos = await getFormRmHeader(isian.nopen).catch(() => null);
  return {
    nopen: isian.nopen,
    norm: isian.norm,
    nama: isian.namaPasien,
    jenisKelamin: simgos?.jenisKelamin ?? "—",
    tanggalLahir: simgos?.tanggalLahir ?? null,
    umur: simgos?.umur ?? null,
    ruang: isian.ruang ?? simgos?.ruang ?? "—",
    masuk: simgos?.masuk ?? isian.createdAt,
    nik: simgos?.nik ?? "",
  };
}

/**
 * Isian untuk dokumen cetak: TTD disisipkan sebagai PNG data-URL, ditambah segel
 * revisi terakhir bila isian identik dengan revisi itu (FINAL/BATAL). Diaudit.
 */
export async function bacaIsianCetak(id: string, aktor: Aktor): Promise<{ isian: IsianForm; segel: string | null }> {
  const db = getAppDb();
  const row = await cariIsian(id);
  const def = definisiDari(row);
  const [data, revisi] = await Promise.all([
    sisipkanTtd(db, id, def, row.data as object),
    db.formRmRevisi.findFirst({ where: { isianId: id }, orderBy: { rev: "desc" }, select: { rev: true, hash: true } }),
  ]);
  await auditIsian(aktor, "cetak", row);
  return { isian: { ...keDto(row), data }, segel: revisi?.rev === row.rev ? revisi.hash : null };
}

/** Gambar TTD (PNG ternormalisasi). Izin dicek di API; id = cuid acak. */
export async function bacaTtd(id: string): Promise<{ png: Uint8Array; sha256: string }> {
  const row = await getAppDb().formRmTtd.findUnique({ where: { id }, select: { png: true, sha256: true } });
  if (!row) throw new NotFoundError("Tanda tangan tidak ditemukan");
  return row;
}

/* ---------------------------------------------------------------- simpan */

export async function simpanIsian(id: string, input: SimpanIsianInput, aktor: Aktor): Promise<IsianForm> {
  const row = await cariIsian(id);
  if (statusDari(row) !== "DRAF") {
    throw new BusinessRuleError(
      row.status === "FINAL"
        ? "Isian sudah FINAL. Buka untuk koreksi lebih dulu."
        : "Isian sudah dibatalkan dan tidak bisa diubah.",
    );
  }
  if (row.rev !== input.rev) throw new ConflictError();
  const def = definisiDari(row);
  const sah = def.skema.parse(input.data);

  const hasil = await getAppDb().$transaction(async (tx) => {
    const data = await pisahkanTtd(tx, id, def, sah, aktor.id);
    if (new TextEncoder().encode(JSON.stringify(data)).byteLength > MAKS_DATA_BYTE) throw new PayloadTooLargeError();
    const n = await tx.formRmIsian.updateMany({
      where: { id, rev: input.rev, status: "DRAF" },
      data: { data: data as Prisma.InputJsonValue, rev: input.rev + 1, diubahOlehId: aktor.id },
    });
    if (n.count === 0) throw new ConflictError();
    return cariIsian(id, tx);
  }).catch((e: unknown) => {
    throw isUnik(e) ? new ConflictError() : e;
  });

  await auditIsian(aktor, "simpan", hasil);
  return keDto(hasil);
}

/* --------------------------------------------------------------- transisi */

const LABEL_AUDIT: Record<AksiIsian, string> = {
  FINALKAN: "finalkan",
  BUKA_KOREKSI: "buka-koreksi",
  BATALKAN: "batalkan",
};

/**
 * FINALKAN / BUKA_KOREKSI / BATALKAN. Aksi atas isian FINAL hanya untuk
 * pengelola RM (`bolehKelola`). Finalisasi mensyaratkan `syaratFinal` form.
 */
export async function aksiIsian(
  id: string,
  input: AksiIsianInput,
  aktor: Aktor & { bolehKelola: boolean },
): Promise<IsianForm> {
  const row = await cariIsian(id);
  const status = statusDari(row);
  const ke = statusSetelah(status, input.aksi);
  if (!ke) throw new BusinessRuleError(`Aksi ${input.aksi} tidak berlaku untuk isian berstatus ${status}`);
  if (perluIzinKelola(status) && !aktor.bolehKelola) {
    throw new ForbiddenError("Hanya pengelola rekam medis yang dapat mengubah isian FINAL");
  }
  if (row.rev !== input.rev) throw new ConflictError();

  const def = definisiDari(row);
  // Yang disegel = data PERSIS seperti tersimpan (bukan hasil parse ulang), agar
  // pemeriksaan "isian sama dengan revisi terakhir" tak pernah alarm palsu.
  const data = row.data as Prisma.JsonObject;
  if (input.aksi === "FINALKAN") {
    const kurang = def.syaratFinal(def.skema.parse(data));
    if (kurang.length > 0) throw new BusinessRuleError("Isian belum lengkap untuk difinalkan", { kurang });
  }

  const kunci = kunciIntegritas();
  const waktu = new Date();
  const alasan = input.aksi === "FINALKAN" ? null : (input.alasan ?? null);

  const hasil = await getAppDb().$transaction(async (tx) => {
    const n = await tx.formRmIsian.updateMany({
      where: { id, rev: input.rev, status },
      data: {
        status: ke,
        rev: input.rev + 1,
        diubahOlehId: aktor.id,
        ...(ke === "FINAL" ? { difinalkanOlehId: aktor.id, difinalkanAt: waktu } : {}),
      },
    });
    if (n.count === 0) throw new ConflictError();

    const sebelum = await tx.formRmRevisi.findFirst({ where: { isianId: id }, orderBy: { rev: "desc" }, select: { hash: true } });
    const isi: IsiSegel = {
      isianId: id,
      formKode: row.formKode,
      formVersi: row.formVersi,
      subjek: row.subjek,
      urutan: row.urutan,
      rev: input.rev + 1,
      aksi: input.aksi,
      status: ke,
      data,
      ttd: await sidikTtd(tx, id, rujukanTtd(def, data)),
      alasan,
      olehId: aktor.id,
      waktu: waktu.toISOString(),
    };
    const hashSebelum = sebelum?.hash ?? null;
    await tx.formRmRevisi.create({
      data: {
        isianId: id,
        rev: isi.rev,
        aksi: input.aksi,
        status: ke,
        data,
        alasan,
        olehId: aktor.id,
        olehNama: aktor.nama,
        hash: segel(kunci, hashSebelum, isi),
        hashSebelum,
        createdAt: waktu,
      },
    });
    return cariIsian(id, tx);
  }).catch((e: unknown) => {
    throw isUnik(e) ? new ConflictError() : e;
  });

  await auditIsian(aktor, LABEL_AUDIT[input.aksi], hasil);
  return keDto(hasil);
}

/* ---------------------------------------------------------------- riwayat */

/**
 * Riwayat revisi + pemeriksaan integritas: rantai segel utuh, dan isian
 * FINAL/BATAL identik dengan revisi terakhirnya (DRAF boleh berbeda — sedang
 * dikoreksi).
 */
export async function riwayatIsian(id: string): Promise<RiwayatIsian> {
  const db = getAppDb();
  const row = await cariIsian(id);
  const def = definisiDari(row);
  const revisi = await db.formRmRevisi.findMany({ where: { isianId: id }, orderBy: { rev: "asc" } });

  const kunci = kunciIntegritas();
  const tersegel = await Promise.all(
    revisi.map(async (r) => ({
      rev: r.rev,
      hash: r.hash,
      hashSebelum: r.hashSebelum,
      isi: {
        isianId: id,
        formKode: row.formKode,
        formVersi: row.formVersi,
        subjek: row.subjek,
        urutan: row.urutan,
        rev: r.rev,
        aksi: r.aksi,
        status: r.status,
        data: r.data,
        ttd: await sidikTtd(db, id, rujukanTtd(def, r.data as object)),
        alasan: r.alasan,
        olehId: r.olehId,
        waktu: r.createdAt.toISOString(),
      } satisfies IsiSegel,
    })),
  );
  const masalah = periksaRantai(kunci, tersegel);

  const terakhir = revisi.at(-1);
  const status = statusDari(row);
  if (status !== "DRAF") {
    if (!terakhir) masalah.push(`Isian berstatus ${status} tanpa revisi`);
    else if (terakhir.status !== status || terakhir.rev !== row.rev || kanonik(terakhir.data) !== kanonik(row.data)) {
      masalah.push(`Isian ${status} tidak sama dengan revisi terakhirnya`);
    }
  }

  return {
    revisi: revisi.map(
      (r): RevisiIsian => ({
        rev: r.rev,
        aksi: r.aksi as AksiIsian,
        status: r.status as StatusIsian,
        alasan: r.alasan,
        olehNama: r.olehNama,
        waktu: r.createdAt.toISOString(),
      }),
    ),
    integritas: { utuh: masalah.length === 0, masalah },
  };
}
