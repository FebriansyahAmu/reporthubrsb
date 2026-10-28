import { describe, expect, it } from "vitest";
import { adalahKegiatan, kategoriAkhir, saranJenisKegiatan } from "./rl35.constants";
import { bulanTercakup, nilaiDari, petaEfektif, susunRl35 } from "./rl35.hitung";
import { rl35QuerySchema, simpanPemetaanRl35Schema } from "./rl35.schema";
import type { BarisAgregat, KategoriRl35, RuanganRow } from "./rl35.types";

/** refrl RL 3.5 (SIRS 6) SIMGOS: 1–34 jenis kegiatan + 66, 77, 99, 100. */
const KATEGORI: KategoriRl35[] = [
  ...Array.from({ length: 34 }, (_, i) => ({ id: i + 1, kode: String(i + 1), deskripsi: `Kegiatan ${i + 1}` })),
  ...[66, 77, 99, 100].map((id) => ({ id, kode: String(id), deskripsi: `Baris ${id}` })),
];
const KEGIATAN = new Set(KATEGORI.filter((k) => adalahKegiatan(k.id)).map((k) => k.id));
const kegiatanById = new Map(KATEGORI.filter((k) => adalahKegiatan(k.id)).map((k) => [k.id, k]));

const rj = (id: string, nama: string, aktif = true): RuanganRow => ({ id, nama, jenisKunjungan: 1, aktif });
const gd = (id: string, nama: string): RuanganRow => ({ id, nama, jenisKunjungan: 2, aktif: true });
const agr = (o: Partial<BarisAgregat> & Pick<BarisAgregat, "ruangan" | "n">): BarisAgregat => ({
  jk: 1,
  dom: 1,
  stroke: false,
  neonatal: false,
  gravid: false,
  ...o,
});

describe("saran jenis kegiatan (pemetaan bawaan)", () => {
  it("17 poliklinik & ruang IGD SIMGOS (28 Okt 2026) mendapat jenis kegiatan yang benar", () => {
    const harap: [string, number, number][] = [
      ["KLINIK ANAK", 1, 4],
      ["KLINIK BEDAH", 1, 2],
      ["KLINIK FISIOTERAPY", 1, 25],
      ["KLINIK GIGI", 1, 14],
      ["KLINIK GIZI", 1, 27],
      ["KLINIK INTERNA", 1, 1],
      ["KLINIK KIA/KB", 1, 7],
      ["KLINIK MATA", 1, 12],
      ["KLINIK MCU", 1, 29],
      ["KLINIK OBGYN", 1, 6],
      ["KLINIK RADIOLOGI", 1, 17],
      ["KLINIK REHAB MEDIK", 1, 25],
      ["KLINIK SARAF", 1, 33],
      ["BEDAH", 2, 24],
      ["IRDA", 2, 24],
      ["IRDO", 2, 24],
      ["NON BEDAH", 2, 24],
    ];
    for (const [nama, jk, id] of harap) expect(saranJenisKegiatan(nama, jk, KEGIATAN), nama).toBe(id);
  });

  it("aturan spesifik lebih dulu; nama tak dikenal tanpa saran; saran di luar refrl dibuang", () => {
    expect(saranJenisKegiatan("KLINIK BEDAH SARAF", 1, KEGIATAN)).toBe(31);
    expect(saranJenisKegiatan("KLINIK BEDAH ORTHOPEDI", 1, KEGIATAN)).toBe(18);
    expect(saranJenisKegiatan("KLINIK JANTUNG", 1, KEGIATAN)).toBe(16);
    expect(saranJenisKegiatan("KLINIK THT-KL", 1, KEGIATAN)).toBe(11);
    expect(saranJenisKegiatan("POLI X", 1, KEGIATAN)).toBeNull();
    expect(saranJenisKegiatan("KLINIK MATA", 1, new Set([1]))).toBeNull();
    expect(saranJenisKegiatan("IRDA", 2, new Set([1]))).toBeNull();
  });

  it("baris rata-rata, total & penanda SIRS bukan jenis kegiatan", () => {
    expect([66, 77, 99, 100].map(adalahKegiatan)).toEqual([false, false, false, false]);
    expect([1, 24, 34].map(adalahKegiatan)).toEqual([true, true, true]);
  });
});

describe("pemindahan baris karena diagnosis (aturan SP)", () => {
  const dx = (o: Partial<Record<"neonatal" | "gravid" | "stroke", boolean>>) => ({ neonatal: false, gravid: false, stroke: false, ...o });
  it("4→3 neonatal, 6→5 gravid, 31→30 & 33→32 stroke; lainnya tetap", () => {
    expect(kategoriAkhir(4, dx({ neonatal: true }))).toEqual({ id: 3, alasan: "neonatal" });
    expect(kategoriAkhir(6, dx({ gravid: true }))).toEqual({ id: 5, alasan: "gravid" });
    expect(kategoriAkhir(31, dx({ stroke: true }))).toEqual({ id: 30, alasan: "stroke" });
    expect(kategoriAkhir(33, dx({ stroke: true }))).toEqual({ id: 32, alasan: "stroke" });
    // Diagnosis tak cocok dengan baris ruangan → tidak pindah (SP hanya memeriksa pasangan tsb).
    expect(kategoriAkhir(1, dx({ stroke: true, gravid: true, neonatal: true }))).toEqual({ id: 1, alasan: null });
    expect(kategoriAkhir(4, dx({ gravid: true }))).toEqual({ id: 4, alasan: null });
    expect(kategoriAkhir(33, dx({}))).toEqual({ id: 33, alasan: null });
  });
});

describe("nilaiDari & petaEfektif", () => {
  it("kolom formulir: L/P dari jenis kelamin, dalam/luar dari domisili (tak tercatat = luar)", () => {
    expect(nilaiDari({ jk: 1, dom: 1, n: 3 })).toEqual({ total: 3, lk: 3, pr: 0, dalamLk: 3, dalamPr: 0, luarLk: 0, luarPr: 0 });
    expect(nilaiDari({ jk: 2, dom: 0, n: 2 })).toEqual({ total: 2, lk: 0, pr: 2, dalamLk: 0, dalamPr: 0, luarLk: 0, luarPr: 2 });
    expect(nilaiDari({ jk: 2, dom: 2, n: 1 })).toMatchObject({ luarPr: 1, dalamPr: 0 });
    // Jenis kelamin tak tercatat: hanya jumlah (SP: IF(JK=1) / IF(JK!=1) → NULL = 0 di keduanya).
    expect(nilaiDari({ jk: 0, dom: 1, n: 4 })).toEqual({ total: 4, lk: 0, pr: 0, dalamLk: 0, dalamPr: 0, luarLk: 0, luarPr: 0 });
  });

  it("tersimpan > bawaan (saran) > belum; ID usang = belum; null = dikecualikan", () => {
    const klinik = rj("101030102", "KLINIK INTERNA");
    expect(petaEfektif(klinik, undefined, kegiatanById)).toMatchObject({ status: "bawaan", kategori: { id: 1 }, saran: 1 });
    expect(petaEfektif(klinik, { rlId: 15 }, kegiatanById)).toMatchObject({ status: "terpetakan", kategori: { id: 15 } });
    expect(petaEfektif(klinik, { rlId: null }, kegiatanById)).toMatchObject({ status: "dikecualikan", kategori: null });
    expect(petaEfektif(klinik, { rlId: 99 }, kegiatanById)).toMatchObject({ status: "belum", kategori: null });
    expect(petaEfektif(rj("1", "POLI X"), undefined, kegiatanById)).toMatchObject({ status: "belum", kategori: null, saran: null });
  });
});

describe("susunRl35", () => {
  const ruangan = [
    rj("101030102", "KLINIK INTERNA"),
    rj("101030112", "KLINIK SARAF"),
    rj("101030105", "KLINIK ANAK"),
    rj("101030199", "POLI X"),
    rj("101030113", "KLINIK RADIOLOGI"),
    gd("101010102", "NON BEDAH"),
    gd("101010103", "IRDA"),
  ];
  const agregat = [
    agr({ ruangan: "101030102", n: 10 }),
    agr({ ruangan: "101030102", jk: 2, dom: 0, n: 5 }),
    agr({ ruangan: "101030112", jk: 2, n: 7 }),
    agr({ ruangan: "101030112", jk: 1, dom: 2, n: 2, stroke: true }),
    agr({ ruangan: "101030105", jk: 1, n: 3, neonatal: true }),
    agr({ ruangan: "101030199", n: 4 }),
    agr({ ruangan: "101030113", n: 6 }),
    agr({ ruangan: "101010102", jk: 2, n: 20 }),
    agr({ ruangan: "101010103", jk: 1, n: 8 }),
  ];
  const hari = [
    { tanggal: "2026-09-01", ruangan: ["101030102", "101030112"] },
    { tanggal: "2026-09-02", ruangan: ["101030199"] }, // hanya poliklinik belum dipetakan → bukan hari buka
    { tanggal: "2026-09-03", ruangan: ["101030113"] }, // dikecualikan → bukan hari buka
    { tanggal: "2026-09-04", ruangan: ["101030105"] },
  ];
  const peta = new Map([["101030113", { ruanganId: "101030113", rlId: null }]]);
  const h = susunRl35({ kategori: KATEGORI, ruangan, agregat, hari, peta, from: "2026-09-01", to: "2026-09-30" });
  const baris = (id: number) => h.baris.find((b) => b.id === id)!;

  it("baris = 34 jenis kegiatan (tanpa 66/77/99/100); angka per kategori + pindah baris", () => {
    expect(h.baris).toHaveLength(34);
    expect(baris(1).nilai).toEqual({ total: 15, lk: 10, pr: 5, dalamLk: 10, dalamPr: 0, luarLk: 0, luarPr: 5 });
    expect(baris(33).nilai.total).toBe(7);
    expect(baris(32).nilai).toMatchObject({ total: 2, lk: 2, luarLk: 2 }); // stroke, domisili tak tercatat = luar
    expect(baris(32).ruangan).toEqual([{ id: "101030112", nama: "KLINIK SARAF", alasan: "stroke" }]);
    expect(baris(3).nilai.total).toBe(3);
    expect(baris(4).nilai.total).toBe(0);
    expect(baris(24).nilai.total).toBe(28); // semua ruang IGD
  });

  it("ruangan belum dipetakan & dikecualikan tidak masuk total; belum dipetakan diperingatkan", () => {
    expect(h.total.total).toBe(15 + 9 + 3 + 28);
    expect(h.belumDipetakan).toEqual([{ id: "101030199", nama: "POLI X", kunjungan: 4 }]);
    const radiologi = h.ruangan.find((r) => r.id === "101030113")!;
    expect([radiologi.status, radiologi.nilai.total, radiologi.kategori]).toEqual(["dikecualikan", 6, null]);
  });

  it("rincian ruangan memuat bagian yang pindah baris (sudah termasuk di nilai ruangan)", () => {
    const saraf = h.ruangan.find((r) => r.id === "101030112")!;
    expect(saraf.nilai.total).toBe(9);
    expect(saraf.pindah).toEqual([{ kategori: kegiatanById.get(32), alasan: "stroke", nilai: expect.objectContaining({ total: 2 }) }]);
    expect(h.ruangan.map((r) => r.jenisKunjungan)).toEqual([1, 1, 1, 1, 1, 2, 2]);
  });

  it("baris 66 & 77: hanya poliklinik terlaporkan; domisili tak tercatat dihitung", () => {
    expect(h.rataRata).toEqual({ hariBuka: 2, bulan: 1, rataHariBuka: 2, kunjunganRj: 27, rataKunjunganPerHari: 13.5 });
    expect(h.domisiliTakTercatat).toBe(2);
  });

  it("tanpa hari buka → rata-rata kunjungan null; triwulan membagi 3", () => {
    const k = susunRl35({ kategori: KATEGORI, ruangan, agregat: [], hari: [], peta, from: "2026-07-01", to: "2026-09-30" });
    expect(k.rataRata).toEqual({ hariBuka: 0, bulan: 3, rataHariBuka: 0, kunjunganRj: 0, rataKunjunganPerHari: null });
    expect(k.total.total).toBe(0);
    expect(k.belumDipetakan).toEqual([]);
  });

  it("bulanTercakup: sebagian bulan = 1, lintas tahun dihitung", () => {
    expect(bulanTercakup("2026-09-01", "2026-09-15")).toBe(1);
    expect(bulanTercakup("2026-07-01", "2026-09-30")).toBe(3);
    expect(bulanTercakup("2025-12-20", "2026-01-10")).toBe(2);
    expect(bulanTercakup("2025-01-01", "2025-12-31")).toBe(12);
  });
});

describe("schema", () => {
  it("periode sah, ≤ 366 hari, tanggal kalender valid", () => {
    expect(rl35QuerySchema.safeParse({ from: "2026-09-01", to: "2026-09-30" }).success).toBe(true);
    expect(rl35QuerySchema.safeParse({ from: "2026-02-30", to: "2026-03-01" }).success).toBe(false);
    expect(rl35QuerySchema.safeParse({ from: "2026-09-30", to: "2026-09-01" }).success).toBe(false);
    expect(rl35QuerySchema.safeParse({ from: "2025-01-01", to: "2026-01-02" }).success).toBe(false);
    expect(rl35QuerySchema.safeParse({ from: "2026-09-01'--", to: "2026-09-30" }).success).toBe(false);
  });

  it("pemetaan: ruangan angka, tujuan ID/kecualikan/kosongkan, tanpa ganda & kunci asing", () => {
    const ok = (perubahan: unknown) => simpanPemetaanRl35Schema.safeParse({ perubahan }).success;
    expect(ok([{ ruanganId: "101030102", tujuan: 1 }, { ruanganId: "101030113", tujuan: "kecualikan" }])).toBe(true);
    expect(ok([{ ruanganId: "101030102", tujuan: "kosongkan" }])).toBe(true);
    expect(ok([])).toBe(false);
    expect(ok([{ ruanganId: "1' OR 1=1", tujuan: 1 }])).toBe(false);
    expect(ok([{ ruanganId: "101030102", tujuan: "hapus" }])).toBe(false);
    expect(ok([{ ruanganId: "101030102", tujuan: 1 }, { ruanganId: "101030102", tujuan: 2 }])).toBe(false);
    expect(ok([{ ruanganId: "101030102", tujuan: 1, pisahDpjp: true }])).toBe(false);
    expect(simpanPemetaanRl35Schema.safeParse({ perubahan: [{ ruanganId: "1", tujuan: 1 }], smf: [] }).success).toBe(false);
  });
});
