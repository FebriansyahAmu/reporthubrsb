import { describe, expect, it } from "vitest";
import { formatHitungMundur, perluSegarkan, pesanSesiSah, sisaIdle, urlMasukKembali } from "./sesi";

describe("sesi idle (K6)", () => {
  it("sisa waktu = aktivitas terakhir + batas − sekarang", () => {
    expect(sisaIdle(1_000, 1_000, 900_000)).toBe(900_000);
    expect(sisaIdle(1_000, 901_000, 900_000)).toBe(0);
    expect(sisaIdle(1_000, 950_000, 900_000)).toBeLessThan(0);
  });

  it("hitung mundur m:ss dibulatkan ke atas, tak pernah negatif", () => {
    expect(formatHitungMundur(60_000)).toBe("1:00");
    expect(formatHitungMundur(59_001)).toBe("1:00");
    expect(formatHitungMundur(42_000)).toBe("0:42");
    expect(formatHitungMundur(1)).toBe("0:01");
    expect(formatHitungMundur(-5)).toBe("0:00");
  });

  it("pesan antar-tab divalidasi (data dari tab lain tak dipercaya mentah)", () => {
    for (const alasan of ["idle", "manual", "batas", "berakhir"]) {
      expect(pesanSesiSah({ jenis: "keluar", alasan })).toBe(true);
    }
    for (const v of [null, "keluar", {}, { jenis: "keluar" }, { jenis: "masuk", alasan: "idle" }, { jenis: "keluar", alasan: "x" }, { jenis: "keluar", alasan: "toString" }]) {
      expect(pesanSesiSah(v)).toBe(false);
    }
  });

  it("keluar otomatis → kembali ke halaman ini dengan alasannya; keluar manual → dasbor", () => {
    const lokasi = { pathname: "/form-rm/isian/abc", search: "?x=1" };
    expect(urlMasukKembali("idle", lokasi)).toBe("/?callbackUrl=%2Fform-rm%2Fisian%2Fabc%3Fx%3D1&alasan=idle");
    expect(urlMasukKembali("batas", lokasi)).toBe("/?callbackUrl=%2Fform-rm%2Fisian%2Fabc%3Fx%3D1&alasan=batas");
    expect(urlMasukKembali("berakhir", lokasi)).toBe("/?callbackUrl=%2Fform-rm%2Fisian%2Fabc%3Fx%3D1&alasan=berakhir");
    expect(urlMasukKembali("manual", lokasi)).toBe("/");
  });
});

describe("penyegaran sesi di latar", () => {
  const JEDA = 13 * 60_000;
  const T = 1_800_000_000_000;

  it("belum pernah tercatat → segarkan", () => {
    expect(perluSegarkan(0, T, JEDA)).toBe(true);
  });

  it("segarkan tepat saat jeda habis, tidak sebelumnya", () => {
    expect(perluSegarkan(T - JEDA + 1, T, JEDA)).toBe(false);
    expect(perluSegarkan(T - JEDA, T, JEDA)).toBe(true);
    expect(perluSegarkan(T - 3 * JEDA, T, JEDA)).toBe(true);
  });

  it("catatan di masa depan (jam PC diundur) → segarkan; selisih kecil antar-tab ditoleransi", () => {
    expect(perluSegarkan(T + 2 * 60_000, T, JEDA)).toBe(true);
    expect(perluSegarkan(T + 30_000, T, JEDA)).toBe(false);
  });
});
