import { describe, expect, it } from "vitest";
import {
  aturanTtd,
  INFORMASI_WAJIB,
  informasiKosong,
  JENIS_INFORMASI,
  jkDariHeader,
  kolomIsiLebar,
  kurangSaksi,
  kurangTerhadap,
  lengkapiInformasi,
  pecahBaris,
  PESAN_TTD_LAMA,
  statusDari,
  tanggalPanjang,
  umurTahun,
  yangMenyatakanKosong,
} from "./informasi";

const TTD = "ttd:abcdefghijklmnopqrstuvwx";
const TTD2 = "ttd:zyxwvutsrqponmlkjihgfedc";

describe("informasi & persetujuan — bagian bersama formulir", () => {
  it("11 jenis informasi sesuai formulir (1–10 + Lain-lain), id unik", () => {
    expect(JENIS_INFORMASI.map((j) => j.label)).toEqual([
      "Diagnosis (WD & DD)",
      "Dasar Diagnosis",
      "Tindakan Kedokteran",
      "Indikasi Tindakan",
      "Tata Cara",
      "Tujuan",
      "Risiko",
      "Komplikasi",
      "Prognosis",
      "Alternatif & Risiko",
      "Lain-lain",
    ]);
    expect(JENIS_INFORMASI.map((j) => j.no)).toEqual(["1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.", "10.", ""]);
    expect(new Set(JENIS_INFORMASI.map((j) => j.id)).size).toBe(11);
    expect(INFORMASI_WAJIB).toHaveLength(10);
  });

  it("lengkapiInformasi: data parsial/rusak → 11 baris bertipe benar", () => {
    expect(lengkapiInformasi(undefined)).toEqual(informasiKosong());
    expect(lengkapiInformasi("rusak")).toEqual(informasiKosong());
    const r = lengkapiInformasi({ risiko: { isi: "Perdarahan", tanda: true }, tujuan: { isi: 5, tanda: "ya" }, asing: { isi: "x" } });
    expect(r.risiko).toEqual({ isi: "Perdarahan", tanda: true });
    expect(r.tujuan).toEqual({ isi: "", tanda: false });
    expect(Object.keys(r)).toHaveLength(11);
    expect(r).not.toHaveProperty("asing");
  });

  it("kekurangan saksi & 'terhadap' (kata objek mengikuti formulir)", () => {
    const s = { saksi1Nama: "", saksi1Ttd: "", saksi2Nama: "", saksi2Ttd: "" };
    expect(kurangSaksi(s)).toEqual(["Minimal satu saksi (nama & tanda tangan)"]);
    expect(kurangSaksi({ ...s, saksi1Nama: "Ns. Ani", saksi1Ttd: TTD })).toEqual([]);
    expect(kurangSaksi({ ...s, saksi1Nama: "Ns. Ani" })).toEqual(["Saksi 1: tanda tangan", "Minimal satu saksi (nama & tanda tangan)"]);
    const y = yangMenyatakanKosong();
    expect(kurangTerhadap(y, "Rujukan")).toEqual(["Rujukan terhadap diri sendiri atau keluarga"]);
    expect(kurangTerhadap({ ...y, terhadap: "diri" }, "Rujukan")).toEqual([]);
    expect(kurangTerhadap({ ...y, terhadap: "keluarga" }, "Rujukan")).toHaveLength(5);
  });

  it("status langkah: lengkap / sebagian / kosong", () => {
    expect(statusDari([], false)).toBe("lengkap");
    expect(statusDari(["x"], true)).toBe("sebagian");
    expect(statusDari(["x"], false)).toBe("kosong");
  });

  it("aturanTtd generik: kunci, slot informasi, pakai ulang hanya dari slot pasangan TERSIMPAN", () => {
    const cek = aturanTtd({
      kunci: "k",
      informasi: ["a"],
      pernyataan: ["p", "q"],
      pakaiUlang: { p: "a" },
      pesanGanti: "GANTI",
    });
    const lama = { k: "1", a: TTD, p: TTD2, q: "" };
    expect(cek(lama, lama)).toBeNull();
    expect(cek(lama, { ...lama, k: "2" })).toBe("GANTI");
    expect(cek(lama, { ...lama, k: "2", p: "" })).toBeNull();
    expect(cek(lama, { ...lama, k: "2", p: TTD })).toBeNull(); // pakai ulang TTD slot a tersimpan
    expect(cek(lama, { ...lama, q: TTD })).toBe(PESAN_TTD_LAMA); // q tak boleh memakai ulang
    expect(cek(lama, { ...lama, a: TTD2, p: TTD2 })).toBe(PESAN_TTD_LAMA); // slot informasi diganti referensi lain
    expect(cek(lama, { ...lama, q: "data:image/png;base64,AAAA" })).toBeNull();
  });
});

describe("informasi & persetujuan — bantu isi & cetak", () => {
  it("umur tahun, jenis kelamin, tanggal panjang", () => {
    expect(umurTahun("45 th 3 bl")).toBe("45");
    expect(umurTahun("0 th 5 bl")).toBe("0");
    expect(umurTahun(null)).toBe("");
    expect(umurTahun("—")).toBe("");
    expect(jkDariHeader("Laki-Laki")).toBe("Laki-laki");
    expect(jkDariHeader("Perempuan")).toBe("Perempuan");
    expect(jkDariHeader("—")).toBe("");
    expect(tanggalPanjang("2026-10-09")).toBe("9 Oktober 2026");
    expect(tanggalPanjang("2026-13-01")).toBe("");
    expect(tanggalPanjang("")).toBe("");
  });

  it("kolom Isi cetak: lebar kertas untuk isi singkat, diperlebar untuk isi panjang", () => {
    const info = informasiKosong();
    expect(kolomIsiLebar(info)).toBe(false);
    for (const j of JENIS_INFORMASI) info[j.id] = { isi: "Penjelasan singkat", tanda: true };
    // Diagnosis SIMRS 3–4 baris + satu baris 2 baris masih muat lebar asli.
    info.diagnosis.isi = "Susp. close fracture 1/3 proximal femur sinistra (S72.0); HPT (I10); Ulkus dekubitus (L89.9)";
    info.alternatif.isi = "Antibiotik konservatif — risiko kambuh";
    expect(kolomIsiLebar(info)).toBe(false);
    for (const j of JENIS_INFORMASI) info[j.id].isi = "x".repeat(85);
    expect(kolomIsiLebar(info)).toBe(true);
    expect(kolomIsiLebar({ risiko: { isi: "a\nb\nc\nd\ne\nf", tanda: true } })).toBe(true);
    expect(kolomIsiLebar(undefined)).toBe(false);
  });

  it("pecah baris di batas kata", () => {
    expect(pecahBaris("Appendektomi", 46)).toEqual(["Appendektomi", ""]);
    const [a, b] = pecahBaris("Laparotomi eksplorasi dengan reseksi usus dan anastomosis end to end", 46);
    expect(a.length).toBeLessThanOrEqual(46);
    expect(`${a} ${b}`).toBe("Laparotomi eksplorasi dengan reseksi usus dan anastomosis end to end");
    expect(a.endsWith(" ")).toBe(false);
    expect(pecahBaris("x".repeat(60), 46)).toEqual(["x".repeat(46), "x".repeat(14)]);
  });
});
