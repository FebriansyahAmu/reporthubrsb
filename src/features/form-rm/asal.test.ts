import { describe, expect, it } from "vitest";
import { ambilPath, normalkanAsal, pasangPath, samaNilai, statusAsal, statusAsalGabung, terisi } from "./asal";

describe("asal kolom isian", () => {
  const data = { alamat: "Jl. A", persiapan: { bahasa: ["Indonesia"] }, entries: [{ nama: "x" }] };

  it("ambilPath: objek bersarang & indeks larik; path tak sah / prototipe → undefined", () => {
    expect(ambilPath(data, "alamat")).toBe("Jl. A");
    expect(ambilPath(data, "persiapan.bahasa")).toEqual(["Indonesia"]);
    expect(ambilPath(data, "entries.0.nama")).toBe("x");
    expect(ambilPath(data, "tidakAda")).toBeUndefined();
    expect(ambilPath(data, "__proto__")).toBeUndefined();
    expect(ambilPath(data, "alamat.constructor")).toBeUndefined();
    expect(ambilPath(data, "toString")).toBeUndefined();
    expect(ambilPath(data, "a..b")).toBeUndefined();
  });

  it("pasangPath hanya mengganti kolom yang sudah ada (tak membuat kunci / mencemari prototipe)", () => {
    const d = structuredClone(data);
    expect(pasangPath(d, "persiapan.bahasa", ["Inggris"])).toBe(true);
    expect(d.persiapan.bahasa).toEqual(["Inggris"]);
    expect(pasangPath(d, "kolomBaru", "x")).toBe(false);
    expect(pasangPath(d, "persiapan.baru", "x")).toBe(false);
    expect(pasangPath(d, "__proto__.admin", true)).toBe(false);
    expect(pasangPath(d, "constructor", "x")).toBe(false);
    expect(Object.keys(d).sort()).toEqual(["alamat", "entries", "persiapan"]);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });

  it("terisi & samaNilai", () => {
    expect([terisi(""), terisi("  "), terisi([]), terisi(false), terisi(null)]).toEqual([false, false, false, false, false]);
    expect([terisi("a"), terisi(["a"]), terisi(true), terisi(0)]).toEqual([true, true, true, true]);
    expect(samaNilai(["a", "b"], ["a", "b"])).toBe(true);
    expect(samaNilai(["a", "b"], ["b", "a"])).toBe(false);
    expect(samaNilai({ a: 1, b: [2] }, { b: [2], a: 1 })).toBe(true);
    expect(samaNilai("1", 1)).toBe(false);
  });

  it("statusAsal: SIMRS selama nilai sama, diubah setelah diganti; isian lama tanpa nilai tetap SIMRS", () => {
    const asal = { alamat: { sumber: "sosial" as const, nilai: "Jl. A" }, nik: { sumber: null } };
    expect(statusAsal(asal, data, "alamat")).toBe("simrs");
    expect(statusAsal(asal, { ...data, alamat: "Jl. B" }, "alamat")).toBe("diubah");
    expect(statusAsal(asal, data, "nik")).toBe("simrs");
    expect(statusAsal(asal, data, "telp")).toBeNull();
    expect(statusAsal(asal, data, "toString")).toBeNull();
    expect(statusAsalGabung(asal, { ...data, alamat: "Jl. B" }, ["nik", "alamat"])).toBe("diubah");
    expect(statusAsalGabung(asal, data, ["telp"])).toBeNull();
  });

  it("normalkanAsal: daftar path lama, entri rusak dibuang, sumber & NOPEN divalidasi", () => {
    expect(normalkanAsal(["alamat", "__proto__", 5])).toEqual({ alamat: { sumber: null } });
    expect(normalkanAsal(null)).toEqual({});
    const n = normalkanAsal({
      alamat: { sumber: "sosial", nilai: "Jl. A", nopen: "2610070001" },
      telp: { sumber: "palsu", nilai: "1", nopen: "x' OR 1" },
      "a..b": { sumber: "sosial" },
      rusak: "x",
    });
    expect(n).toEqual({ alamat: { sumber: "sosial", nilai: "Jl. A", nopen: "2610070001" }, telp: { sumber: null, nilai: "1" } });
    expect(Object.getPrototypeOf(n)).toBe(Object.prototype);
  });
});
