import { describe, expect, it } from "vitest";
import { JUDUL_POIN, SYARAT_FINAL_CONSENT, emptyConsentForm, kekuranganConsent } from "./consent.constants";
import { definisiForm } from "./registry";

/** Pesan syarat FINAL RM.03 sebelum dipindah ke consent.constants (kontrak dialog Finalkan & server). */
const PESAN_LAMA = [
  "Nama pasien / penanggung jawab yang menandatangani",
  "Tanda tangan pasien / penanggung jawab",
  "Nama petugas",
  "Tanda tangan petugas",
  "Tanggal tanda tangan",
];

describe("RM.03 syarat finalisasi (sumber tunggal tampilan & registri)", () => {
  it("isian kosong → kelima syarat kurang, urutan & teks sama dengan sebelumnya", () => {
    expect(kekuranganConsent(emptyConsentForm()).map((s) => s.label)).toEqual(PESAN_LAMA);
    expect(definisiForm("RM.03")!.syaratFinal(emptyConsentForm())).toEqual(PESAN_LAMA);
  });

  it("spasi saja dianggap kosong; terisi → syarat hilang", () => {
    const d = { ...emptyConsentForm(), pasienNama: "   ", petugasNama: "Ns. Ani", tanggalTtd: "2026-11-19" };
    expect(kekuranganConsent(d).map((s) => s.kolom)).toEqual(["pasienNama", "pasienTtd", "petugasTtd"]);
  });

  it("semua terisi → siap difinalkan", () => {
    const d = {
      ...emptyConsentForm(),
      pasienNama: "Budi",
      pasienTtd: "ttd:abc",
      petugasNama: "Ns. Ani",
      petugasTtd: "ttd:def",
      tanggalTtd: "2026-11-19",
    };
    expect(kekuranganConsent(d)).toEqual([]);
    expect(definisiForm("RM.03")!.syaratFinal(d)).toEqual([]);
  });

  it("setiap syarat menunjuk kolom yang ada di isian kosong", () => {
    const kosong = emptyConsentForm();
    for (const s of SYARAT_FINAL_CONSENT) expect(kosong).toHaveProperty(s.kolom);
  });

  it("judul poin I–X lengkap & berurutan", () => {
    expect(Object.keys(JUDUL_POIN)).toEqual(["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]);
  });
});
