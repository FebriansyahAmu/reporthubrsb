import "server-only";
import { addDaysIso, nowWitaIso, todayWitaIso } from "./audit.constants";
import { getRuanganResolver, getTindakanResolver, getUserResolver } from "./audit.resolver";
import { hitungMatriksRi, type SelStatus } from "./kepatuhan";
import {
  JENIS_KUNJUNGAN,
  JENIS_RAWAT_INAP,
  PROFESI_BIDAN,
  PROFESI_PERAWAT,
  RENTANG_PETA_DEFAULT_HARI,
  type KategoriKey,
} from "./kunjungan.constants";
import { queryKunjunganSemua, queryRecordsKunjungan, type KunjunganRow } from "./kunjungan.dal";
import type { PetaQuery } from "./kunjungan.schema";
import {
  buildCard,
  hitunganKunjungan,
  indeksKategori,
  resolveRange,
  type RuanganResolver,
  type UserResolver,
} from "./kunjungan.service";

/**
 * Peta Ruangan (Fase 2 · K4): heatmap ruang × hari. Read-only.
 *
 * - Rawat Inap → **kepatuhan target harian** per hari dinas, dihitung dengan
 *   `hitungMatriksRi` yang SAMA dengan matriks drawer (K2): shift CPPT
 *   keperawatan + visite dokter + TTV ≥ 3; hanya shift/hari utuh yang dinilai.
 * - Jenis lain → **kelengkapan kunjungan** (kategori wajib terisi, sama dengan
 *   kartu K1) per tanggal masuk.
 *
 * Sel = OK ÷ dinilai (dijumlahkan lintas pasien). Biaya SIMGOS: 1 query
 * kunjungan + record/kategori per potongan 300–400 kunjungan.
 */

/* ------------------------------------------------------------------- tipe */

export type PetaItemRi = {
  tipe: "RI";
  nomor: string;
  hariKe: number;
  /** Status shift Pagi, Siang, Malam. */
  shift: SelStatus[];
  dokter: SelStatus;
  ttv: SelStatus;
  ttvN: number;
  cpptKeperawatan: number;
  /** Perawat/bidan berbeda yang menginput pasien ini pada hari dinas tsb. */
  perawat: number;
  petugas: number;
  batal: number;
};

export type PetaItemKel = {
  tipe: "KEL";
  nomor: string;
  persen: number | null;
  kurang: KategoriKey[];
  input: number;
  batal: number;
  petugas: number;
};

export type PetaItem = PetaItemRi | PetaItemKel;

export type PetaSel = {
  tanggal: string;
  persen: number | null;
  ok: number;
  dinilai: number;
  pasien: number;
  batal: number;
  petugas: number;
  items: PetaItem[];
};

export type PetaRingkas = {
  persen: number | null;
  ok: number;
  dinilai: number;
  kunjungan: number;
  /** RI: pasien-hari hadir · lainnya: kunjungan. */
  pasienHari: number;
  petugas: number;
  /** RI saja: rata-rata perawat/bidan berbeda per pasien per hari dinas. */
  perawatPerPasienHari: number | null;
  batal: number;
};

export type PetaBaris = { id: string; nama: string; grupNama: string | null; ringkas: PetaRingkas; sel: (PetaSel | null)[] };

export type PetaPasien = { nama: string | null; norm: string; masuk: string; keluar: string | null };

export type PetaRuangan = {
  range: { from: string; to: string; hari: number };
  jenis: { id: number; label: string; short: string };
  metrik: "HARIAN_RI" | "KELENGKAPAN";
  hari: string[];
  baris: PetaBaris[];
  total: PetaRingkas;
  pasien: Record<string, PetaPasien>;
};

/* ------------------------------------------------------------- akumulator */

type Acc = {
  ok: number;
  dinilai: number;
  pasienHari: number;
  batal: number;
  petugas: Set<string>;
  perawat: number;
  kunjungan: Set<string>;
};
const accBaru = (): Acc => ({ ok: 0, dinilai: 0, pasienHari: 0, batal: 0, petugas: new Set(), perawat: 0, kunjungan: new Set() });
const persenOf = (ok: number, dinilai: number) => (dinilai ? Math.round((ok / dinilai) * 100) : null);

function tambah(a: Acc, nomor: string, x: { ok: number; dinilai: number; batal: number; petugas: Iterable<string>; perawat: number }) {
  a.ok += x.ok;
  a.dinilai += x.dinilai;
  a.pasienHari++;
  a.batal += x.batal;
  a.perawat += x.perawat;
  a.kunjungan.add(nomor);
  for (const p of x.petugas) a.petugas.add(p);
}

function ringkas(a: Acc, ri: boolean): PetaRingkas {
  return {
    persen: persenOf(a.ok, a.dinilai),
    ok: a.ok,
    dinilai: a.dinilai,
    kunjungan: a.kunjungan.size,
    pasienHari: a.pasienHari,
    petugas: a.petugas.size,
    perawatPerPasienHari: ri && a.pasienHari ? Math.round((a.perawat / a.pasienHari) * 10) / 10 : null,
    batal: a.batal,
  };
}

/** Tabel ruang × hari yang diisi per (ruang, tanggal). */
class Grid {
  private sel = new Map<string, { acc: Acc; items: PetaItem[] }>();
  private baris = new Map<string, Acc>();
  private total = accBaru();

  constructor(private readonly hari: string[], private readonly ri: boolean) {}

  add(ruang: string, tanggal: string, item: PetaItem, x: Parameters<typeof tambah>[2]) {
    const key = `${ruang}|${tanggal}`;
    const c = this.sel.get(key) ?? { acc: accBaru(), items: [] };
    tambah(c.acc, item.nomor, x);
    c.items.push(item);
    this.sel.set(key, c);
    const b = this.baris.get(ruang) ?? accBaru();
    tambah(b, item.nomor, x);
    this.baris.set(ruang, b);
    tambah(this.total, item.nomor, x);
  }

  hasil(ruangan: RuanganResolver): { baris: PetaBaris[]; total: PetaRingkas } {
    const baris = [...this.baris.entries()].map(([id, acc]): PetaBaris => {
      const r = ruangan.map.get(id);
      return {
        id,
        nama: r?.nama ?? id,
        grupNama: r?.grupNama ?? null,
        ringkas: ringkas(acc, this.ri),
        sel: this.hari.map((t) => {
          const c = this.sel.get(`${id}|${t}`);
          if (!c) return null;
          return {
            tanggal: t,
            persen: persenOf(c.acc.ok, c.acc.dinilai),
            ok: c.acc.ok,
            dinilai: c.acc.dinilai,
            pasien: c.acc.pasienHari,
            batal: c.acc.batal,
            petugas: c.acc.petugas.size,
            items: c.items,
          };
        }),
      };
    });
    baris.sort((a, b) => (a.grupNama ?? a.nama).localeCompare(b.grupNama ?? b.nama, "id") || a.nama.localeCompare(b.nama, "id"));
    return { baris, total: ringkas(this.total, this.ri) };
  }
}

const dinilai = (s: SelStatus) => s === "OK" || s === "KURANG";

/* ------------------------------------------------------------ rawat inap */

function isiRawatInap(grid: Grid, kunjungan: KunjunganRow[], records: Awaited<ReturnType<typeof queryRecordsKunjungan>>, users: UserResolver, range: { from: string; to: string }) {
  const perK = new Map<string, typeof records>();
  for (const r of records) {
    const list = perK.get(r.kunjungan);
    if (list) list.push(r);
    else perK.set(r.kunjungan, [r]);
  }
  const now = nowWitaIso();
  const keperawatan = (id: string) => {
    const p = users.map.get(id)?.profesi;
    return p === PROFESI_PERAWAT || p === PROFESI_BIDAN;
  };

  for (const k of kunjungan) {
    const m = hitungMatriksRi({
      records: (perK.get(k.nomor) ?? []).map((r) => ({ kategori: r.kategori, waktu: r.waktu, oleh: r.oleh, batal: r.status === 0, peran: r.peran })),
      masuk: k.masuk,
      keluar: k.keluar,
      now,
    });
    for (const h of m.hari) {
      if (h.tanggal < range.from || h.tanggal > range.to) continue;
      // Hadir = setidaknya satu shift dalam masa rawat (bukan LUAR/NANTI).
      if (!h.shifts.some((s) => s.status === "OK" || s.status === "KURANG" || s.status === "PARSIAL")) continue;
      const harian = dinilai(h.dokterStatus);
      const ok = h.shifts.filter((s) => s.status === "OK").length + (h.dokterStatus === "OK" ? 1 : 0) + (h.ttvStatus === "OK" ? 1 : 0);
      const n = h.shifts.filter((s) => dinilai(s.status)).length + (harian ? 2 : 0);
      const perawat = h.petugas.filter(keperawatan).length;
      grid.add(
        k.ruanganId,
        h.tanggal,
        {
          tipe: "RI",
          nomor: k.nomor,
          hariKe: h.hariKe,
          shift: h.shifts.map((s) => s.status),
          dokter: h.dokterStatus,
          ttv: h.ttvStatus,
          ttvN: h.ttv,
          cpptKeperawatan: h.cpptKeperawatan,
          perawat,
          petugas: h.petugas.length,
          batal: h.batal,
        },
        { ok, dinilai: n, batal: h.batal, petugas: h.petugas, perawat },
      );
    }
  }
}

/* ---------------------------------------------------- kelengkapan (non-RI) */

async function isiKelengkapan(
  grid: Grid,
  kunjungan: KunjunganRow[],
  tarifIds: readonly number[],
  users: UserResolver,
  ruangan: RuanganResolver,
) {
  const idx = await indeksKategori(kunjungan, tarifIds);
  const today = todayWitaIso();
  for (const k of kunjungan) {
    const rel = hitunganKunjungan(idx, k);
    const card = buildCard(k, rel, users, ruangan, today);
    const petugas = new Set(rel.filter((c) => c.oleh && c.aktif > 0).map((c) => c.oleh!));
    const terpenuhi = new Set(card.kelengkapan.terpenuhi);
    grid.add(
      k.ruanganId,
      k.masuk.slice(0, 10),
      {
        tipe: "KEL",
        nomor: k.nomor,
        persen: card.kelengkapan.persen,
        kurang: card.kelengkapan.wajib.filter((w) => !terpenuhi.has(w)),
        input: card.totalInput,
        batal: card.totalBatal,
        petugas: petugas.size,
      },
      { ok: terpenuhi.size, dinilai: card.kelengkapan.wajib.length, batal: card.totalBatal, petugas, perawat: 0 },
    );
  }
}

/* ------------------------------------------------------------------ utama */

export async function getPetaRuangan(q: PetaQuery): Promise<PetaRuangan> {
  const { from, to } = resolveRange(q, RENTANG_PETA_DEFAULT_HARI);
  const hari: string[] = [];
  for (let d = from; d <= to; d = addDaysIso(d, 1)) hari.push(d);
  const ri = q.jenis === JENIS_RAWAT_INAP;

  const [kunjungan, tindakan, users, ruangan] = await Promise.all([
    queryKunjunganSemua({ from, to, jenis: q.jenis }),
    getTindakanResolver(),
    getUserResolver(),
    getRuanganResolver(),
  ]);

  const grid = new Grid(hari, ri);
  if (ri) {
    const records = await queryRecordsKunjungan(kunjungan.map((k) => k.nomor), tindakan.tarifIds);
    isiRawatInap(grid, kunjungan, records, users, { from, to });
  } else {
    await isiKelengkapan(grid, kunjungan, tindakan.tarifIds, users, ruangan);
  }

  const { baris, total } = grid.hasil(ruangan);
  const dipakai = new Set(baris.flatMap((b) => b.sel.flatMap((s) => s?.items.map((i) => i.nomor) ?? [])));
  const pasien: Record<string, PetaPasien> = {};
  for (const k of kunjungan) {
    if (dipakai.has(k.nomor)) pasien[k.nomor] = { nama: k.nama, norm: k.norm, masuk: k.masuk, keluar: k.keluar };
  }
  const jm = JENIS_KUNJUNGAN[q.jenis];
  return {
    range: { from, to, hari: hari.length },
    jenis: { id: q.jenis, label: jm?.label ?? `Jenis #${q.jenis}`, short: jm?.short ?? "—" },
    metrik: ri ? "HARIAN_RI" : "KELENGKAPAN",
    hari,
    baris,
    total,
    pasien,
  };
}
