import { describe, expect, it } from "vitest";
import { grupMetrik, labelTempatTidur, METRIK_RL32, metrikRl32, saranJenisPelayanan } from "./rl32.constants";
import { jumlahkan, nilaiKosong, nilaiPerRuangan, nilaiPerRuanganSmf, statusPeta, susunRl32, type MasukanSusun } from "./rl32.hitung";
import { judulPeriode, rentangBulan, rentangTriwulan, satuanPeriode, selisihHari, tambahHari } from "./rl32.periode";
import { rl32QuerySchema, simpanPemetaanSchema } from "./rl32.schema";
import type { BarisAgregat, KategoriRl32, PetaTersimpan } from "./rl32.types";

const KATEGORI: KategoriRl32[] = [
  { id: 2, kode: "2", deskripsi: "Penyakit Dalam" },
  { id: 3, kode: "3", deskripsi: "Kesehatan Anak" },
  { id: 7, kode: "7", deskripsi: "Bedah" },
  { id: 11, kode: "11", deskripsi: "Saraf" },
  { id: 33, kode: "33", deskripsi: "Isolasi" },
];
const ID_VALID = new Set([2, 3, 4, 5, 6, 7, 10, 27, 28, 29, 30, 31, 32, 33, 36]);
// SMF (master.referensi JENIS 26): 1 Interna, 11 Anak, 13 Bedah Umum, 15 Saraf.
const NAMA_SMF = new Map([[1, "Interna"], [11, "Anak"], [13, "Bedah Umum"], [15, "Saraf"]]);

const agr = (ruangan: string, metrik: string, total: number, lk: number, pr: number, smf = 1): BarisAgregat => ({
  ruangan,
  smf,
  metrik,
  total,
  lk,
  pr,
});
const peta = (ruanganId: string, rlId: number | null, pisahDpjp = false): [string, PetaTersimpan] => [ruanganId, { ruanganId, rlId, pisahDpjp }];

describe("nilaiPerRuangan", () => {
  const perSmf = nilaiPerRuanganSmf([
    agr("A", "awal", 3, 1, 2),
    agr("A", "masuk", 10, 4, 6),
    agr("A", "pindahan", 2, 1, 1),
    agr("A", "hidup", 9, 3, 6),
    agr("A", "matiKurang48", 1, 1, 0),
    agr("A", "matiLebih48", 1, 0, 1),
    agr("A", "matiTanpaDurasi", 1, 0, 1),
    agr("A", "keluarTanpaCara", 5, 5, 0),
    agr("A", "sisa", 2, 1, 1),
    agr("A", "lamaDirawat", 40, 15, 25),
    agr("A", "hp5", 20, 10, 10),
    agr("A", "hp5", 10, 0, 10, 15),
    agr("A", "hp3", 5, 5, 0),
    agr("A", "hp0", 2, 0, 2),
  ]);
  const n = nilaiPerRuangan(perSmf, new Map([["A", 20], ["B", 4]])).get("A")!;

  it("mati = < 48 + ≥ 48 + tanpa durasi; keluar tanpa cara tak masuk kolom mana pun", () => {
    expect(n.mati).toEqual({ total: 3, lk: 1, pr: 2 });
    expect(n.matiKurang48.total).toBe(1);
    expect(n.matiLebih48.total).toBe(1);
    expect(n.hidup.total).toBe(9);
  });

  it("hari perawatan = semua kelas (termasuk kelas tak terpetakan) & semua SMF, kolom kelas per RL_KELAS", () => {
    expect(n.hariPerawatan).toEqual({ total: 37, lk: 15, pr: 22 });
    expect(n.kelas3.total).toBe(30);
    expect(n.kelas1.total).toBe(5);
    expect(n.vvip.total).toBe(0);
    expect(perSmf.get("A")?.get(15)?.hariPerawatan.total).toBe(10);
  });

  it("dipindahkan = (awal + masuk + pindahan) − (hidup + mati + sisa), per L/P", () => {
    expect(n.dipindahkan).toEqual({ total: 15 - 14, lk: 6 - 5, pr: 9 - 9 });
  });

  it("TT per ruangan; ruangan hanya ber-TT tetap muncul", () => {
    const p = nilaiPerRuangan(new Map(), new Map([["B", 4]]));
    expect(p.get("B")?.tempatTidur).toBe(4);
    expect(n.tempatTidur).toBe(20);
  });
});

describe("statusPeta", () => {
  const k = new Map(KATEGORI.map((x) => [x.id, x]));
  it("tanpa baris = belum; rlId null = dikecualikan; rlId usang = belum", () => {
    expect(statusPeta(undefined, k).status).toBe("belum");
    expect(statusPeta({ rlId: null }, k).status).toBe("dikecualikan");
    expect(statusPeta({ rlId: 99 }, k).status).toBe("belum");
    expect(statusPeta({ rlId: 3 }, k)).toEqual({ status: "terpetakan", kategori: KATEGORI[1] });
  });
});

const dasar = (over: Partial<MasukanSusun> = {}): MasukanSusun => ({
  kategori: KATEGORI,
  ruanganRi: [
    { id: "A1", nama: "Anak 1", aktif: true },
    { id: "A2", nama: "Anak 2", aktif: true },
    { id: "I1", nama: "Interna", aktif: true },
    { id: "X1", nama: "Transit", aktif: true },
    { id: "V1", nama: "VIP", aktif: true },
    { id: "K1", nama: "Kosong", aktif: true },
  ],
  ruanganLain: new Map([["L9", { nama: "Ruang lama", aktif: false }]]),
  perSmf: nilaiPerRuanganSmf([
    agr("A1", "masuk", 5, 2, 3, 11),
    agr("A2", "masuk", 4, 1, 3, 11),
    agr("A2", "masuk", 1, 1, 0, 13), // pasien bedah di ruang anak
    agr("I1", "masuk", 7, 4, 3, 1),
    agr("I1", "masuk", 3, 2, 1, 15), // pasien saraf di ruang interna
    agr("I1", "masuk", 2, 1, 1, 13), // pasien bedah di ruang interna
    agr("I1", "masuk", 1, 0, 1, 11), // pasien anak di ruang interna (SMF tanpa aturan)
    agr("X1", "masuk", 2, 1, 1),
    agr("L9", "masuk", 1, 1, 0),
  ]),
  tempatTidur: new Map([["A1", 3], ["I1", 20], ["V1", 1]]),
  peta: new Map([peta("A1", 3), peta("A2", 3), peta("I1", 2), peta("X1", null)]),
  petaSmf: new Map([[15, 11], [13, 7]]),
  namaSmf: NAMA_SMF,
  ...over,
});

describe("susunRl32 — per ruangan", () => {
  const hasil = susunRl32(dasar());

  it("semua jenis pelayanan tampil, urut masukan; ruangan dijumlahkan utuh ke kategorinya (tanpa pisah DPJP)", () => {
    expect(hasil.baris.map((b) => b.id)).toEqual([2, 3, 7, 11, 33]);
    expect(hasil.baris[1].nilai.masuk).toEqual({ total: 10, lk: 4, pr: 6 });
    expect(hasil.baris[1].ruangan).toEqual([{ id: "A1", nama: "Anak 1", smf: null }, { id: "A2", nama: "Anak 2", smf: null }]);
    expect(hasil.baris[0].nilai.masuk.total).toBe(13);
    expect(hasil.baris[1].nilai.tempatTidur).toBe(3);
    expect(hasil.baris[4].nilai.tempatTidur).toBeNull();
    expect(hasil.baris[2].nilai.masuk.total).toBe(0);
  });

  it("total = hanya ruangan terpetakan (dikecualikan & belum tidak dihitung)", () => {
    expect(hasil.total.masuk.total).toBe(23);
    expect(hasil.total.tempatTidur).toBe(23);
  });

  it("peringatan: ruangan belum dipetakan yang beraktivitas (pasien atau TT), termasuk ruangan di luar daftar RI", () => {
    expect(hasil.belumDipetakan.map((r) => r.id).sort()).toEqual(["L9", "V1"]);
    expect(hasil.belumDipetakan.find((r) => r.id === "V1")).toMatchObject({ pasien: 0, tempatTidur: 1 });
    expect(hasil.ruangan.find((r) => r.id === "L9")).toMatchObject({ nama: "Ruang lama", aktif: false, status: "belum" });
    expect(hasil.ruangan.find((r) => r.id === "K1")?.aktivitas).toBe(false);
    expect(hasil.ruangan.every((r) => !r.pisahDpjp && r.bagian.length === 0)).toBe(true);
  });

  it("jumlahkan menghitung ulang dipindahkan dari hasil jumlah", () => {
    const a = nilaiKosong();
    a.masuk = { total: 5, lk: 2, pr: 3 };
    a.hidup = { total: 3, lk: 1, pr: 2 };
    const b = nilaiKosong();
    b.awal = { total: 2, lk: 1, pr: 1 };
    const j = jumlahkan([a, b]);
    expect(j.dipindahkan).toEqual({ total: 4, lk: 2, pr: 2 });
  });
});

describe("susunRl32 — pisah menurut SMF DPJP", () => {
  const tanpa = susunRl32(dasar());
  const hasil = susunRl32(dasar({ peta: new Map([peta("A1", 3), peta("A2", 3), peta("I1", 2, true), peta("X1", null, true)]) }));
  const baris = (id: number) => hasil.baris.find((b) => b.id === id)!;

  it("pasien Saraf/Bedah di ruang Interna pindah ke jenis pelayanannya; SMF tanpa aturan ikut ruangan", () => {
    expect(baris(11).nilai.masuk).toEqual({ total: 3, lk: 2, pr: 1 });
    expect(baris(7).nilai.masuk).toEqual({ total: 2, lk: 1, pr: 1 });
    expect(baris(2).nilai.masuk.total).toBe(8); // 7 Interna + 1 Anak (tanpa aturan → ikut ruangan)
    expect(baris(11).ruangan).toEqual([{ id: "I1", nama: "Interna", smf: ["Saraf"] }]);
    expect(baris(2).ruangan).toEqual([{ id: "I1", nama: "Interna", smf: ["Anak", "Interna"] }]);
  });

  it("ruangan tanpa pisah tak berubah (bedah di ruang Anak tetap Kesehatan Anak)", () => {
    expect(baris(3).nilai.masuk.total).toBe(10);
  });

  it("TT tetap milik jenis pelayanan ruangan; jumlah keseluruhan tak berubah", () => {
    expect(baris(2).nilai.tempatTidur).toBe(20);
    expect(baris(11).nilai.tempatTidur).toBeNull();
    expect(hasil.total).toEqual(tanpa.total);
  });

  it("rincian ruangan: bagian per jenis pelayanan (urut ID) yang jumlahnya = ruangan", () => {
    const i1 = hasil.ruangan.find((r) => r.id === "I1")!;
    expect(i1.pisahDpjp).toBe(true);
    expect(i1.bagian.map((b) => [b.kategori.id, b.smf.map((s) => s.nama)])).toEqual([[2, ["Anak", "Interna"]], [7, ["Bedah Umum"]], [11, ["Saraf"]]]);
    expect(jumlahkan(i1.bagian.map((b) => b.nilai))).toEqual(i1.nilai);
  });

  it("pisah DPJP diabaikan untuk ruangan dikecualikan", () => {
    expect(hasil.ruangan.find((r) => r.id === "X1")).toMatchObject({ status: "dikecualikan", pisahDpjp: false, bagian: [] });
  });

  it("aturan SMF ke ID jenis pelayanan usang diabaikan (ikut ruangan)", () => {
    const h = susunRl32(dasar({ peta: new Map([peta("I1", 2, true)]), petaSmf: new Map([[15, 99]]) }));
    expect(h.baris.find((b) => b.id === 2)?.nilai.masuk.total).toBe(13);
  });
});

describe("saranJenisPelayanan", () => {
  it("nama ruangan SIMGOS → jenis pelayanan; kata spesifik lebih dulu", () => {
    expect(saranJenisPelayanan("PERAWATAN ANAK KELAS 1", ID_VALID)).toBe(3);
    expect(saranJenisPelayanan("PERAWATAN INTERNA KELAS 3", ID_VALID)).toBe(2);
    expect(saranJenisPelayanan("PERAWATAN ISOLASI KELAS 3", ID_VALID)).toBe(33);
    expect(saranJenisPelayanan("PERAWATAN OBGYN KELAS 3", ID_VALID)).toBe(5);
    expect(saranJenisPelayanan("ICU", ID_VALID)).toBe(27);
    expect(saranJenisPelayanan("ICCU", ID_VALID)).toBe(29);
    expect(saranJenisPelayanan("NICU/NEONATI", ID_VALID)).toBe(31);
    expect(saranJenisPelayanan("RICU", ID_VALID)).toBe(30);
  });
  it("nama tak jelas → tanpa saran; ID saran tak ada di refrl → tanpa saran", () => {
    expect(saranJenisPelayanan("PERAWATAN UMUM VIP", ID_VALID)).toBeNull();
    expect(saranJenisPelayanan("ICU", new Set([2]))).toBeNull();
  });
});

describe("kolom laporan", () => {
  it("17 kolom angka sesuai urutan SP; grup Mati (3) & Kelas (6) bersebelahan", () => {
    expect(METRIK_RL32).toHaveLength(17);
    const g = grupMetrik();
    expect(g.find((x) => x.grup === "Pasien Keluar Mati")?.metrik.map((m) => m.key)).toEqual(["mati", "matiKurang48", "matiLebih48"]);
    expect(g.find((x) => x.grup?.startsWith("Rincian"))?.metrik).toHaveLength(6);
    expect(g.reduce((s, x) => s + x.metrik.length, 0)).toBe(17);
  });
});

describe("periode", () => {
  it("tambahHari lintas bulan/tahun & kabisat", () => {
    expect(tambahHari("2026-09-30", 1)).toBe("2026-10-01");
    expect(tambahHari("2026-12-31", 1)).toBe("2027-01-01");
    expect(tambahHari("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("judul: bulan, triwulan, tahun penuh vs rentang lain", () => {
    expect(judulPeriode("2026-09-01", "2026-09-30")).toBe("September 2026");
    expect(judulPeriode("2026-02-01", "2026-02-28")).toBe("Februari 2026");
    expect(judulPeriode("2026-09-01", "2026-09-15")).toBe("1 Sep 2026 – 15 Sep 2026");
    expect(judulPeriode("2026-01-01", "2026-03-31")).toBe("Triwulan I 2026");
    expect(judulPeriode("2026-07-01", "2026-09-30")).toBe("Triwulan III 2026");
    expect(judulPeriode("2026-10-01", "2026-12-31")).toBe("Triwulan IV 2026");
    expect(judulPeriode("2025-01-01", "2025-12-31")).toBe("Tahun 2025");
    // Tiga bulan tetapi bukan batas triwulan → rentang.
    expect(judulPeriode("2026-02-01", "2026-04-30")).toBe("1 Feb 2026 – 30 Apr 2026");
    expect(judulPeriode("2026-07-01", "2026-09-29")).toBe("1 Jul 2026 – 29 Sep 2026");
  });
  it("satuan label kolom & rentang triwulan/bulan (kabisat)", () => {
    expect(satuanPeriode("2026-09-01", "2026-09-30")).toBe("Bulan");
    expect(satuanPeriode("2026-04-01", "2026-06-30")).toBe("Triwulan");
    expect(satuanPeriode("2024-01-01", "2024-12-31")).toBe("Tahun");
    expect(satuanPeriode("2026-01-01", "2026-06-30")).toBe("Periode");
    expect(satuanPeriode("2026-09-02", "2026-09-30")).toBe("Periode");
    expect(rentangTriwulan(2024, 1)).toEqual({ from: "2024-01-01", to: "2024-03-31" });
    expect(rentangTriwulan(2026, 4)).toEqual({ from: "2026-10-01", to: "2026-12-31" });
    expect(rentangBulan(2028, 2)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(selisihHari("2026-07-01", "2026-09-30")).toBe(91);
  });
  it("label kolom awal/akhir & alokasi TT mengikuti satuan; kunci & urutan tetap", () => {
    const tw = metrikRl32("Triwulan");
    expect(tw.find((m) => m.key === "awal")).toMatchObject({ label: "Pasien Awal Triwulan", sub: "Awal Triwulan" });
    expect(tw.find((m) => m.key === "sisa")).toMatchObject({ label: "Pasien Akhir Triwulan", sub: "Akhir Triwulan" });
    expect(tw.map((m) => m.key)).toEqual(METRIK_RL32.map((m) => m.key));
    expect(metrikRl32()).toBe(METRIK_RL32);
    expect(metrikRl32("Periode").find((m) => m.key === "awal")?.label).toBe("Pasien Awal Periode");
    expect(labelTempatTidur("Tahun")).toBe("Jumlah Alokasi TT Awal Tahun");
    expect(grupMetrik("Triwulan")[0].metrik[0].sub).toBe("Awal Triwulan");
  });
});

describe("skema", () => {
  it("periode valid; tolak tanggal mustahil, terbalik, dan > 366 hari", () => {
    expect(rl32QuerySchema.safeParse({ from: "2026-09-01", to: "2026-09-30" }).success).toBe(true);
    expect(rl32QuerySchema.safeParse({ from: "2026-02-30", to: "2026-03-01" }).success).toBe(false);
    expect(rl32QuerySchema.safeParse({ from: "2026-09-30", to: "2026-09-01" }).success).toBe(false);
    expect(rl32QuerySchema.safeParse({ from: "2025-01-01", to: "2026-01-02" }).success).toBe(false); // 367 hari
    expect(rl32QuerySchema.safeParse({ from: "2025-01-01", to: "2026-01-01" }).success).toBe(true); // 366 hari
    expect(rl32QuerySchema.safeParse({ from: "2026-09-01' OR 1=1", to: "2026-09-30" }).success).toBe(false);
  });
  it("pemetaan ruangan: tujuan ID / kecualikan / kosongkan (+ pisahDpjp); tolak ganda, kunci asing, ID bukan angka", () => {
    const ok = simpanPemetaanSchema.safeParse({
      perubahan: [
        { ruanganId: "101020101", tujuan: 3 },
        { ruanganId: "101020201", tujuan: 2, pisahDpjp: true },
        { ruanganId: "101020204", tujuan: "kecualikan" },
        { ruanganId: "101040101", tujuan: "kosongkan" },
      ],
    });
    expect(ok.success).toBe(true);
    expect(simpanPemetaanSchema.safeParse({ perubahan: [] }).success).toBe(false);
    expect(simpanPemetaanSchema.safeParse({}).success).toBe(false);
    expect(
      simpanPemetaanSchema.safeParse({ perubahan: [{ ruanganId: "1", tujuan: 2 }, { ruanganId: "1", tujuan: 3 }] }).success,
    ).toBe(false);
    expect(simpanPemetaanSchema.safeParse({ perubahan: [{ ruanganId: "1 OR 1", tujuan: 2 }] }).success).toBe(false);
    expect(simpanPemetaanSchema.safeParse({ perubahan: [{ ruanganId: "1", tujuan: "hapus" }] }).success).toBe(false);
    expect(simpanPemetaanSchema.safeParse({ perubahan: [{ ruanganId: "1", tujuan: 2.5 }] }).success).toBe(false);
    expect(simpanPemetaanSchema.safeParse({ perubahan: [{ ruanganId: "1", tujuan: 2, x: 1 }] }).success).toBe(false);
    expect(simpanPemetaanSchema.safeParse({ perubahan: [{ ruanganId: "1", tujuan: 2, pisahDpjp: "ya" }] }).success).toBe(false);
  });
  it("pemetaan SMF: ID 0–255 → jenis pelayanan / kosongkan; tolak ganda, kecualikan, kunci asing", () => {
    expect(simpanPemetaanSchema.safeParse({ smf: [{ smfId: 15, tujuan: 11 }, { smfId: 13, tujuan: "kosongkan" }] }).success).toBe(true);
    expect(simpanPemetaanSchema.safeParse({ smf: [{ smfId: 15, tujuan: 11 }, { smfId: 15, tujuan: 7 }] }).success).toBe(false);
    expect(simpanPemetaanSchema.safeParse({ smf: [{ smfId: 15, tujuan: "kecualikan" }] }).success).toBe(false);
    expect(simpanPemetaanSchema.safeParse({ smf: [{ smfId: 256, tujuan: 11 }] }).success).toBe(false);
    expect(simpanPemetaanSchema.safeParse({ smf: [{ smfId: 15, tujuan: 11, dpjp: 22 }] }).success).toBe(false);
  });
});
