import { describe, expect, it } from "vitest";
import { domisiliQuerySchema } from "./domisili.schema";
import { kelasDari, klasifikasi, labelKabKota, namaRapi, type BarisAgregat } from "./domisili.olah";

const KAB = "7110";
const KECAMATAN = [
  { kode: "711001", nama: "TUTUYAN" },
  { kode: "711002", nama: "KOTABUNAN" },
  { kode: "711003", nama: "NUANGAN" },
];

/** Baris agregat: jenis 1 RJ / 2 IGD / 3 RI, null = subtotal kecamatan. */
const b = (
  kec: string,
  jenis: number | null,
  kunjungan: number,
  pasien: number,
  nama: Partial<Pick<BarisAgregat, "namaKab" | "namaKec" | "namaProv">> = {},
): BarisAgregat => ({ kec, jenis, kunjungan, pasien, namaKab: null, namaKec: null, namaProv: null, ...nama });

const BOLTIM = { namaKab: "BOLAANG MONGONDOW TIMUR", namaProv: "SULAWESI UTARA" };

describe("klasifikasi domisili", () => {
  const baris: BarisAgregat[] = [
    // Tutuyan: IGD 5 (4 pasien), RI 2 (2) → semua 7 kunjungan, 5 pasien (1 pasien ke IGD & RI)
    b("711001", 2, 5, 4, { ...BOLTIM, namaKec: "TUTUYAN" }),
    b("711001", 3, 2, 2, { ...BOLTIM, namaKec: "TUTUYAN" }),
    b("711001", null, 7, 5, { ...BOLTIM, namaKec: "TUTUYAN" }),
    // Kode kabupaten saja (tanpa kecamatan) → dalam, kecamatan tidak tercatat
    b("7110", 1, 1, 1, BOLTIM),
    b("7110", null, 1, 1, BOLTIM),
    // Kecamatan tak dikenal di bawah 7110 → dalam, tidak tercatat
    b("711099", 2, 1, 1, BOLTIM),
    b("711099", null, 1, 1, BOLTIM),
    // Luar: Kotamobagu (2 kecamatan) & Kab. Gorontalo
    b("717401", 1, 3, 2, { namaKab: "KOTAMOBAGU", namaProv: "SULAWESI UTARA" }),
    b("717401", null, 3, 2, { namaKab: "KOTAMOBAGU", namaProv: "SULAWESI UTARA" }),
    b("717402", 2, 4, 4, { namaKab: "KOTAMOBAGU", namaProv: "SULAWESI UTARA" }),
    b("717402", null, 4, 4, { namaKab: "KOTAMOBAGU", namaProv: "SULAWESI UTARA" }),
    b("750101", 3, 1, 1, { namaKab: "GORONTALO", namaProv: "GORONTALO" }),
    b("750101", null, 1, 1, { namaKab: "GORONTALO", namaProv: "GORONTALO" }),
    // Tanpa wilayah & kode rusak (kabupaten tak dikenal)
    b("", 2, 2, 2),
    b("", null, 2, 2),
    b("999901", 1, 1, 1),
    b("999901", null, 1, 1),
  ];
  const hasil = klasifikasi({ baris, total: { kunjungan: 21, pasien: 18 } }, KAB, KECAMATAN);

  it("ringkasan dalam / luar / tidak tercatat per layanan & semua", () => {
    expect(hasil.ringkasan.dalam.igd).toEqual({ kunjungan: 6, pasien: 5 });
    expect(hasil.ringkasan.dalam.ri).toEqual({ kunjungan: 2, pasien: 2 });
    expect(hasil.ringkasan.dalam.rj).toEqual({ kunjungan: 1, pasien: 1 });
    expect(hasil.ringkasan.dalam.semua).toEqual({ kunjungan: 9, pasien: 7 });
    expect(hasil.ringkasan.luar.semua).toEqual({ kunjungan: 8, pasien: 7 });
    expect(hasil.ringkasan.tidakDiketahui.semua).toEqual({ kunjungan: 3, pasien: 3 });
  });

  it("total: kunjungan dijumlah; pasien semua layanan dari total ROLLUP", () => {
    expect(hasil.ringkasan.total.semua.kunjungan).toBe(20);
    expect(hasil.ringkasan.total.igd.kunjungan).toBe(6 + 4 + 2);
    expect(hasil.ringkasan.total.semua.pasien).toBe(18);
  });

  it("semua kecamatan resmi tampil (yang nol juga) + baris 'tidak tercatat' di akhir", () => {
    expect(hasil.kecamatan.map((k) => [k.kode, k.nama, k.nilai.semua.kunjungan])).toEqual([
      ["711001", "Tutuyan", 7],
      ["711002", "Kotabunan", 0],
      ["711003", "Nuangan", 0],
      ["", "Kecamatan tidak tercatat", 2],
    ]);
  });

  it("rincian luar per kabupaten/kota (kecamatan digabung), terbanyak dulu, kota vs kabupaten", () => {
    expect(hasil.luar.map((l) => [l.kode, l.nama, l.provinsi, l.nilai.semua.kunjungan, l.nilai.semua.pasien])).toEqual([
      ["7174", "Kota Kotamobagu", "Sulawesi Utara", 7, 6],
      ["7501", "Kab. Gorontalo", "Gorontalo", 1, 1],
    ]);
  });

  it("tanpa data → semua nol, kecamatan tetap terdaftar, tanpa baris tidak tercatat", () => {
    const k = klasifikasi({ baris: [], total: { kunjungan: 0, pasien: 0 } }, KAB, KECAMATAN);
    expect(k.ringkasan.total.semua).toEqual({ kunjungan: 0, pasien: 0 });
    expect(k.kecamatan).toHaveLength(3);
    expect(k.luar).toEqual([]);
  });
});

describe("aturan bantu", () => {
  it("kelas: kosong → tidak tercatat; prefiks kabupaten → dalam; kabupaten dikenal → luar; rusak → tidak tercatat", () => {
    expect(kelasDari("", KAB, false)).toBe("tidakDiketahui");
    expect(kelasDari("711004", KAB, true)).toBe("dalam");
    expect(kelasDari("7110", KAB, true)).toBe("dalam");
    expect(kelasDari("710501", KAB, true)).toBe("luar");
    expect(kelasDari("999901", KAB, false)).toBe("tidakDiketahui");
  });

  it("label kabupaten vs kota menurut kode Kemendagri", () => {
    expect(labelKabKota("7501", "GORONTALO")).toBe("Kab. Gorontalo");
    expect(labelKabKota("7571", "GORONTALO")).toBe("Kota Gorontalo");
    expect(labelKabKota("7174", "KOTAMOBAGU")).toBe("Kota Kotamobagu");
    expect(labelKabKota("3175", null)).toBe("Kota 3175");
  });

  it("nama rapi", () => {
    expect(namaRapi("BOLAANG MONGONDOW TIMUR")).toBe("Bolaang Mongondow Timur");
    expect(namaRapi("  MODAYAG BARAT ")).toBe("Modayag Barat");
    expect(namaRapi(null)).toBe("");
  });
});

describe("validasi periode", () => {
  const parse = (from: string, to: string) => domisiliQuerySchema.safeParse({ from, to });

  it("rentang sah, termasuk satu tahun kabisat penuh", () => {
    expect(parse("2026-10-01", "2026-10-31").success).toBe(true);
    expect(parse("2024-01-01", "2024-12-31").success).toBe(true);
  });

  it("tolak tanggal tak valid, terbalik, > 366 hari, dan format/injeksi", () => {
    expect(parse("2026-02-30", "2026-03-01").success).toBe(false);
    expect(parse("2026-10-31", "2026-10-01").success).toBe(false);
    expect(parse("2025-01-01", "2026-01-02").success).toBe(false);
    expect(parse("2026-10-01' OR 1=1 --", "2026-10-31").success).toBe(false);
    expect(domisiliQuerySchema.safeParse({ from: "2026-10-01" }).success).toBe(false);
  });
});
