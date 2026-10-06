import { describe, expect, it } from "vitest";
import { AKSI_ISIAN, butuhAlasan, perluIzinKelola, STATUS_ISIAN, statusSetelah } from "./isian.status";

describe("mesin status isian", () => {
  it("hanya transisi yang didefinisikan yang berlaku", () => {
    const tabel = Object.fromEntries(
      STATUS_ISIAN.flatMap((s) => AKSI_ISIAN.map((a) => [`${s}+${a}`, statusSetelah(s, a)])),
    );
    expect(tabel).toEqual({
      "DRAF+FINALKAN": "FINAL",
      "DRAF+BUKA_KOREKSI": null,
      "DRAF+BATALKAN": "BATAL",
      "FINAL+FINALKAN": null,
      "FINAL+BUKA_KOREKSI": "DRAF",
      "FINAL+BATALKAN": "BATAL",
      "BATAL+FINALKAN": null,
      "BATAL+BUKA_KOREKSI": null,
      "BATAL+BATALKAN": null,
    });
  });

  it("mengubah isian FINAL butuh izin kelola; alasan wajib selain finalisasi", () => {
    expect(STATUS_ISIAN.filter(perluIzinKelola)).toEqual(["FINAL"]);
    expect(AKSI_ISIAN.filter(butuhAlasan)).toEqual(["BUKA_KOREKSI", "BATALKAN"]);
  });
});
