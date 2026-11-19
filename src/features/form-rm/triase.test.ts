import { describe, expect, it } from "vitest";
import { definisiForm } from "./registry";
import {
  LANGKAH_SYARAT_TRIASE,
  LANGKAH_TRIASE,
  SYARAT_FINAL_TRIASE,
  emptyTriaseForm,
  kekuranganTriase,
  ringkasLangkahTriase,
} from "./triase.constants";

const TTD = "ttd:abcdefghijklmnopqrstuvwx";
const lengkap = () => ({
  ...emptyTriaseForm(),
  kedatanganWaktu: "2026-11-19T08:00",
  caraDatang: "Sendiri" as const,
  kasus: "Non Trauma" as const,
  tdSistolik: "120",
  tdDiastolik: "80",
  nadi: "88",
  suhu: "36,8",
  saturasi: "98",
  pernapasan: "18",
  kriteria: ["5b1", "5c1"],
  emergency: "False Emergency" as const,
  waktuTriase: "2026-11-19T08:05",
  petugasNama: "Ns. Uji",
  petugasTtd: TTD,
});

describe("RM.04 Triase — syarat finalisasi (sumber tunggal)", () => {
  it("isian kosong: keempat syarat belum terpenuhi, urut sesuai daftar", () => {
    expect(kekuranganTriase(emptyTriaseForm()).map((s) => s.kolom)).toEqual(SYARAT_FINAL_TRIASE.map((s) => s.kolom));
  });

  it("kesadaran saja sudah menentukan kategori; nama/waktu spasi dianggap kosong", () => {
    const d = { ...lengkap(), kriteria: [], kesadaran: "2" as const, petugasNama: "  ", waktuTriase: " " };
    expect(kekuranganTriase(d).map((s) => s.kolom)).toEqual(["waktuTriase", "petugasNama"]);
  });

  it("registri server memakai pesan yang sama dengan panel layar isian", () => {
    const def = definisiForm("RM.04")!;
    const d = { ...lengkap(), petugasTtd: "" };
    expect(def.syaratFinal(d as never)).toEqual(kekuranganTriase(d).map((s) => s.label));
    expect(def.syaratFinal(lengkap() as never)).toEqual([]);
  });

  it("setiap syarat dipetakan ke langkah yang ada", () => {
    const ids = new Set(LANGKAH_TRIASE.map((l) => l.id));
    for (const s of SYARAT_FINAL_TRIASE) expect(ids.has(LANGKAH_SYARAT_TRIASE[s.kolom]), s.kolom).toBe(true);
  });
});

describe("RM.04 Triase — status langkah layar isian", () => {
  it("isian kosong: semua langkah 'kosong'", () => {
    const r = ringkasLangkahTriase(emptyTriaseForm());
    for (const l of LANGKAH_TRIASE) expect(r[l.id].status, l.id).toBe("kosong");
    expect(r.pemeriksaan.ket).toBe("Belum ada temuan");
  });

  it("isian lengkap: semua langkah 'lengkap'; pemeriksaan menyebut kategori hasil", () => {
    const r = ringkasLangkahTriase(lengkap());
    for (const l of LANGKAH_TRIASE) expect(r[l.id].status, l.id).toBe("lengkap");
    expect(r.pemeriksaan.ket).toBe("Hasil Kategori V");
    expect(r.ttv.ket).toBe("6 dari 6 terisi");
  });

  it("cara datang 'Lain-lain' tanpa keterangan belum dihitung", () => {
    const d = { ...emptyTriaseForm(), kedatanganWaktu: "2026-11-19T08:00", caraDatang: "Lain-lain" as const };
    expect(ringkasLangkahTriase(d).kedatangan).toEqual({ status: "sebagian", ket: "1 dari 2 terisi", kurang: 1 });
    expect(ringkasLangkahTriase({ ...d, caraDatangLain: "Rujukan puskesmas" }).kedatangan.status).toBe("lengkap");
  });

  it("tanda vital: lengkap bila 4 utama terisi (diastolik & saturasi melengkapi)", () => {
    const d = { ...emptyTriaseForm(), tdSistolik: "130", nadi: "90", suhu: "37", pernapasan: "20" };
    expect(ringkasLangkahTriase(d).ttv).toEqual({ status: "lengkap", ket: "4 dari 6 terisi", kurang: 0 });
    expect(ringkasLangkahTriase({ ...d, suhu: "", nadi: "" }).ttv.kurang).toBe(2);
    expect(ringkasLangkahTriase({ ...d, suhu: "" }).ttv.status).toBe("sebagian");
  });

  it("jenis kasus: DOA atau kasus terpilih = lengkap; kecelakaan saja = sebagian", () => {
    expect(ringkasLangkahTriase({ ...emptyTriaseForm(), doa: true }).kasus).toEqual({ status: "lengkap", ket: "DOA", kurang: 0 });
    expect(ringkasLangkahTriase({ ...emptyTriaseForm(), kasus: "Trauma", kecelakaan: ["Kecelakaan Kerja"] }).kasus.ket).toBe(
      "Trauma · 1 kecelakaan",
    );
    expect(ringkasLangkahTriase({ ...emptyTriaseForm(), kecelakaan: ["Kecelakaan Air"] }).kasus.status).toBe("sebagian");
  });
});
