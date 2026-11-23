import { describe, expect, it } from "vitest";
import { EDUKASI_KATEGORI, emptyEdukasiForm, kekuranganEdukasi, syaratEdukasi } from "./edukasi.constants";
import { definisiForm } from "./registry";
import type { EdukasiEntry, EdukasiForm } from "@/server/modules/form-rm/form-rm.types";

/** Aturan syarat FINAL RM.21 sebelum dipindah ke edukasi.constants (kontrak dialog Finalkan & server). */
function syaratLama(d: EdukasiForm): string[] {
  const aktif = d.entries.filter((e) => e.aktif);
  if (aktif.length === 0) return ["Minimal satu kebutuhan edukasi diisi"];
  return aktif.flatMap((e) => [
    ...(e.edukatorNama.trim() === "" ? [`${e.kategori}: nama edukator`] : []),
    ...(e.tanggalJam.trim() === "" ? [`${e.kategori}: tanggal & jam edukasi`] : []),
    ...(e.sasaranTtd === "" ? [`${e.kategori}: tanda tangan sasaran edukasi`] : []),
  ]);
}

const dengan = (ubah: Record<number, Partial<EdukasiEntry>>): EdukasiForm => {
  const d = emptyEdukasiForm();
  return { ...d, entries: d.entries.map((e, i) => ({ ...e, ...ubah[i] })) };
};

describe("RM.21 syarat finalisasi (sumber tunggal tampilan & registri)", () => {
  it("tanpa kategori diberikan → satu syarat 'minimal satu', sama dengan sebelumnya", () => {
    const d = emptyEdukasiForm();
    expect(kekuranganEdukasi(d).map((s) => s.label)).toEqual(["Minimal satu kebutuhan edukasi diisi"]);
    expect(definisiForm("RM.21")!.syaratFinal(d)).toEqual(syaratLama(d));
    expect(syaratEdukasi(d)).toEqual([
      { kunci: "aktif", label: "Minimal satu kebutuhan edukasi diisi", ok: false, indeks: null, kolom: null },
    ]);
  });

  it("kategori aktif kosong → tiga syarat per kategori, urutan & teks sama dengan sebelumnya", () => {
    const d = dengan({ 0: { aktif: true }, 4: { aktif: true } });
    expect(kekuranganEdukasi(d).map((s) => s.label)).toEqual([
      "Keperawatan: nama edukator",
      "Keperawatan: tanggal & jam edukasi",
      "Keperawatan: tanda tangan sasaran edukasi",
      "Dokter: nama edukator",
      "Dokter: tanggal & jam edukasi",
      "Dokter: tanda tangan sasaran edukasi",
    ]);
    expect(definisiForm("RM.21")!.syaratFinal(d)).toEqual(syaratLama(d));
  });

  it("indeks & kunci menunjuk baris entries yang benar (bukan urutan kategori aktif)", () => {
    const d = dengan({ 2: { aktif: true, edukatorNama: "Apt. Rina" } });
    const s = syaratEdukasi(d);
    expect(s.map((x) => [x.kunci, x.indeks, x.kolom, x.ok])).toEqual([
      ["2.edukatorNama", 2, "edukatorNama", true],
      ["2.tanggalJam", 2, "tanggalJam", false],
      ["2.sasaranTtd", 2, "sasaranTtd", false],
    ]);
    expect(d.entries[2].kategori).toBe("Farmasi");
  });

  it("spasi saja pada nama/tanggal = kosong; kategori nonaktif berisi diabaikan", () => {
    const d = dengan({
      0: { aktif: true, edukatorNama: "   ", tanggalJam: " ", sasaranTtd: "ttd:abc" },
      1: { aktif: false, edukatorNama: "Gizi", tanggalJam: "2026-11-19T08:00" },
    });
    expect(kekuranganEdukasi(d).map((s) => s.label)).toEqual(["Keperawatan: nama edukator", "Keperawatan: tanggal & jam edukasi"]);
    expect(definisiForm("RM.21")!.syaratFinal(d)).toEqual(syaratLama(d));
  });

  it("semua kategori aktif lengkap → siap difinalkan", () => {
    const lengkap = { aktif: true, edukatorNama: "Ns. Ani", tanggalJam: "2026-11-19T08:00", sasaranTtd: "ttd:abc" };
    const d = dengan(Object.fromEntries(EDUKASI_KATEGORI.map((_, i) => [i, lengkap])));
    expect(kekuranganEdukasi(d)).toEqual([]);
    expect(syaratEdukasi(d)).toHaveLength(EDUKASI_KATEGORI.length * 3);
    expect(definisiForm("RM.21")!.syaratFinal(d)).toEqual([]);
  });

  it("setara aturan lama untuk semua kombinasi isian satu kategori", () => {
    const nilai = ["", " ", "x"];
    for (const aktif of [true, false])
      for (const nama of nilai)
        for (const waktu of nilai)
          for (const ttd of ["", "ttd:abc"]) {
            const d = dengan({ 3: { aktif, edukatorNama: nama, tanggalJam: waktu, sasaranTtd: ttd } });
            expect(definisiForm("RM.21")!.syaratFinal(d)).toEqual(syaratLama(d));
          }
  });
});
