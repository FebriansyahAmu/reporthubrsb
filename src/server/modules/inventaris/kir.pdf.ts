import "server-only";
import { buildReportPdf, type PdfColumnDef } from "@/server/lib/pdf";
import { stampWita } from "@/server/lib/excel";
import { STATUS_ASET_LABEL } from "./barang.schema";
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

/** Susun PDF Kartu Inventaris Ruangan (KIR) resmi ber-kop + tanda tangan PJ. */
export async function buildKirPdf(data: KirData, opts: { generatedAt: Date; by: string }): Promise<Buffer> {
  const { ruangan, barang, totalNilai } = data;

  const columns: PdfColumnDef[] = [
    { header: "No", width: 26, align: "center" },
    { header: "Kode Barang", width: 78 },
    { header: "Nama Barang", width: 150 },
    { header: "Merk/Tipe", width: 95 },
    { header: "No. Seri", width: 85 },
    { header: "Tahun", width: 42, align: "center" },
    { header: "Kondisi", width: 70 },
    { header: "Status", width: 62 },
    { header: "Harga (Rp)", width: 90, align: "right" },
    { header: "Keterangan", width: 71 },
  ];

  const rows = barang.map((b, i) => [
    String(i + 1),
    b.kodeBarang,
    b.nama,
    b.merk ?? "-",
    b.nomorSeri ?? "-",
    b.tahunPerolehan != null ? String(b.tahunPerolehan) : "-",
    b.kondisi ?? "-",
    STATUS_ASET_LABEL[b.statusAset],
    rupiah(b.harga),
    b.keterangan ?? "-",
  ]);

  const totals = ["", "", "TOTAL NILAI ASET", "", "", "", "", "", rupiah(totalNilai), ""];

  return buildReportPdf({
    title: "KARTU INVENTARIS RUANGAN (KIR)",
    subtitle: "Rumah Sakit Umum Daerah Bolaang Mongondow Timur",
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
      place: "Boltim",
      date: longDateWita(opts.generatedAt),
      columns: [
        { caption: "Mengetahui,\nPengurus/Penyimpan Barang", nip: "" },
        { caption: "Penanggung Jawab Ruangan", name: ruangan.pjNama ?? undefined, nip: ruangan.pjNip ?? "" },
      ],
    },
    footerNote: "Dokumen dibuat melalui AuditTrail RS BOLTIM — Modul Inventarisasi Barang",
    generatedAt: opts.generatedAt,
    orientation: "landscape",
  });
}
