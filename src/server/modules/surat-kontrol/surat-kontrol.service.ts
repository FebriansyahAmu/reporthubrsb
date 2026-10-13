import "server-only";
import { createTtlCache } from "@/server/lib/ttl-cache";
import { nowWitaIso, todayWitaIso } from "@/server/modules/audit-rme/audit.constants";
import { getRuanganResolver, getUserResolver } from "@/server/modules/audit-rme/audit.resolver";
import { auditSuratKontrol } from "./surat-kontrol.audit";
import { ambilRencanaKontrolBpjs } from "./surat-kontrol.bpjs";
import type { JenisKontrol, SumberBpjs } from "./surat-kontrol.constants";
import {
  queryDokterMaster,
  queryJadwalPerReferensi,
  queryJadwalRentang,
  queryKunjunganInfo,
  queryPoliBpjsPerRuangan,
  queryRencanaLokal,
  queryRencanaLokalRentang,
  querySpriPerReferensi,
  type JadwalRow,
  type RencanaLokalRow,
} from "./surat-kontrol.dal";
import { urutkanBaris } from "./surat-kontrol.filter";
import { tentukanRentang, type SuratKontrolQuery } from "./surat-kontrol.schema";
import type { AuditSuratKontrol, BpjsSurat, LokalSurat, SimrsJadwal } from "./surat-kontrol.types";

/**
 * Audit Surat Kontrol (read-only): surat BPJS (webservice, real-time) ↔ jadwal
 * SIMRS ↔ catatan lokal. Data seluruh rentang dikirim sekali; penyaringan,
 * pencarian & paginasi dilakukan di klien (instan, tanpa memanggil BPJS ulang).
 */

const JENIS_KUNJUNGAN_LABEL: Record<number, string> = { 1: "Rawat Jalan", 2: "IGD", 3: "Rawat Inap" };

type Master = { dokter: Map<number, string | null>; poli: Map<string, string> };
const masterCache = createTtlCache<Master>("surat-kontrol-master", { ttlMs: 10 * 60_000, max: 1 });
const muatMaster = () =>
  masterCache
    .get("semua", async () => {
      const dokter = await queryDokterMaster();
      const poli = await queryPoliBpjsPerRuangan();
      return { dokter: new Map(dokter.map((d) => [d.id, d.nama])), poli: new Map(poli.map((p) => [p.ruangan, p.poli])) };
    })
    .then((h) => h.value);

const keLokal = (r: RencanaLokalRow): LokalSurat => ({
  tglRencana: r.tglRencana,
  aktif: r.status === 1,
  kodeDokter: r.kodeDokter,
  poli: r.poli,
  petugas: r.petugas,
});

/** Pesan galat webservice yang aman ditampilkan (tanpa detail internal). */
function pesanGalat(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "TimeoutError" || e.name === "AbortError") return "Webservice BPJS tidak merespons dalam 30 detik.";
    if (/^(Webservice|BPJS)/.test(e.message)) return e.message;
  }
  return "Webservice BPJS tidak dapat dihubungi.";
}

export async function getAuditSuratKontrol(q: SuratKontrolQuery, now: Date = new Date()): Promise<AuditSuratKontrol> {
  const hariIni = todayWitaIso(now);
  const { from, to } = tentukanRentang(q, hariIni);
  const jenis: JenisKontrol | null = q.jenis === "semua" ? null : (Number(q.jenis) as JenisKontrol);

  // 1) Surat BPJS — webservice (sumber utama), cadangan catatan lokal bila gagal.
  let sumber: SumberBpjs = "LIVE";
  let galatBpjs: string | null = null;
  let diambil = nowWitaIso(now);
  let dariCache = false;
  let bpjs: BpjsSurat[];
  try {
    const r = await ambilRencanaKontrolBpjs(from, to, { segar: q.segar === "1" });
    bpjs = r.data;
    diambil = nowWitaIso(new Date(r.diambil));
    dariCache = r.dariCache;
  } catch (e) {
    console.warn("[surat-kontrol] webservice BPJS gagal, memakai catatan lokal:", e instanceof Error ? e.name : "galat");
    sumber = "LOKAL";
    galatBpjs = pesanGalat(e);
    bpjs = (await queryRencanaLokalRentang(from, to)).flatMap((r): BpjsSurat[] =>
      r.jenis === 1 || r.jenis === 2
        ? [
            {
              noSurat: r.noSurat,
              jenis: r.jenis as JenisKontrol,
              jnsPelayanan: null,
              tglRencana: r.tglRencana,
              tglTerbit: null,
              sepAsal: r.jenis === 2 ? r.nomor : null,
              tglSep: null,
              poliAsal: null,
              poliTujuan: r.poli && r.poli !== "-" ? { kode: r.poli, nama: r.poliNama } : null,
              dokter: r.kodeDokter ? { kode: r.kodeDokter, nama: null } : null,
              noKartu: r.noKartu,
              nama: r.nama,
              sepTerbit: null,
            },
          ]
        : [],
    );
  }
  const bpjsDiaudit = jenis === null ? bpjs : bpjs.filter((s) => s.jenis === jenis);

  // 2) SIMRS & catatan lokal (SELECT saja; berurutan → maks. satu koneksi per langkah).
  const refKontrol = bpjsDiaudit.filter((s) => s.jenis === 2).map((s) => s.noSurat);
  const refSpri = bpjsDiaudit.filter((s) => s.jenis === 1).map((s) => s.noSurat);
  const jadwalRef = await queryJadwalPerReferensi(refKontrol);
  const spriRef = await querySpriPerReferensi(refSpri);
  const jadwalRentang = jenis === 1 ? [] : await queryJadwalRentang(from, to);
  const refYatim = jadwalRentang.map((j) => j.referensi).filter((r): r is string => !!r);
  const lokalRows = await queryRencanaLokal([...bpjsDiaudit.map((s) => s.noSurat), ...refYatim]);
  const semuaJadwal = [...jadwalRef, ...spriRef, ...jadwalRentang];
  const info = await queryKunjunganInfo(semuaJadwal.map((j) => j.kunjungan).filter((k): k is string => !!k));

  const [master, ruangan, pengguna] = await Promise.all([muatMaster(), getRuanganResolver(), getUserResolver()]);
  const infoMap = new Map(info.map((k) => [k.nomor, k]));
  const keSimrs = (j: JadwalRow): SimrsJadwal => {
    const k = j.kunjungan ? infoMap.get(j.kunjungan) : undefined;
    const ru = j.ruanganId ? ruangan.map.get(j.ruanganId) : undefined;
    return {
      sumber: j.sumber,
      id: j.id,
      nomor: j.nomor,
      referensi: j.referensi,
      tanggal: j.tanggal,
      jam: j.jam,
      aktif: j.status === 1,
      sudahDigunakan: j.sudahDigunakan,
      ruangan: j.ruanganId ? { id: j.ruanganId, nama: ru?.nama ?? j.ruanganId } : null,
      poliBpjs: j.ruanganId ? (master.poli.get(j.ruanganId) ?? null) : null,
      dokterId: j.dokterId,
      dokter: j.dokterId != null ? (master.dokter.get(j.dokterId) ?? `Dokter #${j.dokterId}`) : null,
      dibuat: j.dibuat,
      oleh: j.olehId ? (pengguna.map.get(j.olehId)?.nama ?? `Pengguna #${j.olehId}`) : null,
      kunjungan: k
        ? {
            nomor: k.nomor,
            nopen: k.nopen,
            norm: k.norm,
            ruangan: k.ruanganId ? (ruangan.map.get(k.ruanganId)?.nama ?? k.ruanganId) : null,
            jenis: k.jenis != null ? (JENIS_KUNJUNGAN_LABEL[k.jenis] ?? null) : null,
            bpjs: k.penjamin == null ? null : k.penjamin === 2,
          }
        : null,
      pasien: k?.nama ?? null,
    };
  };
  const kelompok = (rows: JadwalRow[]) => {
    const m = new Map<string, SimrsJadwal[]>();
    for (const r of rows) {
      if (!r.referensi) continue;
      const list = m.get(r.referensi);
      if (list) list.push(keSimrs(r));
      else m.set(r.referensi, [keSimrs(r)]);
    }
    return m;
  };

  const hasil = auditSuratKontrol({
    from,
    to,
    hariIni,
    sumber,
    jenis,
    bpjs: bpjsDiaudit,
    jadwalPerRef: kelompok(jadwalRef),
    spriPerRef: kelompok(spriRef),
    jadwalRentang: jadwalRentang.map(keSimrs),
    lokal: new Map(lokalRows.map((r) => [r.noSurat, keLokal(r)])),
  });

  return {
    rentang: { from, to },
    hariIni,
    sumber,
    diambil,
    dariCache,
    galatBpjs,
    baris: urutkanBaris(hasil.baris),
    slot: hasil.slot,
    nonBpjsDilewati: hasil.nonBpjsDilewati,
  };
}
