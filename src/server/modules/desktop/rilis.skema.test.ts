import { describe, expect, it } from "vitest";
import { bandingVersi, jawabanPembaruan, manifestSchema, paramPembaruanSchema, type ManifestRilis } from "./rilis.skema";

const SIG = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXk=";
const manifest: ManifestRilis = {
  versi: "1.2.0",
  catatan: "Perbaikan cetak",
  terbit: "2026-10-08T01:00:00Z",
  platform: { "windows-x86_64": { berkas: "audittrail-rsboltim_1.2.0_x64-setup.exe", tandaTangan: SIG } },
};

describe("rilis aplikasi desktop", () => {
  it("bandingkan versi secara numerik (bukan leksikal)", () => {
    expect(bandingVersi("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(bandingVersi("1.0.0", "1.0.0")).toBe(0);
    expect(bandingVersi("1.0.1", "1.0.10")).toBeLessThan(0);
  });

  it("versi lebih baru → jawaban format updater Tauri dengan URL dari origin konfigurasi", () => {
    expect(jawabanPembaruan(manifest, { target: "windows", arch: "x86_64", versi: "1.1.9" }, "http://10.0.0.5:3000")).toEqual({
      version: "1.2.0",
      notes: "Perbaikan cetak",
      pub_date: "2026-10-08T01:00:00Z",
      url: "http://10.0.0.5:3000/api/desktop/unduh/audittrail-rsboltim_1.2.0_x64-setup.exe",
      signature: SIG,
    });
  });

  it("versi sama/lebih baru di klien atau platform tanpa paket → tidak ada pembaruan", () => {
    expect(jawabanPembaruan(manifest, { target: "windows", arch: "x86_64", versi: "1.2.0" }, "http://x")).toBeNull();
    expect(jawabanPembaruan(manifest, { target: "windows", arch: "x86_64", versi: "2.0.0" }, "http://x")).toBeNull();
    expect(jawabanPembaruan(manifest, { target: "windows", arch: "aarch64", versi: "1.0.0" }, "http://x")).toBeNull();
  });

  it("parameter endpoint ketat (target/arsitektur dikenal, versi a.b.c)", () => {
    expect(paramPembaruanSchema.safeParse({ target: "windows", arch: "x86_64", versi: "1.0.0" }).success).toBe(true);
    for (const p of [
      { target: "linux", arch: "x86_64", versi: "1.0.0" },
      { target: "windows", arch: "arm", versi: "1.0.0" },
      { target: "windows", arch: "x86_64", versi: "1.0" },
      { target: "windows", arch: "x86_64", versi: "1.0.0-beta" },
      { target: "windows", arch: "x86_64", versi: "../../etc" },
    ]) {
      expect(paramPembaruanSchema.safeParse(p).success).toBe(false);
    }
  });

  it("manifest ketat: nama berkas tanpa path, tanda tangan base64, kunci liar ditolak", () => {
    expect(manifestSchema.safeParse(manifest).success).toBe(true);
    const ubah = (o: object) => ({ ...manifest, ...o });
    for (const m of [
      ubah({ versi: "1.2" }),
      ubah({ terbit: "kemarin" }),
      ubah({ lain: 1 }),
      ubah({ platform: { "windows-x86_64": { berkas: "../.env", tandaTangan: SIG } } }),
      ubah({ platform: { "windows-x86_64": { berkas: "a/b.exe", tandaTangan: SIG } } }),
      ubah({ platform: { "windows-x86_64": { berkas: "setup.ps1", tandaTangan: SIG } } }),
      ubah({ platform: { "windows-x86_64": { berkas: "a.exe", tandaTangan: "<script>" } } }),
      ubah({ platform: { "linux-x86_64": { berkas: "a.exe", tandaTangan: SIG } } }),
    ]) {
      expect(manifestSchema.safeParse(m).success).toBe(false);
    }
  });
});
