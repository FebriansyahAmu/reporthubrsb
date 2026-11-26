import "server-only";
import { nowWitaIso, todayWitaIso } from "@/server/modules/audit-rme/audit.constants";
import { getRuanganResolver } from "@/server/modules/audit-rme/audit.resolver";
import { ambilRencanaKontrolBpjs } from "./surat-kontrol.bpjs";
import type { JenisKontrol } from "./surat-kontrol.constants";
import { tambahHari } from "./surat-kontrol.filter";
import { selisihHari } from "./surat-kontrol.pulang";
import type { AsalTerbit } from "./surat-kontrol.pulang.types";
import { muatPoli } from "./surat-kontrol.pulang.service";
import { layananJenis, nilaiStatusSep, urutkanSep } from "./surat-kontrol.sep";
import type { LayananSep } from "./surat-kontrol.sep.constants";
import {
  queryCacheSuratPerNomor,
  queryCacheSuratPerRencana,
  queryLokalPerNomor,
  queryPasienPerSep,
  querySepAsal,
  querySepPerSurat,
  querySepRentang,
  type CacheSuratSepRow,
  type SepPakaiRow,
} from "./surat-kontrol.sep.dal";
import type { AsalSurat, AuditKontrolSep, RekapSep, SepKontrol } from "./surat-kontrol.sep.types";
import { tentukanRentangPulang, type SepQuery } from "./surat-kontrol.schema";
import { pesanGalat } from "./surat-kontrol.service";
import type { BpjsSurat, KodeNama } from "./surat-kontrol.types";

/**
 * Audit "Kontrol = SEP" (read-only terhadap SIMGOS).
 *
 * Populasi = SEMUA surat (Surat Kontrol & SPRI) dari webservice BPJS
 * `plugins/bpjs/rencanaKontrol` untuk rentang TANGGAL RENCANA — sama dengan daftar
 * Monitoring Rencana Kontrol VClaim. Klien webservice yang sama dengan tab
 * BPJS ↔ SIMRS (cache 5 mnt, maks. 2 panggilan bersamaan, segar ≥ 30 dtk);
 * panggilan menulis cache SIMGOS `bpjs.monitoring_rencana_kontrol` — perilaku
 * plugin yang sudah disetujui (lihat surat-kontrol.bpjs.ts). Bila webservice
 * gagal, daftar diambil dari cache itu (hanya surat yang pernah diambil).
 *
 * Tiap surat ditautkan ke SEP pemakainya (`bpjs.kunjungan.noSuratSKDP`, tidak
 * batal; > 1 SEP → yang pertama) lalu tanggal entri surat dibandingkan dengan
 * tanggal SEP.
 */

type SuratMentah = {
  noSurat: string;
  jenis: JenisKontrol;
  tglRencana: string;
  tglTerbit: string | null;
  asalTerbit: AsalTerbit | null;
  /** Surat Kontrol: SEP asal. SPRI: SEP rawat inap PEMAKAINYA (tidak dipakai sebagai asal). */
  sepAsal: string | null;
  tglSepAsal: string | null;
  jnsPelayanan: string | null;
  poliTujuan: KodeNama | null;
  poliKode: string | null;
  dokter: KodeNama | null;
  noKartu: string | null;
  nama: string | null;
  sepTerbit: boolean | null;
};

const sebagaiJenis = (n: number | null | undefined): JenisKontrol | null => (n === 1 || n === 2 ? n : null);
const sebagaiLayanan = (n: number | null | undefined): LayananSep | null => (n === 1 ? "RI" : n === 2 ? "RJ" : null);
const layananTeks = (t: string | null | undefined): LayananSep | null => (t === "Rawat Inap" ? "RI" : t === "Rawat Jalan" ? "RJ" : null);

const dariLive = (s: BpjsSurat): SuratMentah => ({
  noSurat: s.noSurat,
  jenis: s.jenis,
  tglRencana: s.tglRencana,
  tglTerbit: s.tglTerbit,
  asalTerbit: s.tglTerbit ? "LIVE" : null,
  sepAsal: s.sepAsal,
  tglSepAsal: s.tglSep,
  jnsPelayanan: s.jnsPelayanan,
  poliTujuan: s.poliTujuan,
  poliKode: null,
  dokter: s.dokter,
  noKartu: s.noKartu,
  nama: s.nama,
  sepTerbit: s.sepTerbit,
});

const dariCache = (c: CacheSuratSepRow): SuratMentah | null => {
  const jenis = sebagaiJenis(c.jenis);
  if (!jenis || !c.tglRencana) return null;
  return {
    noSurat: c.noSurat,
    jenis,
    tglRencana: c.tglRencana,
    tglTerbit: c.tglTerbit,
    asalTerbit: c.tglTerbit ? "CACHE" : null,
    sepAsal: c.sepAsal,
    tglSepAsal: null,
    jnsPelayanan: c.jnsPelayanan,
    poliTujuan: null,
    poliKode: c.poliTujuan,
    dokter: c.kodeDokter || c.namaDokter ? { kode: c.kodeDokter ?? "", nama: c.namaDokter } : null,
    noKartu: c.noKartu,
    nama: c.nama,
    // Kolom cache `terbitSEP` tidak terisi (selalu tanggal nol) → tak diketahui.
    sepTerbit: null,
  };
};

export async function getAuditKontrolSep(q: SepQuery, now: Date = new Date()): Promise<AuditKontrolSep> {
  const hariIni = todayWitaIso(now);
  const { from, to } = tentukanRentangPulang(q, hariIni);

  // 1) Daftar surat: webservice BPJS (live) → cadangan cache SIMGOS.
  let surat: SuratMentah[];
  let dariBpjs = true;
  let galatBpjs: string | null = null;
  try {
    surat = (await ambilRencanaKontrolBpjs(from, to, { segar: q.segar === "1" })).data.map(dariLive);
  } catch (e) {
    console.warn("[surat-kontrol/sep] webservice BPJS gagal, memakai cache SIMGOS:", e instanceof Error ? e.name : "galat");
    galatBpjs = pesanGalat(e);
    dariBpjs = false;
    surat = (await queryCacheSuratPerRencana(from, tambahHari(to, 1))).flatMap((c) => dariCache(c) ?? []);
  }
  const nos = surat.map((s) => s.noSurat);

  // 2) Tanggal entri yang kosong di respons live → lengkapi dari cache.
  const tanpaTerbit = surat.filter((s) => !s.tglTerbit).map((s) => s.noSurat);
  if (tanpaTerbit.length) {
    const perNo = new Map((await queryCacheSuratPerNomor(tanpaTerbit)).map((c) => [c.noSurat, c]));
    for (const s of surat) {
      const c = !s.tglTerbit ? perNo.get(s.noSurat) : undefined;
      if (c?.tglTerbit) {
        s.tglTerbit = c.tglTerbit;
        s.asalTerbit = "CACHE";
      }
    }
  }

  // 3) SEP pemakai (pertama bila > 1) & catatan lokal.
  const sepPer = new Map<string, SepPakaiRow[]>();
  for (const r of await querySepPerSurat(nos)) {
    const l = sepPer.get(r.noSurat);
    if (l) l.push(r);
    else sepPer.set(r.noSurat, [r]);
  }
  // 3b) Basis rekap audit BPJS: SEP dengan TANGGAL SEP di rentang. Suratnya bisa bertanggal
  //     rencana di luar rentang → SEP & jenis/tanggal entrinya dilengkapi (SELECT, cache).
  const sepRentang = await querySepRentang(from, tambahHari(to, 1));
  const suratPer = new Map(surat.map((s) => [s.noSurat, s]));
  const luar = [...new Set(sepRentang.map((x) => x.noSurat).filter((n) => !suratPer.has(n)))];
  const cacheLuar = new Map<string, CacheSuratSepRow>();
  if (luar.length) {
    for (const c of await queryCacheSuratPerNomor(luar)) cacheLuar.set(c.noSurat, c);
    for (const r of await querySepPerSurat(luar)) {
      const l = sepPer.get(r.noSurat);
      if (l) l.push(r);
      else sepPer.set(r.noSurat, [r]);
    }
  }
  for (const l of sepPer.values()) l.sort((a, b) => a.tglSep.localeCompare(b.tglSep) || (a.jamSep ?? "").localeCompare(b.jamSep ?? "") || a.sep.localeCompare(b.sep));
  const lokalPer = new Map((await queryLokalPerNomor(nos)).map((l) => [l.noSurat, l]));

  // 4) SEP asal Surat Kontrol (+ pasien untuk surat yang belum dipakai).
  const noAsal = (s: SuratMentah) => (s.jenis === 2 ? (s.sepAsal ?? lokalPer.get(s.noSurat)?.nomor ?? null) : null);
  const kartu = (s: SuratMentah) => s.noKartu ?? sepPer.get(s.noSurat)?.[0]?.noKartu ?? null;
  const asalRows = await querySepAsal(
    surat.flatMap((s) => {
      const a = noAsal(s);
      const k = kartu(s);
      return a && k ? [{ noKartu: k, sep: a }] : [];
    }),
  );
  const asalPer = new Map(asalRows.map((a) => [`${a.noKartu}|${a.sep}`, a]));
  const pasienAsal = new Map(
    (await queryPasienPerSep(surat.filter((s) => !sepPer.has(s.noSurat)).flatMap((s) => noAsal(s) ?? []))).map((p) => [p.sep, p]),
  );

  // 5) Susun & nilai.
  const [poliNama, ruangan] = await Promise.all([muatPoli(), getRuanganResolver()]);
  const poliKN = (kode: string | null): KodeNama | null => (kode && kode !== "-" ? { kode, nama: poliNama.get(kode) ?? null } : null);
  let nLive = 0;
  let nCache = 0;
  let nBelum = 0;

  const baris: SepKontrol[] = surat.map((s) => {
    const daftarSep = sepPer.get(s.noSurat) ?? [];
    const p = daftarSep[0] ?? null;
    const lokal = lokalPer.get(s.noSurat);
    if (s.asalTerbit === "LIVE") nLive++;
    else if (s.asalTerbit === "CACHE") nCache++;
    else nBelum++;

    const a0 = noAsal(s);
    const k0 = kartu(s);
    const a = a0 && k0 ? asalPer.get(`${k0}|${a0}`) : undefined;
    const layananAsal = a ? sebagaiLayanan(a.jenisPelayanan) : layananTeks(s.jnsPelayanan);
    const asal: AsalSurat | null = a0
      ? { sep: a0, layanan: layananAsal, tglSep: a?.tglSep ?? s.tglSepAsal, tglPulang: layananAsal === "RI" ? (a?.tglPulang ?? null) : null }
      : null;
    const pa = !p && a0 ? pasienAsal.get(a0) : undefined;
    const { status, selisihHari: sel } = nilaiStatusSep(s.tglTerbit, p?.tglSep ?? null, s.sepTerbit);

    return {
      key: s.noSurat,
      surat: {
        noSurat: s.noSurat,
        jenis: s.jenis,
        tglTerbit: s.tglTerbit,
        asalTerbit: s.asalTerbit,
        tglRencana: s.tglRencana,
        poliTujuan: s.poliTujuan ?? poliKN(s.poliKode),
        dokter: s.dokter,
        sepTerbitBpjs: s.sepTerbit,
        pembuat: lokal?.pembuat ?? null,
        aktif: lokal ? lokal.aktif : true,
      },
      layanan: p ? (sebagaiLayanan(p.jenisPelayanan) ?? layananJenis(s.jenis)) : layananJenis(s.jenis),
      noKartu: k0,
      nopen: p?.nopen ?? null,
      norm: p?.norm ?? pa?.norm ?? null,
      pasien: p?.nama ?? pa?.nama ?? s.nama,
      sep: p
        ? {
            sep: p.sep,
            tglSep: p.tglSep,
            jamSep: p.jamSep,
            layanan: sebagaiLayanan(p.jenisPelayanan) ?? layananJenis(s.jenis),
            ruangan: p.ruanganId ? { id: p.ruanganId, nama: ruangan.map.get(p.ruanganId)?.nama ?? p.ruanganId } : null,
            poliSep: poliKN(p.poliSep),
            pembuatSep: p.pembuatSep,
            jumlahSep: daftarSep.length,
          }
        : null,
      asal,
      selisihHari: sel,
      hariSejakPulangAsal: p && asal?.tglPulang ? selisihHari(p.tglSep, asal.tglPulang) : null,
      status,
    };
  });

  // 6) Rekap format audit BPJS (satu baris per SEP di rentang tanggal SEP; tanpa data pasien).
  const sepIndex = new Map<string, SepPakaiRow>();
  for (const l of sepPer.values()) for (const r of l) sepIndex.set(r.sep, r);
  const namaRuang = (p: SepPakaiRow) =>
    p.ruanganId ? (ruangan.map.get(p.ruanganId)?.nama ?? p.ruanganId) : (poliKN(p.poliSep)?.nama ?? p.poliSep ?? "Tanpa ruangan");
  const rekap: RekapSep[] = sepRentang.flatMap((x) => {
    const p = sepIndex.get(x.sep);
    if (!p) return [];
    const sl = suratPer.get(x.noSurat);
    const c = sl ? undefined : cacheLuar.get(x.noSurat);
    const layanan = sebagaiLayanan(p.jenisPelayanan) ?? "RJ";
    const jenis = sl?.jenis ?? sebagaiJenis(c?.jenis) ?? (layanan === "RI" ? 1 : 2);
    const { status } = nilaiStatusSep(sl ? sl.tglTerbit : (c?.tglTerbit ?? null), p.tglSep);
    return [{ tglSep: p.tglSep, jenis, status, layanan, ruangan: namaRuang(p) }];
  });

  return {
    rentang: { from, to },
    hariIni,
    disusun: nowWitaIso(now),
    dariBpjs,
    asal: { live: nLive, cache: nCache, belum: nBelum },
    galatBpjs,
    baris: urutkanSep(baris),
    rekap,
  };
}
