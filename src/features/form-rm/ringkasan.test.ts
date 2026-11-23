import { describe, expect, it } from "vitest";
import { definisiForm } from "./registry";
import {
  emptyRingkasanForm,
  hitungLamaRawat,
  kekuranganRingkasan,
  LANGKAH_RINGKASAN,
  ringkasLangkahRingkasan,
  syaratRingkasan,
} from "./ringkasan.constants";
import { hitungLamaRawat as hitungLamaRawatServer } from "@/server/modules/form-rm/isian.petakan";
import type { RingkasanForm } from "@/server/modules/form-rm/form-rm.types";

const TTD = "ttd:aaaaaaaaaaaaaaaaaaaaaaaa";
const isi = (ubah: Partial<RingkasanForm> = {}): RingkasanForm => ({ ...emptyRingkasanForm(), ...ubah });

describe("RM.01 syarat FINAL sumber tunggal", () => {
  it("pesan & urutan tetap; registri = kekuranganRingkasan", () => {
    const def = definisiForm("RM.01")!;
    const kosong = isi({ sebabKematianAktif: true });
    expect(kekuranganRingkasan(kosong).map((s) => s.label)).toEqual([
      "Nama dokter yang merawat",
      "Tanda tangan dokter yang merawat",
      "Sebab kematian langsung (I.a)",
      "Nama dokter pemberi keterangan sebab kematian",
      "Tanda tangan dokter pemberi keterangan sebab kematian",
    ]);
    for (const d of [isi(), kosong, isi({ dokterMerawatNama: "dr. Uji", dokterMerawatTtd: TTD })]) {
      expect(def.syaratFinal?.(d)).toEqual(kekuranganRingkasan(d).map((s) => s.label));
    }
  });

  it("halaman 2 hanya bersyarat bila diaktifkan; nama berisi spasi = kosong", () => {
    expect(syaratRingkasan(isi()).map((s) => s.kolom)).toEqual(["dokterMerawatNama", "dokterMerawatTtd"]);
    expect(syaratRingkasan(isi({ sebabKematianAktif: true })).map((s) => s.langkah)).toEqual(["keluar", "keluar", "kematian", "kematian", "kematian"]);
    expect(kekuranganRingkasan(isi({ dokterMerawatNama: "   ", dokterMerawatTtd: TTD })).map((s) => s.kolom)).toEqual(["dokterMerawatNama"]);
    expect(kekuranganRingkasan(isi({ dokterMerawatNama: "dr. Uji", dokterMerawatTtd: TTD }))).toEqual([]);
  });
});

describe("RM.01 status langkah layar isian", () => {
  it("6 langkah dalam 2 kelompok halaman", () => {
    expect(LANGKAH_RINGKASAN.map((l) => l.id)).toEqual(["identitas", "sosial", "perawatan", "diagnosa", "keluar", "kematian"]);
    expect(new Set(LANGKAH_RINGKASAN.map((l) => l.grup)).size).toBe(2);
  });

  it("isian kosong: semua 'kosong'; halaman 2 'Tidak dipakai' atau peringatan SIMRS meninggal", () => {
    const r = ringkasLangkahRingkasan(isi());
    expect(Object.values(r).map((x) => x.status)).toEqual(["kosong", "kosong", "kosong", "kosong", "kosong", "kosong"]);
    expect(r.kematian.ket).toBe("Tidak dipakai (pasien tidak meninggal)");
    expect(ringkasLangkahRingkasan(isi(), true).kematian.ket).toBe("SIMRS: pasien meninggal — perlu diisi");
    expect(r.keluar.kurang.map((s) => s.kolom)).toEqual(["dokterMerawatNama", "dokterMerawatTtd"]);
  });

  it("hitungan terisi per langkah (pendidikan lain-lain ikut dihitung)", () => {
    const r = ringkasLangkahRingkasan(
      isi({ alamat: "Jl. Uji", telp: "0812", pendidikanLain: "D3", agama: "Islam", tglMasuk: "2026-10-01T08:00", dpjp: "dr. Uji" }),
    );
    // `sisa` = angka lencana "n belum lengkap" (bukan jumlah syarat FINAL, yang di langkah ini nol).
    expect(r.identitas).toMatchObject({ status: "sebagian", ket: "2 dari 7 terisi", sisa: 5 });
    expect(r.sosial).toMatchObject({ status: "sebagian", ket: "2 dari 7 terisi" });
    expect(r.perawatan).toMatchObject({ status: "sebagian", ket: "2 dari 9 terisi" });
  });

  it("diagnosa: lengkap = utama + kode; kode kosong → 'sebagian'", () => {
    expect(ringkasLangkahRingkasan(isi({ diagnosaUtama: "ISPA", diagnosaUtamaKode: "J06.9", komplikasi: "-" })).diagnosa).toMatchObject({
      status: "lengkap",
      ket: "Diagnosa utama & kode terisi · 1 diagnosa lain",
    });
    expect(ringkasLangkahRingkasan(isi({ diagnosaUtama: "ISPA" })).diagnosa).toMatchObject({
      status: "sebagian",
      ket: "Kode ICD diagnosa utama belum diisi",
    });
  });

  it("keluar & kematian mengikuti syarat FINAL", () => {
    const d = isi({ dokterMerawatNama: "dr. Uji", dokterMerawatTtd: TTD, sebabKematianAktif: true, skA: "Syok sepsis" });
    const r = ringkasLangkahRingkasan(d);
    expect(r.keluar).toMatchObject({ status: "lengkap", ket: "2 dari 2 syarat terpenuhi", kurang: [] });
    expect(r.kematian).toMatchObject({ status: "sebagian", ket: "1 dari 3 syarat terpenuhi", sisa: 2 });
    expect(r.kematian.kurang.map((s) => s.kolom)).toEqual(["dokterKematianNama", "dokterKematianTtd"]);
  });

  it("lama rawat: satu fungsi untuk server (isi SIMRS) & pintasan layar", () => {
    expect(hitungLamaRawat("2026-10-01T23:00", "2026-10-04T01:00")).toBe("3");
    expect(hitungLamaRawat("2026-10-04T01:00", "2026-10-01T01:00")).toBe("");
    expect(hitungLamaRawatServer).toBe(hitungLamaRawat);
  });
});
