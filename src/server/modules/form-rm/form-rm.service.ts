import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { isSimgosConfigured } from "@/server/lib/env";
import { hitungUmur } from "@/lib/format";
import { queryKunjunganRange } from "@/server/modules/pelayanan/pelayanan.dal";
import { mapKunjunganPelayanan } from "@/server/modules/pelayanan/pelayanan.mapper";
import {
  queryFormRmHeader,
  queryRingkasanHeader,
  queryDiagnosaByNopen,
  type DiagnosaRow,
} from "./form-rm.dal";
import { EDUKASI_JENIS } from "@/features/form-rm/edukasi.constants";
import { CONSENT_JENIS } from "@/features/form-rm/consent.constants";
import {
  RINGKASAN_JENIS,
  matchAgama,
  matchPekerjaan,
  matchPendidikan,
  matchPerkawinan,
} from "@/features/form-rm/ringkasan.constants";
import type {
  ConsentContext,
  ConsentForm,
  EdukasiContext,
  EdukasiForm,
  FormRmHeader,
  FormRmListResult,
  FormRmPatient,
  FormRmSaved,
  RingkasanContext,
  RingkasanForm,
  RingkasanPrefill,
} from "./form-rm.types";

const PAGE_SIZE = 12;

export type FormRmListArgs = {
  from: string;
  toExclusive: string;
  ruanganId?: string;
  search?: string;
  page: number;
};

function toIso(v: Date | string | null): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Daftar pasien target Form RM = kunjungan **IGD** (baru masuk / masih dirawat)
 * pada rentang tanggal. READ-ONLY (SIMGOS). Non-final ikut tampil karena form RM
 * diisi di AWAL kunjungan. Pencarian nama/No.RM/ruang; paginasi server-side.
 */
export async function getFormRmList(a: FormRmListArgs): Promise<FormRmListResult> {
  if (!isSimgosConfigured()) {
    return {
      data: [],
      meta: { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 },
      total: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  const rows = await queryKunjunganRange({
    from: a.from,
    to: a.toExclusive,
    ruanganId: a.ruanganId,
  });

  const igd: FormRmPatient[] = rows
    .map(mapKunjunganPelayanan)
    .filter((it) => it.kategori === "IGD")
    .map((it) => ({
      nopen: it.nopen,
      nomor: it.nomor,
      norm: it.norm,
      nama: it.nama,
      jenisKelamin: it.jenisKelamin,
      umur: it.umur,
      kategori: it.kategori,
      ruang: it.ruang,
      masuk: it.masuk,
      keluar: it.keluar,
    }));

  const q = a.search?.trim().toLowerCase();
  const searched = q
    ? igd.filter((it) => `${it.nama} ${it.norm} ${it.ruang}`.toLowerCase().includes(q))
    : igd;

  const total = searched.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, a.page), totalPages);
  const start = (page - 1) * PAGE_SIZE;

  return {
    data: searched.slice(start, start + PAGE_SIZE),
    meta: { page, pageSize: PAGE_SIZE, total, totalPages },
    total,
    updatedAt: new Date().toISOString(),
  };
}

/** Header identitas pasien untuk kepala formulir. Null bila NOPEN tak ditemukan. */
export async function getFormRmHeader(nopen: string): Promise<FormRmHeader | null> {
  if (!isSimgosConfigured()) return null;
  const h = await queryFormRmHeader(nopen);
  if (!h) return null;

  const lahir = h.TANGGAL_LAHIR
    ? h.TANGGAL_LAHIR instanceof Date
      ? h.TANGGAL_LAHIR
      : new Date(h.TANGGAL_LAHIR)
    : null;
  const jk = Number(h.JENIS_KELAMIN);

  return {
    nopen,
    norm: String(h.NORM ?? ""),
    nama: h.NAMA?.trim() || "—",
    jenisKelamin: jk === 1 ? "Laki-Laki" : jk === 2 ? "Perempuan" : "—",
    tanggalLahir: toIso(h.TANGGAL_LAHIR),
    umur: hitungUmur(lahir && !Number.isNaN(lahir.getTime()) ? lahir : null),
    ruang: h.RUANG?.trim() || "—",
    masuk: toIso(h.MASUK) ?? new Date().toISOString(),
    nik: h.NIK?.trim() || "",
  };
}

/** Rekaman form RM tersimpan (reporthub) untuk (NOPEN, jenis), atau null. */
export async function getFormRmRecord(
  nopen: string,
  jenis: string,
): Promise<FormRmSaved | null> {
  const rec = await getAppDb().formRm.findUnique({
    where: { nopen_jenis: { nopen, jenis } },
  });
  if (!rec) return null;
  return {
    nopen: rec.nopen,
    jenis: rec.jenis,
    data: rec.data as unknown as EdukasiForm,
    updatedAt: rec.updatedAt.toISOString(),
    updatedBy: rec.updatedBy ?? null,
  };
}

/** true bila (NOPEN, jenis) sudah punya form tersimpan. */
export async function formRmExists(nopen: string, jenis: string): Promise<boolean> {
  const rec = await getAppDb().formRm.findUnique({
    where: { nopen_jenis: { nopen, jenis } },
    select: { id: true },
  });
  return rec != null;
}

/** Konteks form Edukasi: rekaman tersimpan (bila ada) + header pasien SIMGOS. */
export async function getEdukasiContext(nopen: string): Promise<EdukasiContext | null> {
  const [saved, header] = await Promise.all([
    getFormRmRecord(nopen, EDUKASI_JENIS),
    getFormRmHeader(nopen),
  ]);
  if (!header) return null;
  return { saved, header };
}

/** Konteks form General Consent (RM.03): rekaman tersimpan + header pasien SIMGOS. */
export async function getConsentContext(nopen: string): Promise<ConsentContext | null> {
  const [rec, header] = await Promise.all([
    getAppDb().formRm.findUnique({ where: { nopen_jenis: { nopen, jenis: CONSENT_JENIS } } }),
    getFormRmHeader(nopen),
  ]);
  if (!header) return null;
  const saved: FormRmSaved<ConsentForm> | null = rec
    ? {
        nopen: rec.nopen,
        jenis: rec.jenis,
        data: rec.data as unknown as ConsentForm,
        updatedAt: rec.updatedAt.toISOString(),
        updatedBy: rec.updatedBy ?? null,
      }
    : null;
  return { saved, header };
}

// --- RM.01 Ringkasan Masuk & Keluar --------------------------------------

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Date SIMGOS (jam-dinding di field UTC) → "YYYY-MM-DDTHH:mm" lokal. Baca getUTC*. */
function toWallClockLocal(v: Date | string | null): string {
  if (v == null) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return (
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  );
}

/** Selisih hari (kalender) masuk→keluar sebagai "lama rawat". "" bila tak lengkap. */
function hitungLamaRawat(masuk: Date | string | null, keluar: Date | string | null): string {
  if (masuk == null || keluar == null) return "";
  const dm = masuk instanceof Date ? masuk : new Date(masuk);
  const dk = keluar instanceof Date ? keluar : new Date(keluar);
  if (Number.isNaN(dm.getTime()) || Number.isNaN(dk.getTime())) return "";
  const a = Date.UTC(dm.getUTCFullYear(), dm.getUTCMonth(), dm.getUTCDate());
  const b = Date.UTC(dk.getUTCFullYear(), dk.getUTCMonth(), dk.getUTCDate());
  const days = Math.round((b - a) / 86_400_000);
  return days >= 0 ? String(days) : "";
}

function komposeAlamat(alamat: string | null, rt: string | null, rw: string | null): string {
  const isReal = (s: string | null) => !!s && s.trim() !== "" && !/^0+$/.test(s.trim());
  const parts = [
    alamat?.trim() || "",
    isReal(rt) ? `RT ${rt!.trim()}` : "",
    isReal(rw) ? `RW ${rw!.trim()}` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

/** Susun diagnosa akhir: utama (baris UTAMA=1 pertama) + sekunder (UTAMA=2, gabung). */
function ringkasDiagnosa(rows: DiagnosaRow[]) {
  const clean = (s: string | null) => (s ?? "").trim();
  const utamaRows = rows.filter((r) => Number(r.UTAMA) === 1);
  const sekRows = rows.filter((r) => Number(r.UTAMA) !== 1);
  const u = utamaRows[0];
  return {
    diagnosaUtama: u ? clean(u.DIAGNOSA) : "",
    diagnosaUtamaKode: u ? clean(u.KODE) : "",
    diagnosaSekunder: sekRows.map((r) => clean(r.DIAGNOSA)).filter(Boolean).join("; "),
    diagnosaSekunderKode: sekRows.map((r) => clean(r.KODE)).filter(Boolean).join(", "),
  };
}

const EMPTY_PREFILL: RingkasanPrefill = {
  alamat: "",
  golDarah: "",
  dirawatKe: "",
  pendidikan: "",
  pendidikanLain: "",
  bangsa: "",
  agama: "",
  statusPerkawinan: "",
  pekerjaan: "",
  tglMasuk: "",
  tglKeluar: "",
  lamaRawat: "",
  dpjp: "",
  peserta: "",
  diagnosaUtama: "",
  diagnosaUtamaKode: "",
  diagnosaSekunder: "",
  diagnosaSekunderKode: "",
};

/** Konteks form RM.01: rekaman tersimpan + header pasien + prefill SIMGOS siap-isi. */
export async function getRingkasanContext(nopen: string): Promise<RingkasanContext | null> {
  const [rec, header] = await Promise.all([
    getAppDb().formRm.findUnique({ where: { nopen_jenis: { nopen, jenis: RINGKASAN_JENIS } } }),
    getFormRmHeader(nopen),
  ]);
  if (!header) return null;

  const saved: FormRmSaved<RingkasanForm> | null = rec
    ? {
        nopen: rec.nopen,
        jenis: rec.jenis,
        data: rec.data as unknown as RingkasanForm,
        updatedAt: rec.updatedAt.toISOString(),
        updatedBy: rec.updatedBy ?? null,
      }
    : null;

  let prefill = EMPTY_PREFILL;
  if (isSimgosConfigured()) {
    const [row, dx] = await Promise.all([
      queryRingkasanHeader(nopen).catch(() => null),
      queryDiagnosaByNopen(nopen).catch(() => [] as DiagnosaRow[]),
    ]);
    if (row) {
      const pend = matchPendidikan(row.PENDIDIKAN?.trim() || "");
      const goldar = row.GOL_DARAH?.trim() || "";
      const negara = row.NEGARA?.trim() || "";
      const penjamin = Number(row.PENJAMIN_JENIS);
      prefill = {
        alamat: komposeAlamat(row.ALAMAT, row.RT, row.RW),
        golDarah: /^tidak\s*tahu$/i.test(goldar) ? "" : goldar,
        dirawatKe: row.DIRAWAT_KE != null ? String(Number(row.DIRAWAT_KE) || "") : "",
        pendidikan: pend.opt,
        pendidikanLain: pend.lain,
        bangsa: negara ? (/indonesia/i.test(negara) ? "Indonesia" : "Asing") : "",
        agama: matchAgama(row.AGAMA?.trim() || ""),
        statusPerkawinan: matchPerkawinan(row.PERKAWINAN?.trim() || "", header.jenisKelamin),
        pekerjaan: matchPekerjaan(row.PEKERJAAN?.trim() || ""),
        tglMasuk: toWallClockLocal(row.MASUK),
        tglKeluar: toWallClockLocal(row.KELUAR),
        lamaRawat: hitungLamaRawat(row.MASUK, row.KELUAR),
        dpjp: row.DPJP?.trim() || "",
        peserta: penjamin === 2 ? "BPJS" : penjamin === 3 ? "Asuransi" : penjamin === 1 ? "Umum" : "",
        ...ringkasDiagnosa(dx),
      };
    }
  }

  return { saved, header, prefill };
}

export type FormRmHeaderInput = { norm?: string; nama?: string; ruang?: string };

/** Simpan/replace form RM (upsert per NOPEN+jenis) di DB reporthub. */
export async function saveFormRm<T extends object>(
  nopen: string,
  jenis: string,
  data: T,
  header: FormRmHeaderInput,
  userId: string | null,
): Promise<FormRmSaved<T>> {
  const rec = await getAppDb().formRm.upsert({
    where: { nopen_jenis: { nopen, jenis } },
    create: {
      nopen,
      jenis,
      norm: header.norm ?? null,
      namaPasien: header.nama ?? null,
      ruang: header.ruang ?? null,
      data: data as unknown as object,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      norm: header.norm ?? null,
      namaPasien: header.nama ?? null,
      ruang: header.ruang ?? null,
      data: data as unknown as object,
      updatedBy: userId,
    },
  });
  return {
    nopen: rec.nopen,
    jenis: rec.jenis,
    data: rec.data as unknown as T,
    updatedAt: rec.updatedAt.toISOString(),
    updatedBy: rec.updatedBy ?? null,
  };
}
