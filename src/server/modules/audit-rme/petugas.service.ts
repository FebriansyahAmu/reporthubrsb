import "server-only";
import { NotFoundError } from "@/server/lib/errors";
import { addDaysIso, todayWitaIso } from "./audit.constants";
import { getRuanganResolver, getTindakanResolver, getUserResolver } from "./audit.resolver";
import {
  lacakPembatalan,
  peringatanTtv,
  petugasMap,
  ringkasan,
  toPetugas,
  type Pembatalan,
  type Petugas,
} from "./jejak.service";
import {
  HARI_DINAS_MULAI_JAM,
  JENIS_KUNJUNGAN,
  KATEGORI_KEYS,
  KELOMPOK_JENIS,
  profesiLabel,
  PROFESI_ORDER,
  RENTANG_PETUGAS_DEFAULT_HARI,
  SHIFTS,
  shiftOfHour,
  statusKunjungan,
  SUMBER,
  TTV_TERLAMBAT_MENIT,
  type KategoriKey,
  type ShiftKey,
  type StatusKunjungan,
  type SumberKey,
} from "./kunjungan.constants";
import { queryKunjunganByNomors, type KunjunganRow } from "./kunjungan.dal";
import type { PetugasQuery } from "./kunjungan.schema";
import { resolveRange } from "./kunjungan.service";
import {
  PETUGAS_RECORD_CAP,
  queryPetugasAgregat,
  queryPetugasRecords,
  type PetugasAgregatRow,
  type PetugasFilter,
  type PetugasRecordRow,
} from "./petugas.dal";
import { hitungSkor, type SkorPetugas } from "./skor";

/**
 * Kepatuhan pengimputan per PETUGAS (Fase 2 · K3) — dasar reward & punishment.
 * Semua angka berasal dari data aktual (`OLEH`) dan dapat ditelusuri ke record
 * lewat profil → jejak kunjungan. Read-only.
 */

/* ------------------------------------------------------------------- tipe */

export type RentangHariDinas = { from: string; to: string; hari: number };

export type PetugasSkorItem = SkorPetugas & { nama: string | null; login: string | null; profesiLabel: string };

export type ProfesiRingkas = {
  profesi: number | null;
  label: string;
  total: number;
  dinilai: number;
  medianSkor: number | null;
  klinis: number;
  batal: number;
  tarif: number;
  ttv: number;
  ttvTerlambat: number;
};

export type KepatuhanPetugas = {
  range: RentangHariDinas;
  items: PetugasSkorItem[];
  profesi: ProfesiRingkas[];
};

export type HarianPetugas = {
  /** Tanggal hari dinas (07.00–07.00). */
  tanggal: string;
  klinis: number;
  perKategori: Record<KategoriKey, number>;
  tarif: number;
  batal: number;
};

export type KunjunganPetugas = {
  nomor: string;
  norm: string | null;
  pasien: string | null;
  ruangan: string;
  jenis: { id: number | null; label: string; short: string };
  masuk: string | null;
  keluar: string | null;
  status: StatusKunjungan | null;
  perKategori: Record<KategoriKey, number>;
  klinis: number;
  tarif: number;
  batal: number;
  pertama: string;
  terakhir: string;
};

export type TemuanTtv = {
  id: string;
  kunjungan: string | null;
  waktu: string;
  waktuInput: string | null;
  menit: number | null;
  ringkasan: string | null;
  peringatan: string | null;
};

export type TemuanBatal = {
  sumber: SumberKey;
  kategori: KategoriKey;
  id: string;
  kunjungan: string | null;
  waktu: string;
  ringkasan: string | null;
  batalOleh: Pembatalan | null;
};

export type ProfilPetugas = {
  petugas: Petugas;
  range: RentangHariDinas;
  harian: HarianPetugas[];
  perShift: Record<ShiftKey, number>;
  perKategori: Record<KategoriKey, number>;
  tarif: number;
  batal: number;
  kunjungan: KunjunganPetugas[];
  temuan: { ttvTerlambat: TemuanTtv[]; ttvTakWajar: TemuanTtv[]; batal: TemuanBatal[] };
  /** Profil petugas lain yang dirujuk (pelaku pembatalan). */
  petugasRef: Record<string, Petugas>;
  terpotong: boolean;
};

/* ----------------------------------------------------------------- helper */

const JAM_DINAS = `${String(HARI_DINAS_MULAI_JAM).padStart(2, "0")}:00:00`;

/** Rentang tanggal → jendela hari dinas `[from 07:00, to+1 07:00)` + filter lokasi. */
function toPetugasFilter(q: PetugasQuery): { range: RentangHariDinas; f: PetugasFilter } {
  const { from, to } = resolveRange(q, RENTANG_PETUGAS_DEFAULT_HARI);
  const hari = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  return {
    range: { from, to, hari },
    f: {
      sejak: `${from} ${JAM_DINAS}`,
      sampai: `${addDaysIso(to, 1)} ${JAM_DINAS}`,
      jenis: q.jenis,
      jenisIn: q.jenis == null && q.kelompok ? KELOMPOK_JENIS[q.kelompok] : undefined,
      ruangan: q.ruangan,
    },
  };
}

const nolKategori = (): Record<KategoriKey, number> =>
  Object.fromEntries(KATEGORI_KEYS.map((k) => [k, 0])) as Record<KategoriKey, number>;

const profesiRank = (p: number | null) => {
  const i = p == null ? -1 : (PROFESI_ORDER as readonly number[]).indexOf(p);
  return i < 0 ? 99 : i;
};

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/* --------------------------------------------------------- papan peringkat */

function toMetrik(r: PetugasAgregatRow, profesi: number | null) {
  const perKategori: Record<KategoriKey, number> = {
    ASESMEN: r.asesmen,
    CPPT: r.cppt,
    TTV: r.ttv,
    DIAGNOSIS: r.diagnosis,
    TINDAKAN: r.tindakan,
  };
  return {
    id: r.oleh,
    profesi,
    perKategori,
    klinis: KATEGORI_KEYS.reduce((s, k) => s + perKategori[k], 0),
    cpptKeperawatan: r.cpptKeperawatan,
    cpptDokter: r.cpptDokter,
    tarif: r.tarif,
    batal: r.batal,
    ttv: r.ttv,
    ttvTerlambat: r.ttvTerlambat,
    ttvTakWajar: r.ttvTakWajar,
    hariAktif: r.hariAktif,
    pasien: r.pasien,
    riHariPasien: r.riHariPasien,
    riShift: r.riShift,
    riVisite: r.riVisite,
  };
}

/**
 * Skor & peringkat semua penginput dalam rentang (dikelompokkan per profesi di
 * UI). Biaya SIMGOS: 1 query agregat (+ resolver ter-cache).
 */
export async function getKepatuhanPetugas(q: PetugasQuery): Promise<KepatuhanPetugas> {
  const { range, f } = toPetugasFilter(q);
  const tindakan = await getTindakanResolver();
  const [rows, users] = await Promise.all([queryPetugasAgregat(f, tindakan.tarifIds), getUserResolver()]);

  const items: PetugasSkorItem[] = hitungSkor(rows.map((r) => toMetrik(r, users.map.get(r.oleh)?.profesi ?? null)))
    .map((s) => {
      const u = users.map.get(s.id);
      return { ...s, nama: u?.nama ?? null, login: u?.login ?? null, profesiLabel: profesiLabel(s.profesi) };
    })
    .sort(
      (a, b) =>
        profesiRank(a.profesi) - profesiRank(b.profesi) ||
        (a.peringkat ?? Infinity) - (b.peringkat ?? Infinity) ||
        b.klinis - a.klinis,
    );

  const perProfesi = new Map<number | null, PetugasSkorItem[]>();
  for (const it of items) {
    const list = perProfesi.get(it.profesi);
    if (list) list.push(it);
    else perProfesi.set(it.profesi, [it]);
  }
  const sum = (list: PetugasSkorItem[], k: "klinis" | "batal" | "tarif" | "ttv" | "ttvTerlambat") =>
    list.reduce((s, x) => s + x[k], 0);
  const profesi: ProfesiRingkas[] = [...perProfesi.entries()].map(([p, list]) => ({
    profesi: p,
    label: profesiLabel(p),
    total: list.length,
    dinilai: list.filter((x) => x.dinilai).length,
    medianSkor: median(list.flatMap((x) => (x.skor == null ? [] : [x.skor]))),
    klinis: sum(list, "klinis"),
    batal: sum(list, "batal"),
    tarif: sum(list, "tarif"),
    ttv: sum(list, "ttv"),
    ttvTerlambat: sum(list, "ttvTerlambat"),
  }));

  return { range, items, profesi };
}

/* ------------------------------------------------------------ profil petugas */

function kunjunganPetugas(
  nomor: string,
  rows: PetugasRecordRow[],
  k: KunjunganRow | undefined,
  ruangan: Awaited<ReturnType<typeof getRuanganResolver>>,
): KunjunganPetugas {
  const perKategori = nolKategori();
  let tarif = 0;
  let batal = 0;
  for (const r of rows) {
    if (r.tarif) {
      if (r.status !== 0) tarif++;
    } else if (r.status === 0) batal++;
    else perKategori[r.kategori]++;
  }
  const jm = k?.jenis != null ? JENIS_KUNJUNGAN[k.jenis] : undefined;
  return {
    nomor,
    norm: k?.norm ?? null,
    pasien: k?.nama ?? null,
    ruangan: k ? (ruangan.map.get(k.ruanganId)?.nama ?? k.ruanganId) : "—",
    jenis: { id: k?.jenis ?? null, label: jm?.label ?? "Lainnya", short: jm?.short ?? "—" },
    masuk: k?.masuk ?? null,
    keluar: k?.keluar ?? null,
    status: k ? (k.statusDaftar === 0 ? "BATAL" : statusKunjungan(k.status)) : null,
    perKategori,
    klinis: KATEGORI_KEYS.reduce((s, x) => s + perKategori[x], 0),
    tarif,
    batal,
    pertama: rows[0].waktu,
    terakhir: rows[rows.length - 1].waktu,
  };
}

const toTemuanTtv = (r: PetugasRecordRow): TemuanTtv => ({
  id: r.id,
  kunjungan: r.kunjungan,
  waktu: r.waktu,
  waktuInput: r.waktuInput,
  menit: r.lagMenit,
  ringkasan: ringkasan(r),
  peringatan: peringatanTtv(r),
});

/**
 * Profil kepatuhan satu petugas: kalender aktivitas per hari dinas, pola
 * shift, pasien yang ditangani & temuan (TTV terlambat/tak wajar, input batal
 * beserta pelaku pembatalan). Biaya SIMGOS: 1 union + 1 kunjungan + 1 log (bila ada batal).
 */
export async function getProfilPetugas(id: string, q: PetugasQuery): Promise<ProfilPetugas> {
  const { range, f } = toPetugasFilter(q);
  const [tindakan, users, ruangan] = await Promise.all([getTindakanResolver(), getUserResolver(), getRuanganResolver()]);
  if (!users.map.has(id)) throw new NotFoundError("Petugas tidak ditemukan.");

  const all = await queryPetugasRecords(f, id, tindakan.tarifIds);
  const terpotong = all.length > PETUGAS_RECORD_CAP;
  const rows = all.slice(0, PETUGAS_RECORD_CAP);

  const batalKlinis = rows.filter((r) => r.status === 0 && !r.tarif);
  const jendela = { sejak: `${addDaysIso(range.from, -7)} 00:00:00`, sampai: `${addDaysIso(todayWitaIso(), 1)} 00:00:00` };
  const perKunjungan = new Map<string, PetugasRecordRow[]>();
  for (const r of rows) {
    if (!r.kunjungan) continue;
    const list = perKunjungan.get(r.kunjungan);
    if (list) list.push(r);
    else perKunjungan.set(r.kunjungan, [r]);
  }
  const [kunjunganRows, pembatalan] = await Promise.all([
    queryKunjunganByNomors([...perKunjungan.keys()]),
    lacakPembatalan(batalKlinis, jendela),
  ]);

  // Kalender hari dinas, pola shift & sebaran kategori (input aktif klinis).
  const harianMap = new Map<string, HarianPetugas>();
  for (let d = range.from; d <= range.to; d = addDaysIso(d, 1)) {
    harianMap.set(d, { tanggal: d, klinis: 0, perKategori: nolKategori(), tarif: 0, batal: 0 });
  }
  const perShift = Object.fromEntries(SHIFTS.map((s) => [s.key, 0])) as Record<ShiftKey, number>;
  const perKategori = nolKategori();
  let tarif = 0;
  for (const r of rows) {
    const h = harianMap.get(r.hariDinas);
    if (r.tarif) {
      if (r.status !== 0) {
        tarif++;
        if (h) h.tarif++;
      }
      continue;
    }
    if (r.status === 0) {
      if (h) h.batal++;
      continue;
    }
    perKategori[r.kategori]++;
    perShift[shiftOfHour(r.jam)]++;
    if (h) {
      h.klinis++;
      h.perKategori[r.kategori]++;
    }
  }

  const kByNomor = new Map(kunjunganRows.map((k) => [k.nomor, k]));
  const kunjungan = [...perKunjungan.entries()]
    .map(([nomor, list]) => kunjunganPetugas(nomor, list, kByNomor.get(nomor), ruangan))
    .sort((a, b) => (a.terakhir < b.terakhir ? 1 : a.terakhir > b.terakhir ? -1 : 0));

  const ttvAktif = rows.filter((r) => r.kategori === "TTV" && r.status !== 0);
  const temuan = {
    ttvTerlambat: ttvAktif
      .filter((r) => r.lagMenit != null && r.lagMenit > TTV_TERLAMBAT_MENIT)
      .map(toTemuanTtv)
      .sort((a, b) => (b.menit ?? 0) - (a.menit ?? 0)),
    ttvTakWajar: ttvAktif.map(toTemuanTtv).filter((t) => t.peringatan),
    batal: batalKlinis.map(
      (r): TemuanBatal => ({
        sumber: r.sumber,
        kategori: r.kategori,
        id: r.id,
        kunjungan: r.kunjungan,
        waktu: r.waktu,
        ringkasan: ringkasan(r),
        batalOleh: pembatalan.get(`${SUMBER[r.sumber].objek}:${r.id}`) ?? null,
      }),
    ),
  };

  return {
    petugas: toPetugas(id, users),
    range,
    harian: [...harianMap.values()],
    perShift,
    perKategori,
    tarif,
    batal: batalKlinis.length,
    kunjungan,
    temuan,
    petugasRef: petugasMap(temuan.batal.map((b) => b.batalOleh?.oleh ?? null), users),
    terpotong,
  };
}
