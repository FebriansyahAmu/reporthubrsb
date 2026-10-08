import "server-only";
import { stampWita } from "@/server/lib/excel";
import type { Rl32Result, RuanganRl32 } from "./rl32.types";

/** Model dokumen ekspor BERSAMA (Excel & PDF) — judul, meta, nama berkas satu sumber. */

export const JUDUL_RL32 = "RL 3.2 (SIRS 6) — REKAPITULASI KEGIATAN PELAYANAN RAWAT INAP";

const angkaFmt = new Intl.NumberFormat("id-ID");
export const angkaId = (n: number) => angkaFmt.format(n);

export const subjudulRl32 = (r: Rl32Result) =>
  r.instansi
    ? `${r.instansi.nama} · Kode RS ${r.instansi.kodeRs} · ${r.instansi.kota}`
    : "RSUD Bolaang Mongondow Timur";

const tglId = (ymd: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${ymd}T00:00:00Z`),
  );

/** Label status pemetaan satu ruangan. */
export const labelPeta = (r: RuanganRl32) =>
  r.status === "terpetakan" && r.kategori
    ? `${r.kategori.kode}. ${r.kategori.deskripsi}${r.pisahDpjp ? " · dipisah menurut DPJP" : ""}`
    : r.status === "dikecualikan"
      ? "Tidak dilaporkan"
      : "Belum dipetakan";

/** Baris tabel per ruangan: ruangan, lalu (bila dipisah DPJP) rinciannya per jenis pelayanan. */
export type BarisRuanganDok =
  | { jenis: "ruangan"; r: RuanganRl32; nilai: RuanganRl32["nilai"] }
  | { jenis: "bagian"; r: RuanganRl32; label: string; nilai: RuanganRl32["nilai"] };

export function barisPerRuangan(r: Rl32Result): BarisRuanganDok[] {
  const out: BarisRuanganDok[] = [];
  // Ruangan tanpa aktivitas & tanpa pemetaan tak perlu dicantumkan.
  for (const x of r.ruangan.filter((y) => y.aktivitas || y.status !== "belum")) {
    out.push({ jenis: "ruangan", r: x, nilai: x.nilai });
    for (const b of x.bagian) {
      const smf = b.smf.length ? ` (DPJP SMF ${b.smf.map((s) => s.nama).join(", ")})` : " (alokasi TT)";
      out.push({ jenis: "bagian", r: x, label: `${b.kategori.kode}. ${b.kategori.deskripsi}${smf}`, nilai: b.nilai });
    }
  }
  return out;
}

export function metaRl32(r: Rl32Result, opts: { oleh: string; waktu: Date }): string[] {
  const terpetakan = r.ruangan.filter((x) => x.status === "terpetakan").length;
  const dikecualikan = r.ruangan.filter((x) => x.status === "dikecualikan").length;
  const meta = [
    `Periode: ${r.judulPeriode} (${tglId(r.periode.from)} s.d. ${tglId(r.periode.to)})` +
      (r.periode.berjalan
        ? ` — periode belum berakhir: hari perawatan dihitung s.d. ${tglId(r.periode.hpSampai)}, pasien akhir = pasien yang masih dirawat.`
        : ""),
    `Dasar pengelompokan: ruangan rawat inap → jenis pelayanan (${terpetakan} ruangan dipetakan${dikecualikan ? `, ${dikecualikan} tidak dilaporkan` : ""}). ` +
      (r.tempatTidur.tersedia
        ? `Alokasi TT per ${tglId(r.tempatTidur.tanggal)}.`
        : `Data alokasi TT tanggal ${tglId(r.tempatTidur.tanggal)} tidak tersedia di SIMGOS.`),
  ];
  const dipisah = r.ruangan.filter((x) => x.pisahDpjp);
  if (dipisah.length > 0) {
    const aturan = r.pemisahan.map((p) => `${p.smf.nama} → ${p.kategori.kode}. ${p.kategori.deskripsi}`).join("; ");
    meta.push(
      `Dipisah menurut SMF DPJP kunjungan: ${dipisah.map((x) => x.nama).join(", ")} — ${aturan || "belum ada aturan SMF"}; SMF lain & alokasi TT ikut jenis pelayanan ruangan.`,
    );
  }
  if (r.belumDipetakan.length > 0) {
    meta.push(
      `PERHATIAN: ruangan belum dipetakan sehingga tidak terhitung — ${r.belumDipetakan
        .map((b) => `${b.nama} (${angkaId(b.pasien)} pasien${b.tempatTidur ? `, ${angkaId(b.tempatTidur)} TT` : ""})`)
        .join(", ")}.`,
    );
  }
  meta.push(
    `Dibuat oleh ${opts.oleh}, ${stampWita(opts.waktu)} · Sumber: SIMGOS (hanya dibaca) · port SP LaporanRL32RuanganRevisi dengan pemetaan ruangan ReportHub.`,
  );
  return meta;
}

/** Nama berkas aman (tanggal sudah tervalidasi schema). */
export const namaBerkasRl32 = (r: Rl32Result, format: "xlsx" | "pdf") =>
  `RL-3.2_Rawat-Inap_${r.periode.from}_sd_${r.periode.to}.${format}`;
