import "server-only";
import { NotFoundError } from "@/server/lib/errors";
import { addDaysIso, nowWitaIso, todayWitaIso } from "./audit.constants";
import { humanizeKey, sanitizeValue, setsStatusNonaktif } from "./audit.diff";
import { getRuanganResolver, getUserResolver } from "./audit.resolver";
import { hitungMatriksRi, type Matriks } from "./kepatuhan";
import {
  CPPT_PERAN,
  getSumberByObjek,
  KATEGORI_KEYS,
  profesiLabel,
  PROFESI_ORDER,
  SUMBER,
  tarifLabel,
  TTV_RENTANG_WAJAR,
  TTV_TERLAMBAT_MENIT,
  type KategoriKey,
  type SumberKey,
} from "./kunjungan.constants";
import {
  LOG_CAP,
  queryKunjunganByNomor,
  queryKunjunganRecords,
  queryPembatalanSnapshots,
  queryRecordContent,
  queryRecordLogs,
  type KategoriCountRow,
  type LogJendela,
  type RecordLogRow,
  type RecordRow,
  type RefGroup,
} from "./kunjungan.dal";
import { buildCard, type KunjunganCard, type UserResolver } from "./kunjungan.service";

/**
 * Jejak satu kunjungan (Fase 2 · K2): data AKTUAL per record (aktif & batal),
 * pelaku pembatalan & riwayat edit dari log, rekap petugas, matriks 24 jam ×
 * shift (Rawat Inap). Semua read-only; biaya SIMGOS per kunjungan: 1 query
 * kunjungan + 1 UNION record + 1 UNION log (+ 1 snapshot bila ada yang batal).
 */

/* ------------------------------------------------------------------- tipe */

export type Petugas = { id: string; nama: string | null; login: string | null; profesi: number | null; profesiLabel: string };

export type RekamItem = {
  sumber: SumberKey;
  kategori: KategoriKey;
  id: string;
  /** Waktu klinis (jam dinding WITA). */
  waktu: string | null;
  /** Waktu simpan bila berbeda (TTV). */
  waktuInput: string | null;
  /** Selisih simpan − periksa (menit) bila melewati ambang terlambat. */
  terlambatMenit: number | null;
  oleh: string | null;
  batal: boolean;
  /** Pelaku pembatalan dari log (STATUS level atas → 0); null bila tak tercatat. */
  batalOleh: Pembatalan | null;
  /** Label aturan item tarif (Tindakan) — null bila tindakan klinis/bukan Tindakan. */
  tarif: string | null;
  /** Peran penulis (CPPT) mis. "Dokter" / "Paramedis". */
  peran: string | null;
  ringkasan: string | null;
  /** Nilai tak wajar (kemungkinan salah input), mis. "Suhu 374 di luar 30–45". */
  peringatan: string | null;
  /** Jumlah perubahan tercatat di log (AKSI U). */
  edit: number;
  /** Diagnosis dicatat per episode (bisa dari leg kunjungan lain). */
  episode: boolean;
};

export type PetugasRekap = {
  id: string;
  perKategori: Record<KategoriKey, number>;
  total: number;
  batal: number;
  pertama: string | null;
  terakhir: string | null;
};

export type LogJenis = "PENAMBAHAN" | "PERUBAHAN" | "PEMBATALAN";
export type LogItem = { logId: string; ts: string; jenis: LogJenis; oleh: string; sumber: SumberKey; ref: string };

export type KunjunganDetail = {
  card: KunjunganCard;
  records: RekamItem[];
  petugasRekap: PetugasRekap[];
  logs: LogItem[];
  logTerpotong: boolean;
  /** Hanya Rawat Inap. */
  matriks: Matriks | null;
  /** Profil semua petugas yang dirujuk (id → profil). */
  petugas: Record<string, Petugas>;
};

export type RekamField = { key: string; label: string; value: string };
export type RekamIsi = {
  sumber: SumberKey;
  id: string;
  waktu: string | null;
  oleh: string | null;
  batal: boolean;
  fields: RekamField[];
  logs: LogItem[];
  petugas: Record<string, Petugas>;
};

/* ----------------------------------------------------------------- helper */

export const toPetugas = (id: string, users: UserResolver): Petugas => {
  const u = users.map.get(id);
  const profesi = u?.profesi ?? null;
  return { id, nama: u?.nama ?? null, login: u?.login ?? null, profesi, profesiLabel: profesiLabel(profesi) };
};

export function petugasMap(ids: Iterable<string | null>, users: UserResolver): Record<string, Petugas> {
  const out: Record<string, Petugas> = {};
  for (const id of ids) if (id && !out[id]) out[id] = toPetugas(id, users);
  return out;
}

/** 150.00 → "150", 37.40 → "37,4" (format Indonesia, tanpa nol ekor). */
const angka = (n: number) => String(Number(n.toFixed(2))).replace(".", ",");

type RingkasanInput = Pick<RecordRow, "sumber" | "teks" | "angka">;

/** Ringkasan satu baris per sumber — tanpa teks klinis berat. */
export function ringkasan(r: RingkasanInput): string | null {
  const [a, b, c, d, e, f] = r.angka;
  switch (r.sumber) {
    case "tanda_vital": {
      const part = [
        a && b ? `TD ${angka(a)}/${angka(b)}` : null,
        c ? `N ${angka(c)}` : null,
        d ? `RR ${angka(d)}` : null,
        e ? `S ${angka(e)}` : null,
        f ? `SpO₂ ${angka(f)}` : null,
      ].filter(Boolean);
      return part.length ? part.join(" · ") : null;
    }
    case "diagnosa":
      return r.teks ? `${r.teks}${a === 1 ? " · utama" : a === 2 ? " · sekunder" : ""}` : null;
    case "tindakan_medis":
      return r.teks;
    default:
      return null;
  }
}

/** Nilai TTV di luar rentang fisiologis ekstrem (0/kosong = tidak diisi, diabaikan). */
export function peringatanTtv(r: RingkasanInput): string | null {
  if (r.sumber !== "tanda_vital") return null;
  const salah = TTV_RENTANG_WAJAR.flatMap((w, i) => {
    const v = r.angka[i];
    return v && (v < w.min || v > w.max) ? [`${w.label} ${angka(v)} di luar ${w.min}–${w.max}`] : [];
  });
  return salah.length ? salah.join("; ") : null;
}

/** Selisih menit b − a, dipotong (semantik TIMESTAMPDIFF MINUTE SIMGOS). */
const menit = (a: string, b: string) => Math.trunc((Date.parse(`${b}Z`) - Date.parse(`${a}Z`)) / 60_000);

const refGroups = (items: { sumber: SumberKey; id: string }[]): RefGroup[] => {
  const by = new Map<string, string[]>();
  for (const it of items) {
    const o = SUMBER[it.sumber].objek;
    const list = by.get(o) ?? [];
    list.push(it.id);
    by.set(o, list);
  }
  return [...by.entries()].map(([objek, refs]) => ({ objek, refs }));
};

/**
 * Jendela TANGGAL log (pemangkas partisi): H-1 tanggal daftar episode s/d besok.
 * Tanpa tanggal daftar → tanpa batas bawah efektif (tetap benar, hanya lebih lambat).
 */
function jendelaLog(tglDaftar: string | null): LogJendela {
  return {
    sejak: tglDaftar ? `${addDaysIso(tglDaftar, -1)} 00:00:00` : "2000-01-01 00:00:00",
    sampai: `${addDaysIso(todayWitaIso(), 1)} 00:00:00`,
  };
}

export type Pembatalan = { oleh: string; ts: string; logId: string };

/** Pelaku pembatalan per `objek:ref` — log TERBARU yang menyetel STATUS level atas → 0. */
export async function lacakPembatalan(
  batal: { sumber: SumberKey; id: string }[],
  jendela: LogJendela,
): Promise<Map<string, Pembatalan>> {
  const out = new Map<string, { oleh: string; ts: string; logId: string }>();
  if (batal.length === 0) return out;
  const snaps = await queryPembatalanSnapshots(refGroups(batal), jendela); // urut ID desc
  for (const s of snaps) {
    const key = `${s.objek}:${s.ref}`;
    if (!out.has(key) && setsStatusNonaktif(s.sesudah)) out.set(key, { oleh: s.pengguna, ts: s.ts, logId: s.id });
  }
  return out;
}

function toLogItems(rows: RecordLogRow[], pembatalanLogIds: Set<string>): LogItem[] {
  return rows.flatMap((l) => {
    const s = getSumberByObjek(l.objek);
    if (!s) return [];
    const jenis: LogJenis = l.aksi === "C" ? "PENAMBAHAN" : pembatalanLogIds.has(l.id) ? "PEMBATALAN" : "PERUBAHAN";
    return [{ logId: l.id, ts: l.ts, jenis, oleh: l.pengguna, sumber: s.key, ref: l.ref }];
  });
}

const cmpWaktu = (a: { waktu: string | null }, b: { waktu: string | null }) =>
  (a.waktu ?? "9999") < (b.waktu ?? "9999") ? -1 : (a.waktu ?? "9999") > (b.waktu ?? "9999") ? 1 : 0;

/* ------------------------------------------------------------ jejak kunjungan */

export async function getKunjunganDetail(nomor: string): Promise<KunjunganDetail> {
  const [k, rows, users, ruangan] = await Promise.all([
    queryKunjunganByNomor(nomor),
    queryKunjunganRecords(nomor),
    getUserResolver(),
    getRuanganResolver(),
  ]);
  if (!k) throw new NotFoundError("Kunjungan tidak ditemukan.");

  const jendela = jendelaLog(k.tglDaftar ?? k.masuk.slice(0, 10));
  const refs = rows.map((r) => ({ sumber: r.sumber, id: r.id }));
  const batalRefs = rows.filter((r) => r.status === 0).map((r) => ({ sumber: r.sumber, id: r.id }));
  const [logRows, pembatalan] = await Promise.all([
    queryRecordLogs(refGroups(refs), jendela),
    lacakPembatalan(batalRefs, jendela),
  ]);
  const logTerpotong = logRows.length > LOG_CAP;
  const logs = toLogItems(logRows.slice(0, LOG_CAP), new Set([...pembatalan.values()].map((p) => p.logId)));

  const editCount = new Map<string, number>();
  for (const l of logRows) if (l.aksi === "U") editCount.set(`${l.objek}:${l.ref}`, (editCount.get(`${l.objek}:${l.ref}`) ?? 0) + 1);

  const records: RekamItem[] = rows
    .map((r) => {
      const meta = SUMBER[r.sumber];
      const key = `${meta.objek}:${r.id}`;
      const lag = r.waktu && r.waktuInput ? menit(r.waktu, r.waktuInput) : null;
      return {
        sumber: r.sumber,
        kategori: meta.kategori,
        id: r.id,
        waktu: r.waktu,
        waktuInput: r.waktuInput,
        terlambatMenit: lag != null && lag > TTV_TERLAMBAT_MENIT ? lag : null,
        oleh: r.oleh,
        batal: r.status === 0,
        batalOleh: r.status === 0 ? (pembatalan.get(key) ?? null) : null,
        tarif: r.sumber === "tindakan_medis" ? tarifLabel(r.teks) : null,
        peran: r.sumber === "cppt" && r.peran != null ? (CPPT_PERAN[r.peran] ?? `Peran #${r.peran}`) : null,
        ringkasan: ringkasan(r),
        peringatan: peringatanTtv(r),
        edit: editCount.get(key) ?? 0,
        episode: meta.kategori === "DIAGNOSIS",
      };
    })
    .sort(cmpWaktu);

  // Kartu dari record yang sama → angka identik dgn papan (K1).
  const counts = new Map<string, KategoriCountRow>();
  for (const r of records) {
    const key = `${r.kategori}:${r.oleh ?? ""}`;
    const c = counts.get(key) ?? { kategori: r.kategori, ref: r.episode ? k.nopen : k.nomor, oleh: r.oleh, aktif: 0, batal: 0 };
    if (r.batal) c.batal++;
    else c.aktif++;
    counts.set(key, c);
  }
  const card = buildCard(k, [...counts.values()], users, ruangan, todayWitaIso());

  // Rekap per petugas (input aktif per kategori + batal + rentang waktu).
  const rekap = new Map<string, PetugasRekap>();
  for (const r of records) {
    if (!r.oleh) continue;
    const p =
      rekap.get(r.oleh) ??
      ({
        id: r.oleh,
        perKategori: Object.fromEntries(KATEGORI_KEYS.map((x) => [x, 0])) as Record<KategoriKey, number>,
        total: 0,
        batal: 0,
        pertama: null,
        terakhir: null,
      } satisfies PetugasRekap);
    if (r.batal) p.batal++;
    else {
      p.perKategori[r.kategori]++;
      p.total++;
    }
    if (r.waktu && (!p.pertama || r.waktu < p.pertama)) p.pertama = r.waktu;
    if (r.waktu && (!p.terakhir || r.waktu > p.terakhir)) p.terakhir = r.waktu;
    rekap.set(r.oleh, p);
  }
  const rank = (id: string) => {
    const i = (PROFESI_ORDER as readonly number[]).indexOf(users.map.get(id)?.profesi ?? -1);
    return i < 0 ? 99 : i;
  };
  const petugasRekap = [...rekap.values()].sort((a, b) => rank(a.id) - rank(b.id) || b.total - a.total);

  const peranById = new Map(rows.map((r) => [`${r.sumber}:${r.id}`, r.peran]));
  const matriks =
    k.jenis === 3
      ? hitungMatriksRi({
          records: records.map((r) => ({
            kategori: r.kategori,
            waktu: r.waktu,
            oleh: r.oleh,
            batal: r.batal,
            peran: peranById.get(`${r.sumber}:${r.id}`) ?? null,
          })),
          masuk: k.masuk,
          keluar: k.keluar,
          now: nowWitaIso(),
        })
      : null;

  return {
    card,
    records,
    petugasRekap,
    logs,
    logTerpotong,
    matriks,
    petugas: petugasMap(
      [...records.map((r) => r.oleh), ...records.map((r) => r.batalOleh?.oleh ?? null), ...logs.map((l) => l.oleh)],
      users,
    ),
  };
}

/* -------------------------------------------------------- isi satu record */

const FIELD_LABEL: Record<string, string> = {
  KELUHAN_UTAMA: "Keluhan utama",
  RPS: "Riwayat penyakit sekarang (RPS)",
  RPP: "Riwayat penyakit dahulu (RPP)",
  RPK: "Riwayat penyakit keluarga (RPK)",
  RIWAYAT_ALERGI: "Riwayat alergi",
  REAKSI_ALERGI: "Reaksi alergi",
  DESKRIPSI: "Deskripsi",
  SUBYEKTIF: "S — Subjektif",
  OBYEKTIF: "O — Objektif",
  ASSESMENT: "A — Asesmen",
  PLANNING: "P — Rencana",
  INSTRUKSI: "Instruksi",
  KEADAAN_UMUM: "Keadaan umum",
  KESADARAN: "Kesadaran",
  SISTOLIK: "Sistolik (mmHg)",
  DISTOLIK: "Diastolik (mmHg)",
  FREKUENSI_NADI: "Nadi (×/menit)",
  FREKUENSI_NAFAS: "Napas (×/menit)",
  SUHU: "Suhu (°C)",
  SATURASI_O2: "SpO₂ (%)",
  GCS: "GCS",
  EWSS: "EWSS (skor peringatan dini)",
  KODE: "Kode ICD-10",
  DIAGNOSA: "Diagnosis",
  UTAMA: "Jenis diagnosis",
  CATATAN: "Catatan",
  NAMA_TINDAKAN: "Tindakan",
  VERIFIKASI: "Terverifikasi",
};

const FIELD_VALUE: Record<string, (v: string) => string> = {
  UTAMA: (v) => (v === "1" ? "Utama" : v === "2" ? "Sekunder" : v),
  VERIFIKASI: (v) => (v === "1" ? "Ya" : v === "0" ? "Belum" : v),
};

/** Isi klinis satu record + riwayat log-nya (read-only, on-demand). */
export async function getRekamIsi(sumber: SumberKey, id: string): Promise<RekamIsi> {
  const row = await queryRecordContent(sumber, id);
  if (!row) throw new NotFoundError("Record tidak ditemukan.");
  const batal = row.status === 0;
  const objek = SUMBER[sumber].objek;

  const jendela = jendelaLog(row.tglDaftar);
  const [logRows, pembatalan, users] = await Promise.all([
    queryRecordLogs([{ objek, refs: [row.id] }], jendela),
    batal ? lacakPembatalan([{ sumber, id: row.id }], jendela) : Promise.resolve(new Map<string, Pembatalan>()),
    getUserResolver(),
  ]);
  const logs = toLogItems(logRows.slice(0, LOG_CAP), new Set([...pembatalan.values()].map((p) => p.logId)));

  const fields: RekamField[] = [];
  for (const [key, raw] of Object.entries(row.isi)) {
    // DECIMAL dari adapter berupa objek → teks dulu agar tak ter-JSON-kan ("150").
    let v = sanitizeValue(raw != null && typeof raw === "object" && !(raw instanceof Date) ? String(raw) : raw);
    if (v == null || v === "") continue;
    if (/^-?\d+\.\d+$/.test(v)) v = angka(Number(v));
    fields.push({ key, label: FIELD_LABEL[key] ?? humanizeKey(key), value: FIELD_VALUE[key]?.(v) ?? v });
  }

  return {
    sumber,
    id: row.id,
    waktu: row.waktu,
    oleh: row.oleh,
    batal,
    fields,
    logs,
    petugas: petugasMap([row.oleh, ...logs.map((l) => l.oleh)], users),
  };
}
