import { describe, expect, it } from "vitest";
import { bentukIsian } from "./gabung";
import { daftarLabel, labelKolom, labelTerdaftar, ringkasNilai, ringkasTtd, slotTtd } from "./label-kolom";
import { DEFINISI_FORM } from "./registry";

/** Semua path daun dengan granularitas `daunBeda` (larik objek per indeks). */
function semuaDaun(o: unknown, p = ""): string[] {
  if (o && typeof o === "object" && !Array.isArray(o)) {
    return Object.entries(o).flatMap(([k, v]) => semuaDaun(v, p ? `${p}.${k}` : k));
  }
  if (Array.isArray(o) && o.length > 0 && o.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
    return o.flatMap((x, i) => semuaDaun(x, `${p}.${i}`));
  }
  return [p];
}

describe("label kolom form berlanjut", () => {
  const berlanjut = DEFINISI_FORM.filter((d) => d.berlanjut);

  it("setiap kolom ketiga form punya label terdaftar (bukan cadangan dari path)", () => {
    expect(berlanjut.map((d) => d.kode).sort()).toEqual(["RM.01", "RM.03", "RM.21"]);
    for (const def of berlanjut) {
      const data = bentukIsian(def, def.kosong());
      const tanpa = semuaDaun(data).filter((p) => labelTerdaftar(def.kode, p, data) === null);
      expect(tanpa, def.kode).toEqual([]);
    }
  });

  it("baris berkategori & baris tetap diberi nama", () => {
    expect(labelKolom("RM.21", "entries.2.edukatorNama")).toBe("Edukasi Farmasi: nama edukator");
    expect(labelKolom("RM.21", "entries.0.aktif", { entries: [{ kategori: "Keperawatan" }] })).toBe("Edukasi Keperawatan: diberikan");
    expect(labelKolom("RM.01", "skLain.1.lama")).toBe("Penyakit lain II.2: lama sakit");
    expect(labelKolom("RM.01", "skLain")).toBe("Penyakit lain (sebab kematian II)");
    expect(labelKolom("RM.03", "pjNama")).toBe("Penanggung jawab: nama");
  });

  it("path tak terdaftar → nama dari path", () => {
    expect(labelKolom("RM.03", "kolomBaruSekali")).toBe("Kolom baru sekali");
    expect(labelKolom("RM.99", "a.0.namaPetugas")).toBe("Nama petugas");
  });

  it("daftar label tanpa duplikat", () => {
    expect(daftarLabel("RM.01", ["skLain.0.teks", "skLain.0.teks", "alamat"])).toEqual(["Penyakit lain II.1", "Alamat"]);
  });

  it("slot TTD dari registri", () => {
    const rm21 = DEFINISI_FORM.find((d) => d.kode === "RM.21")!;
    const slot = slotTtd("RM.21", rm21.kosong());
    expect(slot.has("entries.0.sasaranTtd")).toBe(true);
    expect([...slotTtd("RM.03", DEFINISI_FORM.find((d) => d.kode === "RM.03")!.kosong())].sort()).toEqual(["pasienTtd", "petugasTtd"]);
    expect(slotTtd("RM.03", null).size).toBe(0);
  });

  it("ringkasan nilai & TTD tanpa gambar", () => {
    expect(ringkasNilai("")).toBe("(kosong)");
    expect(ringkasNilai(["BCG", "Campak"])).toBe("BCG, Campak");
    expect(ringkasNilai([])).toBe("(kosong)");
    expect(ringkasNilai(true)).toBe("Ya");
    expect(ringkasNilai({ teks: "DM", lama: "2 th" })).toBe("DM · 2 th");
    expect(ringkasTtd("", `ttd:${"a".repeat(25)}`)).toBe("ditandatangani");
    expect(ringkasTtd(`ttd:${"a".repeat(25)}`, `ttd:${"b".repeat(25)}`)).toBe("tanda tangan diganti");
    expect(ringkasTtd(`ttd:${"a".repeat(25)}`, "")).toBe("tanda tangan dihapus");
  });
});
