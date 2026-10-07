import { describe, expect, it } from "vitest";
import { formatHitungMundur, pesanSesiSah, sisaIdle, urlMasukKembali } from "./sesi";

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
    expect(pesanSesiSah({ jenis: "keluar", alasan: "idle" })).toBe(true);
    expect(pesanSesiSah({ jenis: "keluar", alasan: "manual" })).toBe(true);
    for (const v of [null, "keluar", {}, { jenis: "keluar" }, { jenis: "masuk", alasan: "idle" }, { jenis: "keluar", alasan: "x" }]) {
      expect(pesanSesiSah(v)).toBe(false);
    }
  });

  it("idle → kembali ke halaman ini setelah login; keluar manual → dasbor", () => {
    const lokasi = { pathname: "/form-rm/isian/abc", search: "?x=1" };
    expect(urlMasukKembali("idle", lokasi)).toBe("/?callbackUrl=%2Fform-rm%2Fisian%2Fabc%3Fx%3D1&alasan=idle");
    expect(urlMasukKembali("manual", lokasi)).toBe("/");
  });
});
