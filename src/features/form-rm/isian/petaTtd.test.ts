import { describe, expect, it } from "vitest";
import { definisiForm } from "@/features/form-rm/registry";
import type { EdukasiForm } from "@/server/modules/form-rm/form-rm.types";
import { petaTtdBaru } from "./petaTtd";

const PNG_A = "data:image/png;base64,QUFBQQ==";
const PNG_B = "data:image/png;base64,QkJCQg==";
const REF_A = "ttd:aaaaaaaaaaaaaaaaaaaaaaaa";
const REF_B = "ttd:bbbbbbbbbbbbbbbbbbbbbbbb";

describe("petaTtdBaru", () => {
  const consent = definisiForm("RM.03")!;
  const edukasi = definisiForm("RM.21")!;

  it("memetakan data-URL yang dikirim ke referensi server per slot", () => {
    const kirim = { ...consent.kosong(), pasienTtd: PNG_A, petugasTtd: PNG_B };
    const balik = { ...consent.kosong(), pasienTtd: REF_A, petugasTtd: REF_B };
    expect(Object.fromEntries(petaTtdBaru(consent, kirim, balik))).toEqual({ [PNG_A]: REF_A, [PNG_B]: REF_B });
  });

  it("referensi lama & slot kosong tidak dipetakan", () => {
    const kirim = { ...consent.kosong(), pasienTtd: REF_A, petugasTtd: "" };
    const balik = { ...consent.kosong(), pasienTtd: REF_A, petugasTtd: "" };
    expect(petaTtdBaru(consent, kirim, balik).size).toBe(0);
  });

  it("TTD sama di dua slot (dipakai ulang) → satu referensi", () => {
    const kirim = { ...consent.kosong(), pasienTtd: PNG_A, petugasTtd: PNG_A };
    const balik = { ...consent.kosong(), pasienTtd: REF_A, petugasTtd: REF_A };
    expect(Object.fromEntries(petaTtdBaru(consent, kirim, balik))).toEqual({ [PNG_A]: REF_A });
  });

  it("slot berindeks (RM.21 entries) ikut dipetakan; nilai balik bukan referensi diabaikan", () => {
    const kosong = edukasi.kosong() as EdukasiForm;
    const kirim = { ...kosong, entries: kosong.entries.map((e, i) => (i === 1 ? { ...e, sasaranTtd: PNG_B } : e)) };
    const balik = { ...kosong, entries: kosong.entries.map((e, i) => (i === 1 ? { ...e, sasaranTtd: REF_B } : e)) };
    expect(Object.fromEntries(petaTtdBaru(edukasi, kirim, balik))).toEqual({ [PNG_B]: REF_B });
    expect(petaTtdBaru(edukasi, kirim, kirim).size).toBe(0);
  });

  it("diterapkan ke state terbaru: suntingan lain selama simpan tetap utuh", () => {
    const kirim = { ...consent.kosong(), pasienTtd: PNG_A, pasienNama: "Lama" };
    const balik = { ...consent.kosong(), pasienTtd: REF_A, pasienNama: "Lama" };
    const sekarang = { ...kirim, pasienNama: "Diketik saat menyimpan" };
    const peta = petaTtdBaru(consent, kirim, balik);
    const hasil = consent.petaTtd(sekarang, (v) => peta.get(v) ?? v) as typeof sekarang;
    expect(hasil.pasienTtd).toBe(REF_A);
    expect(hasil.pasienNama).toBe("Diketik saat menyimpan");
  });
});
