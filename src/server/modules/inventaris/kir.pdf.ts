import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildReportPdf, type PdfColumnDef, type PdfSignatory } from "@/server/lib/pdf";
import { stampWita } from "@/server/lib/excel";
import { STATUS_ASET_LABEL } from "./barang.schema";
import type { KirSignBlockInput } from "./kir.schema";
import type { KirData } from "./kir.service";

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Tanggal panjang Indonesia dalam WITA (mis. "21 September 2026"). */
function longDateWita(d: Date): string {
  const w = new Date(d.getTime() + 8 * 3600 * 1000);
  return `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}`;
}

const rupiah = (n: number | null): string => (n == null ? "-" : `Rp${n.toLocaleString("id-ID")}`);

// Logo instansi (public/logo/logoboltim.png) — dibaca sekali & di-cache.
let logoCache: Uint8Array | null | undefined;
function loadLogo(): Uint8Array | undefined {
  if (logoCache !== undefined) return logoCache ?? undefined;
  try {
    logoCache = new Uint8Array(readFileSync(join(process.cwd(), "public", "logo", "logoboltim.png")));
  } catch {
    logoCache = null;
  }
  return logoCache ?? undefined;
}

/** Susun PDF Kartu Inventaris Ruangan (KIR) resmi ber-kop, logo & tanda tangan. */
export async function buildKirPdf(
  data: KirData,
  opts: { generatedAt: Date; by: string; sign?: KirSignBlockInput },
): Promise<Buffer> {
  const { ruangan, barang, totalNilai } = data;

  const columns: PdfColumnDef[] = [
    { header: "No", width: 26, align: "center" },
    { header: "Kode Barang", width: 78 },
    { header: "Nama Barang", width: 195 },
    { header: "Merk/Tipe", width: 110 },
    { header: "Tahun", width: 42, align: "center" },
    { header: "Kondisi", width: 70 },
    { header: "Status", width: 62 },
    { header: "Harga (Rp)", width: 90, align: "right" },
    { header: "Keterangan", width: 96 },
  ];

  const rows = barang.map((b, i) => [
    String(i + 1),
    b.kodeBarang,
    b.nama,
    b.merk ?? "-",
    b.tahunPerolehan != null ? String(b.tahunPerolehan) : "-",
    b.kondisi ?? "-",
    STATUS_ASET_LABEL[b.statusAset],
    rupiah(b.harga),
    b.keterangan ?? "-",
  ]);

  const totals = ["", "", "TOTAL NILAI ASET", "", "", "", "", rupiah(totalNilai), ""];

  // Penanda tangan: dari input user bila ada, jika tidak pakai default (PJ ruangan).
  const sigColumns: PdfSignatory[] =
    opts.sign && opts.sign.columns.length > 0
      ? opts.sign.columns.map((s) => ({ caption: s.caption || " ", name: s.name, nip: s.nip ?? "" }))
      : [
          { caption: "Pengurus/Penyimpan Barang", nip: "" },
          { caption: "Mengetahui,\nPenanggung Jawab Ruangan", name: ruangan.pjNama ?? undefined, nip: ruangan.pjNip ?? "" },
        ];
  const place = opts.sign?.place || "Sumber Rejo";

  const logo = loadLogo();

  return buildReportPdf({
    title: "KARTU INVENTARIS RUANGAN (KIR)",
    subtitle: "Rumah Sakit Umum Daerah Bolaang Mongondow Timur",
    logo: logo ? { bytes: logo, format: "png", height: 48 } : undefined,
    metaLines: [
      `Ruangan: ${ruangan.nama} (${ruangan.kodePrefix})`,
      ruangan.pjNama
        ? `Penanggung Jawab: ${ruangan.pjNama}${ruangan.pjNip ? ` — NIP ${ruangan.pjNip}` : ""}`
        : "Penanggung Jawab: (belum ditetapkan)",
      `Jumlah unit: ${barang.length} · Total nilai aset: ${rupiah(totalNilai)}`,
      `Dicetak: ${stampWita(opts.generatedAt)} · Oleh: ${opts.by}`,
    ],
    tables: [{ columns, rows, totals }],
    signature: {
      place,
      date: longDateWita(opts.generatedAt),
      columns: sigColumns,
    },
    footerNote: "Dokumen dibuat melalui AuditTrail RS BOLTIM — Modul Inventarisasi Barang",
    generatedAt: opts.generatedAt,
    orientation: "landscape",
  });
}
