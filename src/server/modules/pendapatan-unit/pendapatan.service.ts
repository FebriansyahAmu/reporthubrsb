import "server-only";
import { ValidationError } from "@/server/lib/errors";
import { createLimiter } from "@/server/lib/limiter";
import { createTtlCache } from "@/server/lib/ttl-cache";
import {
  BATAS,
  infoCakupan,
  klasifikasiUnit,
  KOMPONEN,
  LAYANAN,
  STATUS_TAGIHAN,
  statusDariKode,
  type KlasifikasiUnit,
  type LayananKey,
  type StatusTagihanKey,
} from "./pendapatan.constants";
import {
  queryCaraBayar,
  queryJumlahPenjualanBebas,
  queryPendapatanGrain,
  queryRuanganLeaf,
  type PendapatanGrain,
  type RuanganRow,
} from "./pendapatan.dal";
import { tambahHari, type PendapatanQuery } from "./pendapatan.schema";
import type {
  NilaiPendapatan,
  OpsiCaraBayar,
  PendapatanUnitResult,
  RingkasLayanan,
  RingkasStatus,
  UnitPendapatan,
} from "./pendapatan.types";

/**
 * Laporan Pendapatan per Unit (port SP LaporanPendapatanPerUnit, semua status
 * tagihan, pilihan layanan). SATU komputasi SIMGOS per rentang menghitung semua
 * unit; hasilnya di-cache 60 dtk (single-flight) → ganti layanan, filter status/
 * cara bayar/unit & ekspor tidak memicu query ulang, dan semua layanan berasal
 * dari potret data yang sama (jumlahnya = Semua Layanan).
 */

type Unit = RuanganRow & KlasifikasiUnit;

type Komputasi = {
  /** Semua unit leaf, terklasifikasi ke layanan, urut kode ruangan. */
  units: Unit[];
  caraBayar: OpsiCaraBayar[];
  grain: PendapatanGrain[];
  /** Transaksi penjualan bebas apotek di periode (tak tercakup port). */
  penjualanBebas: number;
  durasiMs: number;
};

type Master = { ruangan: RuanganRow[]; caraBayar: OpsiCaraBayar[] };

// Nama ber-versi: bentuk nilai cache berubah (v1 = khusus RJ) → hindari entri lama saat HMR dev.
const cacheRentang = createTtlCache<Komputasi>("pendapatan-unit-v2", { ttlMs: BATAS.CACHE_TTL_MS, max: BATAS.CACHE_MAKS });
// Master ruangan & cara bayar jarang berubah; tiap query kecil ≈ 0,1–0,2 dtk round-trip → di-cache terpisah.
const cacheMaster = createTtlCache<Master>("pendapatan-unit-master", { ttlMs: BATAS.MASTER_TTL_MS, max: 1 });
const batasKomputasi = createLimiter("pendapatan-unit", BATAS.KOMPUTASI_PARALEL);

async function muatMaster(): Promise<Master> {
  const ruangan = await queryRuanganLeaf();
  const caraBayar = await queryCaraBayar();
  return { ruangan, caraBayar };
}

/** Query SIMGOS BERURUTAN (satu koneksi): [master] → pendapatan → pengaman penjualan. */
async function hitungRentang(from: string, to: string): Promise<Komputasi> {
  const t0 = Date.now();
  const toExclusive = tambahHari(to, 1);
  let master = (await cacheMaster.get("master", muatMaster)).value;
  const grain = await queryPendapatanGrain(from, toExclusive);
  const penjualanBebas = await queryJumlahPenjualanBebas(from, toExclusive);

  // Ada unit berpendapatan yang belum dikenal master ter-cache → segarkan master sekali.
  const belumDikenal = (m: Master) => {
    const ids = new Set(m.ruangan.map((r) => r.id));
    return [...new Set(grain.map((g) => g.ruangan))].filter((id) => !ids.has(id));
  };
  if (belumDikenal(master).length > 0) master = (await cacheMaster.get("master", muatMaster, { fresh: true })).value;
  // Masih tak dikenal (unit lahir di antara dua query — amat jarang): tetap dihitung, tak ada rupiah hilang.
  const baru = belumDikenal(master).map((id): RuanganRow => ({ id, nama: id, aktif: false, jenisKunjungan: 0 }));
  const units = [...master.ruangan, ...baru].map((r) => ({ ...r, ...klasifikasiUnit(r.nama, r.jenisKunjungan) }));
  return { units, caraBayar: master.caraBayar, grain, penjualanBebas, durasiMs: Date.now() - t0 };
}

/* ---------------------------------------------------------------- agregasi */

const bulat = (n: number) => Math.round(n * 100) / 100;

const URUT_LAYANAN = new Map<LayananKey, number>(LAYANAN.map((l, i) => [l.key, i]));

/** Urut layanan (urutan katalog) lalu kode ruangan. */
const urutUnit = (a: Unit, b: Unit) =>
  URUT_LAYANAN.get(a.layanan)! - URUT_LAYANAN.get(b.layanan)! || a.id.localeCompare(b.id);

function nilaiKosong(): NilaiPendapatan {
  return Object.fromEntries([...KOMPONEN.map((k) => [k.key, 0]), ["total", 0]]) as NilaiPendapatan;
}

function tambahkan(akum: NilaiPendapatan, g: PendapatanGrain): void {
  for (const k of KOMPONEN) akum[k.key] += g.nilai[k.key];
  akum.total += g.nilai.total;
}

function bulatkan(n: NilaiPendapatan): NilaiPendapatan {
  return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, bulat(v)])) as NilaiPendapatan;
}

function ringkasPerStatus(baris: readonly PendapatanGrain[], dipilih: ReadonlySet<StatusTagihanKey>) {
  const out = Object.fromEntries(
    STATUS_TAGIHAN.map((s) => [s.key, { tagihan: 0, total: 0, dipilih: dipilih.has(s.key) }]),
  ) as Record<StatusTagihanKey, RingkasStatus>;
  const tagihan = new Map<StatusTagihanKey, Set<string>>();
  for (const g of baris) {
    const s = statusDariKode(g.status);
    if (!s) continue; // kode status di luar katalog (belum pernah ada) → diabaikan
    out[s].total += g.nilai.total;
    if (!tagihan.has(s)) tagihan.set(s, new Set());
    tagihan.get(s)!.add(g.tagihan);
  }
  for (const s of STATUS_TAGIHAN) {
    out[s.key].total = bulat(out[s.key].total);
    out[s.key].tagihan = tagihan.get(s.key)?.size ?? 0;
  }
  return out;
}

/** Total & tagihan berbeda per layanan (satu tagihan bisa lintas layanan, mis. IGD → RI). */
function ringkasPerLayanan(baris: readonly PendapatanGrain[], unitById: ReadonlyMap<string, Unit>): RingkasLayanan[] {
  const akum = new Map<LayananKey, { total: number; tagihan: Set<string> }>();
  for (const g of baris) {
    const l = unitById.get(g.ruangan)!.layanan;
    let a = akum.get(l);
    if (!a) {
      a = { total: 0, tagihan: new Set() };
      akum.set(l, a);
    }
    a.total += g.nilai.total;
    a.tagihan.add(g.tagihan);
  }
  return LAYANAN.map((l) => ({
    key: l.key,
    label: l.label,
    tagihan: akum.get(l.key)?.tagihan.size ?? 0,
    total: bulat(akum.get(l.key)?.total ?? 0),
  }));
}

/* ------------------------------------------------------------------ publik */

export async function getPendapatanUnit(input: PendapatanQuery): Promise<PendapatanUnitResult> {
  const { value: k, at, hit } = await cacheRentang.get(`${input.from}|${input.to}`, () =>
    batasKomputasi(() => hitungRentang(input.from, input.to)),
  );

  const info = infoCakupan(input.layanan);
  const semua = input.layanan === "semua";
  const dalCakupan = (u: Unit) => semua || u.layanan === input.layanan;
  const unitById = new Map(k.units.map((u) => [u.id, u]));
  const adaPendapatan = new Set(k.grain.map((g) => g.ruangan));
  // Unit non-pelayanan (gudang, depo lama) hanya muncul bila ternyata berpendapatan.
  const relevan = (u: Unit) => u.pelayanan || adaPendapatan.has(u.id);
  const termasuk = k.units.filter((u) => dalCakupan(u) && relevan(u)).sort(urutUnit);

  const caraBayar = input.caraBayar ? (k.caraBayar.find((c) => c.id === input.caraBayar) ?? null) : null;
  if (input.caraBayar && !caraBayar) throw new ValidationError({ fieldErrors: { caraBayar: ["Cara bayar tidak dikenal"] } });
  const unitDipilih = input.ruangan ? (termasuk.find((u) => u.id === input.ruangan) ?? null) : null;
  if (input.ruangan && !unitDipilih) {
    throw new ValidationError({ fieldErrors: { ruangan: [`Unit di luar cakupan layanan ${info.label}`] } });
  }

  const statusDipilih = new Set(input.status);
  const statusOk = (g: PendapatanGrain) => {
    const s = statusDariKode(g.status);
    return s !== null && statusDipilih.has(s);
  };
  const bayarOk = (g: PendapatanGrain) => !caraBayar || g.caraBayar === caraBayar.id;

  // Filter cakupan, cara bayar & unit berlaku untuk semua angka; filter status hanya untuk tabel & total.
  const basis = k.grain.filter(
    (g) => dalCakupan(unitById.get(g.ruangan)!) && bayarOk(g) && (!unitDipilih || g.ruangan === unitDipilih.id),
  );
  const baris = basis.filter(statusOk);

  // Agregasi per unit.
  const perUnit = new Map<string, { nilai: NilaiPendapatan; tagihan: Set<string>; perStatus: Map<StatusTagihanKey, number> }>();
  const total = nilaiKosong();
  const semuaTagihan = new Set<string>();
  for (const g of baris) {
    let u = perUnit.get(g.ruangan);
    if (!u) {
      u = { nilai: nilaiKosong(), tagihan: new Set(), perStatus: new Map() };
      perUnit.set(g.ruangan, u);
    }
    tambahkan(u.nilai, g);
    tambahkan(total, g);
    u.tagihan.add(g.tagihan);
    semuaTagihan.add(g.tagihan);
    const s = statusDariKode(g.status)!;
    u.perStatus.set(s, (u.perStatus.get(s) ?? 0) + g.nilai.total);
  }

  const totalBulat = bulatkan(total);
  const units: UnitPendapatan[] = termasuk
    .filter((r) => (unitDipilih ? r.id === unitDipilih.id : (r.aktif && r.pelayanan) || perUnit.has(r.id)))
    .map((r) => {
      const u = perUnit.get(r.id);
      const nilai = u ? bulatkan(u.nilai) : nilaiKosong();
      return {
        id: r.id,
        nama: r.nama,
        layanan: r.layanan,
        aktif: r.aktif,
        tagihan: u?.tagihan.size ?? 0,
        nilai,
        perStatus: Object.fromEntries(input.status.map((s) => [s, bulat(u?.perStatus.get(s) ?? 0)])),
        porsi: totalBulat.total > 0 ? nilai.total / totalBulat.total : 0,
      };
    });

  const dialihkan = semua
    ? []
    : k.units
        .filter((u) => u.asal === input.layanan && u.layanan !== input.layanan && relevan(u))
        .map((u) => ({ id: u.id, nama: u.nama, ke: u.layanan, alasan: u.alasan ?? infoCakupan(u.layanan).label }));

  const peringatan =
    k.penjualanBebas > 0 && (semua || input.layanan === "farmasi")
      ? [
          `Ada ${k.penjualanBebas.toLocaleString("id-ID")} transaksi penjualan bebas apotek pada periode ini yang belum termasuk laporan (cabang Penjualan SP belum di-port karena datanya kosong saat laporan dibuat).`,
        ]
      : [];

  return {
    periode: { from: input.from, to: input.to },
    layanan: { key: input.layanan, label: info.label },
    filter: {
      status: STATUS_TAGIHAN.map((s) => s.key).filter((s) => statusDipilih.has(s)),
      caraBayar,
      ruangan: unitDipilih ? { id: unitDipilih.id, nama: unitDipilih.nama } : null,
    },
    units,
    total: { ...totalBulat, tagihan: semuaTagihan.size },
    perStatus: ringkasPerStatus(basis, statusDipilih),
    // Dasar tab layanan: filter status & cara bayar berlaku, filter cakupan/unit tidak.
    perLayanan: ringkasPerLayanan(k.grain.filter((g) => bayarOk(g) && statusOk(g)), unitById),
    cakupan: { termasuk: termasuk.map((u) => ({ id: u.id, nama: u.nama, layanan: u.layanan })), dialihkan },
    peringatan,
    opsi: {
      caraBayar: k.caraBayar,
      unit: termasuk.filter((u) => (u.aktif && u.pelayanan) || adaPendapatan.has(u.id)).map((u) => ({ id: u.id, nama: u.nama })),
    },
    meta: { dihitungPada: new Date(at).toISOString(), durasiMs: k.durasiMs, dariCache: hit },
  };
}
