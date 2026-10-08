import { describe, expect, it } from "vitest";
import { definisiForm, DEFINISI_FORM } from "./registry";
import {
  CIRI_MAKS,
  identitasSementaraSchema,
  JAM_PERINGATAN_BELUM_TERTAUT,
  ringkasSementara,
  SEBUTAN_MAKS,
  terlaluLamaBelumTertaut,
} from "./sementara";

describe("identitasSementaraSchema", () => {
  it("merapikan spasi & karakter kontrol, mengisi bawaan", () => {
    expect(identitasSementaraSchema.parse({ sebutan: "  Tn.\tX \n " })).toEqual({
      sebutan: "Tn. X",
      jenisKelamin: "",
      perkiraanUmur: "",
      ciri: "",
    });
    expect(identitasSementaraSchema.parse({ sebutan: "Ny. Y", jenisKelamin: "P", perkiraanUmur: " ±30 th ", ciri: "baju\u0000 merah" })).toEqual({
      sebutan: "Ny. Y",
      jenisKelamin: "P",
      perkiraanUmur: "±30 th",
      ciri: "baju merah",
    });
  });

  it("menolak sebutan kosong/terlalu pendek, kepanjangan, JK asing, dan kunci asing", () => {
    for (const v of [
      {},
      { sebutan: "   " },
      { sebutan: "X" },
      { sebutan: "a".repeat(SEBUTAN_MAKS + 1) },
      { sebutan: "Tn. X", ciri: "c".repeat(CIRI_MAKS + 1) },
      { sebutan: "Tn. X", jenisKelamin: "Laki-Laki" },
      { sebutan: "Tn. X", nopen: "2610080001" },
      { sebutan: 12345 },
    ]) {
      expect(identitasSementaraSchema.safeParse(v).success, JSON.stringify(v)).toBe(false);
    }
  });
});

describe("ringkasSementara & peringatan", () => {
  it("menggabung sebutan, JK, dan umur yang terisi", () => {
    expect(ringkasSementara({ sebutan: "Tn. X", jenisKelamin: "L", perkiraanUmur: "±40 tahun" })).toBe("Tn. X · L · ±40 tahun");
    expect(ringkasSementara({ sebutan: "Tn. X", jenisKelamin: "", perkiraanUmur: "" })).toBe("Tn. X");
  });

  it(`peringatan setelah ${JAM_PERINGATAN_BELUM_TERTAUT} jam`, () => {
    const dibuat = "2026-10-08T00:00:00.000Z";
    const jam = (n: number) => Date.parse(dibuat) + n * 3_600_000;
    expect(terlaluLamaBelumTertaut(dibuat, jam(JAM_PERINGATAN_BELUM_TERTAUT) - 1)).toBe(false);
    expect(terlaluLamaBelumTertaut(dibuat, jam(JAM_PERINGATAN_BELUM_TERTAUT))).toBe(true);
  });
});

describe("registri tanpaPendaftaran", () => {
  it("hanya Triase IGD yang boleh diisi sebelum pasien terdaftar", () => {
    expect(DEFINISI_FORM.filter((d) => d.tanpaPendaftaran).map((d) => d.kode)).toEqual(["RM.04"]);
  });

  it("waktu acuan triase = kedatangan, lalu waktu triase", () => {
    const def = definisiForm("RM.04")!;
    const kosong = def.kosong() as Record<string, unknown>;
    const acuan = (d: object) => def.tanpaPendaftaran!.waktuAcuan(d);
    expect(acuan({ ...kosong, kedatanganWaktu: "2026-10-08T09:00", waktuTriase: "2026-10-08T09:10" })).toBe("2026-10-08T09:00");
    expect(acuan({ ...kosong, waktuTriase: "2026-10-08T09:10" })).toBe("2026-10-08T09:10");
    expect(acuan(kosong)).toBe("");
  });
});
