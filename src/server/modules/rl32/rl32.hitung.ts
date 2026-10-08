/**
 * Perhitungan murni RL 3.2: baris agregat per ruangan × SMF DPJP (SIMGOS) +
 * pemetaan ruangan → jenis pelayanan (+ pemisahan menurut SMF DPJP, DB aplikasi)
 * → baris laporan. Tanpa I/O → diuji unit.
 */
import { METRIK_KELAS, METRIK_RL32, type MetrikRl32 } from "./rl32.constants";
import type {
  Angka,
  BagianRuangan,
  BarisAgregat,
  BarisRl32,
  KategoriRl32,
  NilaiRl32,
  PetaTersimpan,
  RuanganRl32,
  SmfRef,
  StatusPeta,
} from "./rl32.types";

const nol = (): Angka => ({ total: 0, lk: 0, pr: 0 });

export function nilaiKosong(): NilaiRl32 {
  const n = { tempatTidur: null } as NilaiRl32;
  for (const m of METRIK_RL32) n[m.key] = nol();
  return n;
}

function tambahAngka(a: Angka, b: Angka): void {
  a.total += b.total;
  a.lk += b.lk;
  a.pr += b.pr;
}

/**
 * Pasien dipindahkan = sisa keseimbangan (rumus SP):
 * (awal + masuk + pindahan) − (keluar hidup + keluar mati + akhir periode).
 */
function hitungDipindahkan(n: NilaiRl32): void {
  for (const k of ["total", "lk", "pr"] as const) {
    n.dipindahkan[k] = n.awal[k] + n.masuk[k] + n.pindahan[k] - (n.hidup[k] + n.mati[k] + n.sisa[k]);
  }
}

/** Jumlahkan beberapa nilai (dipindahkan dihitung ulang dari hasil jumlah). */
export function jumlahkan(daftar: readonly NilaiRl32[]): NilaiRl32 {
  const out = nilaiKosong();
  for (const n of daftar) {
    for (const m of METRIK_RL32) if (m.key !== "dipindahkan") tambahAngka(out[m.key], n[m.key]);
    if (n.tempatTidur != null) out.tempatTidur = (out.tempatTidur ?? 0) + n.tempatTidur;
  }
  hitungDipindahkan(out);
  return out;
}

/** Metrik mentah SQL → kolom laporan (beberapa metrik mentah menyumbang ke >1 kolom). */
function kolomUntuk(metrik: string): MetrikRl32[] {
  switch (metrik) {
    case "awal":
    case "masuk":
    case "pindahan":
    case "hidup":
    case "lamaDirawat":
    case "sisa":
      return [metrik];
    case "matiKurang48":
    case "matiLebih48":
      return ["mati", metrik];
    case "matiTanpaDurasi":
      return ["mati"];
    default: {
      const hp = /^hp(\d+)$/.exec(metrik);
      if (!hp) return []; // mis. keluarTanpaCara: tak masuk kolom mana pun (sama dgn SP)
      const kelas = METRIK_KELAS[Number(hp[1])];
      return kelas ? ["hariPerawatan", kelas] : ["hariPerawatan"];
    }
  }
}

/** Nilai pasien per ruangan → per SMF DPJP (tanpa TT; TT milik ruangan). */
export function nilaiPerRuanganSmf(agregat: readonly BarisAgregat[]): Map<string, Map<number, NilaiRl32>> {
  const peta = new Map<string, Map<number, NilaiRl32>>();
  for (const b of agregat) {
    let perSmf = peta.get(b.ruangan);
    if (!perSmf) peta.set(b.ruangan, (perSmf = new Map()));
    let n = perSmf.get(b.smf);
    if (!n) perSmf.set(b.smf, (n = nilaiKosong()));
    for (const kol of kolomUntuk(b.metrik)) tambahAngka(n[kol], b);
  }
  for (const perSmf of peta.values()) for (const n of perSmf.values()) hitungDipindahkan(n);
  return peta;
}

/** Nilai per ruangan (semua SMF) + TT. */
export function nilaiPerRuangan(
  perSmf: ReadonlyMap<string, ReadonlyMap<number, NilaiRl32>>,
  tempatTidur: ReadonlyMap<string, number>,
): Map<string, NilaiRl32> {
  const out = new Map<string, NilaiRl32>();
  for (const [id, m] of perSmf) out.set(id, jumlahkan([...m.values()]));
  for (const [id, tt] of tempatTidur) {
    const n = out.get(id) ?? nilaiKosong();
    n.tempatTidur = tt;
    out.set(id, n);
  }
  return out;
}

/** Ada pasien atau TT pada periode? */
export function beraktivitas(n: NilaiRl32): boolean {
  return (n.tempatTidur ?? 0) > 0 || METRIK_RL32.some((m) => n[m.key].total !== 0);
}

/** Pasien yang dirawat di ruangan pada periode (awal + masuk + pindahan). */
export const pasienDirawat = (n: NilaiRl32) => n.awal.total + n.masuk.total + n.pindahan.total;

/** Status pemetaan satu ruangan; ID jenis pelayanan usang (tak ada di refrl) = belum. */
export function statusPeta(
  peta: Pick<PetaTersimpan, "rlId"> | undefined,
  kategori: ReadonlyMap<number, KategoriRl32>,
): { status: StatusPeta; kategori: KategoriRl32 | null } {
  if (!peta) return { status: "belum", kategori: null };
  if (peta.rlId == null) return { status: "dikecualikan", kategori: null };
  const k = kategori.get(peta.rlId);
  return k ? { status: "terpetakan", kategori: k } : { status: "belum", kategori: null };
}

export type MasukanSusun = {
  kategori: readonly KategoriRl32[];
  /** Daftar ruang rawat inap (selalu tampil walau tanpa aktivitas). */
  ruanganRi: readonly { id: string; nama: string; aktif: boolean }[];
  /** Nama ruangan lain yang muncul di data (di luar daftar RI). */
  ruanganLain: ReadonlyMap<string, { nama: string; aktif: boolean }>;
  /** Pasien per ruangan per SMF DPJP. */
  perSmf: ReadonlyMap<string, ReadonlyMap<number, NilaiRl32>>;
  tempatTidur: ReadonlyMap<string, number>;
  peta: ReadonlyMap<string, PetaTersimpan>;
  /** SMF DPJP → ID jenis pelayanan (untuk ruangan ber-pisah DPJP). */
  petaSmf: ReadonlyMap<number, number>;
  namaSmf: ReadonlyMap<number, string>;
};

const smfRef = (id: number, nama: ReadonlyMap<number, string>): SmfRef => ({
  id,
  nama: id < 0 ? "Tanpa SMF" : (nama.get(id) ?? `SMF ${id}`),
});

/**
 * Bagi pasien ruangan ber-pisah DPJP ke jenis pelayanan menurut SMF DPJP
 * (SMF tanpa pemetaan → jenis pelayanan ruangan). TT tetap milik ruangan.
 */
function bagiRuangan(
  kategoriRuangan: KategoriRl32,
  perSmf: ReadonlyMap<number, NilaiRl32>,
  tt: number | undefined,
  m: Pick<MasukanSusun, "petaSmf" | "namaSmf">,
  kategoriById: ReadonlyMap<number, KategoriRl32>,
): BagianRuangan[] {
  const kelompok = new Map<number, { kategori: KategoriRl32; smf: SmfRef[]; nilai: NilaiRl32[] }>();
  const ambil = (k: KategoriRl32) => {
    let g = kelompok.get(k.id);
    if (!g) kelompok.set(k.id, (g = { kategori: k, smf: [], nilai: [] }));
    return g;
  };
  for (const [smf, n] of perSmf) {
    const tujuan = kategoriById.get(m.petaSmf.get(smf) ?? -1) ?? kategoriRuangan;
    const g = ambil(tujuan);
    g.smf.push(smfRef(smf, m.namaSmf));
    g.nilai.push(n);
  }
  if (tt != null) {
    const ttSaja = nilaiKosong();
    ttSaja.tempatTidur = tt;
    ambil(kategoriRuangan).nilai.push(ttSaja);
  }
  return [...kelompok.values()]
    .map((g) => ({ kategori: g.kategori, smf: g.smf.sort((a, b) => a.nama.localeCompare(b.nama)), nilai: jumlahkan(g.nilai) }))
    .sort((a, b) => a.kategori.id - b.kategori.id);
}

/** Susun baris laporan per jenis pelayanan + rincian per ruangan + peringatan. */
export function susunRl32(m: MasukanSusun): {
  baris: BarisRl32[];
  total: NilaiRl32;
  ruangan: RuanganRl32[];
  belumDipetakan: { id: string; nama: string; pasien: number; tempatTidur: number | null }[];
} {
  const kategoriById = new Map(m.kategori.map((k) => [k.id, k]));
  const nilai = nilaiPerRuangan(m.perSmf, m.tempatTidur);

  const daftar = new Map<string, { nama: string; aktif: boolean }>();
  for (const r of m.ruanganRi) daftar.set(r.id, { nama: r.nama, aktif: r.aktif });
  for (const id of nilai.keys()) {
    if (!daftar.has(id)) daftar.set(id, m.ruanganLain.get(id) ?? { nama: id, aktif: false });
  }

  const ruangan: RuanganRl32[] = [...daftar].map(([id, info]) => {
    const n = nilai.get(id) ?? nilaiKosong();
    const peta = m.peta.get(id);
    const { status, kategori } = statusPeta(peta, kategoriById);
    const pisahDpjp = status === "terpetakan" && !!peta?.pisahDpjp;
    const bagian =
      pisahDpjp && kategori ? bagiRuangan(kategori, m.perSmf.get(id) ?? new Map(), m.tempatTidur.get(id), m, kategoriById) : [];
    return { id, nama: info.nama || id, aktif: info.aktif, status, kategori, pisahDpjp, bagian, nilai: n, aktivitas: beraktivitas(n) };
  });

  // Sumbangan tiap ruangan terpetakan ke jenis pelayanan.
  const sumbangan = new Map<number, { nilai: NilaiRl32[]; ruangan: BarisRl32["ruangan"] }>();
  const catat = (kategoriId: number, r: RuanganRl32, n: NilaiRl32, smf: string[] | null) => {
    let s = sumbangan.get(kategoriId);
    if (!s) sumbangan.set(kategoriId, (s = { nilai: [], ruangan: [] }));
    s.nilai.push(n);
    s.ruangan.push({ id: r.id, nama: r.nama, smf });
  };
  for (const r of ruangan) {
    if (r.status !== "terpetakan" || !r.kategori) continue;
    if (!r.pisahDpjp) catat(r.kategori.id, r, r.nilai, null);
    else for (const b of r.bagian) catat(b.kategori.id, r, b.nilai, b.smf.map((s) => s.nama));
  }

  const baris: BarisRl32[] = m.kategori.map((k) => {
    const s = sumbangan.get(k.id);
    return { ...k, nilai: jumlahkan(s?.nilai ?? []), ruangan: s?.ruangan ?? [] };
  });

  const belumDipetakan = ruangan
    .filter((r) => r.status === "belum" && r.aktivitas)
    .map((r) => ({ id: r.id, nama: r.nama, pasien: pasienDirawat(r.nilai), tempatTidur: r.nilai.tempatTidur }));

  return { baris, total: jumlahkan(baris.map((b) => b.nilai)), ruangan, belumDipetakan };
}
