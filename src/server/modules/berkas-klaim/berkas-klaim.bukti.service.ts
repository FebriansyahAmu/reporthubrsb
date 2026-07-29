import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { isSimgosConfigured } from "@/server/lib/env";
import { queryTindakanByNopen, type TindakanRow } from "./berkas-klaim.dal";
import type {
  BuktiPelayananContext,
  BuktiPelayananForm,
  BuktiPelayananSaved,
  BuktiTindakanRow,
} from "./berkas-klaim.types";

const pad = (n: number) => String(n).padStart(2, "0");

/** DATE dari SIMGOS → "YYYY-MM-DD" (jam-dinding, baca getUTC*). */
function toWallClockDate(v: Date | string | null): string {
  if (v == null) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function mapTindakan(row: TindakanRow): BuktiTindakanRow {
  return {
    tanggal: toWallClockDate(row.TANGGAL),
    nama: row.NAMA?.trim() || "(tanpa nama)",
    pelaksana: "",
    keterangan: "",
  };
}

/** Rekaman Bukti Pelayanan tersimpan (reporthub) untuk satu NOPEN, atau null. */
export async function getBuktiRecord(nopen: string): Promise<BuktiPelayananSaved | null> {
  const rec = await getAppDb().buktiPelayanan.findUnique({ where: { nopen } });
  if (!rec) return null;
  return {
    nopen: rec.nopen,
    data: rec.data as unknown as BuktiPelayananForm,
    updatedAt: rec.updatedAt.toISOString(),
    updatedBy: rec.updatedBy ?? null,
  };
}

/** true bila episode sudah punya Bukti Pelayanan tersimpan. */
export async function buktiExists(nopen: string): Promise<boolean> {
  const rec = await getAppDb().buktiPelayanan.findUnique({
    where: { nopen },
    select: { id: true },
  });
  return rec != null;
}

/** Konteks untuk form: rekaman tersimpan + tindakan dari SIMGOS (prefill). */
export async function getBuktiContext(nopen: string): Promise<BuktiPelayananContext> {
  const [saved, tindakanRows] = await Promise.all([
    getBuktiRecord(nopen),
    isSimgosConfigured() ? queryTindakanByNopen(nopen).catch(() => []) : Promise.resolve([]),
  ]);
  return { saved, tindakanSimgos: tindakanRows.map(mapTindakan) };
}

export type BuktiHeader = {
  norm?: string;
  nama?: string;
  kategori?: string;
  ruang?: string;
};

/** Simpan/replace Bukti Pelayanan untuk satu NOPEN (upsert) di DB reporthub. */
export async function saveBukti(
  nopen: string,
  form: BuktiPelayananForm,
  header: BuktiHeader,
  userId: string | null,
): Promise<BuktiPelayananSaved> {
  const rec = await getAppDb().buktiPelayanan.upsert({
    where: { nopen },
    create: {
      nopen,
      norm: header.norm ?? null,
      namaPasien: header.nama ?? null,
      kategori: header.kategori ?? null,
      ruang: header.ruang ?? null,
      data: form as unknown as object,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      norm: header.norm ?? null,
      namaPasien: header.nama ?? null,
      kategori: header.kategori ?? null,
      ruang: header.ruang ?? null,
      data: form as unknown as object,
      updatedBy: userId,
    },
  });
  return {
    nopen: rec.nopen,
    data: rec.data as unknown as BuktiPelayananForm,
    updatedAt: rec.updatedAt.toISOString(),
    updatedBy: rec.updatedBy ?? null,
  };
}
