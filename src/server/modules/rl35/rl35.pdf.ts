import "server-only";
import { buildReportPdf, loadInstansiLogo, type PdfColumnDef, type PdfTableSpec } from "@/server/lib/pdf";
import { KOLOM_RL35 } from "./rl35.constants";
import {
  angkaId,
  barisFormulir,
  barisPerRuangan,
  desimalId,
  JUDUL_RL35,
  LABEL_JENIS_RUANGAN,
  labelPeta,
  metaRl35,
  subjudulRl35,
} from "./rl35.dokumen";
import type { NilaiRl35, Rl35Result } from "./rl35.types";

/**
 * PDF RL 3.5 (A4 potret): formulir per jenis kegiatan (urutan SIRS 6, baris
 * 66 & 77 di kolom Jumlah) dan rekap per ruangan.
 */

export type Rl35PdfMeta = { generatedAt: Date; by: string };

const nz = (n: number) => (n === 0 ? "-" : angkaId(n));
const num = (header: string, width: number): PdfColumnDef => ({ header, width, align: "right", maxLines: 1 });
/** "Dalam L", "Luar P", "Total L", "Jumlah" — header sempit satu tingkat. */
const KOLOM = KOLOM_RL35.map((k) => num(k.sub === "Jumlah" ? "Jumlah" : `${k.grup.split(" ")[0]} ${k.sub}`, 46));
const sel = (n: NilaiRl35) => KOLOM_RL35.map((k) => nz(n[k.ambil]));

export async function buildRl35Pdf(r: Rl35Result, meta: Rl35PdfMeta): Promise<Buffer> {
  // Lebar halaman potret A4 yang terpakai ±523 pt.
  const formulir = barisFormulir(r);
  const isi = formulir.filter((b) => b.jenis !== "total");
  const total = formulir.find((b) => b.jenis === "total");
  const rekap: PdfTableSpec = {
    caption: "Rekapitulasi per Jenis Kegiatan",
    columns: [{ header: "No", width: 24, align: "center", maxLines: 1 }, { header: "Jenis Kegiatan", width: 177, maxLines: 2 }, ...KOLOM],
    rows: isi.map((b) =>
      b.jenis === "kegiatan" ? [b.kode, b.label, ...sel(b.nilai)] : [b.kode, b.label, ...KOLOM.slice(1).map(() => ""), desimalId(b.nilai)],
    ),
    styles: isi.map((b) => (b.jenis === "rata" ? Array.from({ length: KOLOM.length + 2 }, () => ({ bold: true })) : [])),
    totals: total?.jenis === "total" ? ["", "TOTAL", ...sel(total.nilai)] : undefined,
    note: "Dalam/Luar = kunjungan pasien berdomisili di dalam/luar kabupaten/kota RS; L/P = laki-laki/perempuan. Baris 66 & 77 berisi rata-rata (kolom Jumlah).",
  };

  const ruangan = barisPerRuangan(r);
  const ABU = { color: "#64748B" };
  const perRuangan: PdfTableSpec = {
    caption: "Rekapitulasi per Ruangan",
    columns: [
      { header: "Ruangan", width: 112, maxLines: 2 },
      { header: "Jenis Kegiatan RL 3.5", width: 89, maxLines: 3 },
      ...KOLOM,
    ],
    rows: ruangan.map((b) =>
      b.jenis === "ruangan"
        ? [`${b.r.aktif ? b.r.nama : `${b.r.nama} (nonaktif)`} · ${LABEL_JENIS_RUANGAN[b.r.jenisKunjungan] ?? ""}`, labelPeta(b.r), ...sel(b.nilai)]
        : ["", `- ${b.label}`, ...sel(b.nilai)],
    ),
    styles: ruangan.map((b) =>
      b.jenis === "pindah"
        ? Array.from({ length: KOLOM.length + 2 }, () => ABU)
        : b.r.status === "belum"
          ? [null, { color: "#B45309", bold: true }]
          : b.r.status === "dikecualikan"
            ? [null, ABU]
            : [],
    ),
    totals: ["TOTAL (ruangan dilaporkan)", "", ...sel(r.total)],
    note:
      "Ruangan \"Belum dipetakan\" / \"Tidak dilaporkan\" tidak masuk rekap per jenis kegiatan. Baris abu-abu bertanda \"-\" = bagian " +
      "kunjungan ruangan yang dipindah ke baris khusus karena diagnosis (sudah termasuk dalam baris ruangannya).",
  };

  const logo = loadInstansiLogo();
  return buildReportPdf({
    title: JUDUL_RL35,
    subtitle: subjudulRl35(r),
    metaLines: metaRl35(r, { oleh: meta.by, waktu: meta.generatedAt }),
    tables: [rekap, perRuangan],
    footerNote: "Sumber: SIMGOS (hanya dibaca) · RL 3.5 kunjungan (port SP LaporanRL35Revisi) · AuditTrail RS BOLTIM",
    generatedAt: meta.generatedAt,
    orientation: "portrait",
    ...(logo ? { logo: { bytes: logo } } : {}),
  });
}
