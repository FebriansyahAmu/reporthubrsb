import "server-only";
import type { SessionUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/lib/errors";
import { createLimiter } from "@/server/lib/limiter";
import { createTtlCache } from "@/server/lib/ttl-cache";
import { can } from "@/server/rbac/permissions";
import {
  BATAS,
  cariTransisi,
  KATEGORI,
  MODUL_VERIFIKASI,
  PENJAMIN_BPJS,
  STATUS_AWAL,
  STATUS_VERIFIKASI,
  type CakupanPenjamin,
  type Kategori,
  type StatusVerifikasi,
} from "./verifikasi.constants";
import {
  queryCpptRingkas,
  queryDiagnosaRingkas,
  queryEpisodeByNopens,
  queryEpisodePulang,
  queryGabungKeRi,
  queryJumlahPerNopen,
  queryPasienPulang,
  queryPenunjang,
  querySepKandidat,
  querySpriRi,
  queryTagihanAda,
  type EpisodeRow,
  type SepKandidat,
} from "./verifikasi.dal";
import {
  findBuktiNopens,
  findNopenDenganTlOpen,
  findRiwayat,
  findStatusByNopens,
  findTindakLanjut,
  hitungTindakLanjut,
  type StatusTersimpan,
} from "./verifikasi.repo";
import { cekManualUntuk, evaluasi, masalahDari } from "./verifikasi.rules";
import { selisihHari, tambahHari, type AntreanFilter, type AntreanQuery } from "./verifikasi.schema";
import { sinkronTindakLanjut } from "./tindak-lanjut.sinkron";
import type {
  AntreanItem,
  AntreanResult,
  AntreanRingkasan,
  DetailKlaim,
  HasilCek,
  IzinKlaim,
  RuangKerjaKlaim,
  SnapshotKlaim,
} from "./verifikasi.types";

/**
 * Orkestrasi Verifikasi Klaim (PRD §7): episode (SIMGOS) → penggabungan IGD→RI →
 * fakta kelengkapan batch (SIMGOS, BERURUTAN) + Bukti Pelayanan (reporthub) →
 * snapshot → evaluasi aturan MURNI → gabung status tersimpan (reporthub).
 *
 * Anti-overload: hasil SIMGOS per (rentang, cakupan) di-cache 60 dtk dengan
 * single-flight, dan maks `BATAS.KOMPUTASI_PARALEL` komputasi berjalan bersamaan.
 * Status reporthub SELALU dibaca segar per permintaan (keputusan langsung tampak).
 */

type Komputasi = {
  snapshots: SnapshotKlaim[];
  cek: Map<string, HasilCek>;
  digabung: number;
  durasiMs: number;
};

const cacheRentang = createTtlCache<Komputasi>("verifikasi-klaim", { ttlMs: BATAS.CACHE_TTL_MS, max: 20 });
const batasKomputasi = createLimiter("verifikasi-klaim", BATAS.KOMPUTASI_PARALEL);

/* ---------------------------------------------------------------- snapshot */

function kategoriDari(e: EpisodeRow): Kategori {
  if (e.ri) return "RI";
  return e.igd ? "IGD" : "RJ";
}

/** SEP dengan jenis pelayanan cocok (RI=1, lainnya=2), tglSEP terdekat (kandidat sudah terurut). */
function pilihSep(kandidat: SepKandidat[] | undefined, kategori: Kategori): SnapshotKlaim["fakta"]["sep"] {
  const jp = kategori === "RI" ? 1 : 2;
  const k = kandidat?.find((c) => c.jenisPelayanan === jp);
  return k ? { nomor: k.nomor, tanggal: k.tanggal } : null;
}

const unik = (xs: (string | null | undefined)[]): string[] => [...new Set(xs.filter((x): x is string => !!x))];

/**
 * Rakit snapshot untuk episode-episode (tanpa menyaring penggabungan). Query
 * SIMGOS dijalankan BERURUTAN — sengaja tanpa Promise.all (satu koneksi).
 */
async function rakitSnapshot(episodes: readonly EpisodeRow[]): Promise<SnapshotKlaim[]> {
  if (episodes.length === 0) return [];
  const nopens = episodes.map((e) => e.nopen);
  const riNopens = episodes.filter((e) => e.ri).map((e) => e.nopen);

  const diagnosa = await queryDiagnosaRingkas(nopens);
  const resume = await queryJumlahPerNopen("resume", nopens);
  const cppt = await queryCpptRingkas(nopens);
  const spri = await querySpriRi(riNopens);
  const asalIgd = new Map([...spri].map(([n, s]) => [n, s.asalIgdNopen]));
  const triase = await queryJumlahPerNopen(
    "triase",
    unik([...episodes.filter((e) => e.igd).map((e) => e.nopen), ...asalIgd.values()]),
  );
  const pulang = await queryPasienPulang(nopens);
  const penunjang = await queryPenunjang(nopens);
  const tagihan = await queryTagihanAda(nopens);
  const sep = await querySepKandidat(nopens);
  const bukti = await findBuktiNopens(nopens);

  return episodes.map((e) => {
    const kategori = kategoriDari(e);
    // IGD asal: NOPEN IGD ber-SPRI ke RI ini; bila IGD satu NOPEN dgn RI → dirinya.
    const asalNopen = asalIgd.get(e.nopen) ?? (kategori === "RI" && e.igd ? e.nopen : null);
    return {
      nopen: e.nopen,
      norm: e.norm,
      nama: e.nama,
      kategori,
      penjamin: e.penjamin,
      masuk: e.masuk,
      pulang: e.terbuka === 0 ? e.pulang : null,
      ruanganId: e.ruanganId,
      ruang: e.ruang,
      dpjpId: e.dpjpId,
      fakta: {
        sep: pilihSep(sep.get(e.nopen), kategori),
        diagnosa: diagnosa.get(e.nopen) ?? { total: 0, primer: 0, tanpaKode: 0 },
        resume: resume.get(e.nopen) ?? 0,
        cppt: cppt.get(e.nopen) ?? { total: 0, verifikasi: 0, belumVerif: 0 },
        triase: triase.get(e.nopen) ?? 0,
        spri: spri.get(e.nopen)?.n ?? 0,
        asal: asalNopen ? { nopen: asalNopen, triase: triase.get(asalNopen) ?? 0 } : null,
        pulang: pulang.get(e.nopen) ?? null,
        penunjang: penunjang.get(e.nopen) ?? { lab: 0, labBelum: 0, rad: 0, radBelum: 0 },
        tagihan: tagihan.has(e.nopen),
        bukti: bukti.has(e.nopen),
      },
    };
  });
}

/** Berkas yang baru dicek SEGAR dari SIMGOS (tanpa cache). */
export type BerkasSegar = {
  snapshot: SnapshotKlaim;
  cek: HasilCek;
  /** Semua leg episode sudah KELUAR. */
  final: boolean;
  /** Episode non-RI yang digabung ke episode RI: NOPEN RI tujuan. */
  digabungKe: string | null;
};

/**
 * Cek SEGAR banyak berkas dalam satu batch (±12 query berurutan, berapa pun
 * jumlahnya s.d. batas batch) — dasar keputusan, loloskan massal & rekonsiliasi
 * tindak lanjut. NOPEN yang tak ditemukan / dibatalkan tidak ada di hasil.
 */
export async function cekSegarBatch(nopens: readonly string[]): Promise<Map<string, BerkasSegar>> {
  const episodes = await queryEpisodeByNopens(unik([...nopens]));
  const gabung = await queryGabungKeRi(episodes.filter((e) => !e.ri).map((e) => e.nopen));
  const snapshots = await rakitSnapshot(episodes);
  const terbuka = new Map(episodes.map((e) => [e.nopen, e.terbuka]));
  return new Map(
    snapshots.map((s) => [
      s.nopen,
      { snapshot: s, cek: evaluasi(s), final: terbuka.get(s.nopen) === 0, digabungKe: gabung.get(s.nopen) ?? null },
    ]),
  );
}

/** Satu komputasi rentang: episode final → buang yang digabung ke RI → snapshot → evaluasi. */
async function hitungRentang(from: string, to: string, cakupan: CakupanPenjamin): Promise<Komputasi> {
  const t0 = Date.now();
  const semua = await queryEpisodePulang(from, tambahHari(to, 1));
  const episodes = cakupan === "semua" ? semua : semua.filter((e) => e.penjamin === PENJAMIN_BPJS);

  const gabung = await queryGabungKeRi(episodes.filter((e) => !e.ri).map((e) => e.nopen));
  const aktif = episodes.filter((e) => !gabung.has(e.nopen));

  const snapshots = await rakitSnapshot(aktif);
  const cek = new Map(snapshots.map((s) => [s.nopen, evaluasi(s)]));
  return { snapshots, cek, digabung: gabung.size, durasiMs: Date.now() - t0 };
}

/* ----------------------------------------------------------------- antrean */

function lamaRawat(s: SnapshotKlaim): number {
  if (s.kategori !== "RI" || !s.masuk || !s.pulang) return 0;
  return Math.max(1, selisihHari(s.masuk, s.pulang));
}

function keItem(
  s: SnapshotKlaim,
  cek: HasilCek,
  simpan: StatusTersimpan | undefined,
  tl: { open: number; total: number } | undefined,
): AntreanItem {
  return {
    nopen: s.nopen,
    norm: s.norm,
    nama: s.nama,
    kategori: s.kategori,
    penjamin: s.penjamin,
    ruang: s.ruang,
    ruanganId: s.ruanganId,
    masuk: s.masuk,
    pulang: s.pulang,
    lamaRawat: lamaRawat(s),
    sep: s.fakta.sep?.nomor ?? null,
    asalNopen: s.fakta.asal && s.fakta.asal.nopen !== s.nopen ? s.fakta.asal.nopen : null,
    status: simpan?.status ?? STATUS_AWAL,
    versi: simpan?.versi ?? null,
    cek: {
      lolos: cek.lolos,
      gagal: cek.gagal,
      peringatan: cek.peringatan,
      total: cek.total,
      lengkap: cek.lengkap,
      masalah: masalahDari(cek).map(({ key, label, status, pesan, pj }) => ({ key, label, status, pesan, pj })),
    },
    tl: tl ?? { open: 0, total: 0 },
  };
}

function cocokCari(it: AntreanItem, q: string): boolean {
  if (/^\d+$/.test(q)) return it.norm === q || it.nopen.startsWith(q) || (it.sep?.includes(q) ?? false);
  const t = q.toLowerCase();
  return it.nama.toLowerCase().includes(t) || (it.sep?.toLowerCase().includes(t) ?? false);
}

const siapPeriksaUlang = (it: AntreanItem) => it.status === "TIDAK_LENGKAP" && it.tl.total > 0 && it.tl.open === 0;

function ringkas(items: readonly AntreanItem[]): AntreanRingkasan {
  const perStatus = Object.fromEntries(STATUS_VERIFIKASI.map((s) => [s, 0])) as Record<StatusVerifikasi, number>;
  const perKategori = Object.fromEntries(KATEGORI.map((k) => [k, 0])) as Record<Kategori, number>;
  const perAturan: Record<string, number> = {};
  let lengkapOtomatis = 0;
  let siap = 0;
  for (const it of items) {
    perStatus[it.status]++;
    perKategori[it.kategori]++;
    for (const m of it.cek.masalah) if (m.status === "gagal") perAturan[m.key] = (perAturan[m.key] ?? 0) + 1;
    if (it.status === "BELUM_DIPERIKSA" && it.cek.lengkap) lengkapOtomatis++;
    if (siapPeriksaUlang(it)) siap++;
  }
  return { total: items.length, perStatus, perKategori, perAturan, lengkapOtomatis, siapPeriksaUlang: siap };
}

/** Filter dasar (kategori/ruangan/cari) — ringkasan pita tahap dihitung setelah filter ini. */
export function saringDasar(items: readonly AntreanItem[], f: AntreanFilter): AntreanItem[] {
  return items.filter(
    (it) =>
      (!f.kategori || it.kategori === f.kategori) &&
      (!f.ruangan || (it.ruanganId?.startsWith(f.ruangan) ?? false)) &&
      (!f.q || cocokCari(it, f.q)),
  );
}

/**
 * Seluruh item antrean rentang (sebelum filter) dengan status & tindak lanjut
 * reporthub terkini. Komputasi SIMGOS segar (bukan dari cache) sekaligus
 * merekonsiliasi tindak lanjut berkas di rentang ini.
 */
export async function itemAntrean(f: AntreanFilter & { segar?: "1" }) {
  const key = `${f.from}|${f.to}|${f.cakupan}`;
  const { value: k, at, hit } = await cacheRentang.get(
    key,
    () => batasKomputasi(() => hitungRentang(f.from, f.to, f.cakupan)),
    { fresh: f.segar === "1" },
  );
  const nopens = k.snapshots.map((s) => s.nopen);

  if (!hit) {
    const adaTl = await findNopenDenganTlOpen(nopens);
    if (adaTl.size) {
      await sinkronTindakLanjut(
        k.snapshots.filter((s) => adaTl.has(s.nopen)).map((s) => ({ snapshot: s, cek: k.cek.get(s.nopen)! })),
      );
    }
  }

  const tersimpan = await findStatusByNopens(nopens);
  const tl = await hitungTindakLanjut(nopens);
  const semua = k.snapshots
    .map((s) => keItem(s, k.cek.get(s.nopen)!, tersimpan.get(s.nopen), tl.get(s.nopen)))
    .sort((a, b) => (a.pulang ?? "").localeCompare(b.pulang ?? "") || a.nopen.localeCompare(b.nopen));
  return { semua, k, at, hit };
}

/**
 * Antrean verifikasi untuk rentang tanggal pulang. Ringkasan (pita tahap, chip
 * masalah) dihitung SETELAH filter dasar (kategori/ruangan/cari) tetapi SEBELUM
 * filter status/masalah/lengkap — agar jumlah per tahap tetap terlihat.
 */
export async function getAntreanVerifikasi(input: AntreanQuery): Promise<AntreanResult> {
  const { semua, k, at, hit } = await itemAntrean(input);

  const dasar = saringDasar(semua, input);
  const tersaring = dasar.filter(
    (it) =>
      (!input.status || it.status === input.status) &&
      (!input.masalah || it.cek.masalah.some((m) => m.key === input.masalah && m.status === "gagal")) &&
      (!input.lengkap || it.cek.lengkap === (input.lengkap === "ya")) &&
      (!input.siap || siapPeriksaUlang(it)),
  );

  const ruang = new Map<string, { id: string; nama: string; n: number }>();
  for (const it of semua) {
    if (!it.ruanganId) continue;
    const r = ruang.get(it.ruanganId) ?? { id: it.ruanganId, nama: it.ruang ?? it.ruanganId, n: 0 };
    r.n++;
    ruang.set(it.ruanganId, r);
  }

  const awal = (input.page - 1) * input.pageSize;
  return {
    items: tersaring.slice(awal, awal + input.pageSize),
    page: input.page,
    pageSize: input.pageSize,
    filtered: tersaring.length,
    ringkasan: ringkas(dasar),
    meta: {
      from: input.from,
      to: input.to,
      cakupan: input.cakupan,
      digabung: k.digabung,
      dihitungPada: new Date(at).toISOString(),
      durasiMs: k.durasiMs,
      dariCache: hit,
    },
    opsi: { ruang: [...ruang.values()].sort((a, b) => a.nama.localeCompare(b.nama)) },
  };
}

/* ------------------------------------------------------------------ detail */

/** Episode + cek SEGAR + status tersimpan satu berkas (tanpa cache). */
export async function muatBerkas(nopen: string): Promise<BerkasSegar & { simpan: StatusTersimpan | undefined }> {
  const b = (await cekSegarBatch([nopen])).get(nopen);
  if (!b) throw new NotFoundError("Episode (NOPEN) tidak ditemukan atau dibatalkan");
  const simpan = (await findStatusByNopens([nopen])).get(nopen);
  return { ...b, simpan };
}

/** Rakit detail dari berkas segar + data reporthub terkini (status, tindak lanjut, riwayat). */
export async function bangunDetail(b: BerkasSegar): Promise<DetailKlaim> {
  const nopen = b.snapshot.nopen;
  const simpan = (await findStatusByNopens([nopen])).get(nopen);
  return {
    snapshot: b.snapshot,
    cek: b.cek,
    status: simpan?.status ?? STATUS_AWAL,
    versi: simpan?.versi ?? null,
    final: b.final,
    digabungKe: b.digabungKe,
    cekManual: cekManualUntuk(b.snapshot.kategori),
    tindakLanjut: await findTindakLanjut(nopen),
    riwayat: await findRiwayat(nopen),
  };
}

/**
 * Hasil cek SEGAR satu episode (dasar "Cek ulang dari SIMRS"), sekaligus
 * merekonsiliasi tindak lanjutnya. Episode IGD yang digabung ke RI tetap
 * dievaluasi sebagai dirinya, dengan `digabungKe` menunjuk NOPEN RI tujuan.
 */
export async function getDetailKlaim(nopen: string): Promise<DetailKlaim> {
  const b = await muatBerkas(nopen);
  await sinkronTindakLanjut([b]);
  return bangunDetail(b);
}

/** Aksi Tahap 1 yang boleh dilakukan pengguna pada berkas ini sekarang. */
export async function izinKlaim(user: SessionUser, d: Pick<DetailKlaim, "status" | "final" | "digabungKe">): Promise<IzinKlaim> {
  const bisa = d.final && !d.digabungKe && (await can(user.role, MODUL_VERIFIKASI.RM, "update"));
  return {
    loloskan: bisa && !!cariTransisi(d.status, "LOLOSKAN_RM"),
    tandai: bisa && !!cariTransisi(d.status, "TANDAI_TIDAK_LENGKAP"),
  };
}

export async function getRuangKerja(nopen: string, user: SessionUser): Promise<RuangKerjaKlaim> {
  const d = await getDetailKlaim(nopen);
  return { ...d, izin: await izinKlaim(user, d) };
}
