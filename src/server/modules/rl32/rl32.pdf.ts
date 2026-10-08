import "server-only";
import { buildReportPdf, loadInstansiLogo, type PdfColumnDef, type PdfTableSpec } from "@/server/lib/pdf";
import type { MetrikRl32 } from "./rl32.constants";
import { angkaId, barisPerRuangan, JUDUL_RL32, labelPeta, metaRl32, subjudulRl32 } from "./rl32.dokumen";
import type { NilaiRl32, Rl32Result } from "./rl32.types";

/**
 * PDF ringkas RL 3.2 (A4 lanskap): rekap per jenis pelayanan, rincian hari
 * perawatan per kelas, dan rekap per ruangan — angka jumlah saja; rincian L/P
 * lengkap ada di Excel.
 */

export type Rl32PdfMeta = { generatedAt: Date; by: string };

const nz = (n: number | null) => (n == null ? "" : n === 0 ? "-" : angkaId(n));
const num = (header: string, width: number): PdfColumnDef => ({ header, width, align: "right", maxLines: 1 });

// Header sempit (lebar kolom ±44 pt); kepanjangannya di KETERANGAN.
const REKAP: [MetrikRl32, string][] = [
  ["awal", "Awal"],
  ["masuk", "Masuk"],
  ["pindahan", "Pindahan"],
  ["dipindahkan", "Dipindah"],
  ["hidup", "Hidup"],
  ["mati", "Mati"],
  ["matiKurang48", "Mati <48j"],
  ["matiLebih48", "Mati >=48j"],
  ["lamaDirawat", "Lama Rawat"],
  ["sisa", "Akhir"],
  ["hariPerawatan", "Hari Rawat"],
];

const KETERANGAN =
  "Awal/Akhir = pasien awal/akhir periode; Dipindah = pasien dipindahkan; Hidup/Mati = pasien keluar hidup/mati " +
  "(<48j / >=48j sejak pendaftaran); Lama Rawat = jumlah lama dirawat; Hari Rawat = jumlah hari perawatan; " +
  "TT = alokasi tempat tidur awal periode.";

const KELAS: [MetrikRl32, string][] = [
  ["vvip", "VVIP"],
  ["vip", "VIP"],
  ["kelas1", "Kelas I"],
  ["kelas2", "Kelas II"],
  ["kelas3", "Kelas III"],
  ["kelasKhusus", "Kelas Khusus"],
  ["hariPerawatan", "Jumlah"],
];

const sel = (n: NilaiRl32, kolom: [MetrikRl32, string][]) => kolom.map(([k]) => nz(n[k].total));

export async function buildRl32Pdf(r: Rl32Result, meta: Rl32PdfMeta): Promise<Buffer> {
  // Lebar halaman lanskap A4 yang terpakai ±770 pt.
  const rekap: PdfTableSpec = {
    caption: "Rekapitulasi per Jenis Pelayanan",
    columns: [
      { header: "No", width: 24, align: "center", maxLines: 1 },
      { header: "Jenis Pelayanan", width: 160, maxLines: 2 },
      ...REKAP.map(([, h]) => num(h, 48)),
      num("TT", 54),
    ],
    rows: r.baris.map((b) => [b.kode, b.deskripsi, ...sel(b.nilai, REKAP), nz(b.nilai.tempatTidur)]),
    totals: ["", "TOTAL", ...sel(r.total, REKAP), nz(r.total.tempatTidur)],
    note: KETERANGAN,
  };

  const kelas: PdfTableSpec = {
    caption: "Rincian Hari Perawatan per Kelas",
    columns: [
      { header: "No", width: 24, align: "center", maxLines: 1 },
      { header: "Jenis Pelayanan", width: 160, maxLines: 2 },
      ...KELAS.map(([, h]) => num(h, 62)),
    ],
    rows: r.baris.map((b) => [b.kode, b.deskripsi, ...sel(b.nilai, KELAS)]),
    totals: ["", "TOTAL", ...sel(r.total, KELAS)],
  };

  // Ruangan (+ rincian per jenis pelayanan bila dipisah menurut DPJP, abu-abu).
  const ruangan = barisPerRuangan(r);
  const ABU = { color: "#64748B" };
  const perRuangan: PdfTableSpec = {
    caption: "Rekapitulasi per Ruangan",
    columns: [
      { header: "Ruangan", width: 128, maxLines: 2 },
      { header: "Jenis Pelayanan RL 3.2", width: 110, maxLines: 3 },
      ...REKAP.map(([, h]) => num(h, 44)),
      num("TT", 46),
    ],
    rows: ruangan.map((b) =>
      b.jenis === "ruangan"
        ? [b.r.aktif ? b.r.nama : `${b.r.nama} (nonaktif)`, labelPeta(b.r), ...sel(b.nilai, REKAP), nz(b.nilai.tempatTidur)]
        : ["", `- ${b.label}`, ...sel(b.nilai, REKAP), nz(b.nilai.tempatTidur)],
    ),
    styles: ruangan.map((b) =>
      b.jenis === "bagian"
        ? Array.from({ length: REKAP.length + 3 }, () => ABU)
        : b.r.status === "belum"
          ? [null, { color: "#B45309", bold: true }]
          : b.r.status === "dikecualikan"
            ? [null, ABU]
            : [],
    ),
    totals: ["TOTAL (ruangan dipetakan)", "", ...sel(r.total, REKAP), nz(r.total.tempatTidur)],
    note:
      "Ruangan \"Belum dipetakan\" / \"Tidak dilaporkan\" tidak masuk rekap per jenis pelayanan. Baris abu-abu bertanda \"-\" = rincian " +
      "ruangan yang dipisah menurut SMF DPJP (sudah termasuk dalam baris ruangannya).",
  };

  const logo = loadInstansiLogo();
  return buildReportPdf({
    title: JUDUL_RL32,
    subtitle: subjudulRl32(r),
    metaLines: metaRl32(r, { oleh: meta.by, waktu: meta.generatedAt }),
    tables: [rekap, kelas, perRuangan],
    footerNote: "Sumber: SIMGOS (hanya dibaca) · RL 3.2 per ruangan (port SP LaporanRL32RuanganRevisi) · AuditTrail RS BOLTIM",
    generatedAt: meta.generatedAt,
    orientation: "landscape",
    ...(logo ? { logo: { bytes: logo } } : {}),
  });
}
