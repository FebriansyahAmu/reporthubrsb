import { describe, expect, it } from "vitest";
import { tafsirCari } from "./cari";

describe("tafsirCari (kata kunci pemilih pasien)", () => {
  it("angka → No.RM / NIK / NOPEN", () => {
    expect(tafsirCari("  12345 ")).toEqual({ angka: "12345" });
    expect(tafsirCari("7106012345678901")).toEqual({ angka: "7106012345678901" });
  });

  it("huruf → nama (spasi dirapikan, tanda baca nama boleh)", () => {
    expect(tafsirCari("siti   aminah")).toEqual({ nama: "siti aminah" });
    expect(tafsirCari("O'neil")).toEqual({ nama: "O'neil" });
    expect(tafsirCari("Ni Made-Ayu, S.Pd")).toEqual({ nama: "Ni Made-Ayu, S.Pd" });
  });

  it("terlalu pendek, campuran, atau karakter asing → null", () => {
    for (const q of ["", "ab", "12", "  a ", "budi 12", "x%y", "a_b_c", "'; DROP TABLE x;--", "<script>", "abc\u0000", "1".repeat(26)]) {
      expect(tafsirCari(q), q).toBeNull();
    }
  });
});
