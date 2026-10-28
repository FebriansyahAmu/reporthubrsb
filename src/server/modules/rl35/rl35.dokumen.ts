import "server-only";
import { stampWita } from "@/server/lib/excel";
import { LABEL_ALASAN, RL35_RATA_HARI_BUKA, RL35_RATA_KUNJUNGAN_HARI } from "./rl35.constants";
import type { NilaiRl35, Rl35Result, RuanganRl35 } from "./rl35.types";

/** Model dokumen ekspor BERSAMA (Excel & PDF) — judul, meta, baris, nama berkas satu sumber. */

export const JUDUL_RL35 = "RL 3.5 (SIRS 6) — REKAPITULASI KUNJUNGAN";

const angkaFmt = new Intl.NumberFormat("id-ID");
export const angkaId = (n: number) => angkaFmt.format(n);
const desimalFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
export const desimalId = (n: number | null) => (n == null ? "-" : desimalFmt.format(n));

export const subjudulRl35 = (r: Rl35Result) =>
  r.instansi ? `${r.instansi.nama} · Kode RS ${r.instansi.kodeRs} · ${r.instansi.kota}` : "RSUD Bolaang Mongondow Timur";

const tglId = (ymd: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${ymd}T00:00:00Z`),
  );

export const LABEL_JENIS_RUANGAN: Record<number, string> = { 1: "Rawat Jalan", 2: "Gawat Darurat" };

/** Label status pemetaan satu ruangan. */
export const labelPeta = (r: RuanganRl35) =>
  r.kategori
    ? `${r.kategori.kode}. ${r.kategori.deskripsi}${r.status === "bawaan" ? " (bawaan)" : ""}`
    : r.status === "dikecualikan"
      ? "Tidak dilaporkan"
      : "Belum dipetakan";

/** Baris formulir: jenis kegiatan, TOTAL, lalu baris 66 & 77 (angka tunggal). */
export type BarisDok =
  | { jenis: "kegiatan"; kode: string; label: string; nilai: NilaiRl35 }
  | { jenis: "total"; label: string; nilai: NilaiRl35 }
  | { jenis: "rata"; kode: string; label: string; nilai: number | null };

export function barisFormulir(r: Rl35Result): BarisDok[] {
  return [
    ...r.baris.map((b) => ({ jenis: "kegiatan" as const, kode: b.kode, label: b.deskripsi, nilai: b.nilai })),
    { jenis: "total", label: "TOTAL", nilai: r.total },
    {
      jenis: "rata",
      kode: String(RL35_RATA_HARI_BUKA),
      label: "Rata-rata hari poliklinik buka",
      nilai: r.rataRata.rataHariBuka,
    },
    {
      jenis: "rata",
      kode: String(RL35_RATA_KUNJUNGAN_HARI),
      label: "Rata-rata kunjungan per hari",
      nilai: r.rataRata.rataKunjunganPerHari,
    },
  ];
}

/** Baris per ruangan: ruangan, lalu (bila ada) bagian yang pindah baris karena diagnosis. */
export type BarisRuanganDok =
  | { jenis: "ruangan"; r: RuanganRl35; nilai: NilaiRl35 }
  | { jenis: "pindah"; r: RuanganRl35; label: string; nilai: NilaiRl35 };

export function barisPerRuangan(r: Rl35Result): BarisRuanganDok[] {
  const out: BarisRuanganDok[] = [];
  // Ruangan tanpa kunjungan & tanpa pemetaan tak perlu dicantumkan.
  for (const x of r.ruangan.filter((y) => y.aktivitas || y.status === "terpetakan" || y.status === "dikecualikan")) {
    out.push({ jenis: "ruangan", r: x, nilai: x.nilai });
    for (const p of x.pindah) {
      out.push({
        jenis: "pindah",
        r: x,
        label: `ke ${p.kategori.kode}. ${p.kategori.deskripsi} (${LABEL_ALASAN[p.alasan]})`,
        nilai: p.nilai,
      });
    }
  }
  return out;
}

export function metaRl35(r: Rl35Result, opts: { oleh: string; waktu: Date }): string[] {
  const hitung = (s: RuanganRl35["status"]) => r.ruangan.filter((x) => x.status === s).length;
  const rr = r.rataRata;
  const meta = [
    `Periode: ${r.judulPeriode} (${tglId(r.periode.from)} s.d. ${tglId(r.periode.to)})` +
      (r.periode.berjalan ? " — periode belum berakhir: kunjungan dihitung s.d. hari ini." : ""),
    `Kunjungan = pendaftaran per poliklinik/ruang IGD yang masuk pada periode. Jenis kegiatan menurut pemetaan ruangan ` +
      `(${hitung("terpetakan")} ditetapkan, ${hitung("bawaan")} bawaan dari nama ruangan` +
      `${hitung("dikecualikan") ? `, ${hitung("dikecualikan")} tidak dilaporkan` : ""}); semua ruang IGD = Rawat Darurat. ` +
      `Kunjungan Kesehatan Anak / Obstetri & Ginekologi / Bedah Saraf / Saraf berdiagnosis neonatal / kehamilan / stroke dipindah ke baris khususnya (aturan SP).`,
    `Dalam/luar kab/kota menurut domisili pasien (kabupaten alamat) dibanding Kab. ${r.kabupaten.nama} (${r.kabupaten.kode})` +
      (r.domisiliTakTercatat ? `; ${angkaId(r.domisiliTakTercatat)} kunjungan berdomisili tak tercatat dihitung luar.` : "."),
    `Baris ${RL35_RATA_HARI_BUKA} = jumlah hari dengan kunjungan poliklinik (${angkaId(rr.hariBuka)} hari) ÷ ${rr.bulan} bulan; ` +
      `baris ${RL35_RATA_KUNJUNGAN_HARI} = kunjungan rawat jalan (${angkaId(rr.kunjunganRj)}, tanpa IGD) ÷ hari poliklinik buka.`,
  ];
  if (r.belumDipetakan.length > 0) {
    meta.push(
      `PERHATIAN: ruangan belum dipetakan sehingga tidak terhitung — ${r.belumDipetakan
        .map((b) => `${b.nama} (${angkaId(b.kunjungan)} kunjungan)`)
        .join(", ")}.`,
    );
  }
  meta.push(
    `Dibuat oleh ${opts.oleh}, ${stampWita(opts.waktu)} · Sumber: SIMGOS (hanya dibaca) · port SP LaporanRL35Revisi dengan pemetaan ruangan ReportHub.`,
  );
  return meta;
}

/** Nama berkas aman (tanggal sudah tervalidasi schema). */
export const namaBerkasRl35 = (r: Rl35Result, format: "xlsx" | "pdf") =>
  `RL-3.5_Kunjungan_${r.periode.from}_sd_${r.periode.to}.${format}`;
