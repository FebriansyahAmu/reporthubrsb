import "server-only";
import { BusinessRuleError } from "@/server/lib/errors";
import { AKSI_JENIS, type JenisAktivitas } from "./audit.constants";
import { queryLogCount, queryLogPage, queryLogSnapshots, type LogFilter, type LogPageRow } from "./audit.dal";
import { computeDiff, detectSoftDelete } from "./audit.diff";
import { getRuanganResolver, getUserResolver } from "./audit.resolver";
import type { LogQuery } from "./audit.schema";
import { toPetugas, type Petugas } from "./jejak.service";
import {
  getSumberByObjek,
  JENIS_KUNJUNGAN,
  SUMBER_OBJEK_IDS,
  type KategoriKey,
  type SumberKey,
} from "./kunjungan.constants";
import { queryKunjunganByNomors, queryRefKunjungan } from "./kunjungan.dal";
import { resolveRange } from "./kunjungan.service";

/**
 * Log Aktivitas (Fase 2 · K4): tabel log CRUD + login berpaginasi BERNOMOR,
 * diperkaya pasien & ruangan (REF → record → kunjungan). Read-only.
 * Biaya SIMGOS per halaman: 2 hitung + 1 halaman UNION + resolusi ≤ 25 REF +
 * snapshot hanya untuk perubahan yang menyentuh STATUS.
 */

export type LogKunjungan = { nomor: string; pasien: string | null; norm: string; ruangan: string; jenisShort: string };

export type LogBaris = {
  uid: string;
  sumber: "RME" | "LOGIN";
  /** Jam dinding WITA `YYYY-MM-DDTHH:mm:ss`. */
  ts: string;
  /** PENGHAPUSAN = pembatalan (STATUS → 0), sama dengan panel diff. */
  jenis: JenisAktivitas;
  logId: string | null;
  pengguna: Petugas;
  objek: { id: string; sumber: SumberKey; label: string; kategori: KategoriKey } | null;
  ref: string | null;
  ip: string | null;
  kunjungan: LogKunjungan | null;
};

export type LogPage = {
  range: { from: string; to: string };
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  jumlah: { rme: number; login: number };
  items: LogBaris[];
};

const RENTANG_LOG_DEFAULT_HARI = 7;
/** Batas baris satu ekspor log (7 hari ± 2.000 baris gabungan — 28 Sep 2026). */
export const LOG_EKSPOR_CAP = 5000;
/** Ukuran potongan `IN (…)` saat memperkaya banyak baris (ekspor). */
const POTONG = 500;

async function bertahap<T, R>(items: T[], fn: (part: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += POTONG) out.push(...(await fn(items.slice(i, i + POTONG))));
  return out;
}

function toLogFilter(q: Omit<LogQuery, "page" | "pageSize">): LogFilter {
  const { from, to } = resolveRange(q, RENTANG_LOG_DEFAULT_HARI);
  // Filter khusus CRUD (objek/aksi/REF) → login tidak relevan.
  const khususRme = !!q.objek || !!q.aksi || !!q.q;
  return {
    from,
    to,
    objek: q.objek ? [q.objek] : SUMBER_OBJEK_IDS,
    aksi: q.aksi,
    pengguna: q.pengguna,
    q: q.q,
    rme: q.sumber !== "LOGIN",
    login: q.sumber !== "RME" && !khususRme,
  };
}

/**
 * Perkaya baris log: pasien/ruangan (REF → record → kunjungan) & label
 * Pembatalan (diff SEBELUM/SESUDAH perubahan yang menyentuh STATUS — sama
 * dengan panel diff). `IN (…)` dipotong per 500 baris, berurutan.
 */
async function perkaya(rows: LogPageRow[], f: LogFilter): Promise<LogBaris[]> {
  const perSumber = new Map<SumberKey, Set<string>>();
  for (const r of rows) {
    const s = r.objek ? getSumberByObjek(r.objek) : undefined;
    if (!s || !r.ref || !/^\d{1,20}$/.test(r.ref)) continue;
    perSumber.set(s.key, (perSumber.get(s.key) ?? new Set()).add(r.ref));
  }
  const ubahIds = rows.filter((r) => r.aksi === "U").map((r) => r.id);
  const [refs, snaps, ruangan, users] = await Promise.all([
    bertahap([...perSumber.entries()].flatMap(([sumber, ids]) => [...ids].map((id) => ({ sumber, id }))), (part) => {
      const g = new Map<SumberKey, string[]>();
      for (const x of part) g.set(x.sumber, [...(g.get(x.sumber) ?? []), x.id]);
      return queryRefKunjungan([...g.entries()].map(([sumber, ids]) => ({ sumber, ids })));
    }),
    bertahap(ubahIds, (part) => queryLogSnapshots(part, f)),
    getRuanganResolver(),
    getUserResolver(),
  ]);
  const kunjungan = await bertahap([...new Set(refs.flatMap((r) => (r.kunjungan ? [r.kunjungan] : [])))], queryKunjunganByNomors);

  const kjByRef = new Map(refs.map((r) => [`${r.sumber}:${r.id}`, r.kunjungan]));
  const kInfo = new Map(
    kunjungan.map((k): [string, LogKunjungan] => [
      k.nomor,
      {
        nomor: k.nomor,
        pasien: k.nama,
        norm: k.norm,
        ruangan: ruangan.map.get(k.ruanganId)?.nama ?? k.ruanganId,
        jenisShort: (k.jenis != null ? JENIS_KUNJUNGAN[k.jenis]?.short : undefined) ?? "—",
      },
    ]),
  );
  const batal = new Set(snaps.filter((s) => detectSoftDelete(computeDiff(s.sebelum, s.sesudah))).map((s) => s.id));

  return rows.map((r) => {
    const s = r.objek ? getSumberByObjek(r.objek) : undefined;
    const nomor = s && r.ref ? kjByRef.get(`${s.key}:${r.ref}`) : null;
    return {
      uid: `${r.sumber === "RME" ? "R" : "L"}:${r.id}`,
      sumber: r.sumber,
      ts: r.ts,
      jenis: r.sumber === "LOGIN" ? "LOGIN" : batal.has(r.id) ? "PENGHAPUSAN" : AKSI_JENIS[r.aksi ?? "U"],
      logId: r.sumber === "RME" ? r.id : null,
      pengguna: toPetugas(r.pengguna, users),
      objek: s ? { id: s.objek, sumber: s.key, label: s.label, kategori: s.kategori } : null,
      ref: r.ref,
      ip: r.ip,
      kunjungan: nomor ? (kInfo.get(nomor) ?? null) : null,
    };
  });
}

export async function getLogAktivitas(q: LogQuery): Promise<LogPage> {
  const f = toLogFilter(q);
  const jumlah = await queryLogCount(f);
  const total = jumlah.rme + jumlah.login;
  const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
  const page = Math.min(q.page, totalPages);
  const rows = total ? await queryLogPage(f, (page - 1) * q.pageSize, q.pageSize) : [];
  return { range: { from: f.from, to: f.to }, page, pageSize: q.pageSize, total, totalPages, jumlah, items: await perkaya(rows, f) };
}

export type LogSemua = { range: { from: string; to: string }; jumlah: { rme: number; login: number }; items: LogBaris[] };

/**
 * SEMUA baris log cocok filter (bahan ekspor), urutan sama dengan tabel.
 * Ditolak bila melebihi `LOG_EKSPOR_CAP` — ekspor tidak pernah terpotong diam-diam.
 */
export async function semuaLog(q: Omit<LogQuery, "page" | "pageSize">): Promise<LogSemua> {
  const f = toLogFilter(q);
  const jumlah = await queryLogCount(f);
  const total = jumlah.rme + jumlah.login;
  if (total > LOG_EKSPOR_CAP) {
    throw new BusinessRuleError(
      `Terlalu banyak baris log (${total.toLocaleString("id-ID")}) untuk satu ekspor — maksimal ${LOG_EKSPOR_CAP.toLocaleString("id-ID")}. Persempit rentang atau filter.`,
    );
  }
  const rows = total ? await queryLogPage(f, 0, total) : [];
  return { range: { from: f.from, to: f.to }, jumlah, items: await perkaya(rows, f) };
}
