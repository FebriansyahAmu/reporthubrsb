import { describe, expect, it } from "vitest";
import { lipat, saring, tampilOpsi, type ComboboxGroup } from "./combobox-saring";

const grup: ComboboxGroup[] = [
  {
    label: "Ruangan saya",
    options: [{ value: "a", label: "Rawat Inap Interna", badge: "RI-INT" }],
  },
  {
    label: "Ruangan lain",
    options: [
      { value: "b", label: "Instalasi Gawat Darurat", badge: "IGD" },
      { value: "c", label: "Intensive Care Unit", badge: "ICU" },
      { value: "d", label: "Ruang Kepala ICU", badge: "KA" },
      { value: "e", label: "Poli Gigi", badge: "PG" },
    ],
  },
];

const nilai = (g: ComboboxGroup[]) => g.map((x) => [x.label, x.options.map((o) => o.value)]);

describe("combobox saring", () => {
  it("kueri kosong → semua kelompok apa adanya", () => {
    expect(nilai(saring(grup, "  "))).toEqual(nilai(grup));
  });

  it("tanpa beda huruf besar/kecil & diakritik", () => {
    expect(lipat("Ruàng ICU")).toBe("ruang icu");
    expect(nilai(saring(grup, "gIgI"))).toEqual([["Ruangan lain", ["e"]]]);
  });

  it("semua kata harus muncul, urutan bebas", () => {
    expect(nilai(saring(grup, "unit care"))).toEqual([["Ruangan lain", ["c"]]]);
    expect(saring(grup, "unit gigi")).toEqual([]);
  });

  it("kode / awal label diutamakan di atas kecocokan di tengah", () => {
    // "icu": c (kode diawali) sebelum d (hanya kata di tengah label)
    expect(nilai(saring(grup, "icu"))).toEqual([["Ruangan lain", ["c", "d"]]]);
  });

  it("kelompok tanpa hasil dibuang, urutan kelompok tetap", () => {
    expect(nilai(saring(grup, "in"))).toEqual([
      ["Ruangan saya", ["a"]],
      ["Ruangan lain", ["b", "c"]],
    ]);
  });

  it("karakter regex di kueri aman", () => {
    expect(() => saring(grup, "(icu[")).not.toThrow();
    expect(saring(grup, "(icu[")).toEqual([]);
  });

  it("tampilan opsi terpilih", () => {
    expect(tampilOpsi({ value: "c", label: "Intensive Care Unit", badge: "ICU" })).toBe("ICU — Intensive Care Unit");
    expect(tampilOpsi({ value: "x", label: "Tanpa kode" })).toBe("Tanpa kode");
  });
});
