import { describe, expect, it } from "vitest";
import {
  adaPerubahan,
  ambangTingkat,
  barisLaporan,
  hariKerjaDalam,
  hariTanggal,
  hariTerlambat,
  hitungDasbor,
  hitungStreak,
  kegiatanRutin,
  ketBawaan,
  bolehDibatalkan,
  bolehDitarik,
  kodeVerifikasi,
  namaBergelar,
  ringkasBaris,
  ringkasPerubahan,
  statusSetelahSetuju,
  tahapPengajuan,
  tanggalSah,
  tingkat,
} from "./bckh.aturan";
import { saranKategori } from "./bckh.constants";
import {
  ajukanSchema,
  alasanSchema,
  idPengajuanSchema,
  logQuerySchema,
  rentangQuerySchema,
  setujuiSchema,
  simpanHariSchema,
  simpanProfilSchema,
  tokenVerifikasiSchema,
} from "./bckh.schema";
import type { HariRingkas } from "./bckh.types";

const K = (uraian: string, target: "SELESAI" | "PROSES" = "SELESAI") => ({ uraian, kategori: saranKategori(uraian), target });
const H = (tanggal: string, status: HariRingkas["status"], kegiatan: HariRingkas["kegiatan"] = [], dibuat = `${tanggal}T09:00:00+08:00`): HariRingkas => ({
  tanggal,
  status,
  keterangan: "",
  kegiatan,
  dibuat: new Date(dibuat).toISOString(),
});

describe("tanggal & format laporan", () => {
  it("tanggal kalender sah", () => {
    expect(tanggalSah("2025-11-03")).toBe(true);
    expect(tanggalSah("2026-02-30")).toBe(false);
    expect(tanggalSah("2025-13-01")).toBe(false);
    expect(tanggalSah("03/11/2025")).toBe(false);
  });

  it("HARI / TANGGAL seperti contoh", () => {
    expect(hariTanggal("2025-11-03")).toBe("Senin, 03/11/2025");
    expect(hariTanggal("2025-11-28")).toBe("Jumat, 28/11/2025");
  });

  it("hari kerja Sen–Jum dipotong di hari ini", () => {
    // November 2025: 1–2 = Sab/Min; s.d. 7 Nov → 3..7 = 5 hari kerja.
    expect(hariKerjaDalam("2025-11-01", "2025-11-30", "2025-11-07")).toEqual([
      "2025-11-03", "2025-11-04", "2025-11-05", "2025-11-06", "2025-11-07",
    ]);
    expect(hariKerjaDalam("2025-11-01", "2025-11-30", "2025-12-31")).toHaveLength(20);
    expect(hariKerjaDalam("2025-12-01", "2025-12-31", "2025-11-30")).toEqual([]);
  });

  it("terlambat bila dibuat > H+1 (tanggal WITA)", () => {
    expect(hariTerlambat("2025-11-03", new Date("2025-11-03T23:50:00+08:00").toISOString())).toBe(0);
    expect(hariTerlambat("2025-11-03", new Date("2025-11-04T23:59:00+08:00").toISOString())).toBe(0);
    expect(hariTerlambat("2025-11-03", new Date("2025-11-05T00:10:00+08:00").toISOString())).toBe(2);
    // 16:30 UTC 4 Nov = 00:30 WITA 5 Nov → terlambat 2 hari.
    expect(hariTerlambat("2025-11-03", "2025-11-04T16:30:00.000Z")).toBe(2);
  });
});

describe("baris Laporan Kinerja Harian", () => {
  const hari: HariRingkas[] = [
    H("2025-11-04", "OFF"),
    H("2025-11-03", "MASUK", [K("Monitoring Status Jaringan"), K("Fix Bug SIMRS"), K("Apel Sore")]),
    H("2025-11-27", "TUGAS_LUAR"),
    H("2025-11-05", "MASUK", [K("Fix Bug SIMRS", "PROSES")]),
    { ...H("2025-11-06", "CUTI"), keterangan: "Cuti tahunan" },
    H("2025-11-10", "REMOTE", [K("Fix Bug SIMRS"), K("Rapat zoom vendor", "PROSES")]),
    { ...H("2025-11-11", "REMOTE", [K("Monitoring Status Server")]), keterangan: "WFH" },
  ];
  const baris = barisLaporan(hari);

  it("urut tanggal, bernomor 1..n tanpa celah", () => {
    expect(baris.map((b) => [b.no, b.tanggal])).toEqual([
      [1, "2025-11-03"], [2, "2025-11-04"], [3, "2025-11-05"], [4, "2025-11-06"], [5, "2025-11-10"], [6, "2025-11-11"], [7, "2025-11-27"],
    ]);
  });

  it("remote: kegiatan utuh (tanpa baris status), KET bawaan 'REMOTE'; keterangan menggantikan KET", () => {
    expect(baris[4]).toMatchObject({ catatan: ["Fix Bug SIMRS", "Rapat zoom vendor"], target: "PROSES", ket: "REMOTE" });
    expect(baris[5]).toMatchObject({ catatan: ["Monitoring Status Server"], target: "SELESAI", ket: "WFH" });
    expect(ketBawaan("REMOTE")).toBe("REMOTE");
    expect(ketBawaan("MASUK")).toBe("");
    expect(ketBawaan("TUGAS_LUAR")).toBe("");
    expect(ketBawaan("SAKIT")).toBe("SAKIT");
  });

  it("hari masuk: kegiatan berpoin, ✓ SELESAI; ada proses → ✓ PROSES", () => {
    expect(baris[0]).toMatchObject({ catatan: ["Monitoring Status Jaringan", "Fix Bug SIMRS", "Apel Sore"], target: "SELESAI", ket: "" });
    expect(baris[2].target).toBe("PROSES");
  });

  it("OFF: catatan & KET 'OFF', tanpa centang; keterangan menggantikan KET", () => {
    expect(baris[1]).toMatchObject({ catatan: ["OFF"], target: null, ket: "OFF" });
    expect(baris[3]).toMatchObject({ catatan: ["CUTI"], target: null, ket: "Cuti tahunan" });
  });

  it("tugas luar tanpa kegiatan: 'TUGAS LUAR' ✓ SELESAI, KET kosong", () => {
    expect(baris[6]).toMatchObject({ catatan: ["TUGAS LUAR"], target: "SELESAI", ket: "" });
  });
});

describe("grafik, streak, rutin", () => {
  it("ambang kuartil & tingkat 0..4", () => {
    const a = ambangTingkat([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(a).toEqual([2, 4, 6]);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 99].map((n) => tingkat(n, a))).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
    // Semua sama → ambang tetap naik ketat (tingkat 1 untuk semua hari berkegiatan).
    expect(ambangTingkat([4, 4, 4])).toEqual([4, 5, 6]);
    expect(ambangTingkat([])).toEqual([1, 2, 3]);
  });

  it("streak: akhir pekan kosong dilewati, hari kerja kosong memutus, hari ini kosong tak memutus", () => {
    // Sen 3 – Jum 7 Nov 2025 terisi, Sab/Min kosong, Sen 10 terisi; hari ini Sel 11 belum terisi.
    const t = new Set(["2025-11-03", "2025-11-04", "2025-11-05", "2025-11-06", "2025-11-07", "2025-11-10"]);
    expect(hitungStreak(t, "2025-11-11")).toEqual({ sekarang: 6, terpanjang: 6 });
    // Rabu 12 kosong (hari kerja lewat) → rangkaian putus.
    expect(hitungStreak(t, "2025-11-13")).toEqual({ sekarang: 0, terpanjang: 6 });
    expect(hitungStreak(new Set(), "2025-11-13")).toEqual({ sekarang: 0, terpanjang: 0 });
  });

  it("kegiatan rutin: tersering dalam 90 hari, tanpa membedakan huruf besar", () => {
    const r = kegiatanRutin(
      [
        H("2025-11-03", "MASUK", [K("Monitoring Status Jaringan"), K("Apel Sore")]),
        H("2025-11-04", "MASUK", [K("monitoring  status jaringan"), K("Fix Bug SIMRS")]),
        H("2025-11-05", "MASUK", [K("Monitoring Status Jaringan"), K("Apel sore")]),
        H("2025-06-01", "MASUK", [K("Lama sekali"), K("Lama sekali"), K("Lama sekali")]),
      ],
      "2025-11-05",
    );
    expect(r.map((x) => [x.uraian, x.n])).toEqual([
      ["Monitoring Status Jaringan", 3],
      ["Apel sore", 2],
      ["Fix Bug SIMRS", 1],
    ]);
    expect(r[0].kategori).toBe("pemantauan");
  });

  it("saran kategori dari uraian", () => {
    expect(saranKategori("Monitoring Status Server")).toBe("pemantauan");
    expect(saranKategori("Rapat Pertemuan dengan IT BPJS Wilayah")).toBe("koordinasi");
    expect(saranKategori("Apel Pagi")).toBe("apel");
    expect(saranKategori("Fix Bug SIMRS")).toBe("tugas-pokok");
    expect(saranKategori("Bimtek e-Klaim")).toBe("pengembangan");
    expect(saranKategori("Membantu instalasi printer IGD")).toBe("pelayanan");
  });
});

describe("log pengisian (ringkas perubahan)", () => {
  const lama = {
    status: "MASUK" as const,
    keterangan: "",
    kegiatan: [
      { id: "a1", ...K("Monitoring Status Jaringan") },
      { id: "b2", ...K("Fix Bug SIMRS") },
      { id: "c3", ...K("Apel Sore") },
    ],
  };

  it("catatan baru", () => {
    const r = ringkasPerubahan(null, { status: "MASUK", keterangan: "", kegiatan: [K("Apel Pagi"), K("Fix Bug SIMRS")] });
    expect(r).toEqual({ kegiatan: 2, status: { dari: null, ke: "MASUK" }, tambah: 2, contoh: ["Apel Pagi", "Fix Bug SIMRS"] });
  });

  it("tambah + ubah + hapus + urutan", () => {
    const r = ringkasPerubahan(lama, {
      status: "MASUK",
      keterangan: "",
      kegiatan: [{ id: "c3", ...K("Apel Sore") }, { id: "a1", ...K("Monitoring Status Jaringan", "PROSES") }, K("Rapat koordinasi")],
    });
    expect(r).toMatchObject({ tambah: 1, ubah: 1, hapus: 1, urutan: true, kegiatan: 3 });
    expect(r.status).toBeUndefined();
  });

  it("simpan tanpa perubahan → tidak ada perubahan", () => {
    expect(adaPerubahan(ringkasPerubahan(lama, { ...lama }))).toBe(false);
    expect(adaPerubahan(ringkasPerubahan(lama, { ...lama, keterangan: "x" }))).toBe(true);
  });
});

describe("dasbor persentase", () => {
  it("kepatuhan, tepat waktu, komposisi", () => {
    const d = hitungDasbor(
      [
        H("2025-11-03", "MASUK", [K("Monitoring Status Jaringan"), K("Fix Bug SIMRS", "PROSES")]),
        H("2025-11-04", "OFF"),
        H("2025-11-05", "MASUK", [K("Apel Sore")], "2025-11-08T10:00:00+08:00"), // terlambat
        H("2025-11-08", "MASUK", [K("Fix Bug SIMRS")]), // Sabtu: bukan hari kerja
        H("2025-10-31", "MASUK", [K("Di luar periode")]),
      ],
      "2025-11-01",
      "2025-11-30",
      "2025-11-07",
    );
    expect(d.kegiatan).toBe(4);
    expect(d.selesai).toBe(3);
    expect(d.hariTercatat).toBe(4);
    expect([d.hariKerja, d.hariKerjaTerisi]).toEqual([5, 3]);
    expect(d.tepatWaktu).toBe(3);
    expect(d.perKategori).toEqual([
      { kategori: "tugas-pokok", n: 2 },
      { kategori: "pemantauan", n: 1 },
      { kategori: "apel", n: 1 },
    ]);
    expect(d.perStatus).toEqual([{ status: "MASUK", n: 3 }, { status: "OFF", n: 1 }]);
    expect(d.teratas[0]).toMatchObject({ uraian: "Fix Bug SIMRS", n: 2 });
    expect(d.perBulan).toEqual([{ bulan: "2025-11", kegiatan: 4, hari: 4 }]);
    expect(d.perHariMinggu[6]).toEqual({ hari: 6, rata: 1, hariBekerja: 1 });
  });

  it("bulan kosong tetap tampil di sumbu", () => {
    const d = hitungDasbor([], "2025-01-01", "2025-12-31", "2026-01-01");
    expect(d.perBulan).toHaveLength(12);
    expect(d.perBulan[11]).toEqual({ bulan: "2025-12", kegiatan: 0, hari: 0 });
  });
});

describe("skema input", () => {
  const dasar = { status: "MASUK", keterangan: "", kegiatan: [{ uraian: "Apel Pagi", kategori: "apel", target: "SELESAI" }], versi: null };

  it("teks dibersihkan (kontrol & spasi)", () => {
    const v = simpanHariSchema.parse({ ...dasar, kegiatan: [{ ...dasar.kegiatan[0], uraian: "  Apel\u0000   Pagi \n" }] });
    expect(v.kegiatan[0].uraian).toBe("Apel Pagi");
  });

  it("aturan status ↔ kegiatan", () => {
    expect(simpanHariSchema.safeParse({ ...dasar, kegiatan: [] }).success).toBe(false);
    expect(simpanHariSchema.safeParse({ ...dasar, status: "OFF" }).success).toBe(false);
    expect(simpanHariSchema.safeParse({ ...dasar, status: "OFF", kegiatan: [] }).success).toBe(true);
    expect(simpanHariSchema.safeParse({ ...dasar, status: "TUGAS_LUAR", kegiatan: [] }).success).toBe(true);
    // Remote = bekerja dari jauh: wajib berkegiatan seperti Masuk.
    expect(simpanHariSchema.safeParse({ ...dasar, status: "REMOTE" }).success).toBe(true);
    expect(simpanHariSchema.safeParse({ ...dasar, status: "REMOTE", kegiatan: [] }).success).toBe(false);
  });

  it("menolak field asing, kategori/status tak dikenal, uraian kosong, id ganda", () => {
    expect(simpanHariSchema.safeParse({ ...dasar, userId: "x" }).success).toBe(false);
    expect(simpanHariSchema.safeParse({ ...dasar, status: "LEMBUR" }).success).toBe(false);
    expect(simpanHariSchema.safeParse({ ...dasar, kegiatan: [{ ...dasar.kegiatan[0], kategori: "x" }] }).success).toBe(false);
    expect(simpanHariSchema.safeParse({ ...dasar, kegiatan: [{ ...dasar.kegiatan[0], uraian: "   " }] }).success).toBe(false);
    const ganda = { ...dasar.kegiatan[0], id: "abc" };
    expect(simpanHariSchema.safeParse({ ...dasar, kegiatan: [ganda, ganda] }).success).toBe(false);
    expect(simpanHariSchema.safeParse({ ...dasar, kegiatan: Array(31).fill(dasar.kegiatan[0]) }).success).toBe(false);
  });

  it("rentang & profil", () => {
    expect(rentangQuerySchema.safeParse({ dari: "2025-01-01", sampai: "2025-12-31" }).success).toBe(true);
    expect(rentangQuerySchema.safeParse({ dari: "2025-01-01", sampai: "2026-01-02" }).success).toBe(false);
    expect(rentangQuerySchema.safeParse({ dari: "2025-02-01", sampai: "2025-01-01" }).success).toBe(false);
    const p = { namaLengkap: "A", namaTtd: "A", jabatan: "", nip: "19810606 200501 2 023", unit: "", atasanNama: "", atasanNip: "" };
    expect(simpanProfilSchema.safeParse(p).success).toBe(true);
    expect(simpanProfilSchema.safeParse({ ...p, nip: "<script>" }).success).toBe(false);
  });
});

describe("persetujuan & tanda tangan (PRD §15)", () => {
  it("alur berurutan: atasan → (Mengetahui) → disetujui", () => {
    expect(tahapPengajuan("MENUNGGU_ATASAN")).toBe("ATASAN");
    expect(tahapPengajuan("MENUNGGU_MENGETAHUI")).toBe("MENGETAHUI");
    for (const s of ["DISETUJUI", "DITOLAK", "DITARIK", "DIBATALKAN"] as const) expect(tahapPengajuan(s)).toBeNull();
    expect(statusSetelahSetuju("MENUNGGU_ATASAN", false)).toBe("DISETUJUI");
    expect(statusSetelahSetuju("MENUNGGU_ATASAN", true)).toBe("MENUNGGU_MENGETAHUI");
    expect(statusSetelahSetuju("MENUNGGU_MENGETAHUI", true)).toBe("DISETUJUI");
    expect(statusSetelahSetuju("DISETUJUI", true)).toBeNull();
    expect(statusSetelahSetuju("DITOLAK", false)).toBeNull();
  });

  it("tarik hanya sebelum disahkan; batal hanya setelah disahkan", () => {
    expect(bolehDitarik("MENUNGGU_ATASAN")).toBe(true);
    expect(bolehDitarik("MENUNGGU_MENGETAHUI")).toBe(true);
    expect(bolehDitarik("DISETUJUI")).toBe(false);
    expect(bolehDitarik("DITOLAK")).toBe(false);
    expect(bolehDibatalkan("DISETUJUI")).toBe(true);
    expect(bolehDibatalkan("MENUNGGU_ATASAN")).toBe(false);
    expect(bolehDibatalkan("DIBATALKAN")).toBe(false);
  });

  it("kode verifikasi & ringkasan baris laporan", () => {
    expect(kodeVerifikasi("a1b2c3d4e5f60718")).toBe("A1B2C3D4");
    const baris = barisLaporan([
      H("2025-11-03", "MASUK", [K("Apel pagi"), K("Monitoring server")]),
      H("2025-11-04", "TUGAS_LUAR", [K("Rapat dinas di Kotamobagu")]),
      H("2025-11-05", "CUTI"),
    ]);
    // "TUGAS LUAR" di depan kegiatan & hari cuti bukan kegiatan.
    expect(ringkasBaris(baris)).toEqual({ hari: 3, kegiatan: 3 });
    expect(ringkasBaris([])).toEqual({ hari: 0, kegiatan: 0 });
  });

  it("nama bergelar akun", () => {
    expect(namaBergelar({ name: "Randya Permadi", gelarDepan: "dr.", gelarBelakang: null })).toBe("dr. Randya Permadi");
    expect(namaBergelar({ name: "Ferawati Massie", gelarDepan: null, gelarBelakang: "S.ST" })).toBe("Ferawati Massie, S.ST");
  });

  const TTD = "data:image/png;base64,iVBORw0KGgo=";

  it("skema ajukan / setujui / alasan", () => {
    const a = { bulan: "2026-10", sampaiMengetahui: true, catatan: "  ok  ", ttd: TTD };
    const r = ajukanSchema.safeParse(a);
    expect(r.success && r.data.catatan).toBe("ok");
    expect(ajukanSchema.safeParse({ ...a, catatan: undefined }).success).toBe(true);
    expect(ajukanSchema.safeParse({ ...a, bulan: "2026-13" }).success).toBe(false);
    expect(ajukanSchema.safeParse({ ...a, ttd: "data:image/svg+xml;base64,PHN2Zz4=" }).success).toBe(false);
    expect(ajukanSchema.safeParse({ ...a, ttd: "javascript:alert(1)" }).success).toBe(false);
    expect(ajukanSchema.safeParse({ ...a, userId: "lain" }).success).toBe(false);
    expect(ajukanSchema.safeParse({ ...a, catatan: "x".repeat(501) }).success).toBe(false);
    expect(setujuiSchema.safeParse({ ttd: TTD }).success).toBe(true);
    expect(setujuiSchema.safeParse({ ttd: TTD, status: "DISETUJUI" }).success).toBe(false);
    expect(alasanSchema.safeParse({ alasan: "   " }).success).toBe(false);
    expect(alasanSchema.safeParse({ alasan: "Kegiatan tgl 12 belum sesuai" }).success).toBe(true);
    expect(idPengajuanSchema.safeParse("cmh9x0abc0000xyz").success).toBe(true);
    expect(idPengajuanSchema.safeParse("../etc").success).toBe(false);
    expect(tokenVerifikasiSchema.safeParse("a".repeat(32)).success).toBe(true);
    expect(tokenVerifikasiSchema.safeParse("A".repeat(32)).success).toBe(false);
  });

  it("akun atasan di profil & direktur di pengaturan: opsional / null / id sah", () => {
    const p = { namaLengkap: "A", namaTtd: "A", jabatan: "", nip: "", unit: "", atasanNama: "", atasanNip: "" };
    expect(simpanProfilSchema.parse(p).atasanId).toBeUndefined();
    expect(simpanProfilSchema.parse({ ...p, atasanId: null }).atasanId).toBeNull();
    expect(simpanProfilSchema.safeParse({ ...p, atasanId: "cmh9x0abc" }).success).toBe(true);
    expect(simpanProfilSchema.safeParse({ ...p, atasanId: "a b" }).success).toBe(false);
  });

  it("log berhalaman: bawaan halaman 1 & semua; jenis tak dikenal ditolak", () => {
    expect(logQuerySchema.parse({})).toMatchObject({ halaman: 1, jenis: "semua" });
    expect(logQuerySchema.parse({ halaman: "3", jenis: "persetujuan" })).toMatchObject({ halaman: 3, jenis: "persetujuan" });
    expect(logQuerySchema.safeParse({ halaman: "0" }).success).toBe(false);
    expect(logQuerySchema.safeParse({ jenis: "rahasia" }).success).toBe(false);
    expect(logQuerySchema.safeParse({ sebelum: "10" }).success).toBe(false);
  });
});
