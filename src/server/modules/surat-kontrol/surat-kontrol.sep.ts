/**
 * Penilaian & ringkasan "Kontrol = SEP" — FUNGSI MURNI, dipakai server
 * (layanan & ekspor) DAN klien (saringan instan) agar isi berkas = layar.
 * Satu baris = satu surat BPJS (daftar rencana kontrol VClaim).
 */
import type { JenisKontrol } from "./surat-kontrol.constants";
import { tambahHari } from "./surat-kontrol.filter";
import { selisihHari } from "./surat-kontrol.pulang";
import { STATUS_SEP_GRAFIK, STATUS_SEP_KEYS, STATUS_SEP_TERBACA, type LayananSep, type StatusSep } from "./surat-kontrol.sep.constants";
import type { RekapSep, SepKontrol } from "./surat-kontrol.sep.types";

/**
 * Status dari tanggal entri surat vs tanggal SEP pemakainya. Tanpa SEP:
 * "SEP tak tercatat" bila BPJS menandai surat sudah dipakai (`terbitSEP`),
 * selain itu "Belum dipakai SEP".
 */
export function nilaiStatusSep(
  tglTerbit: string | null,
  tglSep: string | null,
  sepTerbitBpjs: boolean | null = null,
): { status: StatusSep; selisihHari: number | null } {
  if (!tglSep) return { status: sepTerbitBpjs === true ? "SEP_TAK_TERCATAT" : "BELUM_DIPAKAI", selisihHari: null };
  if (!tglTerbit) return { status: "TAK_TERBACA", selisihHari: null };
  const d = selisihHari(tglTerbit, tglSep);
  return { status: d === 0 ? "SAMA_HARI" : d > 0 ? "SETELAH_SEP" : "SEBELUM_SEP", selisihHari: d };
}

/** Layanan SEP yang diharapkan dari jenis surat (SPRI → rawat inap, Surat Kontrol → rawat jalan). */
export const layananJenis = (jenis: JenisKontrol): LayananSep => (jenis === 1 ? "RI" : "RJ");

export type FilterSep = {
  /** Sertakan SPRI (bawaan: hanya Surat Kontrol). */
  spri?: boolean;
  /** Satu jenis surat saja (bermakna bila SPRI disertakan). */
  jenis?: JenisKontrol;
  status?: StatusSep;
  /** Nama ruangan / poli tampilan (`namaRuanganSep`). */
  ruangan?: string;
  /** Satu tanggal rencana (klik grafik). */
  tanggal?: string;
  /** Cari: nama, RM, NOPEN, no. kartu, SEP, nomor surat, SEP asal, dokter, ruangan, petugas. */
  q?: string;
};

/** Ruangan/poli SEP pemakai; surat yang belum dipakai → poli tujuan surat. */
export const namaRuanganSep = (e: Pick<SepKontrol, "sep" | "surat">) =>
  e.sep?.ruangan?.nama ?? e.sep?.poliSep?.nama ?? e.sep?.poliSep?.kode ?? e.surat.poliTujuan?.nama ?? e.surat.poliTujuan?.kode ?? "Tanpa ruangan";

const norm = (s: string) => s.toLocaleLowerCase("id-ID").normalize("NFKD").replace(/[̀-ͯ]/g, "");

export function cocokCariSep(e: SepKontrol, q: string): boolean {
  const k = norm(q.trim());
  if (!k) return true;
  const ladang = [
    e.pasien,
    e.norm,
    e.nopen,
    e.noKartu,
    e.sep?.sep,
    e.surat.noSurat,
    e.asal?.sep,
    e.surat.dokter?.nama,
    namaRuanganSep(e),
    e.surat.pembuat,
    e.sep?.pembuatSep,
  ];
  return ladang.some((v) => !!v && norm(v).includes(k));
}

export function saringSep(rows: readonly SepKontrol[], f: FilterSep): SepKontrol[] {
  return rows.filter(
    (e) =>
      (f.spri || e.surat.jenis === 2) &&
      (!f.jenis || e.surat.jenis === f.jenis) &&
      (!f.status || e.status === f.status) &&
      (!f.ruangan || namaRuanganSep(e) === f.ruangan) &&
      (!f.tanggal || e.surat.tglRencana === f.tanggal) &&
      (!f.q || cocokCariSep(e, f.q)),
  );
}

const BOBOT = Object.fromEntries(STATUS_SEP_KEYS.map((k, i) => [k, i])) as Record<StatusSep, number>;

/** Urutan bawaan: temuan dulu (surat = SEP), lalu tanggal rencana terbaru. */
export function urutkanSep(rows: SepKontrol[]): SepKontrol[] {
  return rows.sort(
    (a, b) =>
      BOBOT[a.status] - BOBOT[b.status] ||
      b.surat.tglRencana.localeCompare(a.surat.tglRencana) ||
      (b.sep?.jamSep ?? "").localeCompare(a.sep?.jamSep ?? "") ||
      a.key.localeCompare(b.key),
  );
}

export type RingkasSep = {
  /** Semua surat (= jumlah di VClaim untuk saringan yang sama). */
  total: number;
  /** Surat yang sudah dipakai SEP tercatat di SIMGOS. */
  dipakai: number;
  /** Surat dipakai dengan tanggal entri terbaca (penyebut persentase). */
  terbaca: number;
  perStatus: Record<StatusSep, number>;
  /** % surat terbit bersama SEP dari yang terbaca (0–100, 1 desimal); null bila tak ada. */
  persenSama: number | null;
  /** Surat Kontrol = SEP yang SEP asalnya rawat inap (tidak terbit saat pulang). */
  samaDariRi: number;
  /** Surat Kontrol = SEP yang SEP asalnya rawat jalan. */
  samaDariRj: number;
};

export function ringkasSep(rows: readonly SepKontrol[]): RingkasSep {
  const perStatus = Object.fromEntries(STATUS_SEP_KEYS.map((k) => [k, 0])) as Record<StatusSep, number>;
  let samaDariRi = 0;
  let samaDariRj = 0;
  let dipakai = 0;
  for (const e of rows) {
    perStatus[e.status]++;
    if (e.sep) dipakai++;
    if (e.status === "SAMA_HARI" && e.surat.jenis === 2) {
      if (e.asal?.layanan === "RI") samaDariRi++;
      else if (e.asal?.layanan === "RJ") samaDariRj++;
    }
  }
  const terbaca = STATUS_SEP_TERBACA.reduce((n, k) => n + perStatus[k], 0);
  return {
    total: rows.length,
    dipakai,
    terbaca,
    perStatus,
    persenSama: terbaca ? Math.round((perStatus.SAMA_HARI / terbaca) * 1000) / 10 : null,
    samaDariRi,
    samaDariRj,
  };
}

export type HariSep = { tanggal: string } & Record<(typeof STATUS_SEP_GRAFIK)[number], number>;

/** Sebaran per tanggal rencana untuk setiap hari di [from, to]. */
export function ringkasSepPerHari(rows: readonly SepKontrol[], from: string, to: string): HariSep[] {
  const m = new Map<string, HariSep>();
  for (let d = from; d <= to; d = tambahHari(d, 1)) m.set(d, { tanggal: d, SEBELUM_SEP: 0, SETELAH_SEP: 0, SAMA_HARI: 0, BELUM_DIPAKAI: 0 });
  for (const e of rows) {
    const r = m.get(e.surat.tglRencana);
    if (r && (STATUS_SEP_GRAFIK as readonly StatusSep[]).includes(e.status)) r[e.status as (typeof STATUS_SEP_GRAFIK)[number]]++;
  }
  return [...m.values()];
}

export type RuanganSep = {
  ruangan: string;
  layanan: LayananSep;
  total: number;
  terbaca: number;
  sama: number;
  setelah: number;
  belum: number;
};

/** Per ruangan / poli, urut surat = SEP terbanyak lalu setelah SEP. */
export function ringkasSepPerRuangan(rows: readonly SepKontrol[]): RuanganSep[] {
  const m = new Map<string, RuanganSep>();
  for (const e of rows) {
    const nama = namaRuanganSep(e);
    const k = `${e.layanan}|${nama}`;
    const r = m.get(k) ?? { ruangan: nama, layanan: e.layanan, total: 0, terbaca: 0, sama: 0, setelah: 0, belum: 0 };
    r.total++;
    if ((STATUS_SEP_TERBACA as readonly StatusSep[]).includes(e.status)) r.terbaca++;
    if (e.status === "SAMA_HARI") r.sama++;
    else if (e.status === "SETELAH_SEP") r.setelah++;
    else if (e.status === "BELUM_DIPAKAI") r.belum++;
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.sama - a.sama || b.setelah - a.setelah || b.total - a.total || a.ruangan.localeCompare(b.ruangan));
}

/** Kalimat selisih entri surat ↔ SEP yang dibaca manusia. */
export function teksSelisihSep(e: Pick<SepKontrol, "status" | "selisihHari">): string {
  switch (e.status) {
    case "SAMA_HARI":
      return "Hari yang sama dengan SEP";
    case "SETELAH_SEP":
      return `${e.selisihHari} hari setelah SEP`;
    case "SEBELUM_SEP":
      return `${Math.abs(e.selisihHari ?? 0)} hari sebelum SEP`;
    case "TAK_TERBACA":
      return "Tanggal entri belum terbaca";
    case "SEP_TAK_TERCATAT":
      return "SEP tak tercatat di SIMGOS";
    case "BELUM_DIPAKAI":
      return "Belum dipakai SEP";
  }
}

// ── Rekap format audit BPJS (basis TANGGAL SEP) ───────────────────────────────

/** Satu sel rekap audit BPJS: Surkon < SEP / = SEP / > SEP. */
export type RekapAngka = {
  /** Surkon < SEP — surat dibuat sebelum hari SEP (setelah pelayanan sebelumnya selesai). */
  kurang: number;
  /** Surkon = SEP. */
  sama: number;
  /** Surkon > SEP. */
  lebih: number;
  /** SEP yang tanggal entri suratnya belum terbaca (di luar total, seperti tarikan BPJS). */
  takTerbaca: number;
  /** = kurang + sama + lebih ("Grand Total" BPJS). */
  total: number;
  /** "Pembuatan Surkon Setelah Selesai Pelayanan" = kurang ÷ total (0–100, 2 desimal seperti tabel BPJS); null bila total 0. */
  persen: number | null;
};

export function hitungRekap(rows: readonly Pick<RekapSep, "status">[]): RekapAngka {
  let kurang = 0;
  let sama = 0;
  let lebih = 0;
  let takTerbaca = 0;
  for (const r of rows) {
    if (r.status === "SEBELUM_SEP") kurang++;
    else if (r.status === "SAMA_HARI") sama++;
    else if (r.status === "SETELAH_SEP") lebih++;
    else takTerbaca++;
  }
  const total = kurang + sama + lebih;
  return { kurang, sama, lebih, takTerbaca, total, persen: total ? Math.round((kurang / total) * 10000) / 100 : null };
}

export type RekapAudit = { perJenis: Record<JenisKontrol, RekapAngka>; total: RekapAngka };

/** Tabel audit BPJS: baris Surat Kontrol, SPRI, dan total gabungan. */
export function rekapAudit(rows: readonly RekapSep[]): RekapAudit {
  return {
    perJenis: { 2: hitungRekap(rows.filter((r) => r.jenis === 2)), 1: hitungRekap(rows.filter((r) => r.jenis === 1)) },
    total: hitungRekap(rows),
  };
}

export type HariRekap = { tanggal: string } & Record<(typeof STATUS_SEP_TERBACA)[number], number>;

/** Sebaran rekap per tanggal SEP untuk setiap hari di [from, to]. */
export function rekapPerHari(rows: readonly RekapSep[], from: string, to: string): HariRekap[] {
  const m = new Map<string, HariRekap>();
  for (let d = from; d <= to; d = tambahHari(d, 1)) m.set(d, { tanggal: d, SEBELUM_SEP: 0, SETELAH_SEP: 0, SAMA_HARI: 0 });
  for (const r of rows) {
    const h = m.get(r.tglSep);
    if (h && (STATUS_SEP_TERBACA as readonly StatusSep[]).includes(r.status)) h[r.status as (typeof STATUS_SEP_TERBACA)[number]]++;
  }
  return [...m.values()];
}

export type RuanganRekap = { ruangan: string; layanan: LayananSep; perJenis: Record<JenisKontrol, RekapAngka>; total: RekapAngka };

/** Rekap per ruangan / poli SEP, urut total SEP terbanyak. */
export function rekapPerRuangan(rows: readonly RekapSep[]): RuanganRekap[] {
  const grup = new Map<string, RekapSep[]>();
  for (const r of rows) {
    const k = `${r.layanan}|${r.ruangan}`;
    const l = grup.get(k);
    if (l) l.push(r);
    else grup.set(k, [r]);
  }
  return [...grup.values()]
    .map((l) => ({ ruangan: l[0].ruangan, layanan: l[0].layanan, ...rekapAudit(l) }))
    .sort((a, b) => b.total.total - a.total.total || a.ruangan.localeCompare(b.ruangan));
}
