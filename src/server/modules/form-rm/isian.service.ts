import "server-only";
import type { FormRmIdentitasSementara, FormRmIsian, Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  ServiceUnavailableError,
  ValidationError,
} from "@/server/lib/errors";
import { ambilPath, normalkanAsal, pasangPath, samaNilai } from "@/features/form-rm/asal";
import type { AksiForm, HakForm } from "@/features/form-rm/hak";
import { definisiForm, type DefinisiForm } from "@/features/form-rm/registry";
import { pangkasTeksPanjang } from "@/features/form-rm/skema";
import { JK_SEMENTARA, SYARAT_TERTAUT, type IdentitasSementara } from "@/features/form-rm/sementara";
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
import type { AksiIsianInput, BuatIsianInput, SimpanIsianInput, TerapkanSimrsInput } from "./isian.schema";
import { pisahkanTtd, rujukanTtd, sidikTtd, sisipkanTtd } from "./isian.ttd";
import type { AktorForm, BandingSimrs, IsianForm, RevisiIsian, RiwayatIsian } from "./isian.types";

/**
 * LAYANAN ISIAN FORM RM (PRD §6.3, §8). Semua penulisan memakai update
 * bersyarat pada `rev` (+ status) → tulis bersamaan: satu menang, sisanya 409.
 * Setiap transisi status menulis revisi tersegel HMAC berantai dalam transaksi
 * yang sama. Audit tanpa isi form / nama pasien (hanya id, kode, NOPEN, status).
 * Setiap akses isian/TTD/riwayat berdasarkan ID dicek hak kategori form-nya.
 */

export type Tx = Prisma.TransactionClient;

/** Baris isian + identitas sementara (bila isian dibuat sebelum pasien terdaftar). */
export type BarisIsian = FormRmIsian & { identitasSementara: FormRmIdentitasSementara | null };
export const SERTA_SEMENTARA = { identitasSementara: true } as const;

/** JSON isian setelah TTD dipisah (TTD tidak ikut dihitung). */
const MAKS_DATA_BYTE = 256 * 1024;

export const isUnik = (e: unknown) => (e as { code?: string } | null)?.code === "P2002";

/** Isian belum tertaut ke pendaftaran: dibuat sebelum pasien terdaftar, nopen masih kosong. */
export const tertaut = (row: Pick<FormRmIsian, "nopen">): boolean => row.nopen !== "";

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

export function definisiDari(row: Pick<FormRmIsian, "formKode" | "formVersi">): DefinisiForm {
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

function sementaraDto(s: FormRmIdentitasSementara | null): IdentitasSementara | null {
  if (!s) return null;
  return {
    sebutan: s.sebutan,
    jenisKelamin: (JK_SEMENTARA as readonly string[]).includes(s.jenisKelamin) ? (s.jenisKelamin as IdentitasSementara["jenisKelamin"]) : "",
    perkiraanUmur: s.perkiraanUmur,
    ciri: s.ciri,
    dibuatAt: s.createdAt.toISOString(),
    ditautkanAt: s.ditautkanAt?.toISOString() ?? null,
    ditautkanOlehNama: s.ditautkanOlehNama,
  };
}

export function keDto(row: BarisIsian): IsianForm {
  const def = definisiDari(row);
  return {
    id: row.id,
    kode: def.kode,
    versi: row.formVersi,
    judul: def.judul,
    kategori: def.kategori,
    nopen: row.nopen,
    tertaut: tertaut(row),
    sementara: sementaraDto(row.identitasSementara),
    urutan: row.urutan,
    norm: row.norm,
    namaPasien: row.namaPasien,
    ruang: row.ruang,
    status: statusDari(row),
    rev: row.rev,
    data: row.data,
    asal: normalkanAsal(row.asal),
    dibuatOlehId: row.dibuatOlehId,
    diubahOlehId: row.diubahOlehId,
    difinalkanOlehId: row.difinalkanOlehId,
    difinalkanAt: row.difinalkanAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const ISIAN_TAK_ADA = "Isian form tidak ditemukan";

export async function cariIsian(id: string, db: Tx = getAppDb()): Promise<BarisIsian> {
  const row = await db.formRmIsian.findUnique({ where: { id }, include: SERTA_SEMENTARA });
  if (!row) throw new NotFoundError(ISIAN_TAK_ADA);
  return row;
}

/**
 * Hak per kategori form atas isian (PRD §10.2). Kategori yang tak boleh dilihat
 * diperlakukan sama dengan isian yang tak ada (404 seragam → ID isian kategori
 * lain tak bisa ditebak keberadaannya); boleh lihat tetapi tanpa `aksi` → 403.
 */
function jagaKategori(formKode: string, hak: HakForm, aksi: AksiForm): void {
  const def = definisiForm(formKode);
  if (!def || !hak.boleh(def.kategori, "view")) throw new NotFoundError(ISIAN_TAK_ADA);
  if (!hak.boleh(def.kategori, aksi)) throw new ForbiddenError();
}

export async function cariIsianBoleh(id: string, hak: HakForm, aksi: AksiForm): Promise<BarisIsian> {
  const row = await cariIsian(id);
  jagaKategori(row.formKode, hak, aksi);
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
  aktor: AktorForm,
): Promise<{ isian: IsianForm; baru: boolean }> {
  const def = definisiForm(input.kode);
  if (!def) throw new NotFoundError("Form tidak dikenal");
  if (!aktor.hak.boleh(def.kategori, "create")) throw new ForbiddenError();
  const db = getAppDb();
  const subjek = input.nopen; // semua form saat ini bercakupan EPISODE

  const terakhir = () =>
    db.formRmIsian.findFirst({ where: { formKode: def.kode, subjek }, orderBy: { urutan: "desc" }, include: SERTA_SEMENTARA });
  /** Isian aktif milik permintaan lain yang menang balapan (form tidak berulang). */
  const bukaPemenang = async () => {
    const ada = def.berulang ? null : await terakhir();
    if (!ada || ada.status === "BATAL") throw new ConflictError();
    return { isian: keDto(ada), baru: false };
  };

  const awal = await terakhir();
  if (!def.berulang && awal && awal.status !== "BATAL") return { isian: keDto(awal), baru: false };

  // Data tabel lama hanya ada untuk 4 form awal (punya `jenisLama`).
  if (!awal && def.jenisLama) {
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

  const buat = (urutan: number) =>
    db.formRmIsian.create({
      data: {
        formKode: def.kode,
        formVersi: def.versi,
        subjek,
        nopen: input.nopen,
        urutan,
        norm: header.norm,
        namaPasien: header.nama,
        ruang: header.ruang === "—" ? null : header.ruang,
        data: data as Prisma.InputJsonValue,
        asal: asal as Prisma.InputJsonValue,
        dibuatOlehId: aktor.id,
        diubahOlehId: aktor.id,
      },
      include: SERTA_SEMENTARA,
    });

  let urutan = (awal?.urutan ?? 0) + 1;
  // Form berulang: dua isian baru bersamaan sama-sama sah → yang bentrok cukup
  // mengambil urutan berikutnya (paling banyak 3 kali). Form tidak berulang:
  // yang kalah membuka isian milik pemenang.
  for (let coba = 0; ; coba++) {
    try {
      const row = await buat(urutan);
      await auditIsian(aktor, "buat", row);
      return { isian: keDto(row), baru: true };
    } catch (e) {
      if (!isUnik(e)) throw e;
      if (!def.berulang || coba >= 2) return bukaPemenang();
      urutan = ((await terakhir())?.urutan ?? urutan) + 1;
    }
  }
}

/* ------------------------------------------------------------------ baca */

export async function bacaIsian(id: string, aktor: AktorForm): Promise<IsianForm> {
  const row = await cariIsianBoleh(id, aktor.hak, "view");
  await auditIsian(aktor, "lihat", row);
  return keDto(row);
}

const LABEL_JK_HEADER = { L: "Laki-Laki", P: "Perempuan", "": "—" } as const;

/**
 * Identitas kepala formulir: No.RM, nama & ruang dari SNAPSHOT isian (diambil
 * server saat dibuat/ditautkan); jenis kelamin, tanggal lahir, dst. dibaca dari
 * SIMGOS. Isian belum tertaut memakai identitas sementara (No.RM kosong).
 */
export async function identitasIsian(isian: IsianForm): Promise<FormRmHeader> {
  if (!isian.tertaut) {
    const s = isian.sementara;
    return {
      nopen: "",
      norm: "",
      nama: s?.sebutan ?? isian.namaPasien,
      jenisKelamin: LABEL_JK_HEADER[s?.jenisKelamin ?? ""],
      tanggalLahir: null,
      umur: s?.perkiraanUmur || null,
      ruang: "—",
      masuk: isian.createdAt,
      nik: "",
    };
  }
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
export async function bacaIsianCetak(id: string, aktor: AktorForm): Promise<{ isian: IsianForm; segel: string | null }> {
  const db = getAppDb();
  const row = await cariIsianBoleh(id, aktor.hak, "print");
  const def = definisiDari(row);
  const [data, revisi] = await Promise.all([
    sisipkanTtd(db, id, def, row.data as object),
    db.formRmRevisi.findFirst({ where: { isianId: id }, orderBy: { rev: "desc" }, select: { rev: true, hash: true } }),
  ]);
  await auditIsian(aktor, "cetak", row);
  return { isian: { ...keDto(row), data }, segel: revisi?.rev === row.rev ? revisi.hash : null };
}

/** Gambar TTD (PNG ternormalisasi); hak dicek pada kategori form isian pemiliknya. */
export async function bacaTtd(id: string, hak: HakForm): Promise<{ png: Uint8Array; sha256: string }> {
  const row = await getAppDb().formRmTtd.findUnique({
    where: { id },
    select: { png: true, sha256: true, isian: { select: { formKode: true } } },
  });
  const takAda = new NotFoundError("Tanda tangan tidak ditemukan");
  if (!row) throw takAda;
  try {
    jagaKategori(row.isian.formKode, hak, "view");
  } catch {
    throw takAda;
  }
  return { png: row.png, sha256: row.sha256 };
}

/* ---------------------------------------------------------------- simpan */

/** Data SIMRS hanya ada untuk isian yang sudah tertaut ke pendaftaran. */
function jagaTertaut(row: Pick<FormRmIsian, "nopen">): void {
  if (!tertaut(row)) throw new BusinessRuleError("Isian belum tertaut ke pasien terdaftar. Tautkan lebih dulu.");
}

/** Isi isian hanya bisa diubah selama DRAF. */
export function jagaDraf(row: Pick<FormRmIsian, "status">): void {
  if (statusDari(row) === "DRAF") return;
  throw new BusinessRuleError(
    row.status === "FINAL"
      ? "Isian sudah FINAL. Buka untuk koreksi lebih dulu."
      : "Isian sudah dibatalkan dan tidak bisa diubah.",
  );
}

const ukuranJson = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).byteLength;

export async function simpanIsian(id: string, input: SimpanIsianInput, aktor: AktorForm): Promise<IsianForm> {
  const row = await cariIsianBoleh(id, aktor.hak, "update");
  jagaDraf(row);
  if (row.rev !== input.rev) throw new ConflictError();
  const def = definisiDari(row);
  const sah = def.skema.parse(input.data);
  const tolak = def.cekPerubahan?.(row.data, sah);
  if (tolak) throw new BusinessRuleError(tolak);

  const hasil = await getAppDb().$transaction(async (tx) => {
    const data = await pisahkanTtd(tx, id, def, sah, aktor.id);
    if (ukuranJson(data) > MAKS_DATA_BYTE) throw new PayloadTooLargeError();
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

/* ----------------------------------------------------- muat ulang SIMRS */

/** Nilai SIMRS terkini untuk isian (identitas dibaca ulang dari SIMGOS). */
async function isiSimrsTerkini(def: DefinisiForm, nopen: string) {
  const header = await getFormRmHeader(nopen);
  if (!header) throw new BusinessRuleError("Pendaftaran pasien ini tidak lagi aktif di SIMRS");
  return isiOtomatis(def, nopen, header);
}

/**
 * Perbandingan nilai isian dengan nilai SIMRS terkini per bagian (PRD §6.4
 * butir 3). Hanya untuk isian DRAF & pengguna yang boleh mengubahnya.
 */
export async function bandingkanSimrs(id: string, aktor: AktorForm): Promise<BandingSimrs> {
  const row = await cariIsianBoleh(id, aktor.hak, "update");
  jagaDraf(row);
  jagaTertaut(row);
  const def = definisiDari(row);
  const segar = await isiSimrsTerkini(def, row.nopen);
  await auditIsian(aktor, "banding-simrs", row);
  return {
    rev: row.rev,
    bagian: def.simrs.map((b) => ({
      id: b.id,
      judul: b.judul,
      kolom: b.kolom.map((k) => {
        const s = Object.hasOwn(segar.asal, k.path) ? segar.asal[k.path] : undefined;
        const sekarang = ambilPath(row.data, k.path) ?? null;
        return {
          path: k.path,
          label: k.label,
          sekarang,
          simrs: s ? s.nilai : null,
          sama: s ? samaNilai(sekarang, s.nilai) : false,
          status: s ? "ada" : segar.status[k.sumber] === "gagal" ? "gagal" : "kosong",
          episodeIgd: s?.nopen ?? null,
        };
      }),
    })),
  };
}

/**
 * Terapkan nilai SIMRS TERKINI ke kolom terpilih (diambil ulang di server —
 * klien tak pernah mengirim nilai SIMRS sehingga tanda asal tak bisa dipalsu).
 * Kolom tanpa nilai SIMRS dilewati. rev naik; asal kolom diperbarui.
 */
export async function terapkanSimrs(
  id: string,
  input: TerapkanSimrsInput,
  aktor: AktorForm,
): Promise<{ isian: IsianForm; diterapkan: string[] }> {
  const row = await cariIsianBoleh(id, aktor.hak, "update");
  jagaDraf(row);
  jagaTertaut(row);
  if (row.rev !== input.rev) throw new ConflictError();
  const def = definisiDari(row);
  const dikenal = new Set(def.simrs.flatMap((b) => b.kolom.map((k) => k.path)));
  const asing = input.kolom.filter((p) => !dikenal.has(p));
  if (asing.length > 0) throw new ValidationError({ kolom: `Kolom tidak dapat diisi dari SIMRS: ${asing.slice(0, 5).join(", ")}` });

  const segar = await isiSimrsTerkini(def, row.nopen);
  const data = structuredClone(row.data) as Record<string, unknown>;
  const pilih = [...new Set(input.kolom)].filter(
    (p) => Object.hasOwn(segar.asal, p) && pasangPath(data, p, segar.asal[p].nilai),
  );
  if (pilih.length === 0) throw new BusinessRuleError("Data SIMRS untuk kolom yang dipilih tidak tersedia");

  const sah = pangkasTeksPanjang(def.skema, data);
  if (!sah) throw new BusinessRuleError("Data SIMRS tidak sesuai dengan formulir ini");
  if (ukuranJson(sah) > MAKS_DATA_BYTE) throw new PayloadTooLargeError();
  const asal = normalkanAsal(row.asal);
  for (const p of pilih) asal[p] = segar.asal[p];

  const n = await getAppDb().formRmIsian.updateMany({
    where: { id, rev: input.rev, status: "DRAF" },
    data: {
      data: sah as Prisma.InputJsonValue,
      asal: asal as Prisma.InputJsonValue,
      rev: input.rev + 1,
      diubahOlehId: aktor.id,
    },
  });
  if (n.count === 0) throw new ConflictError();
  const hasil = await cariIsian(id);
  await auditIsian(aktor, "muat-ulang-simrs", hasil);
  return { isian: keDto(hasil), diterapkan: pilih };
}

/* --------------------------------------------------------------- transisi */

const LABEL_AUDIT: Record<AksiIsian, string> = {
  FINALKAN: "finalkan",
  BUKA_KOREKSI: "buka-koreksi",
  BATALKAN: "batalkan",
};

/**
 * FINALKAN / BUKA_KOREKSI / BATALKAN (butuh update pada kategori form). Aksi
 * atas isian FINAL hanya untuk pengelola RM (`hak.kelola`). Finalisasi
 * mensyaratkan `syaratFinal` form.
 */
export async function aksiIsian(id: string, input: AksiIsianInput, aktor: AktorForm): Promise<IsianForm> {
  const row = await cariIsianBoleh(id, aktor.hak, "update");
  const status = statusDari(row);
  const ke = statusSetelah(status, input.aksi);
  if (!ke) throw new BusinessRuleError(`Aksi ${input.aksi} tidak berlaku untuk isian berstatus ${status}`);
  if (perluIzinKelola(status) && !aktor.hak.kelola) {
    throw new ForbiddenError("Hanya pengelola rekam medis yang dapat mengubah isian FINAL");
  }
  if (row.rev !== input.rev) throw new ConflictError();

  const def = definisiDari(row);
  // Yang disegel = data PERSIS seperti tersimpan (bukan hasil parse ulang), agar
  // pemeriksaan "isian sama dengan revisi terakhir" tak pernah alarm palsu.
  const data = row.data as Prisma.JsonObject;
  if (input.aksi === "FINALKAN") {
    // Dokumen RM final wajib beridentitas pasien → isian sementara ditautkan dulu.
    const kurang = [...(tertaut(row) ? [] : [SYARAT_TERTAUT]), ...def.syaratFinal(def.skema.parse(data))];
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
export async function riwayatIsian(id: string, hak: HakForm): Promise<RiwayatIsian> {
  const db = getAppDb();
  const row = await cariIsianBoleh(id, hak, "view");
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
