import { describe, expect, it } from "vitest";
import { halamanDari, kelompokkanEpisode, petaJenisEpisode } from "./form-rm.episode";
import type { LegSasaranRow } from "./form-rm.dal";

const leg = (o: Partial<LegSasaranRow>): LegSasaranRow => ({
  NOMOR: "K1",
  NOPEN: "1001",
  RUANGAN_ID: "101010101",
  RUANG: "IGD NON BEDAH",
  JENIS_KUNJUNGAN: 2,
  MASUK: "2026-10-06T08:00:00",
  KELUAR: null,
  NORM: BigInt(123),
  NAMA: " Budi ",
  JENIS_KELAMIN: 1,
  TANGGAL_LAHIR: "1990-10-07",
  ...o,
});
const acuan = new Date(2026, 9, 7);

describe("kelompokkanEpisode", () => {
  it("satu episode per NOPEN, diwakili leg terbaru (baris urut MASUK menurun)", () => {
    const e = kelompokkanEpisode(
      [
        leg({ NOMOR: "K2", JENIS_KUNJUNGAN: 3, RUANG: "PERAWATAN ANAK", MASUK: "2026-10-06T12:00:00" }),
        leg({ NOMOR: "K1", KELUAR: "2026-10-06T11:00:00" }),
        leg({ NOMOR: "K3", NOPEN: "1002", NORM: "77", NAMA: null, JENIS_KELAMIN: 2, TANGGAL_LAHIR: null, KELUAR: "2026-10-06T09:00:00" }),
      ],
      acuan,
    );
    expect(e).toHaveLength(2);
    expect(e[0]).toMatchObject({ nopen: "1001", jenis: 3, ruang: "PERAWATAN ANAK", norm: "123", nama: "Budi", jenisKelamin: "Laki-Laki", dirawat: true, umur: "36 th 0 bl" });
    expect(e[1]).toMatchObject({ nopen: "1002", nama: "—", jenisKelamin: "Perempuan", umur: null, dirawat: false });
  });

  it("masih dilayani bila ada leg lain episode itu yang belum keluar", () => {
    const [e] = kelompokkanEpisode(
      [leg({ NOMOR: "K2", JENIS_KUNJUNGAN: 3, KELUAR: "2026-10-06T13:00:00" }), leg({ NOMOR: "K1", KELUAR: null })],
      acuan,
    );
    expect(e.dirawat).toBe(true);
  });

  it("leg berjenis di luar 1/2/3 dibuang", () => {
    expect(kelompokkanEpisode([leg({ JENIS_KUNJUNGAN: 11 })], acuan)).toEqual([]);
  });
});

describe("petaJenisEpisode", () => {
  it("menghimpun jenis per NOPEN, membuang jenis asing", () => {
    const p = petaJenisEpisode([
      { NOPEN: "1", JENIS_KUNJUNGAN: 2 },
      { NOPEN: "1", JENIS_KUNJUNGAN: "3" },
      { NOPEN: "2", JENIS_KUNJUNGAN: 5 },
    ]);
    expect([...(p.get("1") ?? [])].sort()).toEqual([2, 3]);
    expect(p.has("2")).toBe(false);
  });
});

describe("halamanDari", () => {
  it("memotong & menjepit halaman", () => {
    const xs = Array.from({ length: 45 }, (_, i) => i);
    expect(halamanDari(xs, 3, 20)).toMatchObject({ data: [40, 41, 42, 43, 44], meta: { page: 3, total: 45, totalPages: 3 } });
    expect(halamanDari(xs, 99, 20).meta.page).toBe(3);
    expect(halamanDari([], 5, 20)).toMatchObject({ data: [], meta: { page: 1, total: 0, totalPages: 1 } });
  });
});
