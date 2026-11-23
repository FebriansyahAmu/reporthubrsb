import { describe, expect, it } from "vitest";
import { pilihRuanganAwal } from "./ruangan-awal";

const ruangan = [
  { id: "r1", kodePrefix: "ICU" },
  { id: "r2", kodePrefix: "IGD" },
  { id: "r3", kodePrefix: "VK" },
];

describe("pilihRuanganAwal", () => {
  it("URL menang (ID)", () => {
    expect(pilihRuanganAwal({ ruangan, ruanganSaya: ["r1"] }, { dariUrl: "r3", terakhir: "r1" })).toBe("r3");
  });

  it("URL boleh kode prefix, tanpa beda huruf besar/kecil", () => {
    expect(pilihRuanganAwal({ ruangan, ruanganSaya: [] }, { dariUrl: " igd ", terakhir: null })).toBe("r2");
  });

  it("URL tak dikenal / ruangan nonaktif diabaikan", () => {
    expect(pilihRuanganAwal({ ruangan, ruanganSaya: ["r2"] }, { dariUrl: "rX", terakhir: null })).toBe("r2");
  });

  it("terakhir dipakai dipertahankan bila termasuk ruangan saya", () => {
    expect(pilihRuanganAwal({ ruangan, ruanganSaya: ["r1", "r3"] }, { dariUrl: null, terakhir: "r3" })).toBe("r3");
  });

  it("terakhir dipakai di luar ruangan saya → kembali ke ruangan saya", () => {
    expect(pilihRuanganAwal({ ruangan, ruanganSaya: ["r1"] }, { dariUrl: null, terakhir: "r2" })).toBe("r1");
  });

  it("akun tanpa pemetaan → terakhir dipakai", () => {
    expect(pilihRuanganAwal({ ruangan, ruanganSaya: [] }, { dariUrl: null, terakhir: "r2" })).toBe("r2");
  });

  it("ruangan saya yang nonaktif dilewati", () => {
    expect(pilihRuanganAwal({ ruangan, ruanganSaya: ["rNonaktif", "r3"] }, { dariUrl: null, terakhir: null })).toBe("r3");
  });

  it("tanpa petunjuk apa pun → kosong (tidak lagi memilih ruangan pertama)", () => {
    expect(pilihRuanganAwal({ ruangan, ruanganSaya: [] }, { dariUrl: null, terakhir: null })).toBe("");
    expect(pilihRuanganAwal({ ruangan, ruanganSaya: [] }, { dariUrl: null, terakhir: "hilang" })).toBe("");
  });
});
