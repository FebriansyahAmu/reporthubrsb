import { describe, expect, it } from "vitest";
import { emptyRm22Form, kekuranganRm22, type Rm22Data } from "../rm22.constants";
import { emptyRm33Form, kekuranganRm33, type Rm33Data } from "../rm33.constants";
import { JENIS_INFORMASI } from "./informasi";
import { tujuanPesan } from "./tujuan";

const semuaPesan = (d: Rm22Data) => Object.values(kekuranganRm22(d)).flat();

/** Variasi isian RM.22 yang memunculkan setiap jenis pesan kekurangan. */
function variasi(): Rm22Data[] {
  const kosong = emptyRm22Form();
  const isiSemua = Object.fromEntries(JENIS_INFORMASI.map((j) => [j.id, { isi: "x", tanda: false }])) as Rm22Data["informasi"];
  return [
    kosong,
    { ...kosong, lembar: "persetujuan" },
    { ...kosong, lembar: "penolakan", terhadap: "keluarga" },
    { ...kosong, terhadap: "diri", informasi: isiSemua },
    { ...kosong, saksi1Nama: "Ns. Ani", saksi2Ttd: "ttd:abc" },
  ];
}

describe("tujuanPesan — pesan syarat RM.22 → kolom di layar isian", () => {
  it("setiap pesan kekurangan RM.22 punya kolom tujuan", () => {
    const pesan = new Set(variasi().flatMap(semuaPesan));
    expect(pesan.size).toBeGreaterThan(40);
    const tanpa = [...pesan].filter((p) => tujuanPesan("rm22", p) === null);
    expect(tanpa).toEqual([]);
  });

  it("id tujuan sesuai komponen (awalan formulir)", () => {
    expect(tujuanPesan("rm22", "Dokter pelaksana tindakan")).toBe("rm22-pelaksana");
    expect(tujuanPesan("rm22", "Informasi 7 Risiko")).toBe("rm22-info-risiko");
    expect(tujuanPesan("rm22", "Informasi 10 Alternatif & Risiko")).toBe("rm22-info-alternatif");
    expect(tujuanPesan("rm22", "Tanda (V) penerima: Lain-lain")).toBe("rm22-info-lainLain-tanda");
    expect(tujuanPesan("rm22", "Tindakan terhadap diri sendiri atau keluarga")).toBe("rm22-terhadap");
    expect(tujuanPesan("rm22", "Tindakan yang ditolak")).toBe("rm22-tindakan");
    expect(tujuanPesan("rm22", "Saksi 2: nama")).toBe("rm22-saksi2-nama");
    expect(tujuanPesan("rm22", "Saksi 1: tanda tangan")).toBe("rm22-ttd-saksi1");
    expect(tujuanPesan("rm22", "Jenis kelamin pasien")).toBe("rm22-pasien-jk");
    expect(tujuanPesan("rm33", "Tanggal pernyataan")).toBe("rm33-tanggal");
  });

  it("setiap pesan kekurangan RM.33 punya kolom tujuan", () => {
    const kosong = emptyRm33Form();
    const isiSemua = Object.fromEntries(JENIS_INFORMASI.map((j) => [j.id, { isi: "x", tanda: false }])) as Rm33Data["informasi"];
    const variasi33: Rm33Data[] = [
      kosong,
      { ...kosong, keputusan: "setuju" },
      { ...kosong, keputusan: "menolak", terhadap: "keluarga" },
      { ...kosong, terhadap: "diri", informasi: isiSemua },
      { ...kosong, saksi1Nama: "Ns. Ani", saksi2Ttd: "ttd:abc" },
    ];
    const pesan = new Set(variasi33.flatMap((d) => Object.values(kekuranganRm33(d)).flat()));
    expect(pesan.size).toBeGreaterThan(40);
    const tanpa = [...pesan].filter((p) => tujuanPesan("rm33", p) === null);
    expect(tanpa).toEqual([]);
    expect(tujuanPesan("rm33", "Tujuan rujukan (rumah sakit / fasilitas)")).toBe("rm33-tujuan");
    expect(tujuanPesan("rm33", "Tanggal rujuk")).toBe("rm33-tgl-rujuk");
    expect(tujuanPesan("rm33", "Keputusan: setuju, menunda, atau menolak rujukan")).toBe("rm33-keputusan");
    expect(tujuanPesan("rm33", "Tanda tangan dokter")).toBe("rm33-ttd-dokter");
    expect(tujuanPesan("rm33", "Rujukan terhadap diri sendiri atau keluarga")).toBe("rm33-terhadap");
  });

  it("pesan tak dikenal → null (pemanggil jatuh ke kartu langkah)", () => {
    expect(tujuanPesan("rm22", "Sesuatu yang lain")).toBeNull();
    expect(tujuanPesan("rm22", "Informasi 3 Bukan Jenis")).toBeNull();
  });
});
