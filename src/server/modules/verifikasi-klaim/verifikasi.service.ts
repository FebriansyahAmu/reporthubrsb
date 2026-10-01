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
  STATUS_TAHAP2,
  STATUS_VERIFIKASI,
  type AksiVerifikasi,
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
import { queryKodingBaris } from "./koding.dal";
import { petaIcd } from "./icd.cache";
import {
  evaluasiKoding,
  getAturanKoding,
  kodeUntukIcd,
  konteksKoding,
  setDariUsulan,
  setKlaim,
  sisaPerubahan,
} from "./koding.rules";
import { sinkronKoding } from "./koding.sinkron";
import {
  findBuktiNopens,
  findKoreksi,
  findKoreksiAktif,
  findNopenDenganTlOpen,
  findRiwayat,
  findStatusByNopens,
  findTindakLanjut,
  hitungTindakLanjut,
  type KoreksiAktif,
  type StatusTersimpan,
} from "./verifikasi.repo";
import { findPaketRingkas } from "./paket.repo";
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
  MasalahRingkas,
  PaketRingkas,
  RuangKerjaKlaim,
  SnapshotKlaim,
} from "./verifikasi.types";

/**
 * Orkestrasi Verifikasi Klaim (PRD §7): episode (SIMGOS) → penggabungan IGD→RI →
 * fakta kelengkapan & koding batch (SIMGOS, BERURUTAN) + Bukti Pelayanan
 * (reporthub) → snapshot → evaluasi aturan MURNI Tahap 1 & 2 → gabung status
 * tersimpan (reporthub).
 *
 * Anti-overload: hasil SIMGOS per (rentang, cakupan) di-cache 60 dtk dengan
 * single-flight, dan maks `BATAS.KOMPUTASI_PARALEL` komputasi berjalan bersamaan.
 * Status reporthub SELALU dibaca segar per permintaan (keputusan langsung tampak).
 */

type Komputasi = {
  snapshots: SnapshotKlaim[];
  cek: Map<string, HasilCek>;
  /** Aturan Tahap 2 terhadap koding SIMRS. */
  koding: Map<string, HasilCek>;
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
export function pilihSep(kandidat: SepKandidat[] | undefined, kategori: Kategori): SnapshotKlaim["fakta"]["sep"] {
  const jp = kategori === "RI" ? 1 : 2;
  const k = kandidat?.find((c) => c.jenisPelayanan === jp);
  return k ? { nomor: k.nomor, tanggal: k.tanggal } : null;
}

/** SEP terdekat berjenis pelayanan LAIN — penjelas aturan `sep-jenis` bila SEP yang cocok tak ada. */
function pilihSepLain(kandidat: SepKandidat[] | undefined, kategori: Kategori): SnapshotKlaim["fakta"]["sepLain"] {
  const jp = kategori === "RI" ? 1 : 2;
  const k = kandidat?.find((c) => c.jenisPelayanan !== jp);
  return k ? { nomor: k.nomor, tanggal: k.tanggal, jenisPelayanan: k.jenisPelayanan } : null;
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
  // DB aplikasi (bukan SIMGOS) → boleh berjalan berbarengan dengan rangkaian query SIMGOS.
  const buktiP = findBuktiNopens(nopens);
  buktiP.catch(() => {}); // galat tetap dilempar saat di-await; cegah unhandled rejection lebih dulu

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
  const koding = await queryKodingBaris(nopens);
  const bukti = await buktiP;

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
        sepLain: pilihSepLain(sep.get(e.nopen), kategori),
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
        koding: koding.get(e.nopen) ?? { diagnosa: [], prosedur: [], bedah: 0 },
      },
    };
  });
}

/**
 * Aturan Tahap 2 terhadap koding SIMRS tiap snapshot. Info ICD diambil sekali
 * untuk seluruh kode (hanya kode yang belum ada di cache 24 jam).
 */
async function cekKodingBatch(snapshots: readonly SnapshotKlaim[]): Promise<Map<string, HasilCek>> {
  const sets = new Map(snapshots.map((s) => [s.nopen, setKlaim(s.fakta.koding)]));
  const icd = await petaIcd(kodeUntukIcd([...sets.values()]));
  return new Map(snapshots.map((s) => [s.nopen, evaluasiKoding(konteksKoding(s, icd, sets.get(s.nopen)))]));
}

/** Berkas yang baru dicek SEGAR dari SIMGOS (tanpa cache). */
export type BerkasSegar = {
  snapshot: SnapshotKlaim;
  cek: HasilCek;
  /** Aturan Tahap 2 terhadap koding SIMRS sekarang. */
  cekKoding: HasilCek;
  /** Semua leg episode sudah KELUAR. */
  final: boolean;
  /** Episode non-RI yang digabung ke episode RI: NOPEN RI tujuan. */
  digabungKe: string | null;
};

/**
 * Cek SEGAR banyak berkas dalam satu batch (±14 query berurutan, berapa pun
 * jumlahnya s.d. batas batch) — dasar keputusan, loloskan massal & rekonsiliasi
 * tindak lanjut / koding. NOPEN yang tak ditemukan / dibatalkan tidak ada di hasil.
 */
export async function cekSegarBatch(nopens: readonly string[]): Promise<Map<string, BerkasSegar>> {
  const episodes = await queryEpisodeByNopens(unik([...nopens]));
  const gabung = await queryGabungKeRi(episodes.filter((e) => !e.ri).map((e) => e.nopen));
  const snapshots = await rakitSnapshot(episodes);
  const koding = await cekKodingBatch(snapshots);
  const terbuka = new Map(episodes.map((e) => [e.nopen, e.terbuka]));
  return new Map(
    snapshots.map((s) => [
      s.nopen,
      {
        snapshot: s,
        cek: evaluasi(s),
        cekKoding: koding.get(s.nopen)!,
        final: terbuka.get(s.nopen) === 0,
        digabungKe: gabung.get(s.nopen) ?? null,
      },
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
  const koding = await cekKodingBatch(snapshots);
  return { snapshots, cek, koding, digabung: gabung.size, durasiMs: Date.now() - t0 };
}

/* ----------------------------------------------------------------- antrean */

function lamaRawat(s: SnapshotKlaim): number {
  if (s.kategori !== "RI" || !s.masuk || !s.pulang) return 0;
  return Math.max(1, selisihHari(s.masuk, s.pulang));
}

const ringkasMasalah = (cek: HasilCek): MasalahRingkas[] =>
  masalahDari(cek).map(({ key, label, status, pesan, pj }) => ({ key, label, status, pesan, pj }));

function keItem(
  s: SnapshotKlaim,
  cek: HasilCek,
  cekKoding: HasilCek,
  simpan: StatusTersimpan | undefined,
  tl: { open: number; total: number } | undefined,
  koreksi: KoreksiAktif | undefined,
  paket: PaketRingkas | undefined,
): AntreanItem {
  const status = simpan?.status ?? STATUS_AWAL;
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
    status,
    versi: simpan?.versi ?? null,
    cek: {
      lolos: cek.lolos,
      gagal: cek.gagal,
      peringatan: cek.peringatan,
      total: cek.total,
      lengkap: cek.lengkap,
      masalah: ringkasMasalah(cek),
    },
    tl: tl ?? { open: 0, total: 0 },
    koding: { gagal: cekKoding.gagal, peringatan: cekKoding.peringatan, masalah: ringkasMasalah(cekKoding) },
    koreksi:
      koreksi && status === "KOREKSI_KODING"
        ? {
            perubahan: koreksi.usulan.perubahan.length,
            sisa: sisaPerubahan(setKlaim(s.fakta.koding), koreksi.usulan).size,
            sejak: koreksi.createdAt.toISOString(),
          }
        : null,
    paket: status === "LOLOS_KLAIM" || status === "FINAL" ? (paket ?? null) : null,
  };
}

function cocokCari(it: AntreanItem, q: string): boolean {
  if (/^\d+$/.test(q)) return it.norm === q || it.nopen.startsWith(q) || (it.sep?.includes(q) ?? false);
  const t = q.toLowerCase();
  return it.nama.toLowerCase().includes(t) || (it.sep?.toLowerCase().includes(t) ?? false);
}

const siapPeriksaUlang = (it: AntreanItem) => it.status === "TIDAK_LENGKAP" && it.tl.total > 0 && it.tl.open === 0;
const pekerjaanCoder = (it: AntreanItem) => STATUS_TAHAP2.includes(it.status);
const kodingBersih = (it: AntreanItem) => it.status === "LOLOS_RM" && it.koding.gagal === 0;
const gagalPada = (masalah: readonly MasalahRingkas[], key: string) => masalah.some((m) => m.key === key && m.status === "gagal");

function ringkas(items: readonly AntreanItem[]): AntreanRingkasan {
  const perStatus = Object.fromEntries(STATUS_VERIFIKASI.map((s) => [s, 0])) as Record<StatusVerifikasi, number>;
  const perKategori = Object.fromEntries(KATEGORI.map((k) => [k, 0])) as Record<Kategori, number>;
  const perAturan: Record<string, number> = {};
  const perAturanKoding: Record<string, number> = {};
  let lengkapOtomatis = 0;
  let siap = 0;
  let bersih = 0;
  for (const it of items) {
    perStatus[it.status]++;
    perKategori[it.kategori]++;
    for (const m of it.cek.masalah) if (m.status === "gagal") perAturan[m.key] = (perAturan[m.key] ?? 0) + 1;
    if (pekerjaanCoder(it)) {
      for (const m of it.koding.masalah) if (m.status === "gagal") perAturanKoding[m.key] = (perAturanKoding[m.key] ?? 0) + 1;
    }
    if (it.status === "BELUM_DIPERIKSA" && it.cek.lengkap) lengkapOtomatis++;
    if (siapPeriksaUlang(it)) siap++;
    if (kodingBersih(it)) bersih++;
  }
  return {
    total: items.length,
    perStatus,
    perKategori,
    perAturan,
    lengkapOtomatis,
    siapPeriksaUlang: siap,
    perAturanKoding,
    kodingBersih: bersih,
  };
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
    // Usulan koreksi yang ternyata sudah diterapkan di SIMRS → Lolos Klaim otomatis.
    await sinkronKoding(k.snapshots.map((snapshot) => ({ snapshot })));
  }

  const tersimpan = await findStatusByNopens(nopens);
  const tahap = (st: StatusVerifikasi[]) => nopens.filter((n) => st.includes(tersimpan.get(n)?.status ?? STATUS_AWAL));
  const [tl, koreksi, paket] = await Promise.all([
    hitungTindakLanjut(nopens),
    findKoreksiAktif(tahap(["KOREKSI_KODING"])),
    findPaketRingkas(tahap(["LOLOS_KLAIM", "FINAL"])),
  ]);
  const semua = k.snapshots
    .map((s) =>
      keItem(
        s,
        k.cek.get(s.nopen)!,
        k.koding.get(s.nopen)!,
        tersimpan.get(s.nopen),
        tl.get(s.nopen),
        koreksi.get(s.nopen),
        paket.get(s.nopen),
      ),
    )
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
  // Kunci aturan Tahap 2 → hanya berkas pekerjaan coder (sama dengan hitungan chip).
  const masalahKoding = !!input.masalah && !!getAturanKoding(input.masalah);
  const tersaring = dasar.filter(
    (it) =>
      (!input.status || it.status === input.status) &&
      (!input.masalah ||
        (masalahKoding
          ? pekerjaanCoder(it) && gagalPada(it.koding.masalah, input.masalah)
          : gagalPada(it.cek.masalah, input.masalah))) &&
      (!input.lengkap || it.cek.lengkap === (input.lengkap === "ya")) &&
      (!input.siap || siapPeriksaUlang(it)) &&
      (!input.koding || kodingBersih(it)),
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
  // SIMGOS (berurutan di dalam) ∥ reporthub — dua DB berbeda.
  const [segar, tersimpan] = await Promise.all([cekSegarBatch([nopen]), findStatusByNopens([nopen])]);
  const b = segar.get(nopen);
  if (!b) throw new NotFoundError("Episode (NOPEN) tidak ditemukan atau dibatalkan");
  return { ...b, simpan: tersimpan.get(nopen) };
}

/** Rakit detail dari berkas segar + data reporthub terkini (status, tindak lanjut, riwayat, koreksi). */
export async function bangunDetail(b: BerkasSegar): Promise<DetailKlaim> {
  const nopen = b.snapshot.nopen;
  // Bacaan reporthub saling lepas → paralel (aturan berurutan hanya untuk SIMGOS).
  const [tersimpan, koreksi, tindakLanjut, riwayat] = await Promise.all([
    findStatusByNopens([nopen]),
    findKoreksi(nopen),
    findTindakLanjut(nopen),
    findRiwayat(nopen),
  ]);
  const simpan = tersimpan.get(nopen);
  // Info ICD untuk kode SIMRS + kode di usulan (usulan bisa memuat kode yang belum ada di SIMRS).
  const icd = await petaIcd(
    kodeUntukIcd([setKlaim(b.snapshot.fakta.koding), ...koreksi.map((k) => setDariUsulan(k.usulan))]),
  );
  return {
    snapshot: b.snapshot,
    cek: b.cek,
    status: simpan?.status ?? STATUS_AWAL,
    versi: simpan?.versi ?? null,
    final: b.final,
    digabungKe: b.digabungKe,
    cekManual: cekManualUntuk(b.snapshot.kategori),
    tindakLanjut,
    riwayat,
    cekKoding: b.cekKoding,
    icd,
    koreksi,
  };
}

/**
 * Hasil cek SEGAR satu episode (dasar "Cek ulang dari SIMRS"), sekaligus
 * merekonsiliasi tindak lanjut & usulan koding-nya. Episode IGD yang digabung
 * ke RI tetap dievaluasi sebagai dirinya, dengan `digabungKe` menunjuk NOPEN RI.
 */
export async function getDetailKlaim(nopen: string): Promise<DetailKlaim> {
  const b = await muatBerkas(nopen);
  // Tanpa baris klaim_verifikasi → belum ada tindak lanjut / usulan (FK) → tak perlu rekonsiliasi.
  if (b.simpan) {
    await sinkronTindakLanjut([b]);
    // Usulan MENUNGGU_SIMRS hanya ada selama berkas berstatus KOREKSI_KODING.
    if (b.simpan.status === "KOREKSI_KODING") await sinkronKoding([b]);
  }
  return bangunDetail(b);
}

/** Aksi Tahap 1, 2 & paket yang boleh dilakukan pengguna pada berkas ini sekarang. */
export async function izinKlaim(user: SessionUser, d: Pick<DetailKlaim, "status" | "final" | "digabungKe">): Promise<IzinKlaim> {
  const sah = d.final && !d.digabungKe;
  const [rmUbah, coderUbah, coderLihat, paketLihat, paketBuat] = await Promise.all([
    can(user.role, MODUL_VERIFIKASI.RM, "update"),
    can(user.role, MODUL_VERIFIKASI.KLAIM, "update"),
    can(user.role, MODUL_VERIFIKASI.KLAIM, "view"),
    can(user.role, MODUL_VERIFIKASI.PAKET, "view"),
    can(user.role, MODUL_VERIFIKASI.PAKET, "create"),
  ]);
  const rm = sah && rmUbah;
  const coder = sah && coderUbah;
  const boleh = (izin: boolean, aksi: AksiVerifikasi) => izin && !!cariTransisi(d.status, aksi);
  return {
    loloskan: boleh(rm, "LOLOSKAN_RM"),
    tandai: boleh(rm, "TANDAI_TIDAK_LENGKAP"),
    ajukanKoreksi: boleh(coder, "AJUKAN_KOREKSI"),
    loloskanKlaim: boleh(coder, "LOLOSKAN_KLAIM"),
    kembalikan: boleh(coder, "KEMBALIKAN_KE_RM"),
    paket: sah && (paketLihat || coderLihat),
    kunciFinal: boleh(sah && paketBuat, "KUNCI_FINAL"),
    bukaKunci: boleh(coder, "BUKA_KUNCI"),
  };
}

export async function getRuangKerja(nopen: string, user: SessionUser): Promise<RuangKerjaKlaim> {
  const d = await getDetailKlaim(nopen);
  return { ...d, izin: await izinKlaim(user, d) };
}
