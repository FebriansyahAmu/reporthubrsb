import { describe, expect, it } from "vitest";
import {
  catatanKelompokUmur,
  kelompokUmurTampil,
  kelompokUmurTerisi,
  rlEksporOpsiSchema,
} from "./rl-kelompok-umur";

const nol = () => Array.from({ length: 25 }, () => ({ lk: 0, pr: 0 }));
function baris(isi: Record<number, [number, number]>) {
  const umur = nol();
  for (const [i, [lk, pr]] of Object.entries(isi)) umur[Number(i)] = { lk, pr };
  return { umur };
}

describe("kelompokUmurTerisi", () => {
  it("kelompok terisi bila L atau P > 0 di baris mana pun, urutan tetap", () => {
    const rows = [baris({ 3: [1, 0], 12: [0, 0] }), baris({ 0: [0, 2], 24: [1, 1] })];
    expect(kelompokUmurTerisi(rows)).toEqual([0, 3, 24]);
  });
  it("tanpa baris atau semua 0 → kosong", () => {
    expect(kelompokUmurTerisi([])).toEqual([]);
    expect(kelompokUmurTerisi([baris({})])).toEqual([]);
  });
});

describe("kelompokUmurTampil", () => {
  const rows = [baris({ 7: [2, 0] })];
  it("mode semua → 25 kelompok termasuk yang 0", () => {
    expect(kelompokUmurTampil(rows, "semua")).toEqual(Array.from({ length: 25 }, (_, i) => i));
  });
  it("mode terisi → hanya kelompok berdata", () => {
    expect(kelompokUmurTampil(rows, "terisi")).toEqual([7]);
  });
});

describe("catatanKelompokUmur", () => {
  it("kosong bila semua tampil; menyebut jumlah bila sebagian", () => {
    expect(catatanKelompokUmur(25)).toBe("");
    expect(catatanKelompokUmur(12)).toBe("Kelompok umur yang bernilai 0 disembunyikan (12 dari 25 kelompok ditampilkan)");
    expect(catatanKelompokUmur(0)).toContain("tidak ditampilkan");
  });
});

describe("rlEksporOpsiSchema", () => {
  it("bawaan semua; terima terisi; tolak nilai lain", () => {
    expect(rlEksporOpsiSchema.parse({ umur: undefined }).umur).toBe("semua");
    expect(rlEksporOpsiSchema.parse({ umur: "terisi" }).umur).toBe("terisi");
    expect(rlEksporOpsiSchema.safeParse({ umur: "1' OR '1" }).success).toBe(false);
    expect(rlEksporOpsiSchema.safeParse({ umur: "" }).success).toBe(false);
  });
});
