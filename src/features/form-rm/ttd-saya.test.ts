import { describe, expect, it } from "vitest";
import { bolehSimpanSebagaiSaya, namaSama, namaSetelahTtd } from "./ttd-saya";

const SAYA = "Ns. Rina Pakaya, S.Kep";

describe("namaSama", () => {
  it("abaikan huruf besar/kecil & spasi berlebih", () => {
    expect(namaSama("  ns.  rina pakaya, s.kep ", SAYA)).toBe(true);
    expect(namaSama("Rina", SAYA)).toBe(false);
  });
  it("kosong tidak pernah sama", () => {
    expect(namaSama("", "")).toBe(false);
    expect(namaSama("  ", SAYA)).toBe(false);
  });
});

describe("namaSetelahTtd", () => {
  it("TTD saya dipakai → nama slot = nama pengguna (menimpa nama lain)", () => {
    expect(namaSetelahTtd({ nama: "dr. Budi", namaPengguna: SAYA, saya: true, isiOtomatis: false })).toBe(SAYA);
    expect(namaSetelahTtd({ nama: "", namaPengguna: SAYA, saya: true, isiOtomatis: false })).toBe(SAYA);
  });
  it("TTD baru di slot petugas bernama kosong → nama pengguna login", () => {
    expect(namaSetelahTtd({ nama: " ", namaPengguna: SAYA, saya: false, isiOtomatis: true })).toBe(SAYA);
  });
  it("nama yang sudah diketik (atau dari SIMRS) tidak ditimpa oleh TTD baru", () => {
    expect(namaSetelahTtd({ nama: "Andi", namaPengguna: SAYA, saya: false, isiOtomatis: true })).toBe("Andi");
  });
  it("slot dokter/saksi (tanpa isi otomatis) tidak diisi saat TTD baru", () => {
    expect(namaSetelahTtd({ nama: "", namaPengguna: SAYA, saya: false, isiOtomatis: false })).toBe("");
  });
  it("nama pengguna belum dimuat → tidak mengubah apa pun", () => {
    expect(namaSetelahTtd({ nama: "Andi", namaPengguna: "", saya: true, isiOtomatis: true })).toBe("Andi");
  });
});

describe("bolehSimpanSebagaiSaya", () => {
  it("hanya bila nama slot kosong atau milik pengguna", () => {
    expect(bolehSimpanSebagaiSaya("", SAYA)).toBe(true);
    expect(bolehSimpanSebagaiSaya("ns. rina pakaya, s.kep", SAYA)).toBe(true);
    expect(bolehSimpanSebagaiSaya("dr. Budi", SAYA)).toBe(false);
  });
  it("tanpa nama pengguna → tidak ditawarkan", () => {
    expect(bolehSimpanSebagaiSaya("", "")).toBe(false);
  });
});
