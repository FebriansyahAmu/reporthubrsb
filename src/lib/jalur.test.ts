import { describe, expect, it } from "vitest";
import { jalurInternal } from "./jalur";

const BS = "\\";

describe("jalurInternal", () => {
  it("menerima path internal apa adanya", () => {
    expect(jalurInternal("/dashboard")).toBe("/dashboard");
    expect(jalurInternal("/form-rm/isian/abc?tab=1#ttd")).toBe("/form-rm/isian/abc?tab=1#ttd");
    expect(jalurInternal("/")).toBe("/");
  });

  it("menolak nilai kosong, relatif, dan protocol-relative", () => {
    for (const v of [null, undefined, "", "dashboard", "//evil.com", "https://evil.com", "javascript:alert(1)"]) {
      expect(jalurInternal(v)).toBeNull();
    }
  });

  it("menolak backslash yang dibaca parser URL sebagai garis miring (open redirect)", () => {
    expect(new URL(`/${BS}evil.com`, "http://rs.local").host).toBe("evil.com"); // alasan aturan ini
    expect(jalurInternal(`/${BS}evil.com`)).toBeNull();
    expect(jalurInternal(`/${BS}/evil.com`)).toBeNull();
    expect(jalurInternal(`/a${BS}b`)).toBeNull();
  });

  it("menolak segmen titik yang dinormalkan menjadi `//host` (open redirect)", () => {
    expect(new URL("/.//evil.com", "http://x.invalid").pathname).toBe("//evil.com"); // alasan aturan ini
    for (const v of ["/.//evil.com", "/..//evil.com", "/%2e//evil.com", "/%2E%2E//evil.com", "/a/..//evil.com", "/././/evil.com"]) {
      expect(jalurInternal(v)).toBeNull();
    }
  });

  it("menormalkan segmen titik yang tetap internal", () => {
    expect(jalurInternal("/form-rm/./pasien")).toBe("/form-rm/pasien");
    expect(jalurInternal("/form-rm/../dashboard")).toBe("/dashboard");
    expect(jalurInternal("/a//b")).toBe("/a//b");
  });

  it("menolak karakter kontrol (tab/baris baru dibuang diam-diam oleh parser)", () => {
    expect(jalurInternal("/\t/evil.com")).toBeNull();
    expect(jalurInternal("/\n/evil.com")).toBeNull();
    expect(jalurInternal("/a\u0000b")).toBeNull();
  });

  it("tetap menerima backslash ter-encode (bukan pemisah path)", () => {
    expect(jalurInternal("/%5Cevil.com")).toBe("/%5Cevil.com");
  });

  it("menolak nilai terlalu panjang", () => {
    expect(jalurInternal(`/${"a".repeat(2048)}`)).toBeNull();
  });
});
