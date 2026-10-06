import { describe, expect, it } from "vitest";
import { ipKlien } from "./request";
import { kunciIpKlien } from "./rate-limit";

describe("ipKlien", () => {
  it("X-Real-IP (ditimpa reverse proxy) diutamakan", () => {
    expect(ipKlien(new Headers({ "x-real-ip": "10.0.0.5", "x-forwarded-for": "1.2.3.4, 10.0.0.9" }))).toBe("10.0.0.5");
  });

  it("tanpa X-Real-IP: entri PALING KANAN X-Forwarded-For, bukan entri kiri yang bisa dikarang klien", () => {
    expect(ipKlien(new Headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.9" }))).toBe("10.0.0.9");
    expect(ipKlien(new Headers({ "x-forwarded-for": " 10.0.0.9 , " }))).toBe("10.0.0.9");
  });

  it("tanpa header → null; nilai dibatasi 64 karakter", () => {
    expect(ipKlien(new Headers())).toBeNull();
    expect(ipKlien(new Headers({ "x-real-ip": "a".repeat(500) }))).toHaveLength(64);
  });

  it("kunci rate-limit memakai aturan yang sama", () => {
    expect(kunciIpKlien(new Headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.9" }))).toBe("10.0.0.9");
    expect(kunciIpKlien(new Headers())).toBe("tanpa-ip");
  });
});
