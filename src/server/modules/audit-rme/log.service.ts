import "server-only";
import { AKSI_JENIS, type JenisAktivitas } from "./audit.constants";
import { queryLogCount, queryLogPage, queryLogSnapshots, type LogFilter } from "./audit.dal";
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

export async function getLogAktivitas(q: LogQuery): Promise<LogPage> {
  const { from, to } = resolveRange(q, RENTANG_LOG_DEFAULT_HARI);
  // Filter khusus CRUD (objek/aksi/REF) → login tidak relevan.
  const khususRme = !!q.objek || !!q.aksi || !!q.q;
  const f: LogFilter = {
    from,
    to,
    objek: q.objek ? [q.objek] : SUMBER_OBJEK_IDS,
    aksi: q.aksi,
    pengguna: q.pengguna,
    q: q.q,
    rme: q.sumber !== "LOGIN",
    login: q.sumber !== "RME" && !khususRme,
  };

  const [jumlah, users] = await Promise.all([queryLogCount(f), getUserResolver()]);
  const total = jumlah.rme + jumlah.login;
  const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
  const page = Math.min(q.page, totalPages);
  const rows = total ? await queryLogPage(f, (page - 1) * q.pageSize, q.pageSize) : [];

  // Resolusi REF → kunjungan & deteksi pembatalan hanya untuk baris halaman ini.
  const perSumber = new Map<SumberKey, string[]>();
  for (const r of rows) {
    const s = r.objek ? getSumberByObjek(r.objek) : undefined;
    if (!s || !r.ref || !/^\d{1,20}$/.test(r.ref)) continue;
    perSumber.set(s.key, [...(perSumber.get(s.key) ?? []), r.ref]);
  }
  const ubahIds = rows.filter((r) => r.aksi === "U").map((r) => r.id);
  const [refs, snaps, ruangan] = await Promise.all([
    queryRefKunjungan([...perSumber.entries()].map(([sumber, ids]) => ({ sumber, ids: [...new Set(ids)] }))),
    queryLogSnapshots(ubahIds, f),
    getRuanganResolver(),
  ]);
  const kunjungan = await queryKunjunganByNomors([...new Set(refs.flatMap((r) => (r.kunjungan ? [r.kunjungan] : [])))]);

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

  const items: LogBaris[] = rows.map((r) => {
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

  return { range: { from, to }, page, pageSize: q.pageSize, total, totalPages, jumlah, items };
}
