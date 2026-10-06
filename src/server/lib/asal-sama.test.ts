import { describe, expect, it } from "vitest";
import { permintaanLintasSitus } from "./asal-sama";

const h = (o: Record<string, string>) => new Headers(o);

describe("permintaanLintasSitus (CSRF)", () => {
  it.each([
    ["Sec-Fetch-Site same-origin", { "sec-fetch-site": "same-origin", origin: "https://evil.example" }, false],
    ["Sec-Fetch-Site none (navigasi pengguna)", { "sec-fetch-site": "none" }, false],
    ["Sec-Fetch-Site cross-site", { "sec-fetch-site": "cross-site", host: "app.local" }, true],
    ["Sec-Fetch-Site same-site (subdomain lain)", { "sec-fetch-site": "same-site" }, true],
    ["browser lama: Origin = Host", { origin: "http://app.local:3000", host: "app.local:3000" }, false],
    ["browser lama: Origin asing", { origin: "https://evil.example", host: "app.local" }, true],
    ["Origin null (iframe sandbox)", { origin: "null", host: "app.local" }, true],
    ["Origin = X-Forwarded-Host", { origin: "https://rs.example", host: "127.0.0.1:3000", "x-forwarded-host": "rs.example" }, false],
    ["tanpa Origin & Sec-Fetch-Site (klien non-browser)", { host: "app.local" }, false],
  ])("%s", (_n, headers, lintas) => {
    expect(permintaanLintasSitus(h(headers))).toBe(lintas);
  });

  it("host publik dari env diizinkan", () => {
    const headers = h({ origin: "https://rs.example", host: "127.0.0.1:3000" });
    expect(permintaanLintasSitus(headers)).toBe(true);
    expect(permintaanLintasSitus(headers, ["rs.example"])).toBe(false);
  });
});
