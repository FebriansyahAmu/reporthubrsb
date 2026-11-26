import "server-only";
import { createTtlCache } from "@/server/lib/ttl-cache";
import { nowWitaIso, todayWitaIso } from "@/server/modules/audit-rme/audit.constants";
import { getRuanganResolver } from "@/server/modules/audit-rme/audit.resolver";
import { ambilRencanaKontrolBpjs } from "./surat-kontrol.bpjs";
import { MAKS_HARI_KE_DEPAN } from "./surat-kontrol.constants";
import { tambahHari } from "./surat-kontrol.filter";
import { nilaiEpisode, selisihHari, tentukanWajib, urutkanPulang } from "./surat-kontrol.pulang";
import { CARA_PULANG, type LayananPulang } from "./surat-kontrol.pulang.constants";
import {
  queryCacheSuratPerNomor,
  queryCacheSuratPerSep,
  queryJadwalPerKunjungan,
  queryKunjunganRawatJalan,
  queryLokalSuratPerNomor,
  queryLokalSuratPerSep,
  queryPoliBpjsNama,
  queryPulangRawatInap,
  type CacheSuratRow,
  type EpisodeRow,
  type JadwalKunjunganRow,
  type LokalSuratRow,
} from "./surat-kontrol.pulang.dal";
import type { AuditTerbitPulang, EpisodePulang, SuratPulang } from "./surat-kontrol.pulang.types";
import { tentukanRentangPulang, type PulangQuery } from "./surat-kontrol.schema";
import { muatMaster, pesanGalat } from "./surat-kontrol.service";
import type { BpjsSurat, KodeNama } from "./surat-kontrol.types";

/**
 * Audit "Terbit saat pulang" (read-only): apakah Surat Kontrol pasien BPJS TERBIT
 * DI BPJS pada tanggal yang sama dengan tanggal pulang (RI) / kunjungan (RJ).
 *
 * Sumber tanggal terbit, berurutan:
 * 1. Webservice BPJS (live) — HANYA dipanggil bila ada surat yang tanggal
 *    terbitnya belum ada di cache, atau pengguna menekan "Segarkan dari BPJS".
 *    (Panggilan webservice menulis cache SIMGOS — perilaku plugin yang sudah
 *    disetujui; lihat surat-kontrol.bpjs.ts. Penilaian ini justru MENEKAN jumlah
 *    panggilan dibanding membaca BPJS setiap kali.)
 * 2. Cache SIMGOS `bpjs.monitoring_rencana_kontrol` (dibaca saja).
 * Penautan surat ↔ episode: SEP asal = SEP episode (`pendaftaran.penjamin.NOMOR`),
 * jadwal SIMRS (`jadwal_kontrol.KUNJUNGAN`), dan catatan lokal (`bpjs.rencana_kontrol`).
 */

/** Lebar jendela tanggal RENCANA saat melengkapi / menyegarkan dari BPJS (2 potongan VClaim). */
const JENDELA_LIVE_HARI = 60;

/** Jeda sebelum surat tanpa tanggal terbit dicari ulang di BPJS (memo lintas permintaan, per proses). */
const CELAH_JEDA_MS = 30 * 60_000;
const gCelah = globalThis as unknown as { __skPulangCelah?: Map<string, number> };
const celahDicoba = (gCelah.__skPulangCelah ??= new Map());

const poliCache = createTtlCache<Map<string, string | null>>("surat-kontrol-poli-bpjs", { ttlMs: 10 * 60_000, max: 1 });
/** Nama poli BPJS (kode → nama), cache 10 mnt. Dipakai juga audit "Kontrol = SEP". */
export const muatPoli = () =>
  poliCache.get("semua", async () => new Map((await queryPoliBpjsNama()).map((p) => [p.kode, p.nama]))).then((h) => h.value);

/** SEP sah (penjamin.NOMOR kosong untuk sebagian episode). */
const sepSah = (s: string | null): string | null => (s && s.length >= 10 ? s : null);

type Kandidat = {
  noSurat: string;
  sep: string | null;
  cache?: CacheSuratRow;
  lokal?: LokalSuratRow;
  jadwal?: JadwalKunjunganRow;
  live?: BpjsSurat;
};

/** Jendela tanggal rencana [a, b] untuk melengkapi surat tanpa tanggal terbit (dibatasi lebarnya). */
function jendelaCelah(rencana: string[], hariIni: string): [string, string] | null {
  if (rencana.length === 0) return null;
  const urut = [...rencana].sort();
  let b = urut[urut.length - 1];
  const batasDepan = tambahHari(hariIni, MAKS_HARI_KE_DEPAN);
  if (b > batasDepan) b = batasDepan;
  let a = urut[0];
  if (a > b) a = b;
  if (selisihHari(b, a) > JENDELA_LIVE_HARI - 1) a = tambahHari(b, -(JENDELA_LIVE_HARI - 1));
  return [a, b];
}

const dalam = (t: string | null, [a, b]: [string, string]) => !!t && t >= a && t <= b;

export async function getAuditTerbitPulang(q: PulangQuery, now: Date = new Date()): Promise<AuditTerbitPulang> {
  const hariIni = todayWitaIso(now);
  const { from, to } = tentukanRentangPulang(q, hariIni);
  const toEks = tambahHari(to, 1);

  // 1) Episode pulang BPJS (SELECT saja; berurutan → maks. satu koneksi per langkah).
  const ri = await queryPulangRawatInap(from, toEks);
  const rj = await queryKunjunganRawatJalan(from, toEks);
  const rows: { r: EpisodeRow; layanan: LayananPulang }[] = [
    ...ri.map((r) => ({ r, layanan: "RI" as const })),
    ...rj.map((r) => ({ r, layanan: "RJ" as const })),
  ];
  const seps = [...new Set(rows.map(({ r }) => sepSah(r.sep)).filter((s): s is string => !!s))];

  // 2) Surat tertaut: cache BPJS per SEP, jadwal SIMRS per kunjungan, catatan lokal per SEP.
  const kandidat = new Map<string, Kandidat>();
  const ambilK = (no: string, sep: string | null) => {
    let k = kandidat.get(no);
    if (!k) kandidat.set(no, (k = { noSurat: no, sep }));
    else k.sep ??= sep;
    return k;
  };
  for (const c of await queryCacheSuratPerSep(seps)) ambilK(c.noSurat, c.sep).cache = c;
  const jadwal = await queryJadwalPerKunjungan(rows.map(({ r }) => r.kunjungan));
  for (const l of await queryLokalSuratPerSep(seps)) ambilK(l.noSurat, l.sep).lokal = l;
  for (const j of jadwal) if (j.referensi) ambilK(j.referensi, null).jadwal = j;
  // Surat yang hanya dikenal lewat jadwal/lokal → cari pula di cache & catatan lokal per nomor.
  const tanpaCache = [...kandidat.values()].filter((k) => !k.cache).map((k) => k.noSurat);
  for (const c of await queryCacheSuratPerNomor(tanpaCache)) {
    const k = kandidat.get(c.noSurat);
    if (k) {
      k.cache = c;
      k.sep ??= c.sep;
    }
  }
  const tanpaLokal = [...kandidat.values()].filter((k) => !k.lokal).map((k) => k.noSurat);
  for (const l of await queryLokalSuratPerNomor(tanpaLokal)) {
    const k = kandidat.get(l.noSurat);
    if (k) {
      k.lokal = l;
      k.sep ??= l.sep;
    }
  }

  // 3) Webservice BPJS — hanya bila perlu (celah tanggal terbit) atau diminta (segarkan).
  const jendela: [string, string][] = [];
  if (q.segar === "1") {
    const b = tambahHari(to, JENDELA_LIVE_HARI - (selisihHari(to, from) + 1));
    jendela.push([from, b > tambahHari(hariIni, MAKS_HARI_KE_DEPAN) ? tambahHari(hariIni, MAKS_HARI_KE_DEPAN) : b]);
  }
  const rencanaK = (k: Kandidat) => k.cache?.tglRencana ?? k.lokal?.tglRencana ?? k.jadwal?.tanggal ?? null;
  // Surat tanpa tanggal terbit yang sudah dicari di BPJS < 30 mnt lalu tidak memicu panggilan lagi
  // (mis. surat yang dihapus langsung di VClaim tak pernah muncul) — kecuali pengguna menekan "Segarkan".
  const sekarangMs = now.getTime();
  const kCelah = [...kandidat.values()].filter(
    (k) => !k.cache?.tglTerbit && k.lokal?.aktif !== false && (q.segar === "1" || sekarangMs - (celahDicoba.get(k.noSurat) ?? 0) > CELAH_JEDA_MS),
  );
  const celah = kCelah.map(rencanaK).filter((t): t is string => !!t && !jendela.some((w) => dalam(t, w)));
  const jc = jendelaCelah(celah, hariIni);
  if (jc) jendela.push(jc);
  if (celahDicoba.size > 5_000) celahDicoba.clear();
  for (const k of kCelah) celahDicoba.set(k.noSurat, sekarangMs);

  let galatBpjs: string | null = null;
  const sepSet = new Set(seps);
  for (const [a, b] of jendela) {
    try {
      const r = await ambilRencanaKontrolBpjs(a, b, { segar: q.segar === "1" });
      for (const s of r.data) {
        if (s.jenis !== 2) continue;
        const k = kandidat.get(s.noSurat) ?? (s.sepAsal && sepSet.has(s.sepAsal) ? ambilK(s.noSurat, s.sepAsal) : null);
        if (k) {
          k.live = s;
          k.sep ??= s.sepAsal;
        }
      }
    } catch (e) {
      console.warn("[surat-kontrol/pulang] webservice BPJS gagal, memakai cache SIMGOS:", e instanceof Error ? e.name : "galat");
      galatBpjs = pesanGalat(e);
      break;
    }
  }

  // 4) Susun & nilai episode.
  const [master, poliNama, ruangan] = await Promise.all([muatMaster(), muatPoli(), getRuanganResolver()]);
  const poliKN = (kode: string | null): KodeNama | null => (kode && kode !== "-" ? { kode, nama: poliNama.get(kode) ?? null } : null);
  const keSurat = (k: Kandidat): SuratPulang => {
    const tglTerbit = k.live?.tglTerbit ?? k.cache?.tglTerbit ?? null;
    const kodeDokter = k.cache?.kodeDokter ?? k.lokal?.kodeDokter ?? null;
    return {
      noSurat: k.noSurat,
      tglTerbit,
      tglRencana: k.live?.tglRencana ?? rencanaK(k),
      asalTerbit: k.live?.tglTerbit ? "LIVE" : k.cache?.tglTerbit ? "CACHE" : null,
      poliTujuan: k.live?.poliTujuan ?? poliKN(k.cache?.poli ?? k.lokal?.poli ?? null),
      dokter: k.live?.dokter ?? (kodeDokter || k.cache?.namaDokter ? { kode: kodeDokter ?? "", nama: k.cache?.namaDokter ?? null } : null),
      sepTerbit: k.live?.sepTerbit ?? null,
      // Hanya catatan lokal yang tegas menandai surat dihapus.
      aktif: k.lokal ? k.lokal.aktif : true,
      jadwal: k.jadwal ? { tanggal: k.jadwal.tanggal, jam: k.jadwal.jam, aktif: k.jadwal.aktif } : null,
    };
  };
  const perSep = new Map<string, SuratPulang[]>();
  const perKunjungan = new Map<string, SuratPulang[]>();
  const tambah = (m: Map<string, SuratPulang[]>, key: string, s: SuratPulang) => {
    const l = m.get(key);
    if (l) l.push(s);
    else m.set(key, [s]);
  };
  for (const k of kandidat.values()) {
    const s = keSurat(k);
    if (k.sep) tambah(perSep, k.sep, s);
    if (k.jadwal) tambah(perKunjungan, k.jadwal.kunjungan, s);
  }
  const jadwalPerKunjungan = new Map(jadwal.map((j) => [j.kunjungan, j]));

  const episode: EpisodePulang[] = rows.map(({ r, layanan }) => {
    const sep = sepSah(r.sep);
    const surat = new Map<string, SuratPulang>();
    for (const s of [...(sep ? (perSep.get(sep) ?? []) : []), ...(perKunjungan.get(r.kunjungan) ?? [])]) surat.set(s.noSurat, s);
    const j = jadwalPerKunjungan.get(r.kunjungan);
    const { wajib, alasan: alasanTidakWajib } = tentukanWajib(layanan, r);
    return nilaiEpisode(
      {
        key: `${layanan}-${r.kunjungan}`,
        layanan,
        nopen: r.nopen,
        kunjungan: r.kunjungan,
        norm: r.norm,
        pasien: r.nama,
        sep,
        tglPulang: r.tanggal,
        jamPulang: r.jam,
        ruangan: r.ruanganId ? { id: r.ruanganId, nama: ruangan.map.get(r.ruanganId)?.nama ?? r.ruanganId } : null,
        dokter: r.dokterId ? (master.dokter.get(r.dokterId) ?? `Dokter #${r.dokterId}`) : null,
        cara: r.cara,
        caraLabel: r.cara != null ? (CARA_PULANG[r.cara] ?? `Cara keluar #${r.cara}`) : null,
        wajib,
        alasanTidakWajib,
        kontrolPascaRi: layanan === "RJ" && r.pascaRi ? { suratDipakai: r.suratDipakai, sepRawatInap: r.sepAsalSurat } : null,
        surat: [...surat.values()],
        jadwalTanpaSurat: j && j.aktif && !j.referensi ? { tanggal: j.tanggal, jam: j.jam } : null,
      },
      hariIni,
    );
  });

  const semuaSurat = [...kandidat.values()].map(keSurat).filter((s) => s.aktif);
  return {
    rentang: { from, to },
    hariIni,
    disusun: nowWitaIso(now),
    asal: {
      live: semuaSurat.filter((s) => s.asalTerbit === "LIVE").length,
      cache: semuaSurat.filter((s) => s.asalTerbit === "CACHE").length,
      belum: semuaSurat.filter((s) => !s.asalTerbit).length,
    },
    bpjsDipanggil: jendela.length > 0,
    galatBpjs,
    episode: urutkanPulang(episode),
  };
}
