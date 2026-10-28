/**
 * Perhitungan murni RL 3.5: baris agregat per ruangan (SIMGOS) + pemetaan
 * ruangan → jenis kegiatan (DB aplikasi, atau bawaan dari nama ruangan) →
 * baris laporan, termasuk pemindahan baris karena diagnosis dan baris 66/77.
 * Tanpa I/O → diuji unit.
 */
import { adalahKegiatan, JK_RAWAT_JALAN, kategoriAkhir, saranJenisKegiatan, type AlasanReklas } from "./rl35.constants";
import type {
  BarisAgregat,
  BarisRl35,
  HariKunjungan,
  KategoriRl35,
  NilaiRl35,
  PetaTersimpan,
  PindahRl35,
  RataRataRl35,
  RuanganRl35,
  RuanganRow,
  StatusPeta,
} from "./rl35.types";

export const nilaiKosong = (): NilaiRl35 => ({ total: 0, lk: 0, pr: 0, dalamLk: 0, dalamPr: 0, luarLk: 0, luarPr: 0 });

function tambah(a: NilaiRl35, b: NilaiRl35): void {
  for (const k of Object.keys(a) as (keyof NilaiRl35)[]) a[k] += b[k];
}

export function jumlahkan(daftar: readonly NilaiRl35[]): NilaiRl35 {
  const out = nilaiKosong();
  for (const n of daftar) tambah(out, n);
  return out;
}

/** Satu baris agregat → kolom formulir (domisili tak tercatat = luar kab/kota). */
export function nilaiDari(b: Pick<BarisAgregat, "jk" | "dom" | "n">): NilaiRl35 {
  const dalam = b.dom === 1;
  const lk = b.jk === 1 ? b.n : 0;
  const pr = b.jk === 2 ? b.n : 0;
  return {
    total: b.n,
    lk,
    pr,
    dalamLk: dalam ? lk : 0,
    dalamPr: dalam ? pr : 0,
    luarLk: dalam ? 0 : lk,
    luarPr: dalam ? 0 : pr,
  };
}

/**
 * Pemetaan efektif satu ruangan: tersimpan (admin) lebih dulu; tanpa baris →
 * saran dari nama/jenis ruangan ("bawaan"). ID tersimpan yang bukan jenis
 * kegiatan RL 3.5 (mis. refrl berubah) = belum, agar terlihat & diperbaiki.
 */
export function petaEfektif(
  r: Pick<RuanganRow, "nama" | "jenisKunjungan">,
  tersimpan: Pick<PetaTersimpan, "rlId"> | undefined,
  kegiatan: ReadonlyMap<number, KategoriRl35>,
): { status: StatusPeta; kategori: KategoriRl35 | null; saran: number | null } {
  const saran = saranJenisKegiatan(r.nama, r.jenisKunjungan, new Set(kegiatan.keys()));
  if (tersimpan) {
    if (tersimpan.rlId == null) return { status: "dikecualikan", kategori: null, saran };
    const k = kegiatan.get(tersimpan.rlId);
    return k ? { status: "terpetakan", kategori: k, saran } : { status: "belum", kategori: null, saran };
  }
  const k = saran != null ? kegiatan.get(saran) : undefined;
  return k ? { status: "bawaan", kategori: k, saran } : { status: "belum", kategori: null, saran };
}

/** Jumlah bulan kalender yang dicakup periode (1 Sep–15 Sep = 1; Jul–Sep = 3). */
export function bulanTercakup(from: string, to: string): number {
  const bulan = (ymd: string) => Number(ymd.slice(0, 4)) * 12 + Number(ymd.slice(5, 7));
  return Math.max(1, bulan(to) - bulan(from) + 1);
}

const satuDesimal = (x: number) => Math.round(x * 10) / 10;

export type MasukanSusun = {
  /** Semua baris `master.refrl` RL 3.5 (baris non-kegiatan disaring di sini). */
  kategori: readonly KategoriRl35[];
  /** Poliklinik & ruang IGD master SIMGOS. */
  ruangan: readonly RuanganRow[];
  agregat: readonly BarisAgregat[];
  hari: readonly HariKunjungan[];
  peta: ReadonlyMap<string, PetaTersimpan>;
  from: string;
  to: string;
};

/** Susun baris laporan per jenis kegiatan + rincian per ruangan + baris 66/77 + peringatan. */
export function susunRl35(m: MasukanSusun): {
  baris: BarisRl35[];
  total: NilaiRl35;
  rataRata: RataRataRl35;
  ruangan: RuanganRl35[];
  belumDipetakan: { id: string; nama: string; kunjungan: number }[];
  domisiliTakTercatat: number;
} {
  const kegiatan = m.kategori.filter((k) => adalahKegiatan(k.id));
  const kegiatanById = new Map(kegiatan.map((k) => [k.id, k]));

  const info = new Map<string, RuanganRow>(m.ruangan.map((r) => [r.id, r]));
  // Ruangan beraktivitas di luar daftar master (tak terduga; filter SQL sama) tetap tampil.
  for (const b of m.agregat) {
    if (!info.has(b.ruangan)) info.set(b.ruangan, { id: b.ruangan, nama: b.ruangan, jenisKunjungan: JK_RAWAT_JALAN, aktif: false });
  }

  type Kerja = RuanganRl35 & { pindahPeta: Map<number, PindahRl35> };
  const ruang = new Map<string, Kerja>();
  for (const r of info.values()) {
    const e = petaEfektif(r, m.peta.get(r.id), kegiatanById);
    ruang.set(r.id, {
      id: r.id,
      nama: r.nama || r.id,
      jenisKunjungan: r.jenisKunjungan,
      aktif: r.aktif,
      status: e.status,
      kategori: e.kategori,
      nilai: nilaiKosong(),
      pindah: [],
      aktivitas: false,
      pindahPeta: new Map(),
    });
  }

  const perKategori = new Map<number, { nilai: NilaiRl35; ruangan: Map<string, BarisRl35["ruangan"][number]> }>();
  let domisiliTakTercatat = 0;
  for (const b of m.agregat) {
    const r = ruang.get(b.ruangan)!;
    const n = nilaiDari(b);
    tambah(r.nilai, n);
    if (!r.kategori) continue;
    if (b.dom === 2) domisiliTakTercatat += b.n;
    const akhir = kategoriAkhir(r.kategori.id, b);
    const tujuan = kegiatanById.get(akhir.id) ?? r.kategori;
    if (akhir.alasan && tujuan.id !== r.kategori.id) {
      let p = r.pindahPeta.get(tujuan.id);
      if (!p) r.pindahPeta.set(tujuan.id, (p = { kategori: tujuan, alasan: akhir.alasan, nilai: nilaiKosong() }));
      tambah(p.nilai, n);
    }
    let g = perKategori.get(tujuan.id);
    if (!g) perKategori.set(tujuan.id, (g = { nilai: nilaiKosong(), ruangan: new Map() }));
    tambah(g.nilai, n);
    const alasan: AlasanReklas | null = tujuan.id === r.kategori.id ? null : akhir.alasan;
    g.ruangan.set(`${r.id}|${alasan ?? ""}`, { id: r.id, nama: r.nama, alasan });
  }

  const ruangan: RuanganRl35[] = [...ruang.values()]
    .map(({ pindahPeta, ...r }) => ({
      ...r,
      pindah: [...pindahPeta.values()].sort((a, b) => a.kategori.id - b.kategori.id),
      aktivitas: r.nilai.total > 0,
    }))
    .sort((a, b) => a.jenisKunjungan - b.jenisKunjungan || a.nama.localeCompare(b.nama));

  const baris: BarisRl35[] = kegiatan.map((k) => {
    const g = perKategori.get(k.id);
    return { ...k, nilai: g?.nilai ?? nilaiKosong(), ruangan: g ? [...g.ruangan.values()] : [] };
  });

  // Baris 66 & 77: hanya poliklinik yang ikut laporan (bukan IGD, bukan yang dikecualikan/belum dipetakan).
  const poliklinik = new Set(ruangan.filter((r) => r.jenisKunjungan === JK_RAWAT_JALAN && r.kategori).map((r) => r.id));
  const hariBuka = m.hari.filter((h) => h.ruangan.some((id) => poliklinik.has(id))).length;
  const kunjunganRj = ruangan.filter((r) => poliklinik.has(r.id)).reduce((s, r) => s + r.nilai.total, 0);
  const bulan = bulanTercakup(m.from, m.to);
  const rataRata: RataRataRl35 = {
    hariBuka,
    bulan,
    rataHariBuka: satuDesimal(hariBuka / bulan),
    kunjunganRj,
    rataKunjunganPerHari: hariBuka > 0 ? satuDesimal(kunjunganRj / hariBuka) : null,
  };

  const belumDipetakan = ruangan
    .filter((r) => r.status === "belum" && r.aktivitas)
    .map((r) => ({ id: r.id, nama: r.nama, kunjungan: r.nilai.total }));

  return { baris, total: jumlahkan(baris.map((b) => b.nilai)), rataRata, ruangan, belumDipetakan, domisiliTakTercatat };
}
