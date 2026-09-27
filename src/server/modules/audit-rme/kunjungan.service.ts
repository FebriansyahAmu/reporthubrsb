import "server-only";
import { ValidationError } from "@/server/lib/errors";
import { addDaysIso, todayWitaIso } from "./audit.constants";
import { getRuanganResolver, getUserResolver } from "./audit.resolver";
import {
  JENIS_KUNJUNGAN,
  JENIS_KUNJUNGAN_ORDER,
  KATEGORI_KEYS,
  kategoriWajib,
  KELOMPOK_JENIS,
  profesiLabel,
  PROFESI_ORDER,
  RENTANG_MAKS_HARI,
  statusKunjungan,
  type KategoriKey,
  type StatusKunjungan,
} from "./kunjungan.constants";
import {
  queryKategoriCounts,
  queryKunjunganPage,
  queryKunjunganPerRuangan,
  queryKunjunganSummary,
  type KategoriCountRow,
  type KunjunganFilter,
} from "./kunjungan.dal";
import type { KunjunganQuery, RuanganTreeQuery } from "./kunjungan.schema";

/* ------------------------------------------------------------------- tipe */

export type KategoriStat = { aktif: number; batal: number; petugas: number };
export type PetugasProfesi = { profesi: number | null; label: string; n: number };

export type KunjunganCard = {
  nomor: string;
  nopen: string;
  norm: string;
  pasien: { nama: string | null; jenisKelamin: "L" | "P" | null; umur: number | null };
  ruangan: { id: string; nama: string; grupId: string | null; grupNama: string | null };
  jenis: { id: number | null; label: string; short: string };
  masuk: string;
  keluar: string | null;
  status: StatusKunjungan;
  /** Hari rawat ke-N (hari kalender, inklusif) — relevan untuk Rawat Inap. */
  hariRawat: number;
  kategori: Record<KategoriKey, KategoriStat>;
  totalInput: number;
  totalBatal: number;
  /** Penginput unik lintas kategori, dikelompokkan per profesi. */
  petugas: { total: number; profesi: PetugasProfesi[] };
  /** Kategori wajib (per jenis kunjungan) yang sudah terisi ≥ 1 input aktif. */
  kelengkapan: { wajib: KategoriKey[]; terpenuhi: KategoriKey[]; persen: number | null };
};

export type KunjunganPage = {
  range: { from: string; to: string };
  page: number;
  pageSize: number;
  totalPages: number;
  summary: { total: number; aktif: number; batal: number };
  items: KunjunganCard[];
};

export type RuanganNode = { id: string; nama: string; total: number; aktif: number };
export type RuanganGrupNode = RuanganNode & { ruang: RuanganNode[] };
export type JenisNode = {
  jenis: number | null;
  label: string;
  short: string;
  total: number;
  aktif: number;
  grup: RuanganGrupNode[];
};
export type RuanganTree = { range: { from: string; to: string }; total: number; aktif: number; jenis: JenisNode[] };

/* ----------------------------------------------------------------- helper */

/** Rentang default 7 hari terakhir (WITA); validasi urutan & panjang. */
function resolveRange(q: { from?: string; to?: string }): { from: string; to: string } {
  const to = q.to ?? todayWitaIso();
  const from = q.from ?? addDaysIso(to, -6);
  if (from > to) throw new ValidationError({ from: "Tanggal awal melewati tanggal akhir" });
  if (from < addDaysIso(to, -(RENTANG_MAKS_HARI - 1))) {
    throw new ValidationError({ from: `Rentang maksimal ${RENTANG_MAKS_HARI} hari` });
  }
  return { from, to };
}

function toFilter(q: RuanganTreeQuery & Partial<Pick<KunjunganQuery, "jenis" | "kelompok" | "ruangan">>): KunjunganFilter {
  const { from, to } = resolveRange(q);
  return {
    from,
    to,
    jenis: q.jenis,
    jenisIn: q.kelompok ? KELOMPOK_JENIS[q.kelompok] : undefined,
    ruangan: q.ruangan,
    aktif: q.aktif,
    batal: q.batal,
    q: q.q,
  };
}

/** Selisih hari kalender `YYYY-MM-DD` (b − a). */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

const emptyKategori = (): Record<KategoriKey, KategoriStat> =>
  Object.fromEntries(KATEGORI_KEYS.map((k) => [k, { aktif: 0, batal: 0, petugas: 0 }])) as Record<
    KategoriKey,
    KategoriStat
  >;

const profesiRank = (p: number | null) => {
  const i = p == null ? -1 : (PROFESI_ORDER as readonly number[]).indexOf(p);
  return i < 0 ? 99 : i;
};

/* ------------------------------------------------------------ papan kunjungan */

/**
 * Satu halaman papan kunjungan + ringkasan per kategori. Biaya SIMGOS tetap:
 * ringkasan + halaman (paralel), lalu 1 query kategori `IN (<halaman>)`.
 */
export async function listKunjungan(q: KunjunganQuery): Promise<KunjunganPage> {
  const f = toFilter(q);
  const [summary, rows] = await Promise.all([
    queryKunjunganSummary(f),
    queryKunjunganPage(f, (q.page - 1) * q.pageSize, q.pageSize),
  ]);

  const nomors = rows.map((r) => r.nomor);
  const nopens = [...new Set(rows.map((r) => r.nopen))];
  const [counts, users, ruangan] = await Promise.all([
    queryKategoriCounts(nomors, nopens),
    getUserResolver(),
    getRuanganResolver(),
  ]);

  // Indeks hitungan: per kunjungan (KUNJUNGAN) & per episode (NOPEN, Diagnosis).
  const byRef = new Map<string, KategoriCountRow[]>();
  for (const c of counts) {
    const key = `${c.kategori === "DIAGNOSIS" ? "E" : "K"}:${c.ref}`;
    const list = byRef.get(key);
    if (list) list.push(c);
    else byRef.set(key, [c]);
  }

  const today = todayWitaIso();
  const items = rows.map<KunjunganCard>((r) => {
    const kategori = emptyKategori();
    const petugasKat = new Map<KategoriKey, Set<string>>();
    const semuaPetugas = new Set<string>();
    const rel = [...(byRef.get(`K:${r.nomor}`) ?? []), ...(byRef.get(`E:${r.nopen}`) ?? [])];
    for (const c of rel) {
      const s = kategori[c.kategori];
      s.aktif += c.aktif;
      s.batal += c.batal;
      if (c.oleh) {
        semuaPetugas.add(c.oleh);
        const set = petugasKat.get(c.kategori) ?? new Set<string>();
        set.add(c.oleh);
        petugasKat.set(c.kategori, set);
      }
    }
    for (const [k, set] of petugasKat) kategori[k].petugas = set.size;

    const perProfesi = new Map<number | null, number>();
    for (const id of semuaPetugas) {
      const p = users.map.get(id)?.profesi ?? null;
      perProfesi.set(p, (perProfesi.get(p) ?? 0) + 1);
    }
    const profesi = [...perProfesi.entries()]
      .map(([p, n]) => ({ profesi: p, label: profesiLabel(p), n }))
      .sort((a, b) => profesiRank(a.profesi) - profesiRank(b.profesi));

    const wajib = [...kategoriWajib(r.jenis)];
    const terpenuhi = wajib.filter((k) => kategori[k].aktif > 0);
    const rg = ruangan.map.get(r.ruanganId);
    const jm = r.jenis != null ? JENIS_KUNJUNGAN[r.jenis] : undefined;
    const status: StatusKunjungan = r.statusDaftar === 0 ? "BATAL" : statusKunjungan(r.status);
    const akhir = (r.keluar ?? `${today}T00:00:00`).slice(0, 10);

    return {
      nomor: r.nomor,
      nopen: r.nopen,
      norm: r.norm,
      pasien: {
        nama: r.nama,
        jenisKelamin: r.jenisKelamin === 1 ? "L" : r.jenisKelamin === 2 ? "P" : null,
        umur: r.umur,
      },
      ruangan: { id: r.ruanganId, nama: rg?.nama ?? r.ruanganId, grupId: rg?.grupId ?? null, grupNama: rg?.grupNama ?? null },
      jenis: { id: r.jenis, label: jm?.label ?? "Lainnya", short: jm?.short ?? "—" },
      masuk: r.masuk,
      keluar: r.keluar,
      status,
      hariRawat: Math.max(1, dayDiff(r.masuk.slice(0, 10), akhir) + 1),
      kategori,
      totalInput: KATEGORI_KEYS.reduce((s, k) => s + kategori[k].aktif, 0),
      totalBatal: KATEGORI_KEYS.reduce((s, k) => s + kategori[k].batal, 0),
      petugas: { total: semuaPetugas.size, profesi },
      kelengkapan: {
        wajib,
        terpenuhi,
        persen: wajib.length ? Math.round((terpenuhi.length / wajib.length) * 100) : null,
      },
    };
  });

  return {
    range: { from: f.from, to: f.to },
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(summary.total / q.pageSize)),
    summary,
    items,
  };
}

/* ---------------------------------------------------------------- pohon ruangan */

/** Pohon jenis kunjungan → bangsal (7 digit) → ruang (9 digit) beserta jumlah kunjungan. */
export async function getRuanganTree(q: RuanganTreeQuery): Promise<RuanganTree> {
  const f = toFilter(q);
  const [counts, ruangan] = await Promise.all([queryKunjunganPerRuangan(f), getRuanganResolver()]);

  const jenisMap = new Map<number | null, JenisNode>();
  const grupMap = new Map<string, RuanganGrupNode>();
  let total = 0;
  let aktif = 0;

  for (const c of counts) {
    const rg = ruangan.map.get(c.ruanganId);
    const jenis = rg?.jenis ?? null;
    const jm = jenis != null ? JENIS_KUNJUNGAN[jenis] : undefined;
    let jn = jenisMap.get(jenis);
    if (!jn) {
      jn = { jenis, label: jm?.label ?? "Lainnya", short: jm?.short ?? "—", total: 0, aktif: 0, grup: [] };
      jenisMap.set(jenis, jn);
    }
    const grupId = rg?.grupId ?? c.ruanganId.slice(0, 7);
    const gKey = `${jenis}:${grupId}`;
    let g = grupMap.get(gKey);
    if (!g) {
      g = { id: grupId, nama: rg?.grupNama ?? grupId, total: 0, aktif: 0, ruang: [] };
      grupMap.set(gKey, g);
      jn.grup.push(g);
    }
    g.ruang.push({ id: c.ruanganId, nama: rg?.nama ?? c.ruanganId, total: c.total, aktif: c.aktif });
    g.total += c.total;
    g.aktif += c.aktif;
    jn.total += c.total;
    jn.aktif += c.aktif;
    total += c.total;
    aktif += c.aktif;
  }

  const order = JENIS_KUNJUNGAN_ORDER as readonly number[];
  const rank = (j: number | null) => {
    const i = j == null ? -1 : order.indexOf(j);
    return i < 0 ? 999 : i;
  };
  const byNama = (a: { nama: string }, b: { nama: string }) => a.nama.localeCompare(b.nama, "id");
  const jenis = [...jenisMap.values()].sort((a, b) => rank(a.jenis) - rank(b.jenis));
  for (const j of jenis) {
    j.grup.sort(byNama);
    for (const g of j.grup) g.ruang.sort(byNama);
  }

  return { range: { from: f.from, to: f.to }, total, aktif, jenis };
}
