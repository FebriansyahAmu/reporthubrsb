import type {
  CaraBayar,
  JenisKunjungan,
  KunjunganListItem,
  KunjunganStatus,
  LaporanSummary,
  PageMeta,
  ResumeMedik,
} from "@/lib/types";

/**
 * MOCK DATA — hanya untuk pengembangan UI. Nanti diganti pemanggilan API nyata
 * (bentuk DTO sama). Data dibuat deterministik agar stabil (SSR-friendly).
 */

const NAMA = [
  "Budi Santoso", "Siti Rahmawati", "Andi Wijaya", "Dewi Lestari", "Rizky Pratama",
  "Nur Aisyah", "Agus Setiawan", "Maya Putri", "Hendra Gunawan", "Ratna Sari",
  "Joko Susilo", "Lina Marlina", "Fajar Nugroho", "Indah Permata", "Bayu Aditya",
  "Sri Wahyuni", "Doni Kurniawan", "Wulan Sari", "Eko Prasetyo", "Fitri Handayani",
  "Taufik Hidayat", "Yuni Astuti", "Rahmat Hakim", "Citra Dewi", "Irfan Maulana",
];

export const UNITS = [
  "Poli Umum", "Poli Gigi", "Poli Anak", "Poli Penyakit Dalam",
  "Poli Kandungan", "IGD", "Poli Mata", "Poli Bedah",
];

export const DOKTERS = [
  "dr. Andi Kusuma", "dr. Sari Melati", "dr. Rudi Hartono, Sp.PD",
  "dr. Nina Kartika, Sp.A", "dr. Bagas Prakoso", "dr. Lita Anggraini, Sp.OG",
  "dr. Yoga Pratama, Sp.M", "dr. Reza Fahlevi, Sp.B",
];

const SPESIALISASI = [
  "Umum", "Gigi", "Anak", "Penyakit Dalam",
  "Kandungan", "Umum (IGD)", "Mata", "Bedah",
];

const CARA_BAYAR: CaraBayar[] = ["BPJS", "UMUM", "ASURANSI"];
const JENIS: JenisKunjungan[] = ["RAWAT_JALAN", "IGD", "RAWAT_INAP"];

const TODAY = new Date("2026-07-16T00:00:00.000Z");

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

/** Distribusi status: mayoritas SELESAI supaya resume medik banyak yang bisa dicetak. */
function statusFor(i: number): KunjunganStatus {
  const r = i % 10;
  if (r < 6) return "SELESAI";
  if (r < 8) return "DALAM_PROSES";
  if (r < 9) return "BARU";
  return "BATAL";
}

function buildRows(): KunjunganListItem[] {
  const rows: KunjunganListItem[] = [];
  for (let i = 0; i < 56; i++) {
    const daysAgo = i % 30;
    const d = new Date(TODAY);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    d.setUTCHours(7 + (i % 9), (i * 7) % 60, 0, 0);

    const unitIdx = i % UNITS.length;
    const jenis: JenisKunjungan =
      UNITS[unitIdx] === "IGD" ? "IGD" : JENIS[i % 2 === 0 ? 0 : 2];

    rows.push({
      id: String(10000 + i),
      nomorKunjungan: `${jenis === "IGD" ? "IGD" : "RJ"}-2026-${pad(d.getUTCMonth() + 1)}-${pad(1000 + i, 6)}`,
      namaPasien: NAMA[i % NAMA.length],
      noRekamMedis: `00-${pad(10 + (i % 80))}-${pad((i * 13) % 100)}-${pad((i * 7) % 100)}`,
      tanggalKunjungan: d.toISOString(),
      unit: UNITS[unitIdx],
      dokter: statusFor(i) === "BATAL" ? null : DOKTERS[unitIdx],
      caraBayar: CARA_BAYAR[i % CARA_BAYAR.length],
      jenisKunjungan: jenis,
      status: statusFor(i),
    });
  }
  // urut terbaru dulu
  return rows.sort(
    (a, b) => +new Date(b.tanggalKunjungan) - +new Date(a.tanggalKunjungan),
  );
}

const ROWS = buildRows();

// ---------------------------------------------------------------------------
// Simulasi latency agar state loading terlihat.
function delay<T>(value: T, ms = 450): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export type KunjunganFilter = {
  from?: string;
  to?: string;
  search?: string;
  status?: KunjunganStatus | "ALL";
  unit?: string | "ALL";
  page?: number;
  pageSize?: number;
  onlySelesai?: boolean;
};

function applyFilter(rows: KunjunganListItem[], f: KunjunganFilter) {
  return rows.filter((r) => {
    const t = +new Date(r.tanggalKunjungan);
    if (f.from && t < +new Date(f.from)) return false;
    if (f.to) {
      const to = new Date(f.to);
      to.setUTCHours(23, 59, 59, 999);
      if (t > +to) return false;
    }
    if (f.onlySelesai && r.status !== "SELESAI") return false;
    if (f.status && f.status !== "ALL" && r.status !== f.status) return false;
    if (f.unit && f.unit !== "ALL" && r.unit !== f.unit) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = `${r.namaPasien} ${r.noRekamMedis} ${r.nomorKunjungan}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export async function getKunjunganList(
  f: KunjunganFilter,
): Promise<{ data: KunjunganListItem[]; meta: PageMeta }> {
  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 10;
  const filtered = applyFilter(ROWS, f);
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);
  return delay({
    data,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

export async function getLaporanKunjungan(
  f: KunjunganFilter,
): Promise<{ summary: LaporanSummary; detail: KunjunganListItem[]; meta: PageMeta }> {
  const filtered = applyFilter(ROWS, f);
  const summary: LaporanSummary = {
    totalKunjungan: filtered.length,
    totalSelesai: filtered.filter((r) => r.status === "SELESAI").length,
    totalBatal: filtered.filter((r) => r.status === "BATAL").length,
    totalDalamProses: filtered.filter((r) => r.status === "DALAM_PROSES").length,
    perCaraBayar: CARA_BAYAR.map((cb) => ({
      caraBayar: cb,
      jumlah: filtered.filter((r) => r.caraBayar === cb).length,
    })),
    perUnit: UNITS.map((u) => ({
      label: u,
      jumlah: filtered.filter((r) => r.unit === u).length,
    })).filter((x) => x.jumlah > 0),
  };

  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 10;
  const start = (page - 1) * pageSize;
  const detail = filtered.slice(start, start + pageSize);

  return delay({
    summary,
    detail,
    meta: {
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    },
  });
}

export async function getResumeMedik(id: string): Promise<ResumeMedik | null> {
  const k = ROWS.find((r) => r.id === id);
  if (!k) return delay(null);
  if (k.status !== "SELESAI") return delay(null); // aturan bisnis: hanya selesai

  const idx = Number(k.id) - 10000;
  const keluar = new Date(k.tanggalKunjungan);
  keluar.setUTCHours(keluar.getUTCHours() + 1, keluar.getUTCMinutes() + 25);

  const resume: ResumeMedik = {
    kunjungan: {
      id: k.id,
      nomorKunjungan: k.nomorKunjungan,
      tanggalMasuk: k.tanggalKunjungan,
      tanggalKeluar: keluar.toISOString(),
      unit: k.unit,
      jenisKunjungan: k.jenisKunjungan,
      caraBayar: k.caraBayar,
      status: k.status,
    },
    pasien: {
      noRekamMedis: k.noRekamMedis,
      nama: k.namaPasien,
      tanggalLahir: new Date(1980 + (idx % 30), idx % 12, 1 + (idx % 27))
        .toISOString()
        .slice(0, 10),
      jenisKelamin: idx % 2 === 0 ? "L" : "P",
      alamat: `Jl. Melati No. ${10 + (idx % 90)}, RT ${pad(1 + (idx % 9))}/RW ${pad(1 + (idx % 6))}, Balikpapan`,
    },
    dokter: {
      nama: k.dokter ?? DOKTERS[0],
      spesialisasi: SPESIALISASI[UNITS.indexOf(k.unit)] ?? "Umum",
    },
    anamnesis:
      "Pasien datang dengan keluhan demam sejak 3 hari, disertai batuk dan pilek. Nafsu makan menurun. Riwayat alergi disangkal.",
    pemeriksaanFisik:
      "Keadaan umum baik, kesadaran compos mentis. TD 120/80 mmHg, Nadi 84x/menit, Suhu 37.8°C, RR 20x/menit. Faring hiperemis (+).",
    diagnosa: [
      { kode: "J06.9", nama: "Infeksi Saluran Pernapasan Akut", tipe: "PRIMER" },
      { kode: "R50.9", nama: "Demam, tidak spesifik", tipe: "SEKUNDER" },
    ],
    tindakan: [
      { kode: "89.7", nama: "Pemeriksaan fisik umum", tanggal: k.tanggalKunjungan },
      ...(idx % 3 === 0
        ? [{ kode: "93.94", nama: "Nebulisasi", tanggal: keluar.toISOString() }]
        : []),
    ],
    resep: [
      { namaObat: "Paracetamol 500 mg", aturanPakai: "3 x 1 tablet", jumlah: 10 },
      { namaObat: "Amoxicillin 500 mg", aturanPakai: "3 x 1 kapsul", jumlah: 15 },
      ...(idx % 2 === 0
        ? [{ namaObat: "Ambroxol 30 mg", aturanPakai: "3 x 1 tablet", jumlah: 10 }]
        : []),
    ],
    anjuran:
      "Istirahat cukup, perbanyak minum air putih. Kontrol kembali bila keluhan memberat atau demam tidak turun dalam 3 hari.",
  };

  return delay(resume);
}
