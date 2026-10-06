import "server-only";
import type { FormRmIsian, Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import { writeAudit } from "@/server/lib/audit";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  ServiceUnavailableError,
  ValidationError,
} from "@/server/lib/errors";
import { normalkanPng } from "@/server/lib/png";
import { definisiForm, type DefinisiForm } from "@/features/form-rm/registry";
import {
  adalahDataUrlTtd,
  idDariRefTtd,
  refTtd,
  TTD_DATA_URL_PREFIX,
} from "@/features/form-rm/skema";
import {
  adalahStatusIsian,
  perluIzinKelola,
  statusSetelah,
  type AksiIsian,
  type StatusIsian,
} from "@/features/form-rm/isian.status";
import { getFormRmHeader } from "./form-rm.service";
import { isiOtomatis } from "./isian.prefill";
import { kanonik, periksaRantai, segel, sha256Hex, type IsiSegel } from "./isian.segel";
import type { AksiIsianInput, BuatIsianInput, SimpanIsianInput } from "./isian.schema";
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
/** TTD baru per sekali simpan. */
const MAKS_TTD_BARU = 25;

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

const audit = (aktor: Aktor, aksi: string, row: Pick<FormRmIsian, "id" | "formKode" | "nopen" | "status" | "rev">) =>
  writeAudit({
    actorId: aktor.id,
    actorName: aktor.nama,
    action: `form-rm.isian.${aksi}`,
    targetId: row.id,
    metadata: { kode: row.formKode, nopen: row.nopen, status: row.status, rev: row.rev },
    ip: aktor.ip,
  });

/* ------------------------------------------------------------ tanda tangan */

/** Id TTD yang dirujuk data (urutan slot). */
function rujukanTtd(def: DefinisiForm, data: object): string[] {
  const ids: string[] = [];
  def.petaTtd(data, (v) => {
    const id = idDariRefTtd(v);
    if (id) ids.push(id);
    return v;
  });
  return ids;
}

/**
 * Pisahkan TTD dari data: PNG data-URL baru dinormalkan & disimpan di
 * `form_rm_ttd` (dipakai ulang bila sha256 sama), lalu diganti referensi
 * `ttd:<id>`. Referensi yang ada harus milik isian INI (bukan isian lain).
 */
async function pisahkanTtd(tx: Tx, isianId: string, def: DefinisiForm, data: object, olehId: string): Promise<object> {
  const baru = new Map<string, string>(); // data-URL → slot pertama
  const dirujuk = new Set<string>();
  def.petaTtd(data, (v, slot) => {
    if (adalahDataUrlTtd(v)) {
      if (!baru.has(v)) baru.set(v, slot);
    } else {
      const id = idDariRefTtd(v);
      if (id) dirujuk.add(id);
    }
    return v;
  });

  if (baru.size > MAKS_TTD_BARU) throw new ValidationError({ formErrors: ["Terlalu banyak tanda tangan baru"], fieldErrors: {} });
  if (dirujuk.size > 0) {
    const milik = await tx.formRmTtd.count({ where: { id: { in: [...dirujuk] }, isianId } });
    if (milik !== dirujuk.size) {
      throw new ValidationError({ formErrors: ["Referensi tanda tangan tidak dikenal"], fieldErrors: {} });
    }
  }

  const ganti = new Map<string, string>();
  for (const [dataUrl, slot] of baru) {
    const hasil = normalkanPng(Buffer.from(dataUrl.slice(TTD_DATA_URL_PREFIX.length), "base64"));
    if (!hasil.ok) throw new ValidationError({ formErrors: [], fieldErrors: { [slot]: [hasil.alasan] } });
    const sha256 = sha256Hex(hasil.png);
    const ada = await tx.formRmTtd.findUnique({ where: { isianId_sha256: { isianId, sha256 } }, select: { id: true } });
    const id =
      ada?.id ??
      (
        await tx.formRmTtd.create({
          data: { isianId, slot, png: hasil.png, sha256, ukuran: hasil.png.byteLength, dibuatOlehId: olehId },
          select: { id: true },
        })
      ).id;
    ganti.set(dataUrl, refTtd(id));
  }
  return baru.size === 0 ? data : def.petaTtd(data, (v) => ganti.get(v) ?? v);
}

/** id TTD → sha256 dihitung ulang dari bytes (bukan kolom sha256) untuk segel. */
async function sidikTtd(db: Tx, isianId: string, ids: readonly string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const rows = await db.formRmTtd.findMany({ where: { id: { in: [...ids] }, isianId }, select: { id: true, png: true } });
  return Object.fromEntries(rows.map((r) => [r.id, sha256Hex(r.png)]));
}

/* ------------------------------------------------------------------ buat */

/**
 * Buka isian aktif (bukan BATAL) untuk (form, pendaftaran), atau buat baru
 * dengan identitas & isi otomatis dari SIMGOS (read-only). Form berulang selalu
 * membuat isian baru dengan urutan berikutnya.
 */
export async function bukaAtauBuatIsian(
  input: BuatIsianInput,
  aktor: Aktor,
): Promise<{ isian: IsianForm; baru: boolean }> {
  const def = definisiForm(input.kode);
  if (!def) throw new NotFoundError("Form tidak dikenal");
  const db = getAppDb();
  const subjek = input.nopen; // semua form saat ini bercakupan EPISODE

  const aktif = () =>
    db.formRmIsian.findFirst({
      where: { formKode: def.kode, subjek, status: { not: "BATAL" } },
      orderBy: { urutan: "desc" },
    });
  if (!def.berulang) {
    const ada = await aktif();
    if (ada) return { isian: keDto(ada), baru: false };
  }

  const header = await getFormRmHeader(input.nopen);
  if (!header) throw new NotFoundError("Pendaftaran tidak ditemukan atau tidak aktif");
  const { data, asal } = await isiOtomatis(def, input.nopen, header);

  const terakhir = await db.formRmIsian.aggregate({ where: { formKode: def.kode, subjek }, _max: { urutan: true } });
  try {
    const row = await db.formRmIsian.create({
      data: {
        formKode: def.kode,
        formVersi: def.versi,
        subjek,
        nopen: input.nopen,
        urutan: (terakhir._max.urutan ?? 0) + 1,
        norm: header.norm,
        namaPasien: header.nama,
        ruang: header.ruang === "—" ? null : header.ruang,
        data: data as Prisma.InputJsonValue,
        asal,
        dibuatOlehId: aktor.id,
        diubahOlehId: aktor.id,
      },
    });
    await audit(aktor, "buat", row);
    return { isian: keDto(row), baru: true };
  } catch (e) {
    // Dua permintaan bersamaan: yang kalah membuka isian milik pemenang.
    if (!isUnik(e)) throw e;
    const ada = def.berulang ? null : await aktif();
    if (!ada) throw new ConflictError();
    return { isian: keDto(ada), baru: false };
  }
}

/* ------------------------------------------------------------------ baca */

export async function bacaIsian(id: string, aktor: Aktor): Promise<IsianForm> {
  const row = await cariIsian(id);
  await audit(aktor, "lihat", row);
  return keDto(row);
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

  await audit(aktor, "simpan", hasil);
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

  await audit(aktor, LABEL_AUDIT[input.aksi], hasil);
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
